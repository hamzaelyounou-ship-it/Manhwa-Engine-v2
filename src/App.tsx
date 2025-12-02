import React, { useEffect, useRef, useState } from "react";
import "./index.css";
import SettingsModal from "./components/SettingsModal";

type Mode = "ACT" | "SPEAK" | "SYSTEM";
type Line = { id: string; text: string; type: "narration" | "dialogue" | "action" | "system"; time?: string };

const SCENARIOS = [
  {
    id: "solo",
    title: "Solo Leveling - Inspired",
    desc: "A hungry hunter rises in a city of monsters. Dark, action-forward.",
    image: "/scenarios/solo.jpg",
    authorsNote: "Dark tone. Player is underpowered at start. Slow-burn growth.",
    aiInstructions: "Second-person. Vivid present tense. No assistant tags. Avoid modern brand names.",
  },
  {
    id: "pirate",
    title: "Grand Seafaring",
    desc: "High seas, mutiny whispers, treasure maps and moral choices.",
    image: "/scenarios/pirate.jpg",
    authorsNote: "Adventure tone. Focus on exploration and choice consequences.",
    aiInstructions: "Second-person. Avoid meta commentary. Keep passages short and cinematic.",
  },
  {
    id: "custom",
    title: "Custom Scenario",
    desc: "Create your own world. Use Settings to inject context.",
    image: "/scenarios/custom.jpg",
    authorsNote: "",
    aiInstructions: "",
  },
];

export default function App(): JSX.Element {
  const [view, setView] = useState<"home" | "play">("home");
  const [scenario, setScenario] = useState<any | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [mode, setMode] = useState<Mode>("ACT");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [authorsNote, setAuthorsNote] = useState<string>("");
  const [aiInstructions, setAiInstructions] = useState<string>("");
  const [fontSize, setFontSize] = useState<number>(16);

  const [character, setCharacter] = useState<string>("You");
  const [location, setLocation] = useState<string>("Neon Docks — Sector 7");
  const [health, setHealth] = useState<number>(0.8);
  const [energy, setEnergy] = useState<number>(0.55);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const bookRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (bookRef.current) {
      bookRef.current.scrollTop = bookRef.current.scrollHeight;
    }
  }, [lines]);

  // Start playing a scenario
  function playScenario(s: any) {
    setScenario(s);
    setAuthorsNote(s.authorsNote ?? "");
    setAiInstructions(s.aiInstructions ?? "");
    setLines([
      {
        id: "seed-0",
        text: `You enter: ${s.title}. ${s.desc}`,
        type: "narration",
        time: new Date().toLocaleTimeString(),
      },
    ]);
    setView("play");
  }

  function pushLine(text: string, type: Line["type"] = "narration") {
    setLines((prev) => [...prev, { id: String(Date.now()) + Math.random(), text, type, time: new Date().toLocaleTimeString() }]);
  }

  // Send to API and stream response into the latest assistant line
  async function send() {
    if (!input.trim() || streaming) return;
    // push user cue
    const cue = mode === "SPEAK" ? `You say: "${input}"` : mode === "ACT" ? `You attempt: ${input}` : `System: ${input}`;
    pushLine(cue, mode === "SPEAK" ? "dialogue" : "system");

    const payload = {
      message: input,
      mode,
      worldInfo: { character, location, health, energy },
      history: lines.slice(-12),
      authorsNote,
      aiInstructions,
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
        const text = await res.text();
        pushLine(`(Error) ${text}`, "system");
        setStreaming(false);
        return;
      }

      // create a placeholder assistant line
      const assistantId = String(Date.now()) + "-assistant";
      setLines((prev) => [...prev, { id: assistantId, text: "", type: "narration", time: new Date().toLocaleTimeString() }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          // append chunk to the assistant placeholder
          setLines((prev) =>
            prev.map((ln) => (ln.id === assistantId ? { ...ln, text: ln.text + chunk } : ln))
          );
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        pushLine("(stream aborted)", "system");
      } else {
        pushLine(`(stream error) ${err?.message ?? String(err)}`, "system");
      }
    } finally {
      setStreaming(false);
      controllerRef.current = null;
      // tiny example state change
      setEnergy((e) => Math.max(0, e - 0.02));
    }
  }

  function stopStreaming() {
    controllerRef.current?.abort();
  }

  // UI: header + scenario grid or play view
  return (
    <div className="ms-root" style={{ fontSize: `${fontSize}px` }}>
      <div className="ms-bg" />

      <header className="ms-topnav">
        <div className="ms-logo" onClick={() => setView("home")}>Manhwa Story Engine</div>
        <div className="ms-top-actions">
          <button className="icon-btn" title="Home" onClick={() => setView("home")}>🏠</button>
          <button className="icon-btn" title="Profile">👤</button>
          <button className="icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}>⚙️</button>
        </div>
      </header>

      <main className="ms-main">
        {view === "home" && (
          <section className="ms-home">
            <h2 className="ms-page-title">Scenario Library</h2>
            <div className="ms-grid">
              {SCENARIOS.map((s) => (
                <div key={s.id} className="ms-card">
                  <div className="ms-card-image" style={{ backgroundImage: `url(${s.image})` }} />
                  <div className="ms-card-body">
                    <h3 className="ms-card-title">{s.title}</h3>
                    <p className="ms-card-desc">{s.desc}</p>
                    <div className="ms-card-actions">
                      <button className="btn btn-primary" onClick={() => playScenario(s)}>Play</button>
                      <button className="btn" onClick={() => { setAuthorsNote(s.authorsNote); setAiInstructions(s.aiInstructions); setSettingsOpen(true); }}>Edit</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "play" && (
          <section className="ms-play">
            <aside className="ms-side">
              <div className="ms-side-block">
                <label>Character</label>
                <input className="ms-input" value={character} onChange={(e) => setCharacter(e.target.value)} />
              </div>

              <div className="ms-side-block">
                <label>Location</label>
                <input className="ms-input" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>

              <div className="ms-side-block">
                <label>Health</label>
                <div className="ms-progress">
                  <div className="ms-progress-fill" style={{ width: `${health * 100}%` }} />
                </div>
              </div>

              <div className="ms-side-block">
                <label>Energy</label>
                <div className="ms-progress">
                  <div className="ms-progress-fill energy" style={{ width: `${energy * 100}%` }} />
                </div>
              </div>

              <div className="ms-side-footer">
                <small>Tip: Use the command pill below to send actions or dialogue. Settings allow deep AI adjustments.</small>
              </div>
            </aside>

            <section className="ms-story" ref={bookRef}>
              <div className="ms-story-inner">
                {lines.map((ln) => (
                  <article key={ln.id} className={`ms-paragraph ms-${ln.type}`}>
                    <p>{ln.text}</p>
                    {ln.time && <span className="ms-time">{ln.time}</span>}
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}
      </main>

      {/* Command Pill */}
      {view === "play" && (
        <div className="ms-command">
          <div className="ms-modes">
            <button className={`mode-btn ${mode === "ACT" ? "active":""}`} onClick={() => setMode("ACT")}>[ACT]</button>
            <button className={`mode-btn ${mode === "SPEAK" ? "active":""}`} onClick={() => setMode("SPEAK")}>[SPEAK]</button>
            <button className={`mode-btn ${mode === "SYSTEM" ? "active":""}`} onClick={() => setMode("SYSTEM")}>[SYSTEM]</button>
          </div>

          <input
            className="ms-command-input"
            placeholder={ mode === "SPEAK" ? "Say something..." : mode === "ACT" ? "Describe your action..." : "Ask system / inventory..." }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />

          <div className="ms-command-actions">
            <button className="btn btn-primary" onClick={send} disabled={streaming}>{streaming ? "Streaming…" : "Send"}</button>
            {streaming && <button className="btn" onClick={stopStreaming}>Stop</button>}
          </div>
        </div>
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        authorsNote={authorsNote}
        onAuthorsNoteChange={setAuthorsNote}
        aiInstructions={aiInstructions}
        onAiInstructionsChange={setAiInstructions}
        fontSize={fontSize}
        onFontSizeChange={(n) => setFontSize(n)}
      />
    </div>
  );
}
