import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const { mode, message, worldSummary, history } = req.body;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "Missing API Key" });

  const systemPrompt = `
You are a cinematic narrative engine. Always address the player as "You".
Produce rich descriptive paragraphs (at least 4–5 sentences). Use vivid imagery, atmosphere, internal state, and sensory detail.
Never output assistant tags or JSON. Only narrative text.
Integrate the following world context deeply into the story:
WORLD SUMMARY:
${worldSummary}

MODE: ${mode.toUpperCase()}
USER_INPUT: ${mode === "continue" ? "[CONTINUE]" : message}
Continue the scene accordingly.
  `;

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
       model: "mistralai/mistral-7b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: mode === "continue" ? "Continue." : message },
        ],
        temperature: 0.8,
        max_tokens: 2048,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text();
      return res.status(502).json({ error: `(upstream error) ${txt}` });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    try { res.flushHeaders(); } catch {}

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        res.write(`data: ${chunk}\n\n`);
        try { res.flush(); } catch {}
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
