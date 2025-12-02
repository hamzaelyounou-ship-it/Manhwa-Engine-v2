import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  const body = req.body;

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "Missing API Key" });

  const mode = body.mode ?? "story";
  const message = body.message ?? "";
  const worldSummary = (body.worldSummary ?? "").toString();

  const systemPrompt = `
You are a cinematic narrative engine. Always address the player as "You".
Produce rich descriptive paragraphs (at least 4–5 sentences each turn). Use vivid imagery, atmosphere, internal state, sensory detail.
Never output assistant tags or JSON. Only narrative text.
Integrate the following world context deeply into the story:
WORLD SUMMARY:
${worldSummary}

MODE: ${mode.toUpperCase()}
USER_INPUT: ${mode === "continue" ? "[CONTINUE]" : message}
Continue the scene accordingly.`;

  const payload = {
    model: model: "mistralai/mistral-7b-instruct:free",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: mode === "continue" ? "Continue." : message },
    ],
    temperature: 0.8,
    max_tokens: 800,
    stream: true,
  };

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok || !upstream.body) {
    const txt = await upstream.text();
    res.status(502).write(`(upstream error) ${txt}`);
    return res.end();
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  try { res.flushHeaders(); } catch {} 

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line) continue;
      const m = line.match(/^data:\s*(.*)$/s);
      if (!m) continue;
      const data = m[1].trim();
      if (data === "[DONE]") {
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        const text = delta?.content ?? parsed.choices?.[0]?.text ?? "";
        if (text) {
          res.write(`data: ${text}\n\n`);
          try { res.flush(); } catch {}
        }
      } catch (err) {
        // fallback
        res.write(`data: ${data}\n\n`);
        try { res.flush(); } catch {}
      }
    }
  }

  res.end();
}
