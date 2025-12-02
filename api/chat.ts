import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const {
    mode,
    message,
    worldSummary,
    characterName,
    characterClass,
    characterBackground,
    aiInstructions,
    authorsNote,
    history,
  } = req.body;

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "Missing API Key" });

  const systemPrompt = `
You are a cinematic Manhwa/Game Story Engine. 
Always describe events in second-person ("You...").
Produce rich, descriptive paragraphs with at least 5 sentences.
Never prefix responses with "Assistant:".
Character: ${characterName || "Unknown"} (${characterClass || "Unknown"}, ${
    characterBackground || "No Background"
  })
World Summary: ${worldSummary || "No context"}
History: ${history?.join("\n") ?? ""}
AI Instructions: ${aiInstructions || "None"}
Author's Note: ${authorsNote || "None"}
Mode: ${mode}
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        prompt: systemPrompt + "\nUser: " + message,
        max_tokens: 2048,
        stream: true,
      }),
    });

    if (!response.ok || !response.body)
      return res.status(500).json({ error: "Failed to connect to API" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        res.write(decoder.decode(value));
      }
    }

    res.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
