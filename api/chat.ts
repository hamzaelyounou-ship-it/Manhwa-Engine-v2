import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser';

const OPENAI_API = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { prompt, worldInput, lore = [] } = req.body;

  if (!OPENAI_API) return res.status(500).json({ error: 'Missing API key in environment' });

  // Build dynamic system prompt
  const systemPrompt = `You are Manhwa Story Engine. The world input: ${worldInput || 'original'}.
Write cinematic manhwa-style narrative. Keep turns short and vivid.`;
  const finalPrompt = `${systemPrompt}\n\nUser prompt:\n${prompt}`;

  // Request to OpenAI-compatible streaming endpoint (example format)
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + OPENAI_API,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // placeholder - use your preferred streaming model
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
      stream: true,
      max_tokens: 800
    })
  });

  if (!r.ok) {
    const text = await r.text();
    return res.status(r.status).send(text);
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });

  const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
    if (event.type === 'event') {
      const data = event.data;
      if (data === '[DONE]') {
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      }
      try {
        const json = JSON.parse(data);
        const text = json.choices?.[0]?.delta?.content || '';
        if (text) {
          res.write(`data: ${JSON.stringify(text)}\n\n`);
        }
      } catch (e) {
        // ignore non-json chunks
      }
    }
  });

  for await (const chunk of r.body as any) {
    const str = chunk.toString();
    parser.feed(str);
  }
}
