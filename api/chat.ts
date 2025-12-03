// api/chat.ts
import { IncomingMessage, ServerResponse } from "http";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("Method Not Allowed");
      return;
    }

    const body = await new Promise<any>((resolve) => {
      let data = "";
      req.on("data", (chunk: Buffer) => (data += chunk.toString()));
      req.on("end", () => resolve(data ? JSON.parse(data) : {}));
    });

    const { mode, message, plot = {}, rules = {} } = body || {};

    // Validate
    if (!mode) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "mode required" }));
      return;
    }
    if (mode !== "continue" && (!message || String(message).trim() === "")) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Input required" }));
      return;
    }

    // Build system prompt - inject plot + rules + enforcement
    const plotSummary = plot.summary ?? "";
    const opening = plot.opening ?? "";
    const title = plot.title ?? "";

    const aiInstructions = rules.aiInstructions ?? "";
    const authorsNote = rules.authorsNote ?? "";

    const systemPrompt = `
You are an immersive Manhwa-style narrative engine. Always write in second-person ("You ..."). Use vivid, cinematic description and produce a minimum of five (5) descriptive sentences per response. Do NOT prefix your output with "Assistant" or any role label. Do NOT repeat the user's exact prompt; instead continue the scene. Follow these context rules strictly.

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

    // Assemble messages
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: String(message ?? "") },
    ];

    // Prepare OpenRouter request
    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_KEY) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Server missing OPENROUTER_API_KEY" }));
      return;
    }

    const payload = {
      model: "mistralai/mistral-7b-instruct:free",
      messages,
      max_tokens: 2048,
      temperature: 0.8,
      stream: true,
    };

    // Call OpenRouter with streaming enabled
    const openrouterResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify(payload),
    });

    if (!openrouterResp.ok || !openrouterResp.body) {
      const txt = await openrouterResp.text().catch(() => "");
      res.statusCode = 502;
      res.end(JSON.stringify({ error: "Upstream error", detail: txt }));
      return;
    }

    // Proxy the stream to client as-is (SSE)
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const reader = openrouterResp.body.getReader();
    const decoder = new TextDecoder();

    // Read from upstream and forward chunks to client
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const chunk = decoder.decode(value);
        // Forward the chunk exactly (OpenRouter emits SSE 'data: {...}\n\n' lines)
        try {
          res.write(chunk);
        } catch (e) {
          // If client aborted, stop reading
          break;
        }
      }
    }

    // End stream
    res.write("\n");
    res.end();
  } catch (err: any) {
    console.error("api/chat error:", err);
    try {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err?.message ?? String(err) }));
    } catch {
      // ignore
    }
  }
}
