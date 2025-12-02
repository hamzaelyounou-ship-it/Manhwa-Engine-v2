Manhwa Story Engine V2 - Minimal scaffold
Files included:
- package.json
- vercel.json (configured for serverless api)
- tailwind.config.js, postcss.config.js
- src/ (React + components)
- api/chat.ts (streaming serverless example using eventsource-parser)
- src/utils/lorebook.ts (injects lore into prompts)
- index.html

Notes:
- Replace OPENAI_API_KEY or OPENROUTER_API_KEY in environment.
- The streaming implementation on server expects OpenAI-style SSE. Adjust model & endpoint for your provider.
