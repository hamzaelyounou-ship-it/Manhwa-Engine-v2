import { IncomingMessage, ServerResponse } from "http";

/**
 * api/chat.ts
 *
 * Node-style serverless function that proxies OpenRouter streaming completions.
 * - Accepts POST JSON with keys: mode, message, worldSummary, openingScene, title,
 *   charName, charClass, charBackground, aiInstructions, authorsNote, history.
 * - Builds a strict system prompt requiring at least 5 descriptive sentences per response.
 * - Calls OpenRouter streaming completions and forwards provider stream to client.
 *
 * IMPORTANT:
 * - Set process.env.OPENROUTER_API_KEY in your environment.
 * - The frontend expects SSE-style data chunks; this function forwards the provider stream directly.
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

  // Build system prompt enforcing minimum 5-sentence descriptive paragraphs
  const lines: string[] = [];
  lines.push("You are a cinematic Manhwa-style narrative engine. Always write in second-person ('You...').");
  lines.push("Every response must be rich and descriptive, containing at least FIVE complete sentences.");
  lines.push("Do NOT prefix replies with 'Assistant:' or repeat the user's prompt.");
  lines.push(`Mode: ${body.mode || "story"}.`);
  if (body.authorsNote) lines.push(`Author's Note: ${body.authorsNote}`);
  if (body.aiInstructions) lines.push(`AI Instructions: ${body.aiInstructions}`);
  if (body.title) lines.push(`World Title: ${body.title}`);
  if (body.worldSummary) lines.push(`World Summary: ${body.worldSummary}`);
  if (body.openingScene) lines.push(`Opening Scene: ${body.openingScene}`);
  if (body.charName || body.charClass || body.charBackground) {
    lines.push(
      `Character: ${body.charName || "Unknown"} (${body.charClass || "Unknown"}). Background: ${body.charBackground || "—"}`
    );
  }
  if (body.history && Array.isArray(body.history)) {
    lines.push(`Recent History: ${body.history.slice(-6).join(" | ")}`);
  }

  const systemPrompt = lines.join("\n");

  // Build the model input
  const userInput = `${systemPrompt}\n\nUser: ${body.message ?? ""}\n\nRespond with a minimum of 5 descriptive sentences.`;

  // Call OpenRouter streaming completions endpoint
  try {
    const providerRes = await fetch("https://openrouter.ai/api/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct:free", // fallback stable model
        input: userInput,
        stream: true,
        max_tokens: 2048,
        temperature: 0.8,
      }),
    });

    if (!providerRes.ok || !providerRes.body) {
      const txt = await providerRes.text();
      res.statusCode = providerRes.status || 500;
      res.end(`Upstream error: ${txt}`);
      return;
    }

    // Forward SSE-compatible stream directly to client
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const reader = providerRes.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        // Forward provider chunk straight to client; frontend parses with eventsource-parser.
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
