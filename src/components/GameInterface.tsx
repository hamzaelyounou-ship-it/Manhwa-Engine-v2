import React, { useState, useEffect, useRef } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

type ModeKey = "do" | "say" | "think" | "story" | "continue" | "erase";

type GameProps = {
  worldSummary: string;
  characterName: string;
  characterClass: string;
  characterBackground: string;
  aiInstructions: string;
  authorsNote: string;
};

type MessageLine = { text: string };

export default function GameInterface({
  worldSummary,
  characterName,
  characterClass,
  characterBackground,
  aiInstructions,
  authorsNote,
}: GameProps) {
  const [lines, setLines] = useState<MessageLine[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ModeKey>("story");
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // History for Undo/Redo
  const [historyStack, setHistoryStack] = useState<MessageLine[][]>([]);
  const [redoStack, setRedoStack] = useState<MessageLine[][]>([]);

  const storyRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new lines
  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [lines]);

  const undo = () => {
    if (historyStack.length <= 1) return;
    const prev = historyStack[historyStack.length - 2];
    setRedoStack([historyStack[historyStack.length - 1], ...redoStack]);
    setLines(prev);
    setHistoryStack(historyStack.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setLines(next);
    setHistoryStack([...historyStack, next]);
    setRedoStack(redoStack.slice(1));
  };

  const sendMessage = async (selectedMode?: ModeKey) => {
    const m = selectedMode ?? mode;
    if (m !== "continue" && m !== "erase" && !input.trim()) return;

    if (m === "erase") {
      const prev = [...lines];
      prev.pop();
      prev.pop();
      setLines(prev);
      setHistoryStack([...historyStack, prev]);
      return;
    }

    const userText =
      m === "say"
        ? `${characterName || "You"} says: "${input}"`
        : m === "do"
        ? `${characterName || "You"} attempts: ${input}`
        : m === "think"
        ? `${characterName || "You"} thinks: ${input}`
        : m === "story"
        ? `${characterName || "You"} narrates: ${input}`
        : "Continue";

    if (m !== "continue") setLines((prev) => [...prev, { text: userText }]);
    setInput("");
    setStreaming(true);
    controllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: m,
          message: m === "continue" ? "" : input.trim(),
          worldSummary,
          characterName,
          characterClass,
          characterBackground,
          aiInstructions,
          authorsNote,
          history: lines.map((l) => l.text).slice(-8),
        }),
        signal: controllerRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text();
        setLines((prev) => [...prev, { text: `(error) ${txt}`]);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event" && event.data !== "[DONE]") {
          try {
            const json = JSON.parse(event.data);
            if (json?.content) setLines((prev) => [...prev, { text: json.content }]);
          } catch {}
        }
      });

      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch (err: any) {
      if (err.name === "AbortError") setLines((prev) => [...prev, { text: "(stream aborted)" }]);
      else setLines((prev) => [...prev, { text: `(stream error) ${err.message}` }]);
    } finally {
      setStreaming(false);
      setHistoryStack([...historyStack, lines]);
      controllerRef.current = null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-8 pb-32">
      <div
        ref={storyRef}
        className="bg-white/20 p-12 rounded-lg min-h-[60vh] max-h-[72vh] overflow-y-auto font-serif text-lg leading-relaxed"
      >
        {lines.map((ln, idx) => (
          <p key={idx} className="mb-6">
            {ln.text}
          </p>
        ))}
        {streaming && <div className="text-white/60 italic">…Loading narrative…</div>}
      </div>

      {/* Toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex gap-2 z-50">
        {["do", "say", "think", "story", "continue", "erase"].map((b) => (
          <button
            key={b}
            onClick={() => sendMessage(b as ModeKey)}
            className={`px-3 py-1 rounded hover:bg-white/10 ${
              mode === b ? "bg-cyan-500 text-black font-semibold" : ""
            }`}
          >
            {{
              do: "🗡️ Do",
              say: "💬 Say",
              think: "💭 Think",
              story: "📖 Story",
              continue: "🔄 Continue",
              erase: "🗑️ ERASE",
            }[b as ModeKey]}
          </button>
        ))}
        <input
          type="text"
          className="ml-2 bg-gray-800/60 px-3 py-1 rounded w-64 focus:outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your action or dialogue..."
        />
      </div>

      {/* Undo/Redo buttons */}
      <div className="fixed top-20 right-6 flex gap-2 z-50">
        <button onClick={undo} className="p-2 hover:bg-white/10 rounded bg-black/30">
          ↩️
        </button>
        <button onClick={redo} className="p-2 hover:bg-white/10 rounded bg-black/30">
          ↪️
        </button>
      </div>
    </div>
  );
}
