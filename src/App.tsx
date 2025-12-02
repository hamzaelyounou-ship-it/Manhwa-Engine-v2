import React, { useEffect, useRef, useState } from "react";
import "./index.css";

type Mode = "ACT" | "SPEAK" | "SYSTEM";

type Line = {
  id: string;
  text: string;
  type: "narration" | "dialogue" | "action" | "system";
  time?: string;
};

export default function App(): JSX.Element {
  const [lines, setLines] = useState<Line[]>(initialLines());
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("ACT");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [character, setCharacter] = useState("You");
  const [location, setLocation] = useState("Neon Docks — Sector 7");
  const [health, setHealth] = useState(0.8);
  const [energy, setEnergy] = useState(0.55);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    // autoscroll on new lines
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  function pushLocalLine(text: string, type: Line["type"]) {
    setLines((s) => [
      ...s,
      { id: String(Date.now()), text, type, time: new Date().toLocaleTimeString() },
    ]);
  }

  async function send() {
    if (!input.trim() || streaming) return;
    // Append a user-chosen "cue" line to the log for context (not the AI output)
    const cueText =
      mode === "ACT"
        ? `You perform an action: ${input}`
        : mode === "SPEAK"
        ? `You say: "${input}"`
        : `System query: ${input}`;
    pushLocalLine(cueText, mode === "SPEAK" ? "dialogue" : "system");

    // Prepare payload
    const payload = {
      message: input,
      mode,
      worldInfo: {
        character,
        location,
        health,
        energy,
        anchors: {
          faction: "Harbor Syndicate",
          weather: "Drizzle, luminescent mist",
        },
      },
      history: lines.slice(-12).map((l) => ({ text: l.text, type: l.type })), // short history
    };

    setInput("");
    setStreaming(true);

    // Stream from server
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

      // create an empty assistant line and stream into it
      const assistantId = String(Date.now());
      setLines((s) => [...s, { id: assistantId, text: "", type: "narration", time: new Date().toLocaleTimeString() }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          // The server sends raw text chunks (already cleaned). Append directly.
          setLines((prev) =>
            prev.map((ln) =>
              ln.id === assistantId ? { ...ln, text: ln.text + chunk } : ln
            )
          );
        }
      }
      // end of stream
    } catch (err: any) {
      if (err.name === "AbortError") {
        pushLocalLine("(stream aborted)", "system");
      } else {
        pushLocalLine(`(stream error) ${err?.message ?? err}`, "system");
      }
    } finally {
      setStreaming(false);
      controllerRef.current = null;
      // small simulated state change when stream finishes (demo)
      setEnergy((e) => Math.max(0, Math.min(1, e - 0.02)));
    }
  }

  function stopStream() {
    controllerRef.current?.abort();
  }

  return (
    <div className="cd-root">
      <div className="cd-bg" aria-hidden />

      <div className="cd-grid">
        <main className="cd-main">
          <header className="cd-header">
            <div>
              <h1 className="cd-title">Cinematic Story Dashboard</h1>
              <p className="cd-sub">An immersive, second-person narrative — the world responds to your commands.</p>
            </div>

            <div className="header-controls">
              <div className="mode-pill">Mode: <strong>{mode}</strong></div>
              <button
                className="sidebar-toggle"
                onClick={() => setSidebarOpen((s) => !s)}
                aria-expanded={sidebarOpen}
              >
                {sidebarOpen ? "Hide State" : "Show State"}
              </button>
            </div>
          </header>

          <section className="cd-story" ref={feedRef} aria-live="polite" aria-atomic="false">
            <div className="book-surface">
              {lines.map((l) => (
                <div key={l.id} className={`book-line book-line-${l.type}`}>
                  <div className="line-body">
                    <p className="line-text">{l.text}</p>
                    {l.time && <span className="line-time">{l.time}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className={`cd-side ${sidebarOpen ? "open" : ""}`}>
          <div className="side-top">
            <h2 className="side-title">Live State</h2>
            <p className="side-sub">Anchors for the engine</p>
          </div>

          <div className="side-body">
            <label className="field-label">Character</label>
            <input className="field-input" value={character} onChange={(e) => setCharacter(e.target.value)} />

            <label className="field-label">Location</label>
            <input className="field-input" value={location} onChange={(e) => setLocation(e.target.value)} />

            <div className="stat-block">
              <div className="stat-row">
                <div className="stat-name">Health</div>
                <div className="stat-val">{Math.round(health * 100)}%</div>
              </div>
              <div className="stat-bar">
                <div className="stat-bar-fill" style={{ width: `${health * 100}%` }} />
              </div>

              <div className="stat-row" style={{ marginTop: 10 }}>
                <div className="stat-name">Energy</div>
                <div className="stat-val">{Math.round(energy * 100)}%</div>
              </div>
              <div className="stat-bar">
                <div className="stat-bar-fill energy" style={{ width: `${energy * 100}%` }} />
              </div>
            </div>

            <div className="anchors-list">
              <div><strong>Faction:</strong> Harbor Syndicate</div>
              <div><strong>Weather:</strong> Drizzle, luminescent mist</div>
              <div><strong>Time:</strong> {new Date().toLocaleTimeString()}</div>
            </div>
          </div>

          <footer className="side-foot">
            <small className="muted">Tip: Choose a Mode, write a prompt, then press Send. Streaming responses will appear live.</small>
          </footer>
        </aside>
      </div>

      {/* Floating Command Bar */}
      <div className="cd-comm">
        <div className="comm-left">
          <div className={`comm-mode ${mode === "ACT" ? "active" : ""}`} onClick={() => setMode("ACT")}>[ACT]</div>
          <div className={`comm-mode ${mode === "SPEAK" ? "active" : ""}`} onClick={() => setMode("SPEAK")}>[SPEAK]</div>
          <div className={`comm-mode ${mode === "SYSTEM" ? "active" : ""}`} onClick={() => setMode("SYSTEM")}>[SYSTEM]</div>
        </div>

        <div className="comm-middle">
          <input
            className="comm-input"
            placeholder={mode === "ACT" ? "Describe the action..." : mode === "SPEAK" ? "Write your dialogue..." : "Ask the system / check inventory..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label="Command input"
          />
          <div className="comm-btns">
            <button className="send-btn" onClick={send} disabled={streaming}>{streaming ? "Streaming…" : "Send"}</button>
            {streaming && <button className="stop-btn" onClick={stopStream}>Stop</button>}
          </div>
        </div>

        <div className="comm-right">
          <button className="save-btn" onClick={() => {
            navigator.clipboard?.writeText(JSON.stringify({ character, location, health, energy }));
            pushLocalLine("State copied to clipboard.", "system");
          }}>Export State</button>
        </div>
      </div>

      {/* mobile open */}
      <button className="mobile-open" onClick={() => setSidebarOpen(true)}>State</button>
    </div>
  );
}

function initialLines(): Line[] {
  return [
    {
      id: "seed-1",
      text:
        "You step into the alley where neon bleeds into puddles. The air tastes of ozone and old stories.",
      type: "narration",
      time: new Date().toLocaleTimeString(),
    },
    {
      id: "seed-2",
      text: `"You shouldn't be here," a voice says from the shadowed doorway.`,
      type: "dialogue",
      time: new Date().toLocaleTimeString(),
    },
    {
      id: "seed-3",
      text: "A crate topples. Metal sings. Your hands find a grip on cool steel.",
      type: "action",
      time: new Date().toLocaleTimeString(),
    },
  ];
}
