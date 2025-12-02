import React from "react";

interface GameToolbarProps {
  mode: string;
  setMode: (mode: any) => void;
  sendMessage: (mode?: any) => void;
  input: string;
  setInput: (val: string) => void;
  undo: () => void;
  redo: () => void;
}

export const GameToolbar: React.FC<GameToolbarProps> = ({
  mode,
  setMode,
  sendMessage,
  input,
  setInput,
  undo,
  redo,
}) => {
  const toolbarButtons: { key: string; label: string }[] = [
    { key: "do", label: "🗡️ Do" },
    { key: "say", label: "💬 Say" },
    { key: "think", label: "💭 Think" },
    { key: "story", label: "📖 Story" },
    { key: "continue", label: "🔄 Continue" },
    { key: "erase", label: "🗑️ ERASE" },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex gap-2 z-50">
      {toolbarButtons.map((b) => (
        <button
          key={b.key}
          onClick={() => sendMessage(b.key)}
          className={`px-3 py-1 rounded hover:bg-white/10 ${
            mode === b.key ? "bg-cyan-500 text-black font-semibold" : ""
          }`}
        >
          {b.label}
        </button>
      ))}
      <input
        type="text"
        className="ml-2 bg-gray-800/60 px-3 py-1 rounded w-64 focus:outline-none"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Type your action or dialogue..."
      />
      <button onClick={undo} className="px-2 py-1 hover:bg-white/10 rounded">
        ↩️
      </button>
      <button onClick={redo} className="px-2 py-1 hover:bg-white/10 rounded">
        ↪️
      </button>
    </div>
  );
};
