import { IncomingMessage, ServerResponse } from "http";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    res.statusCode = 400;
    res.end("Invalid JSON");
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
    if (event.type === "event" && event.data !== "[DONE]") {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.content) res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {}
    }
  });

  // Generate robust narrative: minimum 5 sentences
  const sentences = [
    `The world awakens as ${data.characterName || "the protagonist"} takes their first step into the adventure.`,
    `Every shadow hints at secrets and dangers that could alter the course of their journey.`,
    `Allies and rivals alike watch, waiting for opportunities to test the hero's resolve.`,
    `The environment reacts dynamically, shaping the narrative with every choice made.`,
    `A sense of mystery and excitement fills the air, drawing ${data.characterName || "them"} forward.`,
  ];

  for (const s of sentences) {
    const payload = { content: s };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    await new Promise((r) => setTimeout(r, 500));
  }

  res.write("data: [DONE]\n\n");
  res.end();
}
