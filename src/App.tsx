import React, { useEffect, useRef, useState } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

/**
 * Minimal App:
 * - simple story log (center)
 * - input field
 * - toolbar with modes [DO, SAY, THINK, STORY, CONTINUE, ERASE]
 * - streaming fetch to /api/chat
 * - uses eventsource-parser to extract only the content and append to story (no raw JSON)
 */

type ModeKey = "do" | "say" | "think" | "story" | "continue" | "erase";
type Line = { text: string; from?: "user" | "ai" };

export default function App() {
  const [lines, setLines] = useState<Line[]>([
    { text: "Welcome to the Manhwa Story Engine. Start by choosing a mode and sending an action.", from: "ai" },
  ]);
  const [mode, setMode] = useState<ModeKey>("story");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const storyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [lines, streaming]);

  const appendLine = (text: string, from: Line["from"] = "ai") => {
    setLines((prev) => [...prev, { text, from }]);
  };

  async function send(modeOverride?: ModeKey) {
    const m = modeOverride ?? mode;

    // ERASE local: remove last user+ai pair
    if (m === "erase") {
      setLines((prev) => {
        const copy = [...prev];
        // remove last AI line if exists
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].from === "ai") {
            copy.splice(i, 1);
            break;
          }
        }
        // remove last user line
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].from === "user") {
            copy.splice(i, 1);
            break;
          }
        }
        return copy;
      });
      return;
    }

    // For all other modes except continue, require input text
    if (m !== "continue" && input.trim().length === 0) return;

    const userText =
      m === "say"
        ? `You say: "${input.trim()}"`
        : m === "do"
        ? `You attempt: ${input.trim()}`
        : m === "think"
        ? `You think: ${input.trim()}`
        : m === "story"
        ? `You narrate: ${input.trim()}`
        : "Continue the story.";

    if (m !== "continue") appendLine(userText, "user");
    setInput("");

    setStreaming(true);
    controllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: m,
          message: m === "continue" ? "" : userText,
          // You can include more persistent world/context here if desired.
          // For minimal file, we don't include extra UI state — but backend accepts it.
        }),
        signal: controllerRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text();
        appendLine(`(error) ${txt}`);
        setStreaming(false);
        return;
      }

      // Parse SSE stream from the server using eventsource-parser
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      // The server is expected to send SSE-like `data: {...}\n\n` chunks.
      // eventsource-parser will parse these into events with event.data
      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;
          if (data === "[DONE]") {
            // finished
            return;
          }
          try {
            // our server emits JSON objects with { content: "..." }
            const json = JSON.parse(data);
            if (json?.content) {
              appendLine(String(json.content), "ai");
            } else if (typeof json === "string") {
              appendLine(json, "ai");
            }
          } catch (err) {
            // If it's not JSON, append raw text safely
            appendLine(String(data), "ai");
          }
        }
      });

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          parser.feed(chunk);
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        appendLine("(stream aborted)", "ai");
      } else {
        appendLine(`(network error) ${err?.message ?? String(err)}`, "ai");
      }
    } finally {
      setStreaming(false);
      controllerRef.current = null;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Manhwa Story Engine (Minimal)</h1>
      </header>

      <main className="max-w-3xl mx-auto">
        <div
          ref={storyRef}
          className="bg-white/5 rounded-lg p-6 min-h-[50vh] max-h-[60vh] overflow-y-auto font-serif text-lg leading-relaxed"
        >
          {lines.map((ln, i) => (
            <p key={i} className={`${ln.from === "user" ? "text-cyan-200" : "text-gray-200"} mb-4`}>
              {ln.text}
            </p>
          ))}

          {streaming && <p className="text-gray-400 italic">…streaming response…</p>}
        </div>

        {/* Input + Toolbar */}
        <div className="mt-6 flex flex-col items-center">
          <div className="w-full bg-black/40 backdrop-blur-md rounded-full px-4 py-3 flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type action, dialogue, or leave empty for Continue"
              className="flex-1 bg-transparent outline-none text-white placeholder-gray-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              onClick={() => send("do")}
              className="px-3 py-1 rounded hover:bg-white/10"
              title="Do (action)"
            >
              🗡️
            </button>
            <button
              onClick={() => send("say")}
              className="px-3 py-1 rounded hover:bg-white/10"
              title="Say (dialogue)"
            >
              💬
            </button>
            <button
              onClick={() => send("think")}
              className="px-3 py-1 rounded hover:bg-white/10"
              title="Think (internal)"
            >
              💭
            </button>
            <button
              onClick={() => send("story")}
              className="px-3 py-1 rounded hover:bg-white/10"
              title="Story (narration)"
            >
              📖
            </button>
            <button
              onClick={() => send("continue")}
              className="px-3 py-1 rounded hover:bg-white/10"
              title="Continue"
            >
              🔄
            </button>
            <button
              onClick={() => send("erase")}
              className="px-3 py-1 rounded hover:bg-white/10"
              title="Erase last"
            >
              🗑️
            </button>
          </div>
          <div className="w-full text-right mt-2 text-xs text-gray-400">
            Mode: <span className="text-white">{mode}</span> — click an icon to send with that mode.
          </div>
        </div>
      </main>
    </div>
  );
}
