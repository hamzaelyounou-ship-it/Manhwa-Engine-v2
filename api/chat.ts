import { IncomingMessage, ServerResponse } from "http";

/**
 * Serverless API route (node http style) that proxies OpenRouter streaming completions.
 * - Expects POST JSON body with fields:
 *   - mode: "do" | "say" | "think" | "story" | "continue"
 *   - message: string (user message or empty for continue)
 *   - ... optional context (worldSummary, authorsNote, etc.)
 *
 * - Uses process.env.OPENROUTER_API_KEY
 * - Forwards the streaming response to the client as SSE (data: JSON\n\n chunks).
 *
 * Important: This is intentionally conservative and forwards the provider's stream as-is.
 * The frontend uses eventsource-parser to parse incoming SSE into usable text pieces.
 */

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  let raw = "";
  for await (const chunk of req) raw += chunk;
  let body: any;
  try {
    body = JSON.parse(raw);
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

  // Build system prompt enforcing 5+ sentence descriptive narration
  const systemPromptParts = [
    `You are an immersive Manhwa-style game narrator (second-person).`,
    `Respond in rich, descriptive paragraphs of at least FIVE sentences per turn.`,
    `Do NOT prefix replies with "Assistant:" or reproduce the user's prompt.`,
    `Follow the user's chosen mode: ${body.mode || "story"}.`,
  ];

  if (body.authorsNote) {
    systemPromptParts.push(`Author's Note: ${body.authorsNote}`);
  }
  if (body.worldSummary) {
    systemPromptParts.push(`World Summary: ${body.worldSummary}`);
  }

  const systemPrompt = systemPromptParts.join("\n");

  // Build the input to the model: combine system prompt + user message
  const userInput = `${systemPrompt}\n\nUser: ${body.message ?? ""}`;

  // Call OpenRouter completions endpoint with streaming
  try {
    const providerRes = await fetch("https://openrouter.ai/api/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct:free", // fallback model choice
        input: userInput,
        stream: true,
        max_tokens: 2048,
        // You can customize temperature, top_p, etc.
      }),
    });

    if (!providerRes.ok || !providerRes.body) {
      const errTxt = await providerRes.text();
      res.statusCode = providerRes.status || 500;
      res.end(`Upstream error: ${errTxt}`);
      return;
    }

    // Set SSE headers for client
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    // Pipe provider stream through to the client. Provider should already be sending SSE-style chunks.
    const reader = providerRes.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        // Forward chunk directly. The frontend will parse events with eventsource-parser.
        res.write(chunk);
      }
    }

    // End stream
    res.write("\n");
    res.end();
  } catch (err: any) {
    res.statusCode = 500;
    res.end(`Server error: ${err?.message ?? String(err)}`);
  }
}
