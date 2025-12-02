import React, { useState } from "react";
import GameInterface from "./components/GameInterface";

type Scenario = { id: string; title: string; desc: string; worldSummary?: string };

const SAMPLE_SCENARIOS: Scenario[] = [
  { id: "solo", title: "Solo Leveling", desc: "Low-rank hunter rises in a dangerous world." },
  { id: "pirate", title: "Grand Sea Voyage", desc: "High-seas adventure and treasure hunting." },
];

export default function App() {
  const [view, setView] = useState<"home" | "game">("home");

  // Settings / World Creation
  const [tabsOpen, setTabsOpen] = useState(false);
  const [worldTitle, setWorldTitle] = useState("");
  const [worldSummary, setWorldSummary] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [characterClass, setCharacterClass] = useState("");
  const [characterBackground, setCharacterBackground] = useState("");
  const [aiInstructions, setAiInstructions] = useState("");
  const [authorsNote, setAuthorsNote] = useState("");

  const startGame = () => setView("game");

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-6 backdrop-blur-md bg-black/30 z-50">
        <div className="text-xl font-bold cursor-pointer" onClick={() => setView("home")}>
          Manhwa Engine
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTabsOpen(true)}>⚙️ Settings</button>
        </div>
      </header>

      <main className="pt-20">
        {view === "home" && (
          <section className="max-w-6xl mx-auto px-4">
            <h1 className="text-3xl font-bold mb-6">Scenario Library</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {SAMPLE_SCENARIOS.map((s) => (
                <div key={s.id} className="bg-white/5 rounded-lg p-4 flex flex-col">
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-sm text-white/70 flex-1 my-2">{s.desc}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      className="px-3 py-2 rounded bg-green-500 font-semibold"
                      onClick={startGame}
                    >
                      Quick Start
                    </button>
                    <button
                      className="px-3 py-2 rounded bg-cyan-500 font-semibold"
                      onClick={() => setTabsOpen(true)}
                    >
                      Create Custom
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {view === "game" && (
          <GameInterface
            worldSummary={worldSummary}
            characterName={characterName}
            characterClass={characterClass}
            characterBackground={characterBackground}
            aiInstructions={aiInstructions}
            authorsNote={authorsNote}
          />
        )}

        {/* Settings Modal */}
        {tabsOpen && (
          <div className="fixed inset-0 flex justify-center items-center bg-black/70 z-50">
            <div className="bg-black/90 p-6 rounded-lg max-w-2xl w-full text-white">
              <div className="flex justify-between mb-4">
                <h2 className="font-bold text-xl">Operations Room</h2>
                <button onClick={() => setTabsOpen(false)}>✖️</button>
              </div>

              {/* Tabs */}
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="World Title"
                  className="p-2 rounded bg-gray-800"
                  value={worldTitle}
                  onChange={(e) => setWorldTitle(e.target.value)}
                />
                <textarea
                  placeholder="World / Plot Summary"
                  className="p-2 rounded bg-gray-800"
                  rows={3}
                  value={worldSummary}
                  onChange={(e) => setWorldSummary(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Character Name"
                  className="p-2 rounded bg-gray-800"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Character Class"
                  className="p-2 rounded bg-gray-800"
                  value={characterClass}
                  onChange={(e) => setCharacterClass(e.target.value)}
                />
                <textarea
                  placeholder="Background / Origin"
                  className="p-2 rounded bg-gray-800"
                  rows={3}
                  value={characterBackground}
                  onChange={(e) => setCharacterBackground(e.target.value)}
                />
                <textarea
                  placeholder="AI Instructions"
                  className="p-2 rounded bg-gray-800"
                  rows={2}
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                />
                <textarea
                  placeholder="Author's Note"
                  className="p-2 rounded bg-gray-800"
                  rows={2}
                  value={authorsNote}
                  onChange={(e) => setAuthorsNote(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  className="px-3 py-2 rounded bg-cyan-400 text-black font-semibold"
                  onClick={() => {
                    setTabsOpen(false);
                    startGame();
                  }}
                >
                  Start Game
                </button>
                <button
                  className="px-3 py-2 rounded border border-white/20"
                  onClick={() => setTabsOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
