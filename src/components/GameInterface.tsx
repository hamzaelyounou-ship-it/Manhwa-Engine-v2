import React, { useEffect, useRef, useState } from 'react';
import { LoreEntry, injectLoreIntoPrompt } from '../utils/lorebook';

export default function GameInterface({ session, onExit }: any) {
  const [messages, setMessages] = useState<{role:string, text:string}[]>([]);
  const [input, setInput] = useState('');
  const [lore, setLore] = useState<LoreEntry[]>([]);
  const evtRef = useRef<EventSource | null>(null);

  useEffect(()=> {
    // seed with starting scenario
    if (session?.scenario) {
      setMessages([{ role: 'system', text: session.scenario }]);
    }
  }, [session]);

  const append = (role: string, text: string) => setMessages(prev=>[...prev, { role, text }]);

  async function sendAction() {
    const userPrompt = input || '...';
    append('user', userPrompt);
    setInput('');

    // build prompt with lore
    const promptWithLore = injectLoreIntoPrompt(userPrompt, lore);

    // open streaming request
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptWithLore, worldInput: session.world, lore })
    });
    if (!res.body) {
      append('assistant', 'Error: no body from API');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done=false;
    append('assistant', ''); // placeholder for streaming content
    let accIndex = messages.length;
    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        const chunk = decoder.decode(value);
        // server sends 'data: "text"' chunks (see api/chat.ts)
        const parts = chunk.split('\n\n').filter(Boolean);
        for (const p of parts) {
          if (p.startsWith('data:')) {
            const raw = p.replace('data:','').trim();
            if (raw === '[DONE]') { done=true; break; }
            try {
              const text = JSON.parse(raw);
              // append to last assistant message
              setMessages(prev=>{
                const copy = [...prev];
                const last = copy[copy.length-1];
                last.text = (last.text || '') + text;
                return copy;
              });
            } catch(e){
              // ignore
            }
          }
        }
      }
    }
  }

  function addLore() {
    const id = Date.now().toString();
    const key = prompt('Lore key (e.g., Mana)') || 'Key';
    const value = prompt('Lore value') || 'Value';
    setLore(prev=>[{ id, key, value }, ...prev]);
  }

  return (
    <div className="min-h-screen grid grid-cols-4">
      <div className="col-span-3 p-6">
        <header className="flex justify-between items-center mb-4">
          <h2 className="text-2xl">{session.world} — {session.character}</h2>
          <div>
            <button onClick={()=> onExit()} className="px-3 py-1 rounded bg-dark-fantasy-700">Exit</button>
          </div>
        </header>

        <main className="bg-dark-fantasy-800 p-6 rounded h-[60vh] overflow-auto prose">
          {messages.map((m, i)=>(
            <div key={i} className={m.role === 'assistant' ? 'mb-4' : 'mb-2'}>
              <strong className="block text-sm opacity-60">{m.role}</strong>
              <div>{m.text}</div>
            </div>
          ))}
        </main>

        <div className="mt-4 flex gap-2">
          <input value={input} onChange={e=>setInput(e.target.value)} className="flex-1 p-3 bg-dark-fantasy-700 rounded" placeholder="Act or describe an action..." />
          <button onClick={sendAction} className="px-4 py-2 rounded bg-accent-myst">Send</button>
        </div>
      </div>

      <aside className="col-span-1 p-6 bg-dark-fantasy-700">
        <h3 className="mb-2">Lorebook</h3>
        <button onClick={addLore} className="mb-3 px-3 py-1 rounded bg-accent-ember">+ Add Lore</button>
        <div className="space-y-2">
          {lore.map(l=>(
            <div key={l.id} className="p-2 bg-dark-fantasy-600 rounded">
              <div className="text-sm font-semibold">{l.key}</div>
              <div className="text-xs opacity-70">{l.value}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
