import React, { useEffect, useRef, useState } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import "./styles-override.css";

/**
 * App.tsx - Full app with three states: HOME, SETUP, GAME
 *
 * - HOME: scenario library (cards)
 * - SETUP: scenario / world / author inputs (simple form)
 * - GAME: story log, top nav (home/shield/gear), and bottom toolbar (DO, SAY, THINK, STORY, CONTINUE, ERASE)
 *
 * Critical: uses eventsource-parser on the client to parse SSE from the server and append only narrative text.
 */

type AppView = "HOME" | "SETUP" | "GAME";
type ModeKey = "do" | "say" | "think" | "story" | "continue" | "erase";
type Line = { text: string; from: "user" | "ai" };

export default function App() {
  const [view, setView] = useState<AppView>("HOME");

  // Setup / world state (SETUP view)
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [openingScene, setOpeningScene] = useState("");
  const [charName, setCharName] = useState("");
  const [charClass, setCharClass] = useState("");
  const [charBackground, setCharBackground] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [authorsNote, setAuthorsNote] = useState("");

  // Game state
  const [lines, setLines] = useState<Line[]>([
    { text: "Welcome to Manhwa Engine. Choose a scenario to start.", from: "ai" },
  ]);
  const [mode, setMode] = useState<ModeKey>("story");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const storyRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // UI small states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sample scenarios
  const SCENARIOS = [
    {
      id: "solo",
      title: "Solo Leveling — Inspired",
      desc: "Dark growth tale: a low-rank hunter rises in a dangerous world.",
      worldSummary:
        "Gates spawn across the city with monsters; hunters rise in rank by clearing dungeons.",
    },
    {
      id: "pirate",
      title: "Grand Sea Voyage",
      desc: "High seas adventure, mutiny, and treasure.",
      worldSummary:
        "The seas are divided among maritime factions; ships, crew loyalty, and maps drive conflict.",
    },
    {
      id: "custom",
      title: "Custom Scenario",
      desc: "Design your own world in the Setup screen.",
      worldSummary: "",
    },
  ];

  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [lines, streaming]);

  const appendLine = (text: string, from: Line["from"] = "ai") =>
    setLines((prev) => [...prev, { text, from }]);

  // Navigation helpers
  function startSetupForScenario(scenarioId: string) {
    if (scenarioId === "custom") {
      // empty or preserve
      setTitle("");
      setSummary("");
      setOpeningScene("");
    } else {
      const s = SCENARIOS.find((x) => x.id === scenarioId);
      if (s) {
        setTitle(s.title);
        setSummary(s.worldSummary || "");
        setOpeningScene(s.desc || "");
      }
    }
    setView("SETUP");
  }

  function startGameFromSetup() {
    // initialize story with world title and summary and/or opening scene
    const init: Line[] = [];
    if (title) init.push({ text: `World — ${title}`, from: "ai" });
    if (summary) init.push({ text: summary, from: "ai" });
    if (openingScene) init.push({ text: openingScene, from: "ai" });
    if (init.length === 0) init.push({ text: "A new world begins.", from: "ai" });
    setLines(init);
    setView("GAME");
  }

  // Main send logic: POST to /api/chat, stream parse via eventsource-parser
  async function sendMessage(modeOverride?: ModeKey) {
    const m = modeOverride ?? mode;

    // ERASE: remove last user+ai pair
    if (m === "erase") {
      setLines((prev) => {
        const copy = [...prev];
        // remove last AI
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].from === "ai") {
            copy.splice(i, 1);
            break;
          }
        }
        // remove last user
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

    // require input if not continue
    if (m !== "continue" && input.trim().length === 0) return;

    const userText =
      m === "say"
        ? `${charName || "You"} say: "${input.trim()}"`
        : m === "do"
        ? `${charName || "You"} attempt: ${input.trim()}`
        : m === "think"
        ? `${charName || "You"} think: ${input.trim()}`
        : m === "story"
        ? `${charName || "You"} narrate: ${input.trim()}`
        : "Continue";

    if (m !== "continue") setLines((prev) => [...prev, { text: userText, from: "user" }]);

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
          worldSummary: summary,
          openingScene,
          title,
          charName,
          charClass,
          charBackground,
          aiInstructions,
          authorsNote,
        }),
        signal: controllerRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text();
        appendLine(`(error) ${txt}`, "ai");
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // Use eventsource-parser to parse SSE chunks safely
      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          if (event.data === "[DONE]") {
            // stream finished signal
            return;
          }
          const data = event.data;
          try {
            // provider should send JSON objects per data: {...}
            const parsed = JSON.parse(data);
            if (parsed?.content) {
              appendLine(String(parsed.content), "ai");
            } else if (typeof parsed === "string") {
              appendLine(parsed, "ai");
            }
          } catch {
            // fallback: append raw text
            appendLine(String(data), "ai");
          }
        }
      });

      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          parser.feed(chunk);
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") appendLine("(stream aborted)", "ai");
      else appendLine(`(network error) ${err?.message ?? String(err)}`, "ai");
    } finally {
      setStreaming(false);
      controllerRef.current = null;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black text-white">
      {/* Top nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView("HOME")}
            className="text-white/80 hover:text-white px-2 py-1 rounded"
            title="Home"
          >
            🏠
          </button>
          <div className="text-xl font-bold">Manhwa Engine</div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen((s) => !s)}
            className="p-2 hover:bg-white/5 rounded"
            title="Status"
          >
            🛡️
          </button>
          <button
            onClick={() => setSettingsOpen((s) => !s)}
            className="p-2 hover:bg-white/5 rounded"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Views */}
      <main className="p-6 max-w-6xl mx-auto">
        {view === "HOME" && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Scenario Library</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {SCENARIOS.map((s) => (
                <div
                  key={s.id}
                  className="bg-white/5 rounded-lg p-4 flex flex-col"
                >
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="text-sm text-white/70 my-2">{s.desc}</p>
                  <div className="mt-auto flex gap-2">
                    <button
                      onClick={() => {
                        // quick start with scenario defaults
                        setTitle(s.title);
                        setSummary(s.worldSummary || "");
                        setOpeningScene(s.desc || "");
                        startGameFromSetup();
                      }}
                      className="px-3 py-2 bg-cyan-500 text-black rounded"
                    >
                      Quick Start
                    </button>
                    <button
                      onClick={() => startSetupForScenario(s.id)}
                      className="px-3 py-2 border border-white/10 rounded"
                    >
                      Customize
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {view === "SETUP" && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Setup — Create Scenario</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 p-4 rounded">
                <label className="block mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 rounded bg-black/40"
                />
                <label className="block mt-3 mb-1">Summary</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  className="w-full p-2 rounded bg-black/40"
                />
                <label className="block mt-3 mb-1">Opening Scene</label>
                <textarea
                  value={openingScene}
                  onChange={(e) => setOpeningScene(e.target.value)}
                  rows={3}
                  className="w-full p-2 rounded bg-black/40"
                />
              </div>

              <div className="bg-white/5 p-4 rounded">
                <label className="block mb-1">Character Name</label>
                <input
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  className="w-full p-2 rounded bg-black/40"
                />
                <label className="block mt-3 mb-1">Class</label>
                <input
                  value={charClass}
                  onChange={(e) => setCharClass(e.target.value)}
                  className="w-full p-2 rounded bg-black/40"
                />
                <label className="block mt-3 mb-1">Background</label>
                <textarea
                  value={charBackground}
                  onChange={(e) => setCharBackground(e.target.value)}
                  rows={3}
                  className="w-full p-2 rounded bg-black/40"
                />
                <label className="block mt-3 mb-1">AI Instructions</label>
                <textarea
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  rows={2}
                  className="w-full p-2 rounded bg-black/40"
                />
                <label className="block mt-3 mb-1">Author's Note</label>
                <textarea
                  value={authorsNote}
                  onChange={(e) => setAuthorsNote(e.target.value)}
                  rows={2}
                  className="w-full p-2 rounded bg-black/40"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => startGameFromSetup()}
                className="px-4 py-2 bg-cyan-500 text-black rounded"
              >
                Start Game
              </button>
              <button
                onClick={() => setView("HOME")}
                className="px-4 py-2 border border-white/10 rounded"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {view === "GAME" && (
          <>
            {/* The story log */}
            <div className="mb-6">
              <div
                ref={storyRef}
                className="bg-white/5 p-6 rounded-lg min-h-[48vh] max-h-[60vh] overflow-y-auto font-serif text-lg leading-relaxed"
              >
                {lines.map((ln, idx) => (
                  <p key={idx} className={`${ln.from === "user" ? "text-cyan-200" : "text-gray-200"} mb-4`}>
                    {ln.text}
                  </p>
                ))}

                {streaming && <p className="text-gray-400 italic">…streaming response…</p>}
              </div>
            </div>

            {/* Bottom toolbar & input */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex gap-2 items-center z-50">
              <input
                placeholder="Type action, dialogue, or leave blank for Continue"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="bg-transparent outline-none text-white placeholder-gray-400 w-[40rem]"
              />
              <div className="flex gap-2">
                <button onClick={() => sendMessage("do")} title="Do (Action)" className="px-3 py-1 rounded hover:bg-white/10">🗡️</button>
                <button onClick={() => sendMessage("say")} title="Say (Dialogue)" className="px-3 py-1 rounded hover:bg-white/10">💬</button>
                <button onClick={() => sendMessage("think")} title="Think (Internal)" className="px-3 py-1 rounded hover:bg-white/10">💭</button>
                <button onClick={() => sendMessage("story")} title="Story (Narration)" className="px-3 py-1 rounded hover:bg-white/10">📖</button>
                <button onClick={() => sendMessage("continue")} title="Continue" className="px-3 py-1 rounded hover:bg-white/10">🔄</button>
                <button onClick={() => sendMessage("erase")} title="Erase last" className="px-3 py-1 rounded hover:bg-white/10">🗑️</button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Simple right drawer for status (if drawerOpen) */}
      {drawerOpen && (
        <aside className="fixed right-6 top-24 w-80 bg-white/5 p-4 rounded z-40">
          <h4 className="font-semibold mb-2">Status</h4>
          <div className="text-sm text-white/70">Health: —</div>
          <div className="text-sm text-white/70">Energy: —</div>
          <div className="mt-3 text-xs text-white/60">(Status drawer placeholder)</div>
        </aside>
      )}

      {/* Simple settings drawer */}
      {settingsOpen && (
        <aside className="fixed left-6 top-24 w-96 bg-white/5 p-4 rounded z-40">
          <h4 className="font-semibold mb-2">Settings</h4>
          <div className="text-sm text-white/70">Author's Note (preview):</div>
          <p className="text-sm text-white/60 mt-2">{authorsNote || "— none —"}</p>
        </aside>
      )}
    </div>
  );
}
