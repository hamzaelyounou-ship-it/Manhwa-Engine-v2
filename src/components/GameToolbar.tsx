import React, { useState } from "react";

type ModeKey = "do" | "say" | "think" | "story" | "continue" | "erase";

type GameToolbarProps = {
  onSelectMode: (mode: ModeKey) => void;
};

export default function GameToolbar({ onSelectMode }: GameToolbarProps) {
  const [activeMode, setActiveMode] = useState<ModeKey>("story");

  const buttons: { key: ModeKey; label: string }[] = [
    { key: "do", label: "🗡️ Do" },
    { key: "say", label: "💬 Say" },
    { key: "think", label: "💭 Think" },
    { key: "story", label: "📖 Story" },
    { key: "continue", label: "🔄 Continue" },
    { key: "erase", label: "🗑️ ERASE" },
  ];

  const handleClick = (mode: ModeKey) => {
    setActiveMode(mode);
    onSelectMode(mode);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex gap-2 z-50">
      {buttons.map((b) => (
        <button
          key={b.key}
          onClick={() => handleClick(b.key)}
          className={`px-3 py-1 rounded hover:bg-white/10 ${
            activeMode === b.key ? "bg-cyan-500 text-black font-semibold" : ""
          }`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
