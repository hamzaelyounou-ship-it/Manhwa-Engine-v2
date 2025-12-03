// api/chat.ts
// ✅ Fully compatible with Vercel serverless
// ✅ Works with your frontend App.jsx streaming
// ✅ Keeps plot, rules, and narrative system prompts

import type { NextApiRequest, NextApiResponse } from "next";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const config = {
  api: {
    bodyParser: true, // parse JSON automatically
  },
};

type ResponseData = { content?: string } | string;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { mode, message, plot = {}, rules = {} } = req.body;

    if (!mode) return res.status(400).json({ error: "mode required" });
    if (mode !== "continue" && (!message || String(message).trim() === ""))
      return res.status(400).json({ error: "Input required" });

    const plotSummary = plot.summary ?? "";
    const opening = plot.opening ?? "";
    const title = plot.title ?? "";
    const aiInstructions = rules.aiInstructions ?? "";
    const authorsNote = rules.authorsNote ?? "";

    // System prompt for narrative AI
    const systemPrompt = `
You are an immersive Manhwa-style narrative engine. Always write in second-person ("You ..."). Use vivid, cinematic description and produce a minimum of five descriptive sentences per response. Do NOT prefix your output with any role label. Do NOT repeat the user's exact prompt; instead continue the scene. Follow these context rules strictly.

WORLD CONTEXT:
Title: ${title}
Summary: ${plotSummary}
Opening: ${opening}

AUTHOR'S NOTE:
${authorsNote}

AI INSTRUCTIONS:
${aiInstructions}

When responding, produce flowing narrative paragraphs, show sensory detail, internal state when appropriate, and clear consequences for actions. Keep responses in plain text suitable for streaming.
`.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: String(message ?? "") },
    ];

    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_KEY)
      return res.status(500).json({ error: "Server missing OPENROUTER_API_KEY" });

    const payload = {
      model: "mistralai/mistral-7b-instruct:free",
      messages,
      max_tokens: 2048,
      temperature: 0.8,
      stream: true,
    };

    const openrouterResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });

    if (!openrouterResp.ok || !openrouterResp.body) {
      const txt = await openrouterResp.text().catch(() => "");
      return res.status(502).json({ error: "Upstream error", detail: txt });
    }

    // Stream SSE to frontend
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const reader = openrouterResp.body.getReader();
    const decoder = new TextDecoder();

    const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
      if (event.type === "event") {
        if (event.data === "[DONE]") return;
        try {
          const j: ResponseData = JSON.parse(event.data);
          if (typeof j === "string") res.write(j);
          else if (j?.content) res.write(j.content);
        } catch {
          res.write(event.data); // fallback for invalid JSON
        }
      }
    });

    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      finished = done;
      if (value) parser.feed(decoder.decode(value, { stream: true }));
    }

    res.write("\n");
    res.end();
  } catch (err: any) {
    console.error("api/chat error:", err);
    res.status(500).json({ error: err?.message ?? String(err) });
  }
}
