import React, { useState, useRef, useEffect } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

type Template = {
  id: string;
  title: string;
  desc: string;
  img: string;
  worldSummary?: string;
};

const TEMPLATES: Template[] = [
  {
    id: "fantasy",
    title: "Fantasy Realm",
    desc: "Magic, dragons, and kingdoms await.",
    img: "/templates/fantasy.jpg",
    worldSummary:
      "The world is ruled by magic and mythical creatures. Kingdoms vie for power. Heroes embark on quests to gain fame and fortune.",
  },
  {
    id: "adventure",
    title: "Adventure Land",
    desc: "Exploration, treasure, and danger.",
    img: "/templates/adventure.jpg",
    worldSummary:
      "An expansive land filled with dangerous terrains, lost civilizations, and hidden treasures. Expeditions reveal secrets and test courage.",
  },
  {
    id: "romance",
    title: "Romantic Tales",
    desc: "Love, intrigue, and drama.",
    img: "/templates/romance.jpg",
    worldSummary:
      "A world of social intrigue, relationships, and forbidden love. Choices shape destinies and hearts collide in unexpected ways.",
  },
];

type MessageLine = { text: string };
type ModeKey = "do" | "say" | "think" | "story" | "continue" | "erase";

export default function App() {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Template, 2: Character, 3: Game
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Character & world setup
  const [characterName, setCharacterName] = useState("");
  const [characterClass, setCharacterClass] = useState("");
  const [race, setRace] = useState("");
  const [faction, setFaction] = useState("");
  const [startingLocation, setStartingLocation] = useState("");
  const [worldSummary, setWorldSummary] = useState("");

  // Game state
  const [lines, setLines] = useState<MessageLine[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ModeKey>("story");
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const storyRef = useRef<HTMLDivElement | null>(null);

  // History stack
  const [historyStack, setHistoryStack] = useState<MessageLine[][]>([]);
  const [redoStack, setRedoStack] = useState<MessageLine[][]>([]);

  // Auto-scroll story
  useEffect(() => {
    if (storyRef.current) storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [lines]);

  // Start game
  function startGame() {
    const initLines = [
      { text: `${selectedTemplate?.title || "Custom World"}` },
      { text: worldSummary || selectedTemplate?.worldSummary || "The world awaits your story." },
    ];
    setLines(initLines);
    setHistoryStack([initLines]);
    setRedoStack([]);
    setStep(3);
  }

  // Undo / Redo
  function undo() {
    if (historyStack.length <= 1) return;
    const prev = historyStack[historyStack.length - 2];
    setRedoStack([historyStack[historyStack.length - 1], ...redoStack]);
    setLines(prev);
    setHistoryStack(historyStack.slice(0, -1));
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setLines(next);
    setHistoryStack([...historyStack, next]);
    setRedoStack(redoStack.slice(1));
  }

  // Send message to API
  async function sendMessage(useMode?: ModeKey) {
    const m = useMode ?? mode;
    if (m !== "continue" && m !== "erase" && !input.trim()) return;

    if (m === "erase") {
      const prev = [...lines];
      prev.pop();
      prev.pop();
      setLines(prev);
      setHistoryStack([...historyStack, prev]);
      return;
    }

    const userText =
      m === "say"
        ? `${characterName || "You"} says: "${input}"`
        : m === "do"
        ? `${characterName || "You"} attempts: ${input}`
        : m === "think"
        ? `${characterName || "You"} thinks: ${input}`
        : m === "story"
        ? `${characterName || "You"} narrates: ${input}`
        : "Continue";

    if (m !== "continue") setLines((prev) => [...prev, { text: userText }]);

    const payload = {
      mode: m,
      message: m === "continue" ? "" : input.trim(),
      characterName,
      characterClass,
      race,
      faction,
      startingLocation,
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
        setLines((prev) => [...prev, { text: `(error) ${txt}`]);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          if (event.data === "[DONE]") return;
          try {
            const json = JSON.parse(event.data);
            if (json?.content) setLines((prev) => [...prev, { text: json.content }]);
          } catch {}
        }
      });

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch (err: any) {
      if (err.name === "AbortError") setLines((prev) => [...prev, { text: "(stream aborted)" }]);
      else setLines((prev) => [...prev, { text: `(stream error) ${err.message}` }]);
    } finally {
      setStreaming(false);
      setHistoryStack([...historyStack, lines]);
      controllerRef.current = null;
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "radial-gradient(circle at 10% 10%, #001220, #0d141f)" }}>
      {/* Top Header */}
      {step === 3 && (
        <header className="fixed top-0 left-0 right-0 h-16 backdrop-blur-md bg-black/30 z-50 flex items-center justify-between px-6">
          <div className="text-xl font-bold cursor-pointer" onClick={() => confirm("Exit game?") && setStep(1)}>
            RPG Engine
          </div>
          <div className="flex items-center gap-2">
            <button onClick={undo} className="p-2 hover:bg-white/10 rounded">↩️</button>
            <button onClick={redo} className="p-2 hover:bg-white/10 rounded">↪️</button>
          </div>
        </header>
      )}

      <main className="pt-20 pb-32 max-w-6xl mx-auto px-4">
        {/* Step 1: Template Selection */}
        {step === 1 && (
          <>
            <h1 className="text-3xl font-bold mb-6">Select a Template</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  className="bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition"
                  onClick={() => { setSelectedTemplate(t); setWorldSummary(t.worldSummary || ""); setStep(2); }}
                >
                  <img src={t.img} alt={t.title} className="h-40 w-full object-cover rounded-t-lg"/>
                  <div className="p-4">
                    <h3 className="text-xl font-semibold">{t.title}</h3>
                    <p className="text-white/70">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Character / World Setup */}
        {step === 2 && (
          <div className="max-w-xl mx-auto flex flex-col gap-4">
            <h1 className="text-2xl font-bold">Character & World Setup</h1>
            <input className="p-2 rounded bg-gray-800" placeholder="Character Name" value={characterName} onChange={e => setCharacterName(e.target.value)} />
            <input className="p-2 rounded bg-gray-800" placeholder="Class/Role" value={characterClass} onChange={e => setCharacterClass(e.target.value)} />
            <input className="p-2 rounded bg-gray-800" placeholder="Race" value={race} onChange={e => setRace(e.target.value)} />
            <input className="p-2 rounded bg-gray-800" placeholder="Faction" value={faction} onChange={e => setFaction(e.target.value)} />
            <input className="p-2 rounded bg-gray-800" placeholder="Starting Location" value={startingLocation} onChange={e => setStartingLocation(e.target.value)} />
            <textarea className="p-2 rounded bg-gray-800" placeholder="World Summary" value={worldSummary} onChange={e => setWorldSummary(e.target.value)} rows={4} />
            <button className="bg-cyan-500 text-black font-semibold px-4 py-2 rounded" onClick={startGame}>Start Game</button>
          </div>
        )}

        {/* Step 3: Game */}
        {step === 3 && (
          <>
            <div ref={storyRef} className="bg-white/20 p-12 rounded-lg min-h-[60vh] max-h-[72vh] overflow-y-auto font-serif text-lg leading-relaxed">
              {lines.map((ln, idx) => <p key={idx} className="mb-6">{ln.text}</p>)}
              {streaming && <div className="text-white/60 italic">…Loading narrative…</div>}
            </div>

            {/* Toolbar */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex gap-2 z-50">
              {["do","say","think","story","continue","erase"].map(m => (
                <button key={m} onClick={() => sendMessage(m as ModeKey)} className={`px-3 py-1 rounded hover:bg-white/10 ${mode===m?"bg-cyan-500 text-black font-semibold":""}`}>
                  {{
                    do:"🗡️ Do",
                    say:"💬 Say",
                    think:"💭 Think",
                    story:"📖 Story",
                    continue:"🔄 Continue",
                    erase:"🗑️ ERASE"
                  }[m as ModeKey]}
                </button>
              ))}
              <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Type your action..." className="ml-2 bg-gray-800/60 px-3 py-1 rounded w-64 focus:outline-none"/>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
