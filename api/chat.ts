// api/chat.ts
// Vercel / Next.js serverless route implementation (no Next types used).
// Proxies to OpenRouter. Streams upstream content and forwards as SSE frames to the client.
// Uses model: mistralai/mistral-7b-instruct:free
import { IncomingMessage, ServerResponse } from "http";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"; // adjust if your account uses different endpoint

function sseWrite(res: ServerResponse, payload: object | string) {
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.write(data: ${data}\n\n);
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.metho…
// api/chat.ts
// Vercel / Next.js compatible API route (no Next types) that proxies to OpenRouter
// and streams responses to the client as SSE. Uses mistralai/mistral-7b-instruct:free
// and enforces second-person + minimum 5-sentence descriptive output.

import { IncomingMessage, ServerResponse } from "http";
import fetch from "node-fetch"; // If your environment already polyfills fetch, you can remove this import.

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.warn("Warning: OPENROUTER_API_KEY is not set in environment.");
}

// Change this if your OpenRouter uses a different base path for streaming completions
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"; // adjust if necessary

// Helper to write SSE frame
function sseWrite(res: ServerResponse, payload: object | string) {
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.write(data: ${data}\n\n);
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  // Only accept POST
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return;
  }

  // parse body (Node.js plain)
  let body: any = {};
  try {
    if (typeof req.body === "object" && req.body !== null) {
      body = req.body;
    } else {
      // raw parsing
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Uint8Array);
      }
      const raw = Buffer.concat(chunks).toString("utf-8");
      body = raw ? JSON.parse(raw) : {};
    }
  } catch (err) {
    res.statusCode = 400;
    res.end("Invalid JSON body");
    return;
  }

  // extract fields from client
  const {
    mode = "story",
    message = "",
    plot = { title: "", summary: "", opening: "" },
    rules = { aiInstructions: "", authorsNote: "" },
  } = body;

  // Build a robust system prompt that injects user's world & rules and forces style
  const systemPromptParts: string[] = [];

  // Basic persona and narration rules
  systemPromptParts.push(
    "You are an immersive RPG Narrator / Game Engine for a 'Manhwa' style interactive story."
  );
  systemPromptParts.push(
    "Always write in SECOND-PERSON (use 'You ...') unless explicitly instructed otherwise. Do NOT prefix responses with 'Assistant' or meta commentary."
  );
  systemPromptParts.push(
    "Each response MUST be descriptive and substantial: produce at least FIVE (5) sentences, rich sensory detail, and clear consequences of actions. Use varied sentence lengths and vivid verbs; do not output short one-line replies."
  );
  systemPromptParts.push(
    "Keep the tone consistent with the Author's Note and AI Instructions provided below. Never repeat the user's raw prompt back verbatim; instead continue the narrative."
  );

  // Inject plot / world context
  if (plot?.title) systemPromptParts.push(World Title: ${String(plot.title)}.);
  if (plot?.summary) systemPromptParts.push(World Summary: ${String(plot.summary)}.);
  if (plot?.opening) systemPromptParts.push(Opening Scene: ${String(plot.opening)}.);

  // Inject rules and author note
  if (rules?.aiInstructions) systemPromptParts.push(AI Instructions: ${String(rules.aiInstructions)}.);
  if (rules?.authorsNote) systemPromptParts.push(Author's Note: ${String(rules.authorsNote)}.);

  // Mode-specific guidance
  const modeGuidanceMap: Record<string, string> = {
    do: "User performed a physical action. Describe immediate consequences in the world, how NPCs react, sensory details, and next possible options.",
    say: "User spoke dialogue. Render the spoken line as part of the scene, then narrate reactions and effects.",
    think: "User had an internal thought. Render inner monologue in present tense, revealing feelings and internal conflict, and then show how this affects behavior.",
    story: "User provided narration or direction. Incorporate it smoothly into the scene and advance the plot.",
    continue: "User requested continuation. Progress the story forward naturally with new developments and vivid detail.",
  };
  if (modeGuidanceMap[mode]) {
    systemPromptParts.push(Mode guidance: ${modeGuidanceMap[mode]});
  }

  // Final instruction to model about output formatting
  systemPromptParts.push(
    "Respond only with plain narrative text (no JSON, no markdown fences). End your segment ready to continue the next user action."
  );

  const systemPrompt = systemPromptParts.join("\n");

  // Compose prompt to send to OpenRouter / model
  // For instruct-style models, we often give a single 'input' containing system + user instructions.
  // We also include the user's message as the user_input.
  const user_input = message || "";

  const fullInput = ${systemPrompt}\n\nUser Input (mode=${mode}): ${user_input};

  // Prepare request payload for OpenRouter model
  const payload = {
    model: "mistralai/mistral-7b-instruct:free",
    // Many instruct models accept 'input' field; adapt if your endpoint expects 'messages' instead.
    input: fullInput,
    // tuning parameters
    max_tokens: 2048,
    temperature: 0.8,
    top_p: 0.9,
    stream: true,
  };

  // Begin SSE response to client
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.writeHead(200);

  // If no API key, return error via SSE
  if (!OPENROUTER_API_KEY) {
    sseWrite(res, { error: "OPENROUTER_API_KEY not configured on server." });
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  // Call OpenRouter API with streaming
  let upstreamResp: any = null;
  try {
    upstreamResp = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: Bearer ${OPENROUTER_API_KEY},
      },
      body: JSON.stringify(payload),
    });

    if (!upstreamResp.ok || !upstreamResp.body) {
      const text = await upstreamResp.text().catch(() => "upstream error");
      sseWrite(res, { error: Upstream error: ${upstreamResp.status} ${text} });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Stream upstream body and forward as SSE data frames.
    const reader = upstreamResp.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        const chunkText = decoder.decode(value, { stream: true });
        // Upstream may already be SSE style or plain JSON lines. We'll try to parse and forward meaningful text.
        // Split by double newlines to handle multiple events in one chunk
        const parts = chunkText.split(/\n\n/);
        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          // If the upstream chunk already begins with "data: " remove it
          const cleaned = trimmed.replace(/^data:\s*/, "");
          // Try parse JSON
          try {
            const parsed = JSON.parse(cleaned);
            // Try common fields
            if (parsed.text) {
              sseWrite(res, { content: parsed.text });
            } else if (parsed?.content) {
              sseWrite(res, { content: parsed.content });
            } else if (parsed?.delta?.content) {
              sseWrite(res, { content: parsed.delta.content });
            } else if (parsed?.choices && Array.isArray(parsed.choices)) {
              // handle choices streaming (OpenAI-like)
              for (const c of parsed.choices) {
                if (c.delta && c.delta.content) {
                  sseWrite(res, { content: c.delta.content });
                } else if (c.text) {
                  sseWrite(res, { content: c.text });
                } else if (c.content) {
                  sseWrite(res, { content: c.content });
                }
              }
            } else {
              // fallback: forward whole parsed object as content field
              sseWrite(res, { content: String(cleaned) });
            }
          } catch {
            // not JSON -> forward raw text chunk
            sseWrite(res, { content: cleaned });
          }
        }
      }
    }

    // signal stream done
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    // network/upstream error
    sseWrite(res, { error: Network/Upstream error: ${String(err?.message ?? err)} });
    res.write("data: [DONE]\n\n");
    try {
      res.end();
    } catch {}
  }
