import type { NextApiRequest, NextApiResponse } from "next";

/**
 * API: /api/chat
 * - Forwards conversation to OpenRouter chat completions (streaming)
 * - Uses process.env.OPENROUTER_API_KEY
 * - Sends model: google/gemini-2.0-flash-exp:free (or change to meta-llama/llama-3-8b-instruct:free)
 * - Injects Operations Room fields into system prompt
 *
 * The upstream provider (OpenRouter) uses an OpenAI-like streaming SSE format.
 * We parse "data: ..." chunks and forward the plain text content to the client.
 */

type ReqBody = {
  message: string;
  mode?: string;
  authorsNote?: string;
  aiInstructions?: string;
  plotEssentials?: string;
  storySummary?: string;
  health?: number;
  energy?: number;
  stats?: { [k: string]: any };
  history?: any[];
  scenarioId?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const body = req.body as ReqBody;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "Missing OPENROUTER_API_KEY in environment." });

  // Base URL as requested
  const BASE_URL = "https://openrouter.ai/api/v1";
  const model = "google/gemini-2.0-flash-exp:free"; // or "meta-llama/llama-3-8b-instruct:free"

  const systemParts: string[] = [
    "You are an immersive RPG Engine and Narrator. ALWAYS write in second-person (address the player as 'You').",
    "Output ONLY story content — no 'Assistant:' prefixes, no explanation, and no JSON. Keep short cinematic paragraphs.",
  ];
  if (body.authorsNote) systemParts.push(`Author's Note: ${body.authorsNote}`);
  if (body.aiInstructions) systemParts.push(`AI Instructions: ${body.aiInstructions}`);
  if (body.plotEssentials) systemParts.push(`Plot Essentials: ${body.plotEssentials}`);
  if (body.storySummary) systemParts.push(`Story Summary: ${body.storySummary}`);

  // Add some quick status context
  systemParts.push(`Context: Health=${Math.round((body.health ?? 1) * 100)}%, Energy=${Math.round((body.energy ?? 1) * 100)}%`);

  const systemPrompt = systemParts.join("\n\n");

  // Build message array for the model
  const messages: any[] = [
    { role: "system", content: systemPrompt },
  ];

  // Include short recent history (if provided)
  if (Array.isArray(body.history)) {
    body.history.slice(-6).forEach((h) => {
      // keep role flavor: dialogues as user content, others as assistant narrative
      const role = h.type === "dialogue" ? "user" : "assistant";
      messages.push({ role, content: h.text ?? h });
    });
  }

  // Append user instruction including mode
  const userText = `Mode: ${body.mode ?? "ACT"}\nInstruction: Continue the scene using the player's action: "${body.message}". Do NOT repeat the prompt, do NOT prefix responses.`;
  messages.push({ role: "user", content: userText });

  // Prepare streaming response to client
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  try { res.flushHeaders?.(); } catch (e) {}

  try {
    const upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
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
      res.write(`(upstream error) ${txt}`);
      return res.end();
    }

    // Read upstream stream and forward parsed content chunks
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        // OpenRouter/OpenAI streams use SSE-style "data: {...}\n\n"
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? ""; // last partial stays in buffer

        for (const part of parts) {
          const line = part.trim();
          if (!line) continue;
          // match "data: { ... }" lines (may include multiple lines)
          const m = line.match(/data:\s*(.*)/s);
          if (!m) continue;
          const payload = m[1].trim();
          if (payload === "[DONE]") {
            res.write("\n");
            break;
          }
          try {
            const parsed = JSON.parse(payload);
            // parsed.choices[0].delta.content or parsed.choices[0].text
            const delta = parsed.choices?.[0]?.delta;
            const text = delta?.content ?? parsed.choices?.[0]?.text ?? "";
            if (text) {
              res.write(text);
              try { res.flush?.(); } catch (e) {}
            }
          } catch (err) {
            // fallback — forward raw payload minimally
            res.write(payload);
            try { res.flush?.(); } catch (e) {}
          }
        }
      }
    }

    return res.end();
  } catch (err: any) {
    console.error("chat stream error", err);
    if (!res.writableEnded) {
      res.write(`(server error) ${err?.message ?? String(err)}`);
      res.end();
    }
  }
}
