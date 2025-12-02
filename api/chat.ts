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

  // Simulate AI streaming: 5+ descriptive sentences
  const sentences = [
    `The world is alive as ${data.characterName || "the protagonist"} begins their journey.`,
    `Hidden factions and secret societies watch silently, plotting intricate schemes.`,
    `Every choice made in this world resonates and shapes the destiny of all who dwell within.`,
    `Dangers lurk in the shadows, yet opportunities for glory await the brave.`,
    `A mysterious aura envelops the land, promising both peril and adventure.`,
  ];

  for (const s of sentences) {
    const payload = { content: s };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    await new Promise((r) => setTimeout(r, 500));
  }

  res.write("data: [DONE]\n\n");
  res.end();
}

