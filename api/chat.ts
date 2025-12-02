import type { NextApiRequest, NextApiResponse } from "next";

type ChatRequest = {
  mode: string;
  message: string;
  worldSummary: string;
  characterName: string;
  characterClass: string;
  characterBackground: string;
  aiInstructions: string;
  authorsNote: string;
  history: string[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const body: ChatRequest = req.body;

  const prompt = `
You are an AI storyteller. Respond with at least 5 descriptive sentences.
Mode: ${body.mode}
World: ${body.worldSummary}
Character: ${body.characterName} (${body.characterClass}) Background: ${body.characterBackground}
Instructions: ${body.aiInstructions}
Author's Note: ${body.authorsNote}
Previous History: ${body.history.join("\n")}

${body.mode === "story" ? "Continue the story with vivid narration:" : body.message}
`;

  try {
    // Example: OpenRouter streaming
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const response = await fetch("https://api.openrouter.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const txt = await response.text();
      return res.status(500).json({ error: txt });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const chunk = decoder.decode(value);
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
