import React, { useState, useRef, useEffect } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import { SettingsModalContent } from "./components/SettingsModalContent";
import { GameToolbar } from "./components/GameToolbar";

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

export default function App() {
  const [view, setView] = useState<"home" | "game">("home");
  const [scenarios] = useState<Scenario[]>(SAMPLE_SCENARIOS);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [lines, setLines] = useState<MessageLine[]>([]);
  const storyRef = useRef<HTMLDivElement | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);

  // Scenario & Character
  const [worldTitle, setWorldTitle] = useState("");
  const [worldSummary, setWorldSummary] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [characterClass, setCharacterClass] = useState("");
  const [characterBackground, setCharacterBackground] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [authorsNote, setAuthorsNote] = useState("");
  const [bgGradient, setBgGradient] = useState(
    "radial-gradient(circle at 10% 10%, #001220, #0d141f)"
  );

  const [mode, setMode] = useState("story");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const [historyStack, setHistoryStack] = useState<MessageLine[][]>([]);
  const [redoStack, setRedoStack] = useState<MessageLine[][]>([]);

  // Auto-scroll
  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [lines]);

  // Scenario handlers
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

  function quickStart() {
    setCurrentScenario(null);
    setWorldTitle("Custom World");
    setWorldSummary("A blank world waiting for your story.");
    const initLines = [
      { text: "World — Custom World" },
      { text: "A blank world waiting for your story." },
    ];
    setLines(initLines);
    setHistoryStack([initLines]);
    setRedoStack([]);
    setView("game");
  }

  function handleStartCustom() {
    const initLines = [
      { text: `World — ${worldTitle || "Custom World"}` },
      { text: worldSummary || "A blank world waiting for your story." },
    ];
    setLines(initLines);
    setHistoryStack([initLines]);
    setRedoStack([]);
    setOpsOpen(false);
    setView("game");
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

  // Streaming / API
  async function sendMessage(selectedMode?: string) {
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

    const payload = {
      mode: m,
      message: m === "continue" ? "" : input.trim(),
      worldSummary,
      characterName,
      characterClass,
      characterBackground,
      aiInstructions,
      authorsNote,
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
        setLines((prev) => [...prev, { text: `(error) ${txt}`]);
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
            if (json?.content) setLines((prev) => [...prev, { text: json.content }]);
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
      className="min-h-screen text-white relative"
      style={{ background: bgGradient, transition: "background 0.5s ease" }}
    >
      {/* Top Nav */}
      <header className="fixed top-0 left-0 right-0 h-16 backdrop-blur-md bg-black/30 z-50 flex items-center justify-between px-6">
        <div
          className="text-xl font-bold cursor-pointer"
          onClick={() =>
            view === "game" &&
            confirm("Exit game? Unsaved progress will be lost.") &&
            setView("home")
          }
        >
          Manhwa Engine
        </div>
      </header>

      {/* Home / Game Views */}
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
                    <button
                      className="px-3 py-2 rounded bg-cyan-400 text-black font-semibold"
                      onClick={() => openScenario(s)}
                    >
                      Play
                    </button>
                    <button
                      className="px-3 py-2 rounded border border-white/10"
                      onClick={() => setOpsOpen(true)}
                    >
                      Customize
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <button
                className="px-4 py-2 bg-green-500 rounded text-black font-semibold"
                onClick={quickStart}
              >
                Quick Start
              </button>
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

              <GameToolbar
                mode={mode}
                setMode={setMode}
                sendMessage={sendMessage}
                input={input}
                setInput={setInput}
                undo={undo}
                redo={redo}
              />
            </article>
          </section>
        )}
      </main>

      {/* Settings Modal */}
      {(opsOpen || settingsOpen) && (
        <div className="fixed inset-0 flex justify-center items-center modal-backdrop z-50">
          <SettingsModalContent
            worldTitle={worldTitle}
            setWorldTitle={setWorldTitle}
            worldSummary={worldSummary}
            setWorldSummary={setWorldSummary}
            characterName={characterName}
            setCharacterName={setCharacterName}
            characterClass={characterClass}
            setCharacterClass={setCharacterClass}
            characterBackground={characterBackground}
            setCharacterBackground={setCharacterBackground}
            aiInstructions={aiInstructions}
            setAiInstructions={setAiInstructions}
            authorsNote={authorsNote}
            setAuthorsNote={setAuthorsNote}
            bgGradient={bgGradient}
            setBgGradient={setBgGradient}
            onClose={() => {
              setOpsOpen(false);
              setSettingsOpen(false);
            }}
            onStart={handleStartCustom}
          />
        </div>
      )}
    </div>
  );
}

