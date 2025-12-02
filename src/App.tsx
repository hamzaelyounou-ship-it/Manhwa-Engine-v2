import React, { useEffect, useRef, useState } from "react";

/**
 * App.tsx
 * - Home (scenario library) default
 * - Game view when Play clicked
 * - Shield icon toggles status drawer slide-over
 * - Operations Room modal for Create Custom, injects worldSummary into API calls
 * - Five modes: Do, Say, Think, Story, Continue
 * - Streaming client: POST to /api/chat and append chunks to story area live
 */

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
      "Low-rank dungeons and a ranking system define society. Gates appear across the city; hunters gain strength by clearing them.",
  },
  {
    id: "pirate",
    title: "Grand Sea Voyage",
    desc: "High-seas adventure, mutiny and treasure.",
    img: "/scenarios/pirate.jpg",
    worldSummary:
      "The world is divided into maritime factions. Ships, crew loyalty, and treasure maps drive choices and consequences.",
  },
];

export default function App(): JSX.Element {
  // view state
  const [view, setView] = useState<"home" | "game">("home");

  // drawer & modals
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);

  // scenario + story
  const [scenarios] = useState<Scenario[]>(SAMPLE_SCENARIOS);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const storyRef = useRef<HTMLDivElement | null>(null);

  // operations room fields (injected as worldSummary)
  const [worldSummary, setWorldSummary] = useState<string>(""); // large textarea for world context

  // Input / modes
  const [mode, setMode] = useState<"do" | "say" | "think" | "story" | "continue">("story");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // status (in drawer)
  const [health] = useState<number>(0.82);
  const [energy] = useState<number>(0.47);

  // autoscroll
  useEffect(() => {
    if (storyRef.current) {
      storyRef.current.scrollTop = storyRef.current.scrollHeight;
    }
  }, [lines]);

  // Start playing a scenario (or custom if null)
  function startGame(scn: Scenario | null) {
    setCurrentScenario(scn);
    if (scn && scn.worldSummary) setWorldSummary(scn.worldSummary);
    // seed story
    setLines([
      scn ? `Scene — ${scn.title}: ${scn.desc}` : "A new custom world awakens.",
      scn?.worldSummary ?? "The world stands clear; define your story with the Operations Room.",
    ]);
    setView("game");
  }

  // Create custom -> open ops modal first
  function createCustom() {
    setWorldSummary("");
    setOpsOpen(true);
  }

  // send to API and stream
  async function sendMessage(selectedMode?: typeof mode) {
    const usedMode = selectedMode ?? mode;

    // For Continue mode, message can be empty; send special command
    const msgPayload = usedMode === "continue" ? "[CONTINUE]" : input.trim();
    if (!msgPayload) return;

    // Append a local cue (not necessary but useful)
    const cue = usedMode === "say" ? `You say: "${msgPayload}"` :
                usedMode === "do" ? `You do: ${msgPayload}` :
                usedMode === "think" ? `You think: ${msgPayload}` :
                usedMode === "story" ? `You narrate: ${msgPayload}` :
                `Continue:`;

    if (usedMode !== "continue" && input.trim() === "") return;
    if (usedMode !== "continue") setInput("");

    setLines((prev) => [...prev, cue]);

    // Prepare payload
    const payload = {
      mode: usedMode,
      message: msgPayload,
      worldSummary,
      // minimal history could be added here
      history: lines.slice(-8),
      scenarioId: currentScenario?.id ?? null,
    };

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
        setLines((prev) => [...prev, `(error) ${txt}`]);
        setStreaming(false);
        return;
      }

      // create assistant placeholder
      const assistantId = String(Date.now()) + "-assistant";
      setLines((prev) => [...prev, ""]); // placeholder empty string appended; we'll replace last empty string with streaming text
      let assistantIndex = lines.length + 1; // index where we appended placeholder (approx), but simpler approach below

      // We'll stream chunks and append them to the last line incrementally:
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      // We'll maintain current tail text separately and then push updates to lines
      let tailText = "";

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          // chunk may contain raw text or SSE 'data:' pieces depending on server
          // We'll append chunk directly (server sends plain text chunks)
          tailText += chunk;
          // update the last line in state
          setLines((prev) => {
            // If last element is placeholder (empty or our previous tail), replace it
            const copy = [...prev];
            if (copy.length === 0) {
              copy.push(tailText);
            } else {
              // replace last element
              copy[copy.length - 1] = tailText;
            }
            return copy;
          });
        }
      }

      // end stream
    } catch (err: any) {
      if (err.name === "AbortError") setLines((prev) => [...prev, "(stream aborted)"]);
      else setLines((prev) => [...prev, `(stream error) ${err?.message ?? String(err)}`]);
    } finally {
      setStreaming(false);
      controllerRef.current = null;
    }
  }

  function stopStream() {
    controllerRef.current?.abort();
  }

  // UI components simplified below
  return (
    <div className="min-h-screen bg-background text-white font-sans">
      {/* Top nav */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-black/30 backdrop-blur-md z-40 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold cursor-pointer" onClick={() => { if (view === "game") { /* confirm before exit? */ if (confirm("Exit to Home? Unsaved progress will be lost.")) { setView("home"); setLines([]); } } else { setView("home"); } }}>
            Manhwa Engine
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Shield toggles drawer */}
          <button className="p-2 hover:bg-white/5 rounded" onClick={() => setDrawerOpen((s) => !s)} aria-label="Toggle status drawer">🛡️</button>
          {/* Gear opens operations room */}
          <button className="p-2 hover:bg-white/5 rounded" onClick={() => setOpsOpen(true)} aria-label="Open Operations Room">⚙️</button>
        </div>
      </header>

      {/* Main */}
      <main className="pt-20 pb-32">
        {/* Home: scenario library */}
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
                    <button className="px-3 py-2 rounded bg-cyan-400 text-black font-semibold" onClick={() => startGame(s)}>Play</button>
                    <button className="px-3 py-2 rounded border border-white/10" onClick={() => { setWorldSummary(s.worldSummary ?? ""); setOpsOpen(true); }}>Customize</button>
                  </div>
                </div>
              ))}

              {/* Create Custom */}
              <div className="bg-white/5 rounded-lg p-6 flex items-center justify-center cursor-pointer hover:bg-white/6" onClick={createCustom}>
                <div className="text-center">
                  <div className="text-4xl mb-2">＋</div>
                  <div className="font-semibold">Create Custom</div>
                  <div className="text-sm text-white/70 mt-1">Define your World Summary / Plot Essentials before starting.</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Game view */}
        {view === "game" && (
          <section className="max-w-6xl mx-auto px-4">
            <article className="mx-auto max-w-4xl">
              <div ref={storyRef} className="bg-white/3 p-12 rounded-lg min-h-[60vh] max-h-[72vh] overflow-y-auto font-serif text-lg leading-relaxed prose prose-invert">
                {lines.length === 0 ? (
                  <p className="text-white/70">No narrative yet — use the toolbar to begin.</p>
                ) : (
                  lines.map((ln, i) => <p key={i} className="mb-6">{ln}</p>)
                )}
              </div>
            </article>
          </section>
        )}
      </main>

      {/* Status Drawer (slide-over) */}
      <div className={`fixed top-16 right-0 h-[calc(100%-4rem)] w-80 bg-black/60 backdrop-blur-md border-l border-white/6 z-50 transform transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold">Status</h4>
            <button onClick={() => setDrawerOpen(false)}>✖</button>
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
              <div className="text-sm text-white/70 mb-2">Inventory / Notes</div>
              <div className="text-sm text-white/70">No items yet.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar + Command Pill (only in Game view) */}
      {view === "game" && (
        <>
          <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-40 flex gap-3">
            <button className={`px-4 py-2 rounded-full ${mode === "do" ? "bg-white/30" : "bg-white/10"}`} onClick={() => setMode("do")}>🗡️ Do</button>
            <button className={`px-4 py-2 rounded-full ${mode === "say" ? "bg-white/30" : "bg-white/10"}`} onClick={() => setMode("say")}>💬 Say</button>
            <button className={`px-4 py-2 rounded-full ${mode === "think" ? "bg-white/30" : "bg-white/10"}`} onClick={() => setMode("think")}>💭 Think</button>
            <button className={`px-4 py-2 rounded-full ${mode === "story" ? "bg-white/30" : "bg-white/10"}`} onClick={() => setMode("story")}>📖 Story</button>
            <button className={`px-4 py-2 rounded-full ${mode === "continue" ? "bg-white/30" : "bg-white/10"}`} onClick={() => { setMode("continue"); /* immediately request continue when clicked */ sendMessage("continue"); }}>🔄 Continue</button>
          </div>

          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-3xl">
            <div className="bg-white/6 backdrop-blur-md rounded-full flex items-center gap-3 px-4 py-3">
              <input className="flex-1 bg-transparent outline-none text-white placeholder-white/60" placeholder={
                mode === "say" ? "Speak out loud..." :
                mode === "do" ? "Describe an action..." :
                mode === "think" ? "Your internal thoughts..." :
                "Narrate..." } value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} />
              <button className="px-4 py-2 rounded-full bg-cyan-400 text-black font-semibold" onClick={() => sendMessage()}>Send</button>
              {streaming && <button className="ml-2 px-3 py-2 rounded bg-white/10" onClick={() => stopStream()}>Stop</button>}
            </div>
          </div>
        </>
      )}

      {/* Operations Room Modal */}
      {opsOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50" onClick={() => setOpsOpen(false)}>
          <div className="bg-white/5 p-6 rounded-lg w-[min(920px,96%)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-3">Operations Room — World Summary / Plot Essentials</h3>

            <div className="mb-3">
              <label className="block text-sm text-white/70 mb-1">World Summary / Plot Essentials</label>
              <textarea className="w-full min-h-[160px] bg-transparent border border-white/6 rounded p-3" value={worldSummary} onChange={(e) => setWorldSummary(e.target.value)} placeholder="Define settings, factions, world rules, ranks, gates, main characters..." />
            </div>

            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 rounded bg-white/6" onClick={() => setOpsOpen(false)}>Cancel</button>
              <button className="px-4 py-2 rounded bg-cyan-400 text-black font-semibold" onClick={() => { setOpsOpen(false); /* If user created world while on Home, start game */ if (view === "home" && !currentScenario) startGame(null); }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
