2


en ligne
Aujourd’hui
2 messages non lus
import React, { useEffect, useRef, useState } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import "./index.css";

/**
 * Clean SPA with four views now: HOME, SETUP (tabs), LOADING, GAME.
 * Finalized SSE parsing: aggregates streamed content into a single AI line,
 * prevents raw JSON/data object prints, robust error handling, AbortController support.
 *
 * NOTE: This file preserves your original app structure and UI, only augments
 * the streaming and append logic (and a few UX niceties).
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

  // For undo/redo (simple)
  const undoStack = useRef<Line[][]>([]);
  const redoStack = useRef<Line[][]>([]);

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
    if (plotTitle) initial.push({ text: World — ${plotTitle}, who: "ai" });
    if (plotSummary) initial.push({ text: plotSummary, who: "ai" });
    if (openingScene) initial.push({ text: openingScene, who: "ai" });
    if (initial.length === 0) initial.push({ text: "A new tale begins.", who: "ai" });
    // reset history stacks
    undoStack.current = [];
    redoStack.current = [];
    setLines(initial);
    applyView("GAME");
  }

  function pushUndoSnapshot() {
    // push previous lines to undo stack
    undoStack.current.push(JSON.parse(JSON.stringify(lines)));
    // limit stack size to avoid memory bloat
    if (undoStack.current.length > 50) undoStack.current.shift();
    // clearing redo on new action
    redoStack.current = [];
  }

  function appendLine(text: string, who: Line["who"] = "ai") {
    setLines((prev) => [...prev, { text, who }]);
  }

  // Helper: update last AI line (if streaming) by appending text
  function appendToLastAiChunk(chunk: string) {
    setLines((prev) => {
      const copy = [...prev];
      // find last AI line index
      let lastAi = -1;
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].who === "ai") {
          lastAi = i;
          break;
        }
      }
      if (lastAi === -1) {
        // no ai line yet, push new
        copy.push({ text: chunk, who: "ai" });
      } else {
        // append to existing last ai line
        copy[lastAi] = { ...copy[lastAi], text: copy[lastAi].text + chunk };
      }
      return copy;
    });
  }

  // Helper: ensure an empty AI line exists to stream into
  function ensureStreamingAiLine() {
    setLines((prev) => {
      const copy = [...prev];
      // if last line is ai, keep; else push empty ai placeholder
      if (copy.length === 0 || copy[copy.length - 1].who !== "ai") {
        copy.push({ text: "", who: "ai" });
      }
      return copy;
    });
  }

  async function sendMessage(modeOverride?: Mode) {
    const m = modeOverride ?? mode;

    // ERASE mode: remove last pair (ai + user)
    if (m === "erase") {
      pushUndoSnapshot();
      setLines((prev) => {
        const c = [...prev];
        // remove last ai
        for (let i = c.length - 1; i >= 0; i--) {
          if (c[i].who === "ai") {
            c.splice(i, 1);
            break;
          }
        }
        // remove last user
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

    // require input if not continue
    if (m !== "continue" && input.trim().length === 0) {
      // show tiny inline message instead of sending
      appendLine("(You must type something or press Continue)", "ai");
      return;
    }

    const userText =
      m === "say"
        ? You say: "${input.trim()}"
        : m === "do"
        ? You attempt: ${input.trim()}
        : m === "think"
        ? You think: ${input.trim()}
        : m === "story"
        ? You narrate: ${input.trim()}
        : "Continue";

    // Snapshot for undo
    pushUndoSnapshot();

    if (m !== "continue") setLines((prev) => [...prev, { text: userText, who: "user" }]);

    // Reset input and start streaming state
    setInput("");
    setStreaming(true);

    // Prepare to receive streamed response
    controllerRef.current = new AbortController();

    try {
      // Add an AI placeholder line to stream into
      ensureStreamingAiLine();

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
        appendLine((error) ${t}, "ai");
        setStreaming(false);
        controllerRef.current = null;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // Use eventsource-parser to correctly parse SSE-style chunks.
      // Many backends forward chunks with "data: {...}\n\n" frames; parser.feed handles that.
      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;
          if (data === "[DONE]") {
            // stream finished signal
            return;
          }
          // Try to parse JSON payloads that have content fields
          try {
            const parsed = JSON.parse(data);
            // If the server sends an object like { content: "..." } or { choices: [...] }:
            if (parsed && typeof parsed === "object") {
              // prefer content
              if (typeof parsed.content === "string") {
                appendToLastAiChunk(parsed.content);
                return;
              }
              // if the provider wraps text differently (e.g., { delta: { content: "..." } })
              if (parsed.delta && typeof parsed.delta.content === "string") {
                appendToLastAiChunk(parsed.delta.content);
                return;
              }
              // if provider uses choices[*].delta.content (OpenAI-like), handle gracefully
              if (parsed.choices && Array.isArray(parsed.choices)) {
                for (const ch of parsed.choices) {
                  if (ch.delta && typeof ch.delta.content === "string") {
                    appendToLastAiChunk(ch.delta.content);
                  } else if (typeof ch.text === "string") {
                    appendToLastAiChunk(ch.text);
                  } else if (typeof ch.content === "string") {
                    appendToLastAiChunk(ch.content);
                  }
                }
                return;
              }
            }
            // If parsed is string or fallback
            if (typeof parsed === "string") {
              appendToLastAiChunk(parsed);
              return;
            }
          } catch {
            // Not JSON — append raw text chunk (trim leading/trailing spaces carefully)
            // Some providers send plain text chunks. Append directly.
            const raw = String(data);
            appendToLastAiChunk(raw);
            return;
          }
        }
      });

      // Read stream loop
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          // feed chunk into parser; parser callback will append to last AI line
          parser.feed(chunk);
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        appendLine("(stream aborted)", "ai");
      } else {
        appendLine((network error) ${err?.message ?? String(err)}, "ai");
        console.error("sendMessage error:", err);
      }
    } finally {
      setStreaming(false);
      // clear controller
      controllerRef.current = null;
    }
  }

  function undo() {
    const snapshot = undoStack.current.pop();
    if (snapshot) {
      // push current to redo
      redoStack.current.push(JSON.parse(JSON.stringify(lines)));
      setLines(snapshot);
    }
  }

  function redo() {
    const snap = redoStack.current.pop();
    if (snap) {
      // push current to undo stack
      undoStack.current.push(JSON.parse(JSON.stringify(lines)));
      setLines(snap);
    }
  }

  // Stop streaming / abort controller
  function stopStreaming() {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setStreaming(false);
  }

  return (
    <div className={app-root ${fade}}>
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
              <button className={tab ${activeSetupTab === "PLOT" ? "active" : ""}} onClick={() => setActiveSetupTab("PLOT")}>PLOT</button>
              <button className={tab ${activeSetupTab === "RULES" ? "active" : ""}} onClick={() => setActiveSetupTab("RULES")}>RULES</button>
              <button className={tab ${activeSetupTab === "APPEARANCE" ? "active" : ""}} onClick={() => setActiveSetupTab("APPEARANCE")}>APPEARANCE</button>
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
                <p key={i} className={story-line ${ln.who === "user" ? "user-line" : "ai-line"}}>{ln.text}</p>
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
                <button className={mode-btn ${mode === "do" ? "active" : ""}} onClick={() => setMode("do")}>🗡️ Do</button>
                <button className={mode-btn ${mode === "say" ? "active" : ""}} onClick={() => setMode("say")}>💬 Say</button>
                <button className={mode-btn ${mode === "think" ? "active" : ""}} onClick={() => setMode("think")}>💭 Think</button>
                <button className={mode-btn ${mode === "story" ? "active" : ""}} onClick={() => setMode("story")}>📖 Story</button>
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
                {/* Stop button while streaming */}
                {streaming && (
                  <button className="btn" onClick={() => stopStreaming()} style={{ marginLeft: 8 }}>
                    Stop
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

      </main>

      <footer className="footer muted">Manhwa Engine — cinematic story dashboard</footer>
    </div>
  );
}
11:01


