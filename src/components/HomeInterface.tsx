import React, { useState } from 'react';

export default function HomeInterface({ onStart }: { onStart: (payload: any)=>void }) {
  const [world, setWorld] = useState('');
  const [genre, setGenre] = useState('Fantasy');
  const [character, setCharacter] = useState('');
  const [scenario, setScenario] = useState('');

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-4xl font-display mb-4">Create Adventure</h1>
      <div className="space-y-4">
        <input value={world} onChange={e=>setWorld(e.target.value)} placeholder="World Name (e.g. Solo Leveling)" className="w-full p-3 bg-dark-fantasy-700 rounded" />
        <select value={genre} onChange={e=>setGenre(e.target.value)} className="w-full p-3 bg-dark-fantasy-700 rounded">
          <option>Fantasy</option>
          <option>Action</option>
          <option>Romance</option>
          <option>Slice of Life</option>
          <option>Custom</option>
        </select>
        <input value={character} onChange={e=>setCharacter(e.target.value)} placeholder="Character Name" className="w-full p-3 bg-dark-fantasy-700 rounded" />
        <textarea value={scenario} onChange={e=>setScenario(e.target.value)} placeholder="Starting Scenario" className="w-full p-3 bg-dark-fantasy-700 rounded" />
        <div className="flex gap-2">
          <button onClick={()=> onStart({ world, genre, character, scenario })} className="px-4 py-2 rounded bg-accent-ember">Create Adventure</button>
        </div>
      </div>
    </div>
  );
}
