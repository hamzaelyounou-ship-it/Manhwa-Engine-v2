import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const { mode, message, worldSummary, history } = req.body;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "Missing API Key" });

  const systemPrompt = `
You are a cinematic Manhwa/Game Story Engine. 
Always describe events in second-person ("You...").
Produce rich, descriptive paragraphs with at least 5 sentences each.
Never prefix responses with "Assistant:".
Incorporate all context from the World Summary:
${worldSummary || "No world context provided."}
History (last 8 messages):
${history?.join("\n") ?? ""}

Use the selected mode (${mode}) to guide narration:
- do: describe consequences of actions
- say: include speech/dialogue
- think: internal thoughts
- story: narrative exposition
- continue: continue the scene naturally
- erase: remove last action from the story
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct:free",
        stream: true,
        input: `${systemPrompt}\n${message}`,
        max_tokens: 2048,
      }),
    });

    if (!response.body) return res.status(500).json({ error: "No response body" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
    }

    res.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

