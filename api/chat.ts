import type { NextApiRequest, NextApiResponse } from "next";

/**
 * api/chat.ts
 * - POST JSON payload:
 *   {
 *     mode: "do"|"say"|"think"|"story"|"continue",
 *     message: string, // or "[CONTINUE]"
 *     worldSummary: string,
 *     history?: array,
 *     scenarioId?: string|null
 *   }
 *
 * - Uses OPENROUTER API key from process.env.OPENROUTER_API_KEY
 * - Default model: meta-llama/llama-3-8b-instruct:free (swap if needed)
 * - Streams plain text chunks to client (res.write) as they arrive
 */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  const body = req.body;

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });

  // Validate
  const mode = body.mode ?? "story";
  const message = body.message ?? "";
  const worldSummary = (body.worldSummary ?? "").toString();

  // Strong system prompt: enforce second-person, sustained descriptive paragraphs (4-5 sentences),
  // and deeply integrate the worldSummary into reasoning.
  const systemPrompt = [
    "You are an immersive narrative engine. Always reply in second-person (address the player as 'You').",
    "Produce rich, descriptive paragraphs of at least 4–5 sentences for each response. Use sensory detail, internal state, and consequences. Do not output single-sentence replies.",
    "Do NOT prefix with 'Assistant:' or metadata. Do not output JSON or code blocks; only narrative text.",
    "Integrate the world context below deeply into the scene (use world-specific terms, systems, ranks, and mechanics where relevant).",
    `WORLD SUMMARY / PLOT ESSENTIALS:\n${worldSummary}`,
    `MODE: ${mode.toUpperCase()}`,
    mode === "continue" ? "USER COMMAND: Continue the narration organically, building on prior events." : `USER ACTION/INPUT: ${message}`,
    "Respond as the scene's narrator / game engine, continuing the story accordingly."
  ].join("\n\n");

  // Build messages
  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: (mode === "continue") ? "Continue the scene." : message }
  ];

  // Upstream request to OpenRouter ChatCompletions (stream)
  const model = "meta-llama/llama-3-8b-instruct:free";
  const OPENROUTER_URL = "https://openrouter.ai/api/v1";

  try {
    const upstream = await fetch(`${OPENROUTER_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.8,
        max_tokens: 800,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text();
      res.status(502).write(`(upstream error) ${txt}`);
      return res.end();
    }

    // Setup response for streaming
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    try { res.flushHeaders?.(); } catch {}

    // Read upstream stream and forward parsed textual deltas
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // split SSE-style events
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line) continue;
        // expect "data: {...}"
        const m = line.match(/data:\s*(.*)/s);
        if (!m) continue;
        const data = m[1].trim();
        if (data === "[DONE]") {
          res.write("data: [DONE]\n\n");
          try { res.flush?.(); } catch {}
          break;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          // delta.content pieces for modern chat completions
          const text = (delta?.content) ?? parsed.choices?.[0]?.text ?? "";
          if (text) {
            // send as SSE data: chunk
            res.write(`data: ${text}\n\n`);
            try { res.flush?.(); } catch {}
          }
        } catch (err) {
          // fallback: forward raw data as-is
          res.write(`data: ${data}\n\n`);
          try { res.flush?.(); } catch {}
        }
      }
    }

    // end
    res.end();
  } catch (err: any) {
    console.error("chat error", err);
    if (!res.writableEnded) {
      res.status(500).end(`(server error) ${err?.message ?? String(err)}`);
    }
  }
}
