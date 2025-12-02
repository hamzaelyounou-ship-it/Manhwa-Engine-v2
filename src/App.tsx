import React, { useEffect, useRef, useState } from "react";

/**
 * src/App.tsx
 * - Default: HOME screen (scenario library)
 * - Click Play => switches to GAME view
 * - In GAME view: header shows Home (X) icon which triggers Safe Exit modal
 * - Shield icon toggles Status Drawer
 * - Gear icon opens Operations Room (Settings) modal
 * - Create Custom opens Operations Room BEFORE starting a game
 *
 * NOTE: This file intentionally contains everything in one place to avoid missing imports.
 * Replace placeholders (images, API calls) with your real implementations as needed.
 */

type Scenario = {
  id: string;
  title: string;
  desc: string;
  img?: string;
  authorsNote?: string;
  aiInstructions?: string;
  plotEssentials?: string;
  storySummary?: string;
};

const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: "s1",
    title: "Solo Leveling — Inspired",
    desc: "A dark growth tale. Start weak, climb to power.",
    img: "/scenarios/solo.jpg",
    authorsNote: "Dark tone: player begins weak.",
    aiInstructions: "Second-person; cinematic sentences; no assistant tags.",
    plotEssentials: "MC: Jin; Faction: Hunters",
    storySummary: "Jin wakes bleeding at the gate of a ruined district.",
  },
  {
    id: "s2",
    title: "Grand Sea Voyage",
    desc: "Seafaring choices and mutiny on the horizon.",
    img: "/scenarios/pirate.jpg",
    authorsNote: "Adventure tone; emphasize consequences.",
    aiInstructions: "Second-person; present-tense; vivid imagery.",
    plotEssentials: "MC: Aya; Ship: Nightingale",
    storySummary: "The Nightingale catches a strange light at dusk.",
  },
];

export default function App(): JSX.Element {
  // VIEW: 'home' | 'game'
  const [view, setView] = useState<"home" | "game">("home");

  // UI: drawer, modals
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  // story & scenario
  const [scenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const storyRef = useRef<HTMLDivElement | null>(null);

  // operations room fields (persisted into each API call)
  const [authorsNote, setAuthorsNote] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [plotEssentials, setPlotEssentials] = useState("");
  const [storySummary, setStorySummary] = useState("");

  // modes: do/say/think/story
  const [mode, setMode] = useState<"do" | "say" | "think" | "story">("story");
  const [input, setInput] = useState("");

  // simple status values (drawer)
  const [health] = useState(0.78);
  const [energy] = useState(0.53);

  // ensure story scrolls down on new lines
  useEffect(() => {
    if (storyRef.current) {
      storyRef.current.scrollTop = storyRef.current.scrollHeight;
    }
  }, [lines]);

  // Start game with scenario (or custom)
  function startGameWithScenario(scn: Scenario | null) {
    // populate ops-room fields if scenario provided
    if (scn) {
      setAuthorsNote(scn.authorsNote ?? "");
      setAiInstructions(scn.aiInstructions ?? "");
      setPlotEssentials(scn.plotEssentials ?? "");
      setStorySummary(scn.storySummary ?? "");
      setCurrentScenario(scn);
      setLines([
        `Scene: ${scn.title} — ${scn.desc}`,
        scn.storySummary ?? "The story begins...",
      ]);
    } else {
      // custom created scenario: keep ops fields as-is
      setCurrentScenario(null);
      setLines(["A new world awakens."]);
    }

    setView("game");
  }

  // Create custom scenario: open ops modal first
  function createCustom() {
    // clear fields for new creation
    setAuthorsNote("");
    setAiInstructions("");
    setPlotEssentials("");
    setStorySummary("");
    setOpsOpen(true);
  }

  // Safe Exit flow: when clicking header X in game view
  function attemptExitToHome() {
    setConfirmExitOpen(true);
  }

  function confirmExit() {
    // close game and reset minimal state
    setView("home");
    setCurrentScenario(null);
    setLines([]);
    setConfirmExitOpen(false);
    setDrawerOpen(false);
  }

  function cancelExit() {
    setConfirmExitOpen(false);
  }

  // Send message (placeholder: append local lines and clear input)
  async function send() {
    if (!input.trim()) return;

    // produce a short local line depending on mode then clear input.
    const prefix =
      mode === "do" ? "You do: " :
      mode === "say" ? 'You say: "' :
      mode === "think" ? "You think: " :
      "Story: ";

    const content =
      mode === "say" ? `${prefix}${input}"` : `${prefix}${input}`;

    // append user cue
    setLines((prev) => [...prev, content]);

    // Placeholder for AI call: here you would call api/chat and stream response
    // For now simulate a response that observes the mode:
    setTimeout(() => {
      const aiResp =
        mode === "think"
          ? `You feel the memory twist — an internal whisper answers: \"${input}\".`
          : mode === "do"
          ? `The world reacts: ${input} causes a low metallic groan nearby.`
          : mode === "say"
          ? `A voice returns: The alley answers your words with silence, then a soft reply.`
          : `The narration continues: ${input}`;

      setLines((prev) => [...prev, aiResp]);
    }, 450);

    setInput("");
  }

  return (
    <div className="min-h-screen bg-background text-white">

      {/* Top Nav */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-md flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-4">
          <div
            className="text-lg font-semibold cursor-pointer"
            onClick={() => {
              // If on home, do nothing. If on game, treat as safe-exit attempt.
              if (view === "game") attemptExitToHome();
              else setView("home");
            }}
            aria-label="Home / Exit"
            title={view === "game" ? "Exit to Home (confirm)" : "Home"}
          >
            {/* show X icon when in game to indicate 'leave' */}
            {view === "game" ? "✖" : "🏠"} Manhwa Engine
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Shield toggles drawer */}
          <button
            onClick={() => setDrawerOpen((s) => !s)}
            className="p-2 rounded hover:bg-white/5"
            aria-label="Toggle Status Drawer"
          >
            🛡️
          </button>

          {/* Gear opens Operations Room */}
          <button
            onClick={() => setOpsOpen(true)}
            className="p-2 rounded hover:bg-white/5"
            aria-label="Open Operations Room"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="pt-20 pb-36">
        {/* HOME: Scenario Library */}
        {view === "home" && (
          <section className="max-w-6xl mx-auto px-4">
            <h1 className="text-3xl font-bold mb-6">Scenario Library</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {scenarios.map((s) => (
                <div key={s.id} className="bg-white/5 rounded-lg p-4 flex flex-col">
                  <div className="h-36 bg-gray-800 rounded-md mb-3" style={{ backgroundImage: s.img ? `url(${s.img})` : undefined, backgroundSize: "cover" }} />
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-sm text-white/70 flex-1 my-2">{s.desc}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      className="px-3 py-2 rounded bg-blue-600 text-black font-semibold"
                      onClick={() => startGameWithScenario(s)}
                    >
                      Play
                    </button>
                    <button
                      className="px-3 py-2 rounded border border-white/10"
                      onClick={() => {
                        // load scenario fields into ops modal for editing, then open ops modal
                        setAuthorsNote(s.authorsNote ?? "");
                        setAiInstructions(s.aiInstructions ?? "");
                        setPlotEssentials(s.plotEssentials ?? "");
                        setStorySummary(s.storySummary ?? "");
                        setOpsOpen(true);
                      }}
                    >
                      Customize
                    </button>
                  </div>
                </div>
              ))}

              {/* Create Custom card */}
              <div className="bg-white/5 rounded-lg p-6 flex items-center justify-center cursor-pointer hover:bg-white/6" onClick={createCustom}>
                <div className="text-center">
                  <div className="text-4xl mb-2">＋</div>
                  <div className="font-semibold">Create Custom</div>
                  <div className="text-sm text-white/70 mt-1">Open Operations Room to define your world.</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* GAME view */}
        {view === "game" && (
          <section className="max-w-6xl mx-auto px-4">
            <div className="md:flex md:items-start md:gap-8">
              {/* Wide Story Reader (centered column) */}
              <article className="w-full max-w-4xl mx-auto">
                <div
                  ref={storyRef}
                  className="bg-white/3 rounded-lg p-10 min-h-[60vh] max-h-[70vh] overflow-y-auto prose prose-invert"
                >
                  {lines.length === 0 ? (
                    <p className="text-lg text-white/70">No content yet — use the command pill below to begin.</p>
                  ) : (
                    lines.map((ln, i) => (
                      <p key={i} className="mb-6 text-lg leading-relaxed font-serif">{ln}</p>
                    ))
                  )}
                </div>
              </article>
            </div>
          </section>
        )}
      </main>

      {/* Status Drawer (Slide-over) */}
      <div
        className={`fixed right-0 top-16 h-[calc(100%-4rem)] w-80 bg-black/60 backdrop-blur-md border-l border-white/6 z-50 transform transition-all duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!drawerOpen}
      >
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold">Status</h4>
            <button onClick={() => setDrawerOpen(false)} className="p-1">✖</button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-sm text-white/70 mb-1">Health</div>
              <div className="w-full bg-white/10 h-3 rounded-full">
                <div className="h-3 rounded-full bg-red-500" style={{ width: `${health * 100}%` }} />
              </div>
            </div>

            <div>
              <div className="text-sm text-white/70 mb-1">Energy</div>
              <div className="w-full bg-white/10 h-3 rounded-full">
                <div className="h-3 rounded-full bg-cyan-400" style={{ width: `${energy * 100}%` }} />
              </div>
            </div>

            <div>
              <div className="text-sm text-white/70 mb-2">Stats</div>
              <ul className="text-sm space-y-1">
                <li>Strength: 8</li>
                <li>Agility: 6</li>
                <li>Perception: 5</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Command Pill & Mode Toolbar (only in GAME view) */}
      {view === "game" && (
        <>
          <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 flex gap-3">
            <button className={`px-4 py-2 rounded-full ${mode === "do" ? "bg-white/30" : "bg-white/10"}`} onClick={() => setMode("do")}>🗡️ Do</button>
            <button className={`px-4 py-2 rounded-full ${mode === "say" ? "bg-white/30" : "bg-white/10"}`} onClick={() => setMode("say")}>💬 Say</button>
            <button className={`px-4 py-2 rounded-full ${mode === "think" ? "bg-white/30" : "bg-white/10"}`} onClick={() => setMode("think")}>💭 Think</button>
            <button className={`px-4 py-2 rounded-full ${mode === "story" ? "bg-white/30" : "bg-white/10"}`} onClick={() => setMode("story")}>📖 Story</button>
          </div>

          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-3xl">
            <div className="bg-white/6 backdrop-blur-md rounded-full flex items-center gap-3 px-4 py-3">
              <input
                className="flex-1 bg-transparent outline-none text-white placeholder-white/60"
                placeholder={mode === "say" ? "Speak out loud..." : mode === "do" ? "Describe an action..." : mode === "think" ? "Your thoughts..." : "Narrate..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { send(); } }}
              />
              <button className="px-4 py-2 rounded-full bg-cyan-400 text-black font-semibold" onClick={() => send()}>Send</button>
            </div>
          </div>
        </>
      )}

      {/* Operations Room modal */}
      {opsOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50" onClick={() => setOpsOpen(false)}>
          <div className="bg-white/5 backdrop-blur-md p-6 rounded-lg w-[min(880px,96%)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-3">Operations Room</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Author's Note</label>
                <textarea className="w-full min-h-[120px] bg-transparent border border-white/6 rounded p-2" value={authorsNote} onChange={(e) => setAuthorsNote(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">AI Instructions</label>
                <textarea className="w-full min-h-[120px] bg-transparent border border-white/6 rounded p-2" value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Plot Essentials</label>
                <textarea className="w-full min-h-[80px] bg-transparent border border-white/6 rounded p-2" value={plotEssentials} onChange={(e) => setPlotEssentials(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm text-white/70 mb-1">Story Summary</label>
                <textarea className="w-full min-h-[80px] bg-transparent border border-white/6 rounded p-2" value={storySummary} onChange={(e) => setStorySummary(e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button className="px-4 py-2 rounded bg-white/6" onClick={() => setOpsOpen(false)}>Cancel</button>
              <button className="px-4 py-2 rounded bg-cyan-400 text-black font-semibold" onClick={() => { setOpsOpen(false); /* if on home and custom creation, start game */ if (view === "home" && !currentScenario) { startGameWithScenario(null); } }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Exit Modal */}
      {confirmExitOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60">
          <div className="bg-white/5 p-6 rounded-lg max-w-md w-full">
            <h4 className="text-lg font-semibold mb-2">Are you sure you want to exit?</h4>
            <p className="text-sm text-white/70 mb-4">Unsaved progress will be lost.</p>
            <div className="flex justify-end gap-3">
              <button className="px-3 py-2 rounded bg-white/6" onClick={cancelExit}>Cancel</button>
              <button className="px-3 py-2 rounded bg-red-600 text-black font-semibold" onClick={confirmExit}>Exit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
