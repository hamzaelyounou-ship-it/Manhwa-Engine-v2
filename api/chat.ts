import type { NextApiRequest, NextApiResponse } from "next";

/**
 * POST body expected:
 * {
 *   message: string,
 *   mode: "ACT"|"SPEAK"|"SYSTEM",
 *   worldInfo: { character, location, health, energy },
 *   history: Array<{ id?, text, type }>,
 *   authorsNote?: string,
 *   aiInstructions?: string,
 *   scenarioId?: string | null
 * }
 *
 * Streams back raw story text (no assistant tags). The client appends chunks directly.
 */

type Body = {
  message: string;
  mode?: "ACT" | "SPEAK" | "SYSTEM";
  worldInfo?: any;
  history?: any[];
  authorsNote?: string;
  aiInstructions?: string;
  scenarioId?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const body = req.body as Body;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: "OPENAI_API_KEY not set" });

  // Compose system prompt
  const systemBase = `You are an immersive RPG Engine and Narrator. ALWAYS write in second-person (address the player as "You"). 
Output must be only story content (no "Assistant:" prefixes, no explanation, no JSON). Use vivid, present-tense language. Keep paragraphs short and cinematic.`;

  const authorsNoteText = body.authorsNote ? `\n\nAuthor's Note: ${body.authorsNote}` : "";
  const aiInstrText = body.aiInstructions ? `\n\nAI Rules: ${body.aiInstructions}` : "";

  const world = body.worldInfo
    ? `\n\nContext:\nCharacter: ${body.worldInfo.character ?? "You"}\nLocation: ${body.worldInfo.location ?? "Unknown"}\nHealth: ${Math.round((body.worldInfo.health ?? 1) * 100)}%\nEnergy: ${Math.round((body.worldInfo.energy ?? 1) * 100)}%`
    : "";

  const systemPrompt = systemBase + authorsNoteText + aiInstrText + world;

  // Build messages
  const messages: any[] = [
    { role: "system", content: systemPrompt },
  ];

  // include short history as context (if present)
  if (Array.isArray(body.history)) {
    body.history.slice(-6).forEach((h) => {
      // treat earlier narration as assistant content, dialogues as user content for flavor
      if (h.type === "dialogue") messages.push({ role: "user", content: h.text });
      else messages.push({ role: "assistant", content: h.text });
    });
  }

  // final user instruction
  const userContent = `Mode: ${body.mode ?? "ACT"}\nInstruction: Continue the story in second person, using the player's action: "${body.message}". Do NOT repeat the prompt. Do NOT prefix lines.`;
  messages.push({ role: "user", content: userContent });

  // Stream using OpenAI ChatCompletions API
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // flush headers if supported
  try { res.flushHeaders?.(); } catch (e) { /* ignore */ }

  // call upstream
  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // change if you prefer another model
        messages,
        temperature: 0.8,
        max_tokens: 700,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text();
      res.write(`(upstream error) ${txt}`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    // Minimal buffering to parse "data: " chunks
    let buffer = "";

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        // split on data: (OpenAI SSE)
        const parts = buffer.split("\n\n");
        // keep last partial
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line) continue;
          // openai sends lines like: "data: { ... }"
          const m = line.match(/^data:\s*(.*)$/s);
          if (!m) continue;
          const data = m[1].trim();
          if (data === "[DONE]") {
            // end
            res.write("\n");
            break;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const text = delta?.content ?? parsed.choices?.[0]?.text ?? "";
            if (text) {
              // forward text chunk
              res.write(text);
              // attempt flush
              try { res.flush?.(); } catch (e) {}
            }
          } catch (err) {
            // if JSON parse fails, forward raw chunk as fallback
            res.write(data);
            try { res.flush?.(); } catch (e) {}
          }
        }
      }
    }

    return res.end();
  } catch (err: any) {
    console.error("stream error:", err);
    if (!res.writableEnded) {
      res.write(`(server error) ${err?.message ?? String(err)}`);
      res.end();
    }
  }
}
