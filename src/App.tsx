import React, { useState } from 'react';
import HomeInterface from './components/HomeInterface';
import GameInterface from './components/GameInterface';

export default function App() {
  const [session, setSession] = useState(null as null | { world: string, character: string });
  return (
    <div className="min-h-screen">
      {!session && <HomeInterface onStart={(payload)=> setSession(payload)} />}
      {session && <GameInterface session={session} onExit={()=> setSession(null)} />}
    </div>
  );
}
