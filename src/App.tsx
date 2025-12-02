import React, { useState, useRef, useEffect } from "react";

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
type ModeKey = "do" | "say" | "think" | "story" | "continue";

export default function App() {
  const [view, setView] = useState<"home" | "game">("home");
  const [scenarios] = useState<Scenario[]>(SAMPLE_SCENARIOS);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [lines, setLines] = useState<MessageLine[]>([]);
  const storyRef = useRef<HTMLDivElement | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [worldTitle, setWorldTitle] = useState("");
  const [worldSummary, setWorldSummary] = useState("");

  const [mode, setMode] = useState<ModeKey>("story");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const [bgGradient, setBgGradient] = useState<string>(
    "radial-gradient(circle at 10% 10%, #001220, #0d141f)"
  );

  const [health] = useState(0.8);
  const [energy] = useState(0.5);

  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [lines]);

  function openScenario(s: Scenario) {
    setCurrentScenario(s);
    setWorldTitle(s.title);
    setWorldSummary(s.worldSummary ?? "");
    setLines([
      { text: `Scenario — ${s.title}: ${s.desc}` },
      { text: s.worldSummary ?? "The world awaits your story." },
    ]);
    setView("game");
  }

  function createCustomScenario() {
    setCurrentScenario(null);
    setWorldTitle("");
    setWorldSummary("");
    setOpsOpen(true);
  }

  function handleStartCustom() {
    setLines([
      { text: `World — ${worldTitle || "Custom World"}` },
      { text: worldSummary || "A blank world waiting for your story." },
    ]);
    setView("game");
    setOpsOpen(false);
  }

  async function sendMessage(useMode?: ModeKey) {
    const m = useMode ?? mode;
    if (m !== "continue" && !input.trim()) return;

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
      let acc = "";

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          acc += decoder.decode(value);
          setLines((prev) => {
            const copy = [...prev];
            copy.push({ text: acc });
            return copy;
          });
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") setLines((prev) => [...prev, { text: "(stream aborted)" }]);
      else setLines((prev) => [...prev, { text: `(stream error) ${err.message}` }]);
    } finally {
      setStreaming(false);
      controllerRef.current = null;
    }
  }

  function stopStream() {
    controllerRef.current?.abort();
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: bgGradient, transition: "background 0.5s ease" }}
    >
      {/* Top Nav */}
      <header className="fixed top-0 left-0 right-0 h-16 backdrop-blur-md bg-black/30 z-50 flex items-center justify-between px-6">
        <div className="text-xl font-bold cursor-pointer" onClick={() => setView("home")}>
          Manhwa Engine
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setDrawerOpen((s) => !s)} className="p-2 hover:bg-white/10 rounded">🛡️</button>
          <button onClick={() => setSettingsOpen(true)} className="p-2 hover:bg-white/10 rounded">⚙️</button>
        </div>
      </header>

      {/* Status Drawer */}
      <div className={`fixed top-16 right-0 h-[calc(100%-4rem)] w-80 bg-black/60 backdrop-blur-md border-l border-white/10 z-40 transform transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-4">
          <h4 className="font-semibold mb-4">Status</h4>
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
            <div className="text-sm text-white/70">No items yet.</div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setSettingsOpen(false)}>
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg w-[90%] max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Appearance Settings</h3>
            <div className="mb-4">
              <label className="block text-sm text-white/70 mb-1">Background Gradient</label>
              <select
                className="w-full p-2 bg-transparent border border-white/20 rounded"
                value={bgGradient}
                onChange={(e) => setBgGradient(e.target.value)}
              >
                <option value="radial-gradient(circle at 10% 10%, #001220, #0d141f)">Deep Blue</option>
                <option value="radial-gradient(circle at 20% 20%, #2a0d2a, #0d0a14)">Dark Purple</option>
                <option value="radial-gradient(circle at 50% 50%, #0b201f, #111013)">Forest Noir</option>
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 bg-white/10 rounded" onClick={() => setSettingsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Operations Room Modal */}
      {opsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setOpsOpen(false)}>
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg w-[90%] max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <TabView
              onConfirm={handleStartCustom}
              worldTitle={worldTitle}
              setWorldTitle={setWorldTitle}
              worldSummary={worldSummary}
              setWorldSummary={setWorldSummary}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="pt-20 pb-32">
        {view === "home" && (
          <section className="max-w-6xl mx-auto px-4">
            <h1 className="text-3xl font-bold mb-6">Scenario Library</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {scenarios.map((s) => (
                <div key={s.id} className="bg-white/5 rounded-lg p-4 flex flex-col">
                  <div className="h-36 bg-gray-800 rounded-md mb-3" style={{
                    backgroundImage: s.img ? `url(${s.img})` : undefined,
                    backgroundSize: "cover",
                  }} />
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-sm text-white/70 flex-1 my-2">{s.desc}</p>
                  <div className="flex gap-2 mt-3">
                    <button className="px-3 py-2 rounded bg-cyan-400 text-black font-semibold" onClick={() => openScenario(s)}>Play</button>
                    <button className="px-3 py-2 rounded border border-white/10" onClick={() => { setWorldTitle(s.title); setWorldSummary(s.worldSummary ?? ""); setOpsOpen(true); }}>Customize</button>
                  </div>
                </div>
              ))}
              <div className="bg-white/5 rounded-lg p-6 flex items-center justify-center cursor-pointer hover:bg-white/6" onClick={createCustomScenario}>
                <div className="text-center">
                  <div className="text-4xl mb-2">＋</div>
                  <div className="font-semibold">Create Custom</div>
                  <div className="text-sm text-white/70 mt-1">Define your world & start fresh</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {view === "game" && (
          <section className="max-w-6xl mx-auto px-4">
            <article className="mx-auto max-w-4xl">
              <div ref={storyRef} className="bg-white/20 p-12 rounded-lg min-h-[60vh] max-h-[72vh] overflow-y-auto font-serif text-lg leading-relaxed">
                {lines.map((ln, idx) => (
                  <p key={idx} className="mb-6">{ln.text}</p>
                ))}
                {streaming && <div className="text-white/60 italic">…Loading narrative…</div>}
              </div>
            </article>
          </section>
        )}
      </main>

      {/* Toolbar + Command Pill */}
      {view === "game" && (
        <>
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex gap-3 z-40">
            {["do", "say", "think", "story", "continue"].map((m) => (
              <button
                key={m}
                onClick={() => {
                  if (m === "continue") sendMessage("continue");
                  else setMode(m as ModeKey);
                }}
                className={`px-4 py-2 rounded-full ${mode === m ? "bg-white/30" : "bg-white/10"}`}
              >
                {m === "do" && "🗡️ Do"}
                {m === "say" && "💬 Say"}
                {m === "think" && "💭 Think"}
                {m === "story" && "📖 Story"}
                {m === "continue" && "🔄 Continue"}
              </button>
            ))}
          </div>
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl z-40">
            <div className="bg-white/10 backdrop-blur-md rounded-full flex items-center gap-3 px-4 py-3">
              <input
                className="flex-1 bg-transparent outline-none text-white placeholder-white/60"
                placeholder={
                  mode === "say"
                    ? "Speak..."
                    : mode === "do"
                    ? "Do something..."
                    : mode === "think"
                    ? "Think..."
                    : "Narrate..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              />
              <button className="px-4 py-2 bg-cyan-400 text-black rounded-full font-semibold" onClick={() => sendMessage()}>
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TabView(props: {
  worldTitle: string;
  setWorldTitle: (v: string) => void;
  worldSummary: string;
  setWorldSummary: (v: string) => void;
  onConfirm: () => void;
}) {
  const [tab, setTab] = useState<"PLOT" | "RULES">("PLOT");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("PLOT")} className={`px-3 py-1 rounded ${tab === "PLOT" ? "bg-white/20" : "bg-white/5"}`}>PLOT</button>
        <button onClick={() => setTab("RULES")} className={`px-3 py-1 rounded ${tab === "RULES" ? "bg-white/20" : "bg-white/5"}`}>RULES</button>
      </div>

      {tab === "PLOT" && (
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-white/70">Title</label>
            <input
              className="w-full bg-transparent border border-white/10 rounded p-2"
              value={props.worldTitle}
              onChange={(e) => props.setWorldTitle(e.target.value)}
              placeholder="World / Scenario Title"
            />
          </div>
          <div>
            <label className="block mb-1 text-white/70">World Summary / Plot Essentials</label>
            <textarea
              className="w-full bg-transparent border border-white/10 rounded p-2 min-h-[120px]"
              value={props.worldSummary}
              onChange={(e) => props.setWorldSummary(e.target.value)}
              placeholder="Describe setting, mechanics, factions, tone..."
            />
          </div>
        </div>
      )}

      {tab === "RULES" && (
        <div className="space-y-4">
          <div>
            <label className="block mb-1 text-white/70">AI Instructions</label>
            <textarea className="w-full bg-transparent border border-white/10 rounded p-2 min-h-[80px]" placeholder="Rules for narration..." />
          </div>
          <div>
            <label className="block mb-1 text-white/70">Author's Note</label>
            <textarea className="w-full bg-transparent border border-white/10 rounded p-2 min-h-[80px]" placeholder="Optional notes..." />
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button className="px-4 py-2 bg-white/10 rounded" onClick={props.onConfirm}>Save & Start</button>
      </div>
    </div>
  );
}
