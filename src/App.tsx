import React, { useState, useRef, useEffect } from "react";

const modes = [
  { key: "do", icon: "🗡️", label: "Do" },
  { key: "say", icon: "💬", label: "Say" },
  { key: "think", icon: "💭", label: "Think" },
  { key: "story", icon: "📖", label: "Story" },
];

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState("story");
  const storyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (storyRef.current)
      storyRef.current.scrollTop = storyRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const payload = {
      mode,
      message: input,
    };

    setInput("");

    const response = new EventSource(`/api/chat?payload=${encodeURIComponent(JSON.stringify(payload))}`);

    response.onmessage = (e) => {
      if (e.data === "[DONE]") {
        response.close();
        return;
      }
      setMessages((prev) => [...prev, e.data]);
    };
  };

  return (
    <div className="min-h-screen w-full bg-gradient-breathing text-white overflow-hidden">

      {/* TOP NAV */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-black/20 backdrop-blur-md flex items-center justify-between px-6 z-50">
        <div className="text-xl font-semibold tracking-wide">Manhwa Engine</div>

        <div className="flex items-center gap-6 text-2xl">
          {/* Status Drawer Icon */}
          <button onClick={() => setDrawerOpen(true)} className="hover:opacity-80">🛡️</button>
        </div>
      </header>

      {/* DRAWER */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-black/40 backdrop-blur-xl shadow-xl transform transition-transform duration-300 z-40
          ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="p-4 flex justify-between items-center border-b border-white/10">
          <h2 className="text-lg font-semibold">Status Panel</h2>
          <button onClick={() => setDrawerOpen(false)} className="text-xl">✖</button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm opacity-70">Health</p>
            <div className="w-full bg-white/10 h-3 rounded-full mt-1">
              <div className="h-full bg-red-500 rounded-full w-4/5"></div>
            </div>
          </div>

          <div>
            <p className="text-sm opacity-70">Energy</p>
            <div className="w-full bg-white/10 h-3 rounded-full mt-1">
              <div className="h-full bg-blue-400 rounded-full w-3/5"></div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN STORY AREA */}
      <main className="pt-20 pb-32 flex justify-center px-4">
        <div
          ref={storyRef}
          className="w-full max-w-4xl h-[80vh] overflow-y-auto pr-2 story-scroll"
        >
          {messages.map((msg, i) => (
            <p key={i} className="text-lg leading-relaxed mb-6 font-serif">
              {msg}
            </p>
          ))}
        </div>
      </main>

      {/* MODE TABS */}
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 flex gap-4 z-30">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-2 rounded-full text-xl backdrop-blur-md 
            ${mode === m.key ? "bg-white/30" : "bg-white/10 hover:bg-white/20"}`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {/* INPUT PILL */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[70%] max-w-2xl bg-white/10 backdrop-blur-xl rounded-full p-3 flex gap-3">
        <input
          className="flex-1 bg-transparent outline-none px-4 text-white"
          placeholder="Type your next move…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          className="px-6 py-2 bg-white text-black rounded-full font-semibold hover:bg-gray-200"
        >
          Send
        </button>
      </div>
    </div>
  );
}

