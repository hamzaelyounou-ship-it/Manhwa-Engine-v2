import React, { useState, useEffect, useRef } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

type Scenario = { id: string; title: string; desc: string; worldSummary?: string };
type MessageLine = { text: string };
type ModeKey = "do" | "say" | "think" | "story" | "continue" | "erase";

const SAMPLE_SCENARIOS: Scenario[] = [
  {
    id: "solo",
    title: "Solo Leveling",
    desc: "Low-rank hunter rises in a dangerous world.",
    worldSummary: "Gates spawn throughout the city; hunters gain strength by clearing them.",
  },
  {
    id: "pirate",
    title: "Grand Sea Voyage",
    desc: "High-seas adventure and treasure hunting.",
    worldSummary: "The seas are divided among factions; ships and crew loyalty are key.",
  },
];

export default function App() {
  const [view, setView] = useState<"home" | "game">("home");
  const [lines, setLines] = useState<MessageLine[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);

  // World / Character Setup
  const [tabsOpen, setTabsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"plot" | "rules" | "appearance">("plot");
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

  // Toolbar & Input
  const [mode, setMode] = useState<ModeKey>("story");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // History / Undo/Redo
  const [historyStack, setHistoryStack] = useState<MessageLine[][]>([]);
  const [redoStack, setRedoStack] = useState<MessageLine[][]>([]);
  const storyRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll
  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [lines]);

  // Undo/Redo
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

  // Quickstart
  const quickStart = () => {
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
  };

  // Start custom scenario
  const startCustom = () => {
    const initLines = [
      { text: `World — ${worldTitle || "Custom World"}` },
      { text: worldSummary || "A blank world waiting for your story." },
    ];
    setLines(initLines);
    setHistoryStack([initLines]);
    setRedoStack([]);
    setTabsOpen(false);
    setView("game");
  };

  // Send message to API
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
  };

  return (
    <div
      className="min-h-screen text-white relative"
      style={{ background: bgGradient, transition: "background 0.5s ease" }}
    >
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 h-16 backdrop-blur-md bg-black/30 z-50 flex items-center justify-between px-6">
        <div className="text-xl font-bold cursor-pointer" onClick={() => setView("home")}>
          Manhwa Engine
        </div>
        {view === "game" && (
          <div className="flex gap-2">
            <button onClick={undo} className="p-2 hover:bg-white/10 rounded">
              ↩️
            </button>
            <button onClick={redo} className="p-2 hover:bg-white/10 rounded">
              ↪️
            </button>
          </div>
        )}
      </header>

      <main className="pt-20 pb-32">
        {/* HOME VIEW */}
        {view === "home" && (
          <section className="max-w-6xl mx-auto px-4">
            <h1 className="text-3xl font-bold mb-6">Scenario Library</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {SAMPLE_SCENARIOS.map((s) => (
                <div key={s.id} className="bg-white/5 rounded-lg p-4 flex flex-col">
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-sm text-white/70 flex-1 my-2">{s.desc}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      className="px-3 py-2 rounded bg-green-500 font-semibold"
                      onClick={quickStart}
                    >
                      Quick Start
                    </button>
                    <button
                      className="px-3 py-2 rounded bg-cyan-500 font-semibold"
                      onClick={() => setTabsOpen(true)}
                    >
                      Create World
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* GAME VIEW */}
        {view === "game" && (
          <section className="max-w-6xl mx-auto px-4">
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
          </section>
        )}

        {/* TABS MODAL */}
        {tabsOpen && (
          <div className="fixed inset-0 flex justify-center items-center bg-black/70 z-50">
            <div className="bg-black/90 p-6 rounded-lg max-w-2xl w-full text-white">
              <div className="flex justify-between mb-4">
                <h2 className="font-bold text-xl">Operations Room</h2>
                <button onClick={() => setTabsOpen(false)}>✖️</button>
              </div>
              <div className="flex gap-4 mb-4 border-b border-white/20">
                {["plot", "rules", "appearance"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t as any)}
                    className={`px-2 py-1 ${
                      activeTab === t ? "border-b-2 border-cyan-400" : ""
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {activeTab === "plot" && (
                  <>
                    <input
                      type="text"
                      placeholder="World / Plot Title"
                      className="p-2 rounded bg-gray-800"
                      value={worldTitle}
                      onChange={(e) => setWorldTitle(e.target.value)}
                    />
                    <textarea
                      placeholder="Story Summary"
                      className="p-2 rounded bg-gray-800"
                      rows={3}
                      value={worldSummary}
                      onChange={(e) => setWorldSummary(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Character Name"
                      className="p-2 rounded bg-gray-800"
                      value={characterName}
                      onChange={(e) => setCharacterName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Character Class"
                      className="p-2 rounded bg-gray-800"
                      value={characterClass}
                      onChange={(e) => setCharacterClass(e.target.value)}
                    />
                    <textarea
                      placeholder="Background"
                      className="p-2 rounded bg-gray-800"
                      rows={3}
                      value={characterBackground}
                      onChange={(e) => setCharacterBackground(e.target.value)}
                    />
                  </>
                )}

                {activeTab === "rules" && (
                  <>
                    <textarea
                      placeholder="AI Instructions"
                      className="p-2 rounded bg-gray-800"
                      rows={2}
                      value={aiInstructions}
                      onChange={(e) => setAiInstructions(e.target.value)}
                    />
                    <textarea
                      placeholder="Author's Note"
                      className="p-2 rounded bg-gray-800"
                      rows={2}
                      value={authorsNote}
                      onChange={(e) => setAuthorsNote(e.target.value)}
                    />
                  </>
                )}

                {activeTab === "appearance" && (
                  <>
                    <label>Background Color</label>
                    <input
                      type="color"
                      value="#0d141f"
                      onChange={(e) =>
                        setBgGradient(
                          `radial-gradient(circle at 10% 10%, #001220, ${e.target.value})`
                        )
                      }
                    />
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-3 py-2 rounded bg-cyan-400 text-black font-semibold"
                  onClick={startCustom}
                >
                  Start Game
                </button>
                <button
                  className="px-3 py-2 rounded border border-white/20"
                  onClick={() => setTabsOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
