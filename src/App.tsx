import React, { useEffect, useRef, useState } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import "./index.css";

/**
 * Clean SPA with four views now: HOME, SETUP (tabs), LOADING, GAME.
 */

type View = "HOME" | "SETUP" | "LOADING" | "GAME";
type Mode = "do" | "say" | "think" | "story" | "continue" | "erase";
type Line = { text: string; who: "user" | "ai" };

export default function App(): JSX.Element {
  const [view, setView] = useState<View>("HOME");

  // Smooth transitions
  const [fade, setFade] = useState("fade-in");

  const applyView = (v: View) => {
    setFade("fade-out");
    setTimeout(() => {
      setView(v);
      setFade("fade-in");
    }, 180);
  };

  // Setup state (tabs)
  const [activeSetupTab, setActiveSetupTab] = useState<"PLOT" | "RULES" | "APPEARANCE">("PLOT");
  const [plotTitle, setPlotTitle] = useState("");
  const [plotSummary, setPlotSummary] = useState("");
  const [openingScene, setOpeningScene] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [authorsNote, setAuthorsNote] = useState("");
  const [bgAccent, setBgAccent] = useState("#0f1724");

  // Game state
  const [lines, setLines] = useState<Line[]>([
    { text: "Welcome — start a scenario or create a custom world.", who: "ai" },
  ]);
  const [mode, setMode] = useState<Mode>("story");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const storyRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [lines, streaming]);

  // Sample scenarios
  const SCENARIOS = [
    {
      id: "solo",
      title: "Solo Leveling — Inspired",
      desc: "A low-rank hunter rises in a dangerous world of gates and monsters.",
      worldSummary: "Gates spawn across the city; hunters clear dungeons and gain rank.",
    },
    {
      id: "sea",
      title: "Grand Sea Voyage",
      desc: "High-seas adventure: treasures, storms, and rivalry.",
      worldSummary: "Factions and naval power shape the seas; crews search for glory.",
    },
    {
      id: "custom",
      title: "Custom Scenario",
      desc: "Create your own world — open the Setup.",
      worldSummary: "",
    },
  ];

  function startSetupFromScenario(id: string) {
    const s = SCENARIOS.find((x) => x.id === id);
    if (!s) return;
    if (id === "custom") {
      setPlotTitle("");
      setPlotSummary("");
      setOpeningScene("");
    } else {
      setPlotTitle(s.title);
      setPlotSummary(s.worldSummary || "");
      setOpeningScene(s.desc || "");
    }
    setActiveSetupTab("PLOT");
    applyView("SETUP");
  }

  /** ⭐ NEW — START GAME WITH LOADING SCREEN */
  function startGameWithLoading() {
    applyView("LOADING");

    setTimeout(() => {
      startGameFromSetup(); // existing
    }, 1800);
  }

  function startGameFromSetup() {
    const initial: Line[] = [];
    if (plotTitle) initial.push({ text: `World — ${plotTitle}`, who: "ai" });
    if (plotSummary) initial.push({ text: plotSummary, who: "ai" });
    if (openingScene) initial.push({ text: openingScene, who: "ai" });
    if (initial.length === 0) initial.push({ text: "A new tale begins.", who: "ai" });
    setLines(initial);
    applyView("GAME");
  }

  function appendLine(text: string, who: Line["who"] = "ai") {
    setLines((prev) => [...prev, { text, who }]);
  }

  async function sendMessage(modeOverride?: Mode) {
    const m = modeOverride ?? mode;

    if (m === "erase") {
      setLines((prev) => {
        const c = [...prev];
        for (let i = c.length - 1; i >= 0; i--) {
          if (c[i].who === "ai") {
            c.splice(i, 1);
            break;
          }
        }
        for (let i = c.length - 1; i >= 0; i--) {
          if (c[i].who === "user") {
            c.splice(i, 1);
            break;
          }
        }
        return c;
      });
      return;
    }

    if (m !== "continue" && input.trim().length === 0) return;

    const userText =
      m === "say"
        ? `You say: "${input.trim()}"`
        : m === "do"
        ? `You attempt: ${input.trim()}`
        : m === "think"
        ? `You think: ${input.trim()}`
        : m === "story"
        ? `You narrate: ${input.trim()}`
        : "Continue";

    if (m !== "continue") appendLine(userText, "user");
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
          plot: { title: plotTitle, summary: plotSummary, opening: openingScene },
          rules: { aiInstructions, authorsNote },
        }),
        signal: controllerRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const t = await res.text();
        appendLine(`(error) ${t}`, "ai");
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          if (event.data === "[DONE]") return;
          try {
            const j = JSON.parse(event.data);
            if (j?.content) appendLine(String(j.content), "ai");
            else if (typeof j === "string") appendLine(j, "ai");
          } catch {
            appendLine(String(event.data), "ai");
          }
        }
      });

      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        finished = done;
        if (value) {
          parser.feed(decoder.decode(value, { stream: true }));
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

  function undo() {
    setLines((prev) => prev.slice(0, Math.max(0, prev.length - 2)));
  }
  function redo() {}

  return (
    <div className={`app-root ${fade}`}>
      {/* Top Nav */}
      <header className="topbar">
        <div className="brand" onClick={() => applyView("HOME")}>Manhwa Engine</div>
        <div className="top-actions">
          {view === "GAME" && (
            <>
              <button className="icon-btn" onClick={undo} title="Undo">↩️</button>
              <button className="icon-btn" onClick={redo} title="Redo">↪️</button>
            </>
          )}
          <button className="icon-btn" onClick={() => applyView("SETUP")} title="Create">⚙️</button>
        </div>
      </header>

      <main className="main-container">

        {/* ⭐ NEW — LOADING SCREEN */}
        {view === "LOADING" && (
          <div className="loading-page">
            <div className="dots-loader">
              <div></div>
              <div></div>
              <div></div>
            </div>
            <p className="loading-text">Shaping your world…</p>
          </div>
        )}

        {view === "HOME" && (
          <section className="library section-padding">
            <h2 className="section-title">Scenario Library</h2>
            <div className="card-grid">
              {SCENARIOS.map((s) => (
                <article key={s.id} className="scenario-card">
                  <div className="card-body">
                    <h3 className="card-title">{s.title}</h3>
                    <p className="card-desc">{s.desc}</p>
                  </div>
                  <div className="card-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setPlotTitle(s.title);
                        setPlotSummary(s.worldSummary || "");
                        setOpeningScene(s.desc || "");
                        startGameWithLoading();
                      }}
                    >
                      Quick Start
                    </button>
                    <button className="btn" onClick={() => startSetupFromScenario(s.id)}>Customize</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {view === "SETUP" && (
          <section className="setup-panel section-padding">
            <h2 className="section-title">Operations Room — Create Scenario</h2>

            <div className="tabs">
              <button className={`tab ${activeSetupTab === "PLOT" ? "active" : ""}`} onClick={() => setActiveSetupTab("PLOT")}>PLOT</button>
              <button className={`tab ${activeSetupTab === "RULES" ? "active" : ""}`} onClick={() => setActiveSetupTab("RULES")}>RULES</button>
              <button className={`tab ${activeSetupTab === "APPEARANCE" ? "active" : ""}`} onClick={() => setActiveSetupTab("APPEARANCE")}>APPEARANCE</button>
            </div>

            <div className="tab-panel">
              {activeSetupTab === "PLOT" && (
                <div className="panel-grid">
                  <label>Title</label>
                  <input className="input" value={plotTitle} onChange={(e) => setPlotTitle(e.target.value)} />
                  <label>Summary</label>
                  <textarea className="input" rows={4} value={plotSummary} onChange={(e) => setPlotSummary(e.target.value)} />
                  <label>Opening Scene</label>
                  <textarea className="input" rows={3} value={openingScene} onChange={(e) => setOpeningScene(e.target.value)} />
                </div>
              )}

              {activeSetupTab === "RULES" && (
                <div className="panel-grid">
                  <label>AI Instructions</label>
                  <textarea className="input" rows={3} value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)} />
                  <label>Author's Note</label>
                  <textarea className="input" rows={3} value={authorsNote} onChange={(e) => setAuthorsNote(e.target.value)} />
                </div>
              )}

              {activeSetupTab === "APPEARANCE" && (
                <div className="panel-grid">
                  <label>Background Accent</label>
                  <input type="color" className="input-color" value={bgAccent} onChange={(e) => setBgAccent(e.target.value)} />
                  <p className="muted">Choose a subtle background accent color for your world.</p>
                </div>
              )}
            </div>

            <div className="setup-actions">
              <button className="btn btn-primary" onClick={startGameWithLoading}>Start Game</button>
              <button className="btn" onClick={() => applyView("HOME")}>Cancel</button>
            </div>
          </section>
        )}

        {view === "GAME" && (
          <section className="game-area section-padding">
            <div ref={storyRef} className="story-window">
              {lines.map((ln, i) => (
                <p key={i} className={`story-line ${ln.who === "user" ? "user-line" : "ai-line"}`}>{ln.text}</p>
              ))}

              {/* ⭐ NEW — streaming skeleton */}
              {streaming && (
                <div className="stream-skeleton">
                  <div className="pulse-line"></div>
                  <div className="pulse-line short"></div>
                </div>
              )}
            </div>

            <div className="toolbar">
              <div className="toolbar-left">
                <button className={`mode-btn ${mode === "do" ? "active" : ""}`} onClick={() => setMode("do")}>🗡️ Do</button>
                <button className={`mode-btn ${mode === "say" ? "active" : ""}`} onClick={() => setMode("say")}>💬 Say</button>
                <button className={`mode-btn ${mode === "think" ? "active" : ""}`} onClick={() => setMode("think")}>💭 Think</button>
                <button className={`mode-btn ${mode === "story" ? "active" : ""}`} onClick={() => setMode("story")}>📖 Story</button>
                <button className="mode-btn" onClick={() => sendMessage("continue")}>🔄 Continue</button>
                <button className="mode-btn" onClick={() => sendMessage("erase")}>🗑️ Erase</button>
              </div>

              <div className="toolbar-right">
                <input
                  className="input toolbar-input"
                  placeholder="Type action/dialogue..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                />
                <button className="btn btn-primary" onClick={() => sendMessage()}>Send</button>
              </div>
            </div>
          </section>
        )}

      </main>

      <footer className="footer muted">Manhwa Engine — cinematic story dashboard</footer>
    </div>
  );
}
