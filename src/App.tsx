2


en ligne
17/11/2025
Aujourd’hui
import React, { useEffect, useRef, useState } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import "./index.css";

/**
 * App.tsx - Stable streaming + UI
 *
 * - Uses eventsource-parser client-side to parse SSE forwarded by /api/chat
 * - Ensures only narrative text (parsed.content) is appended to the story
 * - Sends full context (plot, rules, author note) to the API
 */

type View = "HOME" | "SETUP" | "LOADING" | "GAME";
type Mode = "do" | "say" | "think" | "story" | "continue" | "erase";
type Line = { text: string; who: "user" | "ai" };

export default function App(): JSX.Element {
  const [view, setView] = useState<View>("HOME");

  // Setup state
  const [plotTitle, setPlotTitle] = useState("");
  const [plotSummary, setPlotSummary] = useState("");
  const [openingScene, setOpeningScene] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [authorsNote, setAuthorsNote] = useState("");

  // Simple scenarios
  const SCENARIOS = [
    { id: "solo", title: "Solo Leveling — Inspired", desc: "A low-rank hunter rises...", worldSummary: "Gates spawn..." },
    { id: "sea", title: "Grand Sea Voyage", desc: "High-seas adventure...", worldSummary: "Factions and naval power..." },
    { id: "custom", title: "Custom Scenario", desc: "Create your own world — open the Setup.", worldSummary: "" },
  ];

  // Game state
  const [lines, setLines] = useState<Line[]>([
    { text: "Welcome — pick a scenario or create a custom world.", who: "ai" },
  ]);
  const [mode, setMode] = useState<Mode>("story");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  // Refs for streaming update
  const storyRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const currentAIIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [lines, streaming]);

  function startSetupFor(sid: string) {
    const s = SCENARIOS.find((x) => x.id === sid);
    if (!s) return;
    if (sid === "custom") {
      setPlotTitle("");
      setPlotSummary("");
      setOpeningScene("");
    } else {
      setPlotTitle(s.title);
      setPlotSummary(s.worldSummary || "");
      setOpeningScene(s.desc || "");
    }
    setView("SETUP");
  }

  function startGameFromSetup() {
    const init: Line[] = [];
    if (plotTitle) init.push({ text: World — ${plotTitle}, who: "ai" });
    if (plotSummary) init.push({ text: plotSummary, who: "ai" });
    if (openingScene) init.push({ text: openingScene, who: "ai" });
    if (init.length === 0) init.push({ text: "A new tale begins.", who: "ai" });
    setLines(init);
    setView("GAME");
  }

  function appendUserLine(text: string) {
    setLines((prev) => [...prev, { text, who: "user" }]);
  }

  function appendNewAiLineStarter() {
    // push an empty ai line and store its index so streaming updates append to it
    setLines((prev) => {
      const copy = [...prev, { text: "", who: "ai" }];
      currentAIIndexRef.current = copy.length - 1;
      return copy;
    });
  }

  function updateAiLineAppend(chunk: string) {
    // append chunk to current AI line at index currentAIIndexRef
    setLines((prev) => {
      const copy = prev.slice();
      const idx = currentAIIndexRef.current;
      if (idx == null || idx < 0 || idx >= copy.length) {
        // fallback - push new ai line
        copy.push({ text: chunk, who: "ai" });
        currentAIIndexRef.current = copy.length - 1;
      } else {
        copy[idx] = { ...copy[idx], text: copy[idx].text + chunk };
      }
      return copy;
    });
  }

  function finishAiLine() {
    currentAIIndexRef.current = null;
  }

  // Main send function: robust streaming and parsing using eventsource-parser
  async function sendMessage(modeOverride?: Mode) {
    const m = modeOverride ?? mode;

    // ERASE: remove last ai + user pair
    if (m === "erase") {
      setLines((prev) => {
        const copy = [...prev];
        // remove last ai
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].who === "ai") {
            copy.splice(i, 1);
            break;
          }
        }
        // remove last user
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].who === "user") {
            copy.splice(i, 1);
            break;
          }
        }
        return copy;
      });
      return;
    }

    if (m !== "continue" && input.trim().length === 0) return;

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

    if (m !== "continue") appendUserLine(userText);

    setInput("");
    setStreaming(true);
    controllerRef.current = new AbortController();

    // Prepare payload to API
    const payload = {
      mode: m,
      message: m === "continue" ? "" : userText,
      plot: { title: plotTitle, summary: plotSummary, opening: openingScene },
      rules: { aiInstructions, authorsNote },
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controllerRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const txt = await res.text();
        setStreaming(false);
        setLines((prev) => [...prev, { text: (error) ${txt}, who: "ai" }]);
        return;
      }

      // Setup parser
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;
          if (!data) return;
          if (data === "[DONE]") {
            // done
            return;
          }
          // event.data expected to be a JSON string with { content: "text chunk" } or plain text
          try {
            const parsed = JSON.parse(data);
            // prioritize parsed.content or parsed.text
            const chunk = parsed?.content ?? parsed?.text ?? parsed;
            if (typeof chunk === "string") {
              updateAiLineAppend(chunk);
            } else {
              // if parsed is not string, try stringify fallback
              updateAiLineAppend(String(chunk));
            }
          } catch (err) {
            // not JSON: treat as raw text
            updateAiLineAppend(String(data));
          }
        }
      });

      // Start a new AI line to accumulate streamed chunks
      appendNewAiLineStarter();

      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          // feed to parser (it will break into events and call our callback)
          parser.feed(chunk);
        }
      }

      // mark done
      finishAiLine();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setLines((prev) => [...prev, { text: "(stream aborted)", who: "ai" }]);
      } else {
        setLines((prev) => [...prev, { text: (network error) ${err?.message ?? String(err)}, who: "ai" }]);
      }
    } finally {
      setStreaming(false);
      controllerRef.current = null;
    }
  }

  // Undo simple: remove last user+ai pair
  function undo() {
    setLines((prev) => prev.slice(0, Math.max(0, prev.length - 2)));
  }

  // UI
  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand" onClick={() => setView("HOME")}>Manhwa Engine</div>
        <div className="top-actions">
          {view === "GAME" && (
            <>
              <button className="icon-btn" onClick={undo} title="Undo">↩️</button>
            </>
          )}
          <button className="icon-btn" onClick={() => setView("SETUP")} title="Create">⚙️</button>
        </div>
      </header>

      <main className="main-container">
        {view === "HOME" && (
          <section className="library">
            <h2 className="section-title">Scenario Library</h2>
            <div className="card-grid">
              {SCENARIOS.map((s) => (
                <article key={s.id} className="scenario-card">
                  <div className="card-body">
                    <h3 className="card-title">{s.title}</h3>
                    <p className="card-desc">{s.desc}</p>
                  </div>
                  <div className="card-actions">
                    <button className="btn btn-primary" onClick={() => { setPlotTitle(s.title); setPlotSummary(s.worldSummary || ""); setOpeningScene(s.desc || ""); startGameFromSetup(); }}>
                      Quick Start
                    </button>
                    <button className="btn" onClick={() => startSetupFor(s.id)}>Customize</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {view === "SETUP" && (
          <section className="setup-panel">
            <h2 className="section-title">Operations Room — Create Scenario</h2>

            <div className="panel-grid">
              <label>Title</label>
              <input className="input" value={plotTitle} onChange={(e) => setPlotTitle(e.target.value)} />
              <label>Summary</label>
              <textarea className="input" rows={4} value={plotSummary} onChange={(e) => setPlotSummary(e.target.value)} />
              <label>Opening Scene</label>
              <textarea className="input" rows={3} value={openingScene} onChange={(e) => setOpeningScene(e.target.value)} />
              <label>AI Instructions</label>
              <textarea className="input" rows={3} value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)} />
              <label>Author's Note</label>
              <textarea className="input" rows={3} value={authorsNote} onChange={(e) => setAuthorsNote(e.target.value)} />
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => { setView("LOADING"); setTimeout(() => startGameFromSetup(), 1200); }}>Start Game</button>
              <button className="btn" onClick={() => setView("HOME")} style={{ marginLeft: 8 }}>Cancel</button>
            </div>
          </section>
        )}

        {view === "LOADING" && (
          <div className="loading-page">
            <div className="dots-loader"><div></div><div></div><div></div></div>
            <p className="loading-text">Shaping your world…</p>
          </div>
        )}

        {view === "GAME" && (
          <section className="game-area">
            <div ref={storyRef} className="story-window">
              {lines.map((ln, i) => (
                <p key={i} className={story-line ${ln.who === "user" ? "user-line" : "ai-line"}}>{ln.text}</p>
              ))}
              {streaming && <p className="muted">…streaming response…</p>}
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
                <input className="input toolbar-input" placeholder="Type action/dialogue..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} />
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
10:53


