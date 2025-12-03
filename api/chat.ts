import React, { useState } from "react";
import GameInterface from "./components/GameInterface";
import CreationModal from "./components/CreationModal";
import GameToolbar from "./components/GameToolbar";

export default function App() {
  const [view, setView] = useState<"HOME" | "GAME">("HOME");
  const [modalOpen, setModalOpen] = useState(false);
  const [worldData, setWorldData] = useState<any>({});

  const handleStartGame = (data: any) => {
    setWorldData(data);
    setView("GAME");
  };

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Top Navbar */}
      <header className="flex justify-between items-center p-4 bg-gray-900">
        <div className="text-2xl font-bold">Manhwa Engine</div>
        <div className="flex gap-4">
          {/* Undo/Redo placeholders */}
          <button className="hover:text-cyan-400">↩️ Undo</button>
          <button className="hover:text-cyan-400">↪️ Redo</button>
          <button onClick={() => setModalOpen(true)} className="hover:text-cyan-400">⚙️ Customize</button>
        </div>
      </header>

      {/* Home Screen */}
      {view === "HOME" && (
        <main className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-4 rounded hover:bg-gray-700 cursor-pointer"
            onClick={() => handleStartGame({ default: true })}>
            <h2 className="text-xl font-bold mb-2">Quick Start</h2>
            <p>Start immediately with default scenario.</p>
          </div>
          <div className="bg-gray-800 p-4 rounded hover:bg-gray-700 cursor-pointer"
            onClick={() => setModalOpen(true)}>
            <h2 className="text-xl font-bold mb-2">Create Custom</h2>
            <p>Define a new scenario using tabs.</p>
          </div>
        </main>
      )}

      {/* Game Screen */}
      {view === "GAME" && (
        <>
          <GameInterface
            worldSummary={worldData}
          />
          <GameToolbar onSelectMode={(mode) => console.log("Selected mode:", mode)} />
        </>
      )}

      {/* Creation Modal */}
      <CreationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleStartGame}
      />
    </div>
  );
}
