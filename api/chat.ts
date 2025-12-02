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

  // Simulate 5-sentence descriptive narrative
  const sentences = [
    `The world breathes as ${data.characterName || "the protagonist"} begins their journey.`,
    `Factions and races observe silently in the shadows.`,
    `Hidden dangers lurk around every corner of ${data.worldSummary || "this world"}.`,
    `Every decision shapes the destiny of the characters.`,
    `An ominous yet exciting atmosphere envelops the scene.`,
  ];

  for (const s of sentences) {
    const payload = { content: s };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    await new Promise((r) => setTimeout(r, 500));
  }

  res.write("data: [DONE]\n\n");
  res.end();
}
