import { IncomingMessage, ServerResponse } from "http";

/**
 * Serverless handler that proxies OpenRouter streaming completions.
 * - Accepts POST JSON: { mode, message, plot: {title,summary,opening}, rules: { aiInstructions, authorsNote } }
 * - Builds a strict system prompt that enforces >=5 descriptive sentences.
 * - Calls OpenRouter completions with streaming and forwards provider stream as SSE-like chunks.
 *
 * Note: Ensure OPENROUTER_API_KEY is set in environment.
 */

async function streamProviderToClient(providerRes: Response, res: ServerResponse) {
  // providerRes.body is a ReadableStream (Web)
  const reader = providerRes.body!.getReader();
  const decoder = new TextDecoder();

  // set SSE headers on client response
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  let done = false;
  while (!done) {
    const { value, done: d } = await reader.read();
    done = d;
    if (value) {
      // forward chunk as data: <chunk>\n\n so client eventsource-parser receives event.data = chunk
      const chunk = decoder.decode(value, { stream: true });
      // sanitize: remove any lone "event:" that might confuse parser
      // send chunk as-is but wrapped
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
  }

  // signal done
  res.write("data: [DONE]\n\n");
  res.end();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  let bodyRaw = "";
  for await (const chunk of req) bodyRaw += chunk;
  let body: any;
  try {
    body = JSON.parse(bodyRaw);
  } catch (err) {
    res.statusCode = 400;
    res.end("Invalid JSON");
    return;
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    res.statusCode = 500;
    res.end("Missing OPENROUTER_API_KEY");
    return;
  }

  // Build system prompt enforcing >=5 sentences and second-person narration
  const pieces: string[] = [
    "You are an immersive Manhwa-style narrative engine. Write in second-person ('You ...').",
    "Every response MUST be a rich, descriptive paragraph containing at least FIVE complete sentences.",
    "Do NOT prefix with 'Assistant:' or repeat or echo the user's exact prompt.",
    `Mode: ${body.mode || "story"}.`,
  ];

  if (body.rules?.aiInstructions) pieces.push(`AI Instructions: ${body.rules.aiInstructions}`);
  if (body.rules?.authorsNote) pieces.push(`Author's Note: ${body.rules.authorsNote}`);
  if (body.plot?.title) pieces.push(`World Title: ${body.plot.title}`);
  if (body.plot?.summary) pieces.push(`World Summary: ${body.plot.summary}`);
  if (body.plot?.opening) pieces.push(`Opening Scene: ${body.plot.opening}`);
  if (body.message) pieces.push(`User Input: ${body.message}`);

  const systemPrompt = pieces.join("\n");

  // Build model prompt input
  const requestBody = {
    model: "meta-llama/llama-3-8b-instruct:free",
    input: systemPrompt,
    stream: true,
    max_tokens: 2048,
    temperature: 0.8,
  };

  try {
    const providerRes = await fetch("https://openrouter.ai/api/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!providerRes.ok || !providerRes.body) {
      const txt = await providerRes.text();
      res.statusCode = providerRes.status || 500;
      res.end(`Upstream error: ${txt}`);
      return;
    }

    // Stream provider response to client wrapped as SSE-friendly chunks
    await streamProviderToClient(providerRes, res);
    return;
  } catch (err: any) {
    res.statusCode = 500;
    res.end(`Server error: ${err?.message ?? String(err)}`);
    return;
  }
}
