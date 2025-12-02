import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const {
    mode,
    message,
    characterName,
    characterClass,
    race,
    faction,
    startingLocation,
    worldSummary,
    history,
  } = req.body;

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) return res.status(500).json({ error: "Missing API Key" });

  const systemPrompt = `
You are a cinematic RPG story engine. 
Always narrate in second-person perspective ("You ...").
Produce rich, descriptive paragraphs with at least 5 sentences.
Character: ${characterName || "Unknown"} (${characterClass || "Unknown"})
Race: ${race || "Unknown"}, Faction: ${faction || "Unknown"}, Location: ${startingLocation || "Unknown"}
World Summary: ${worldSummary || "No context provided"}
History: ${history?.join("\n") || ""}
User Mode: ${mode}
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-7b-instruct",
        prompt: systemPrompt + (message ? `\nUser Input: ${message}` : ""),
        max_tokens: 2048,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.body) return res.status(500).json({ error: "No response body from API" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    const parser = createParser((event: any) => {
      if (event.type === "event") {
        if (event.data === "[DONE]") {
          res.write("data: [DONE]\n\n");
          res.end();
        } else {
          res.write(`data: ${event.data}\n\n`);
        }
      }
    });

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) parser.feed(decoder.decode(value, { stream: true }));
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

function createParser(callback: (event: any) => void) {
  const { parse } = require("eventsource-parser");
  return parse(callback);
}
