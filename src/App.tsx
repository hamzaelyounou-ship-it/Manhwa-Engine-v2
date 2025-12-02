import React, { useState, useRef, useEffect } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

type Scenario = {
  id: string;
  title: string;
  desc: string;
  img?: string;
  worldSummary?: string;
};

const SAMPLE_SCENARIOS: Scenario[] = [
  {
    id: "solo",
    title: "Solo Leveling — Inspired",
    desc: "Dark growth tale: low-rank hunter, rising danger.",
    img: "/scenarios/solo.jpg",
    worldSummary:
      "Low-rank dungeons and a ranking system define society. Gates spawn across the city. Hunters gain strength by clearing them.",
  },
  {
    id: "pirate",
    title: "Grand Sea Voyage",
    desc: "High-seas adventure, mutiny and treasure.",
    img: "/scenarios/pirate.jpg",
    worldSummary:
      "The world is divided into maritime factions. Ships, crew loyalty, treasure maps — choices and danger wait on the waves.",
  },
];

type MessageLine = { text: string };
type ModeKey = "do" | "say" | "think" | "story" | "continue" | "erase";

export default function App() {
  const [view, setView] = useState<"home" | "game">("home");
  const [scenarios] = useState<Scenario[]>(SAMPLE_SCENARIOS);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [lines, setLines] = useState<MessageLine[]>([]);
  const storyRef = useRef<HTMLDivElement | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);

  const [worldTitle, setWorldTitle] = useState("");
  const [worldSummary, setWorldSummary] = useState("");

  const [mode, setMode] = useState<ModeKey>("story");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const [historyStack, setHistoryStack] = useState<MessageLine[][]>([]);
  const [redoStack, setRedoStack] = useState<MessageLine[][]>([]);

  const [bgGradient, setBgGradient] = useState<string>(
    "radial-gradient(circle at 10% 10%, #001220, #0d141f)"
  );

  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [lines]);

  // Scenario Handlers
  function openScenario(s: Scenario) {
    setCurrentScenario(s);
    setWorldTitle(s.title);
    setWorldSummary(s.worldSummary ?? "");
    const initLines = [
      { text: `Scenario — ${s.title}: ${s.desc}` },
      { text: s.worldSummary ?? "The world awaits your story." },
    ];
    setLines(initLines);
    setHistoryStack([initLines]);
    setRedoStack([]);
    setView("game");
  }

  function createCustomScenario() {
    setCurrentScenario(null);
    setWorldTitle("");
    setWorldSummary("");
    setOpsOpen(true);
  }

  function handleStartCustom() {
    const initLines = [
      { text: `World — ${worldTitle || "Custom World"}` },
      { text: worldSummary || "A blank world waiting for your story." },
    ];
    setLines(initLines);
    setHistoryStack([initLines]);
    setRedoStack([]);
    setView("game");
    setOpsOpen(false);
  }

  // Undo / Redo
  function undo() {
    if (historyStack.length <= 1) return;
    const prev = historyStack[historyStack.length - 2];
    setRedoStack([historyStack[historyStack.length - 1], ...redoStack]);
    setLines(prev);
    setHistoryStack(historyStack.slice(0, -1));
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setLines(next);
    setHistoryStack([...historyStack, next]);
    setRedoStack(redoStack.slice(1));
  }

  // Streaming / API call
  async function sendMessage(useMode?: ModeKey) {
    const m = useMode ?? mode;
    if (m !== "continue" && m !== "erase" && !input.trim()) return;

    if (m === "erase") {
      // Remove last user + AI response
      const prev = [...lines];
      prev.pop();
      prev.pop();
      setLines(prev);
      setHistoryStack([...historyStack, prev]);
      return;
    }

    const userText =
      m === "say"
        ? `You say: "${input}"`
        : m === "do"
        ? `You attempt: ${input}`
        : m === "think"
        ? `You think: ${input}`
        : m === "story"
        ? `You narrate: ${input}`
        : "Continue";

    if (m !== "continue") setLines((prev) => [...prev, { text: userText }]);

    const payload = {
      mode: m,
      message: m === "continue" ? "" : input.trim(),
      worldSummary,
      history: lines.map((ln) => ln.text).slice(-8),
    };

    setInput("");
    setStreaming(true);
    controllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controllerRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text();
        setLines((prev) => [...prev, { text: `(error) ${txt}` }]);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          if (event.data === "[DONE]") return;
          try {
            const json = JSON.parse(event.data);
            if (json?.content) {
              setLines((prev) => [...prev, { text: json.content }]);
            }
          } catch {}
        }
      });

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
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: bgGradient, transition: "background 0.5s ease" }}
    >
      {/* Top Nav */}
      <header className="fixed top-0 left-0 right-0 h-16 backdrop-blur-md bg-black/30 z-50 flex items-center justify-between px-6">
        <div
          className="text-xl font-bold cursor-pointer"
          onClick={() => view === "game" && confirm("Exit game?") && setView("home")}
        >
          Manhwa Engine
        </div>
        <div className="flex items-center gap-2">
          <button onClick={undo} className="p-2 hover:bg-white/10 rounded">↩️</button>
          <button onClick={redo} className="p-2 hover:bg-white/10 rounded">↪️</button>
          <button onClick={() => setDrawerOpen((s) => !s)} className="p-2 hover:bg-white/10 rounded">🛡️</button>
          <button onClick={() => setSettingsOpen(true)} className="p-2 hover:bg-white/10 rounded">⚙️</button>
        </div>
      </header>

      {/* Status Drawer */}
      <div
        className={`fixed top-16 right-0 h-[calc(100%-4rem)] w-80 bg-black/60 backdrop-blur-md border-l border-white/10 z-40 transform transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-4">
          <h4 className="font-semibold mb-4">Status</h4>
          <div className="text-sm text-white/70">Health & Energy placeholder</div>
        </div>
      </div>

      {/* Main */}
      <main className="pt-20 pb-32">
        {view === "home" && (
          <section className="max-w-6xl mx-auto px-4">
            <h1 className="text-3xl font-bold mb-6">Scenario Library</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {scenarios.map((s) => (
                <div key={s.id} className="bg-white/5 rounded-lg p-4 flex flex-col">
                  <div
                    className="h-36 bg-gray-800 rounded-md mb-3"
                    style={{
                      backgroundImage: s.img ? `url(${s.img})` : undefined,
                      backgroundSize: "cover",
                    }}
                  />
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-sm text-white/70 flex-1 my-2">{s.desc}</p>
                  <div className="flex gap-2 mt-3">
                    <button className="px-3 py-2 rounded bg-cyan-400 text-black font-semibold" onClick={() => openScenario(s)}>Play</button>
                    <button className="px-3 py-2 rounded border border-white/10" onClick={createCustomScenario}>Customize</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "game" && (
          <section className="max-w-6xl mx-auto px-4">
            <article className="mx-auto max-w-4xl">
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
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
