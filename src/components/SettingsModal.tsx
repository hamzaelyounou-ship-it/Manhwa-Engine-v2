import React, { useState } from "react";

interface SettingsModalContentProps {
  worldTitle: string;
  setWorldTitle: (val: string) => void;
  worldSummary: string;
  setWorldSummary: (val: string) => void;
  characterName: string;
  setCharacterName: (val: string) => void;
  characterClass: string;
  setCharacterClass: (val: string) => void;
  characterBackground: string;
  setCharacterBackground: (val: string) => void;
  aiInstructions: string;
  setAiInstructions: (val: string) => void;
  authorsNote: string;
  setAuthorsNote: (val: string) => void;
  bgGradient: string;
  setBgGradient: (val: string) => void;
  onClose: () => void;
  onStart: () => void;
}

export const SettingsModalContent: React.FC<SettingsModalContentProps> = ({
  worldTitle,
  setWorldTitle,
  worldSummary,
  setWorldSummary,
  characterName,
  setCharacterName,
  characterClass,
  setCharacterClass,
  characterBackground,
  setCharacterBackground,
  aiInstructions,
  setAiInstructions,
  authorsNote,
  setAuthorsNote,
  bgGradient,
  setBgGradient,
  onClose,
  onStart,
}) => {
  const [activeTab, setActiveTab] = useState<"character" | "world" | "appearance">("character");

  return (
    <div className="bg-black/80 p-6 rounded-lg max-w-2xl w-full text-white">
      <div className="flex justify-between mb-4">
        <h2 className="font-bold text-xl">Operations Room</h2>
        <button onClick={onClose}>✖️</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-4 border-b border-white/20">
        <button
          className={`px-2 py-1 ${activeTab === "character" ? "border-b-2 border-cyan-400" : ""}`}
          onClick={() => setActiveTab("character")}
        >
          CHARACTER
        </button>
        <button
          className={`px-2 py-1 ${activeTab === "world" ? "border-b-2 border-cyan-400" : ""}`}
          onClick={() => setActiveTab("world")}
        >
          WORLD RULES
        </button>
        <button
          className={`px-2 py-1 ${activeTab === "appearance" ? "border-b-2 border-cyan-400" : ""}`}
          onClick={() => setActiveTab("appearance")}
        >
          APPEARANCE
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "character" && (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Character Name"
            className="p-2 rounded bg-gray-800"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Class"
            className="p-2 rounded bg-gray-800"
            value={characterClass}
            onChange={(e) => setCharacterClass(e.target.value)}
          />
          <textarea
            placeholder="Background / Origin Summary"
            className="p-2 rounded bg-gray-800"
            rows={4}
            value={characterBackground}
            onChange={(e) => setCharacterBackground(e.target.value)}
          />
        </div>
      )}

      {activeTab === "world" && (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="World / Plot Title"
            className="p-2 rounded bg-gray-800"
            value={worldTitle}
            onChange={(e) => setWorldTitle(e.target.value)}
          />
          <textarea
            placeholder="World / Story Summary"
            className="p-2 rounded bg-gray-800"
            rows={3}
            value={worldSummary}
            onChange={(e) => setWorldSummary(e.target.value)}
          />
          <textarea
            placeholder="AI Instructions"
            className="p-2 rounded bg-gray-800"
            rows={3}
            value={aiInstructions}
            onChange={(e) => setAiInstructions(e.target.value)}
          />
          <textarea
            placeholder="Author's Note"
            className="p-2 rounded bg-gray-800"
            rows={3}
            value={authorsNote}
            onChange={(e) => setAuthorsNote(e.target.value)}
          />
        </div>
      )}

      {activeTab === "appearance" && (
        <div className="flex flex-col gap-3">
          <label>Background Gradient Color</label>
          <input
            type="color"
            value="#0d141f"
            onChange={(e) =>
              setBgGradient(`radial-gradient(circle at 10% 10%, #001220, ${e.target.value})`)
            }
          />
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          className="px-3 py-2 rounded bg-cyan-400 text-black font-semibold"
          onClick={onStart}
        >
          Start Game
        </button>
        <button className="px-3 py-2 rounded border border-white/20" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};
