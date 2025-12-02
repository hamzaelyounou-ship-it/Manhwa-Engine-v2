// api/chat.ts
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * This endpoint:
 *  - accepts POST with { message, mode, worldInfo, history }
 *  - constructs a system prompt to force the model to be an "immersive RPG Engine" (second-person)
 *  - calls OpenAI chat completion with stream:true and proxies chunks to the client as raw text
 *
 * Important: set process.env.OPENAI_API_KEY
 */

type BodyPayload = {
  message: string;
  mode?: "ACT" | "SPEAK" | "SYSTEM";
  worldInfo?: any;
  history?: { text: string; type?: string }[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const body = req.body as BodyPayload;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

  // Build a robust system prompt that enforces second-person narration and engine rules
  const systemPrompt = [
    {
      role: "system",
      content:
        "You are an immersive RPG Engine and Narrator. ALWAYS write in second-person perspective (address the player as 'You'). " +
        "The output must be pure story text — do NOT prefix lines with 'Assistant:' or repeat the user's prompt. " +
        "Do NOT output JSON or explanation. Answer as the game engine continuing the scene, using short paragraphs and occasional inline actions. " +
        "When the user chooses modes, treat them as follows: 'ACT' -> the user performs a physical action; 'SPEAK' -> the user speaks aloud; 'SYSTEM' -> in-world system queries or checks. " +
        "If the user asks the system for inventory/stat queries, output a concise in-world description. Keep the language vivid, present-tense, second-person."
    }
  ];

  // Convert incoming history into messages for context (optional, short)
  const messages = [...systemPrompt];
  if (body.history && Array.isArray(body.history)) {
    body.history.slice(-8).forEach((h) => {
      const role = h.type === "dialogue" ? "user" : "assistant";
      messages.push({ role, content: h.text });
    });
  }

  // Add a helpful "context" block referencing current world state
  const worldInfoText = `World Info:\nCharacter: ${body.worldInfo?.character ?? "You"}\nLocation: ${body.worldInfo?.location ?? "Unknown"}\nHealth: ${Math.round((body.worldInfo?.health ?? 1) * 100)}%\nEnergy: ${Math.round((body.worldInfo?.energy ?? 1) * 100)}%\nAnchors: ${JSON.stringify(body.worldInfo?.anchors ?? {})}`;

  messages.push({ role: "system", content: worldInfoText });

  // Add user input as an instruction (brief)
  const userInstruction = `Mode: ${body.mode ?? "ACT"}\nPrompt: ${body.message}\nContinue the story from the player's perspective. Keep it immersive and do not prefix or repeat the prompt.`;
  messages.push({ role: "user", content: userInstruction });

  // Stream to the client as plain text chunks
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // flush headers
  res.flushHeaders?.();

  try {
    // Call to OpenAI Chat Completions (stream)
    // The endpoint and request below use the standard OpenAI API v1/chat/completions with stream:true.
    // If you use a different provider, change URL & parsing accordingly.
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // you can change to your preferred model
        messages,
        temperature: 0.8,
        max_tokens: 700,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const err = await upstream.text();
      res.write(`(upstream error) ${err}`);
      return res.end();
    }

    // upstream stream -> read chunks and forward them to client directly, but sanitize the "data: " format from OpenAI
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value);
        // OpenAI stream sends "data: {json}\n\n" pieces. We will extract content fields and forward plain text.
        // Simple approach: find occurrences of "data: " and parse JSON parts.
        const parts = chunk.split(/\ndata: /).filter(Boolean);
        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          if (trimmed === "[DONE]") {
            // signal end
            res.write("\n");
            // flush and end after loop
          } else {
            try {
              // some parts may contain multiple JSON objects or partial fragments; attempt parse safely
              const jsonStr = trimmed.replace(/\n$/, "");
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta;
              const text = delta?.content ?? parsed.choices?.[0]?.text ?? "";
              if (text) {
                // write text directly to response (client appends raw chunks)
                res.write(text);
                // flush to client
                res.flush?.();
              }
            } catch (e) {
              // If parse fails (partial JSON), attempt to extract plain text fallback
              // Write raw chunk as fallback (this prevents silence on partial deliveries)
              const fallback = trimmed.replace(/\\n/g, "\n");
              // avoid exposing JSON boundaries, but allow text
              res.write(fallback);
              res.flush?.();
            }
          }
        }
      }
    }

    // done reading
    res.end();
  } catch (err: any) {
    console.error("chat stream error:", err);
    if (!res.writableEnded) {
      res.write(`(server error) ${err?.message ?? "unknown"}`);
      res.end();
    }
  }
}
