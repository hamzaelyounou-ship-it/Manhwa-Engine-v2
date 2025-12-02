import React, { useEffect, useRef, useState } from "react";
import "./index.css";

/**
 * Manhwa Story Engine - App.tsx
 * - Top nav with Gear ⚙️ (Operations Room) and Shield 🛡️ (Status Drawer)
 * - Home (scenario cards) + Play view with story column (max-width: 800px)
 * - Operations Room modal (tabs): Author's Note, AI Instructions, Plot Essentials, Story Summary
 * - Status drawer (hidden by default) with Health/Energy/Stats
 * - Every request sends the Operations Room fields so the model keeps context
 */

type Mode = "ACT" | "SPEAK" | "SYSTEM";
type Line = { id: string; text: string; type: "narration" | "dialogue" | "action" | "system"; time?: string };

const INITIAL_SCENARIOS = [
  {
    id: "one",
    title: "Solo Leveling - Inspired",
    desc: "Dark growth story in a city of gates and blood.",
    img: "/scenarios/solo.jpg",
    authorsNote: "Dark tone. Player begins weak and hungry for power.",
    aiInstructions: "Second-person narrative; vivid imagery; short cinematic paragraphs.",
    plotEssentials: "MC: Jin; Faction: Hunters; Starting zone: Low-rank gate district",
    storySummary: "Jin wakes after a near-fatal fight with a low-rank spider.",
  },
  {
    id: "two",
    title: "Grand Sea Voyage",
    desc: "A seafaring adventure with choices and mutiny.",
    img: "/scenarios/pirate.jpg",
    authorsNote: "Adventure tone, emphasize choices and consequences.",
    aiInstructions: "Second-person; avoid modern tech references; keep alive-action pacing.",
    plotEssentials: "MC: Aya; Vessel: Nightingale; Goal: Find the Sun Map",
    storySummary: "On the edge of the Siren Sea, rumors grow of a hidden map.",
  },
];

export default function App(): JSX.Element {
  const [view, setView] = useState<"home" | "play">("home");
  const [scenario, setScenario] = useState<any | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [mode, setMode] = useState<Mode>("ACT");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  // Operations Room fields
  const [opsOpen, setOpsOpen] = useState(false);
  const [authorsNote, setAuthorsNote] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [plotEssentials, setPlotEssentials] = useState("");
  const [storySummary, setStorySummary] = useState("");
  // Status Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [health, setHealth] = useState(0.85);
  const [energy, setEnergy] = useState(0.6);
  const [stats, setStats] = useState<{ [k: string]: number }>({ Strength: 8, Agility: 6, Perception: 5 });

  const controllerRef = useRef<AbortController | null>(null);
  const storyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // scroll to bottom on new line
    if (storyRef.current) {
      storyRef.current.scrollTop = storyRef.current.scrollHeight;
    }
  }, [lines]);

  function openScenario(s: any) {
    setScenario(s);
    // populate operations room from scenario defaults
    setAuthorsNote(s.authorsNote ?? "");
    setAiInstructions(s.aiInstructions ?? "");
    setPlotEssentials(s.plotEssentials ?? s.plotEssentials ?? "");
    setStorySummary(s.storySummary ?? "");
    // initial seed lines
    setLines([
      { id: "seed-1", text: `${s.title} — ${s.desc}`, type: "narration", time: new Date().toLocaleTimeString() },
      { id: "seed-2", text: s.storySummary ?? "The story begins...", type: "narration", time: new Date().toLocaleTimeString() },
    ]);
    setView("play");
  }

  function pushLocalLine(text: string, type: Line["type"] = "narration") {
    setLines((prev) => [...prev, { id: Date.now().toString() + Math.random(), text, type, time: new Date().toLocaleTimeString() }]);
  }

  async function send() {
    if (!input.trim() || streaming) return;

    // user cue line (not AI)
    const cue = mode === "SPEAK" ? `You say: "${input}"` : mode === "ACT" ? `You attempt: ${input}` : `System: ${input}`;
    pushLocalLine(cue, mode === "SPEAK" ? "dialogue" : "system");

    // payload sends all ops room fields
    const payload = {
      message: input,
      mode,
      authorsNote,
      aiInstructions,
      plotEssentials,
      storySummary,
      health,
      energy,
      stats,
      history: lines.slice(-12), // limited history
      scenarioId: scenario?.id ?? null,
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
        pushLocalLine(`(error) ${txt}`, "system");
        setStreaming(false);
        return;
      }

      // placeholder assistant line
      const assistantId = Date.now().toString() + "-assistant";
      setLines((prev) => [...prev, { id: assistantId, text: "", type: "narration", time: new Date().toLocaleTimeString() }]);

      // stream loop
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          // append to assistant placeholder
          setLines((prev) => prev.map((ln) => (ln.id === assistantId ? { ...ln, text: ln.text + chunk } : ln)));
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") pushLocalLine("(stream aborted)", "system");
      else pushLocalLine(`(stream error) ${err?.message ?? String(err)}`, "system");
    } finally {
      setStreaming(false);
      controllerRef.current = null;
      // small state drift example
      setEnergy((e) => Math.max(0, e - 0.02));
    }
  }

  function stopStream() {
    controllerRef.current?.abort();
  }

  // Home create custom opens operations room
  function createCustom() {
    setScenario(null);
    setAuthorsNote("");
    setAiInstructions("");
    setPlotEssentials("");
    setStorySummary("");
    setOpsOpen(true);
  }

  return (
    <div className="v2-root">
      <div className="v2-bg" />

      {/* Top Nav */}
      <header className="v2-topnav">
        <div className="v2-left">
          <div className="v2-logo" onClick={() => setView("home")}>Manhwa Story Engine</div>
        </div>
        <div className="v2-right">
          <button aria-label="Open status drawer" className="icon-btn" onClick={() => setDrawerOpen((s) => !s)}>🛡️</button>
          <button aria-label="Open operations room" className="icon-btn" onClick={() => setOpsOpen(true)}>⚙️</button>
        </div>
      </header>

      {/* Main */}
      <main className="v2-main">
        {view === "home" && (
          <section className="v2-home">
            <h2>Scenario Library</h2>
            <div className="v2-scenarios">
              {INITIAL_SCENARIOS.map((s) => (
                <div key={s.id} className="v2-card">
                  <div className="v2-card-image" style={{ backgroundImage: `url(${s.img})` }} />
                  <div className="v2-card-body">
                    <h3>{s.title}</h3>
                    <p className="muted">{s.desc}</p>
                    <div className="v2-card-actions">
                      <button className="btn primary" onClick={() => openScenario(s)}>Play</button>
                      <button className="btn" onClick={() => { setAuthorsNote(s.authorsNote); setAiInstructions(s.aiInstructions); setPlotEssentials(s.plotEssentials || ""); setStorySummary(s.storySummary || ""); setOpsOpen(true); }}>Customize</button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="v2-card create" onClick={createCustom}>
                <div className="create-inner">
                  <div className="plus">＋</div>
                  <div>Create Custom</div>
                  <div className="muted">Set world & AI rules before you begin</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {view === "play" && (
          <section className="v2-play">
            {/* Story column */}
            <article className="v2-story" ref={storyRef}>
              <div className="v2-story-inner" ref={storyRef}>
                {lines.map((ln) => (
                  <div key={ln.id} className={`v2-paragraph v2-${ln.type}`}>
                    <p>{ln.text}</p>
                    {ln.time && <span className="v2-time">{ln.time}</span>}
                  </div>
                ))}
              </div>
            </article>

            {/* Sidebar (thin on desktop, but drawer primary) */}
            <aside className="v2-side-mini">
              <div className="mini-block">
                <div className="mini-label">Health</div>
                <div className="mini-bar"><div className="mini-fill" style={{ width: `${health * 100}%` }} /></div>
              </div>
              <div className="mini-block">
                <div className="mini-label">Energy</div>
                <div className="mini-bar"><div className="mini-fill energy" style={{ width: `${energy * 100}%` }} /></div>
              </div>
              <button className="btn small" onClick={() => setDrawerOpen(true)}>Open Status</button>
            </aside>
          </section>
        )}
      </main>

      {/* Command Pill (bottom) - only on play */}
      {view === "play" && (
        <div className="v2-command">
          <div className="modes">
            <button className={`mode ${mode === "ACT" ? "active" : ""}`} onClick={() => setMode("ACT")}>[ACT]</button>
            <button className={`mode ${mode === "SPEAK" ? "active" : ""}`} onClick={() => setMode("SPEAK")}>[SPEAK]</button>
            <button className={`mode ${mode === "SYSTEM" ? "active" : ""}`} onClick={() => setMode("SYSTEM")}>[SYSTEM]</button>
          </div>

          <input className="cmd-input" placeholder={mode === "SPEAK" ? "Say something..." : mode === "ACT" ? "Describe your action..." : "Query the system..."} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />

          <div className="cmd-actions">
            <button className="btn primary" onClick={send} disabled={streaming}>{streaming ? "Streaming…" : "Send"}</button>
            {streaming && <button className="btn" onClick={stopStream}>Stop</button>}
          </div>
        </div>
      )}

      {/* Operations Room Modal */}
      {opsOpen && (
        <div className="ops-backdrop" onMouseDown={() => setOpsOpen(false)}>
          <div className="ops-modal" onMouseDown={(e) => e.stopPropagation()}>
            <header className="ops-header">
              <h3>Operations Room</h3>
              <button className="btn" onClick={() => setOpsOpen(false)}>Close</button>
            </header>

            <div className="ops-tabs">
              <Tab label="Author's Note">
                <textarea value={authorsNote} onChange={(e) => setAuthorsNote(e.target.value)} placeholder="High priority context, tone, hooks..." />
              </Tab>

              <Tab label="AI Instructions">
                <textarea value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)} placeholder="Engine rules: second person, no repetition..." />
              </Tab>

              <Tab label="Plot Essentials">
                <textarea value={plotEssentials} onChange={(e) => setPlotEssentials(e.target.value)} placeholder="Facts: MC name, factions, world rules..." />
              </Tab>

              <Tab label="Story Summary">
                <textarea value={storySummary} onChange={(e) => setStorySummary(e.target.value)} placeholder="Short summary to keep model anchored..." />
              </Tab>
            </div>

            <footer className="ops-footer">
              <button className="btn" onClick={() => { setOpsOpen(false); }}>Done</button>
            </footer>
          </div>
        </div>
      )}

      {/* Status Drawer */}
      <div className={`status-drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-header">
          <h4>Status</h4>
          <button className="btn small" onClick={() => setDrawerOpen(false)}>Close</button>
        </div>

        <div className="drawer-body">
          <div className="stat-row">
            <div>Health</div>
            <div>{Math.round(health * 100)}%</div>
          </div>
          <div className="stat-bar"><div className="stat-fill" style={{ width: `${health * 100}%` }} /></div>

          <div className="stat-row" style={{ marginTop: 12 }}>
            <div>Energy</div>
            <div>{Math.round(energy * 100)}%</div>
          </div>
          <div className="stat-bar"><div className="stat-fill energy" style={{ width: `${energy * 100}%` }} /></div>

          <div style={{ marginTop: 16 }}>
            <h5>Stats</h5>
            <ul className="stat-list">
              {Object.entries(stats).map(([k, v]) => <li key={k}><strong>{k}</strong>: {v}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small reusable Tab component inside App.tsx to avoid extra files */
function Tab({ label, children }: { label: string; children: React.ReactNode }) {
  // We'll implement a simple accordion-like vertical tabs
  const [open, setOpen] = useState<boolean>(false);
  return (
    <div className="ops-tab">
      <button className="ops-tab-btn" onClick={() => setOpen((s) => !s)}>{label} {open ? "▾" : "▸"}</button>
      {open && <div className="ops-tab-panel">{children}</div>}
    </div>
  );
}
