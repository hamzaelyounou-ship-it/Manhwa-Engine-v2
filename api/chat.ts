2


en ligne
17/11/2025
BAC.pdf
2 pages•PDF•1 Mo
16:53
Aujourd’hui
import React, { useEffect, useRef, useState } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import "./index.css";

type Mode = "do" | "say" | "think" | "story" | "continue" | "erase";
type Line = { text: string; who: "user" | "ai" };

export default function App(): JSX.Element {
  // Minimal UI state
  const [lines, setLines] = useState<Line[]>([
    { text: "Welcome — start a scenario or type something to begin.", who: "ai" },
  ]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("story");
  const [streaming, setStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // Scroll ref
  const storyRef = useRef<HTMLDivElement | null>(null)… Voir plus
09:11
import React, { useEffect, useRef, useState } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import "./index.css";

/**
 * Clean SPA with four views now: HOME, SETUP (tabs), LOADING, GAME.
 */

type View = "HOME" | "SETUP" | "LOADING" | "GAME";
type Mode = "do" | "say" | "think" | "story" | "continue" | "erase";
type Line = { text: string; who: "user" | "ai" };

export default function App(): JSX.Element {
  const [view, setView] = useState<View>("HOME");

  // Smooth transitions
  const [fade, setFade] = useState("fade-in");

  const applyView = (v: View) => {
    setFade("fade-out");
    setTimeout(() => {
      setView(v);
      setFade("fade-in");
    }, 180);
  };

  // Setup state (tabs)
  const [active… Voir plus
09:14
import React, { useEffect, useRef, useState } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import "./index.css";

/**
 * Clean SPA with four views now: HOME, SETUP (tabs), LOADING, GAME.
 * Finalized SSE parsing: aggregates streamed content into a single AI line,
 * prevents raw JSON/data object prints, robust error handling, AbortController support.
 *
 * NOTE: This file preserves your original app structure and UI, only augments
 * the streaming and append logic (and a few UX niceties).
 */

type View = "HOME" | "SETUP" | "LOADING" | "GAME";
type Mode = "do" | "say" | "think" | "story" | "continue" | "erase";
type Line = { text: string; who: "user" | "ai" };

export default function App(): JSX.Element {
 … Voir plus
09:29
// api/chat.ts
// Vercel / Next.js compatible API route (no Next types) that proxies to OpenRouter
// and streams responses to the client as SSE. Uses mistralai/mistral-7b-instruct:free
// and enforces second-person + minimum 5-sentence descriptive output.

import { IncomingMessage, ServerResponse } from "http";
import fetch from "node-fetch"; // If your environment already polyfills fetch, you can remove this import.

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.warn("Warning: OPENROUTER_API_KEY is not set in environment.");
}

// Change this if your OpenRouter uses a different base path for streaming completions
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"; // adjust if necessary
… Voir plus
09:31
import React, { useEffect, useRef, useState } from "react";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
import "./index.css";

/**
 * App.tsx - Stable streaming + UI
 *
 * - Uses eventsource-parser client-side to parse SSE forwarded by /api/chat
 * - Ensures only narrative text (parsed.content) is appended to the story
 * - Sends full context (plot, rules, author note) to the API
 */

type View = "HOME" | "SETUP" | "LOADING" | "GAME";
type Mode = "do" | "say" | "think" | "story" | "continue" | "erase";
type Line = { text: string; who: "user" | "ai" };

export default function App(): JSX.Element {
  const [view, setView] = useState<View>("HOME");

  // Setup state
  const [plotTitle, setPlotTitle] = useState("");
  const… Voir plus
10:53
// api/chat.ts
// Vercel / Next.js serverless route implementation (no Next types used).
// Proxies to OpenRouter. Streams upstream content and forwards as SSE frames to the client.
// Uses model: mistralai/mistral-7b-instruct:free
import { IncomingMessage, ServerResponse } from "http";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"; // adjust if your account uses different endpoint

function sseWrite(res: ServerResponse, payload: object | string) {
  const data = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.write(data: ${data}\n\n);
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.metho… Voir plus
10:55


