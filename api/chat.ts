import { NextRequest } from "next/server";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest) {
  try {
    const payloadStr = req.nextUrl.searchParams.get("payload");
    if (!payloadStr) throw new Error("Missing payload");

    const { mode, message } = JSON.parse(payloadStr);

    let modeInstruction = "";

    if (mode === "do")  modeInstruction = "Describe the consequences of the user's physical action.";
    if (mode === "say") modeInstruction = "Interpret the user's message as spoken dialogue. Reflect tone and atmosphere.";
    if (mode === "think") modeInstruction = "Describe the user's internal monologue in second person (your thoughts swirl…).";
    if (mode === "story") modeInstruction = "Continue the story naturally.";

    const systemPrompt = `
You are a cinematic narrative engine. 
Always respond in second person ("You…").
Do NOT prefix messages with Assistant.
Follow mode instructions strictly.
Mode instruction: ${modeInstruction}
`;

    const body = {
      model: "meta-llama/llama-3-8b-instruct:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      stream: true,
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.body) throw new Error("No stream");

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const json = line.replace("data: ", "").trim();
              if (json === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(json);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) {
                  controller.enqueue(encoder.encode(`data: ${token}\n\n`));
                }
              } catch {}
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`);
  }
}
