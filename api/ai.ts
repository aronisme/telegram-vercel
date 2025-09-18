import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function ai(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, chatId, prompt, user } = req.body || {};
  const input = text ?? prompt;
  if (!input) return res.status(400).json({ error: 'Missing text/prompt' });

  try {
    const aiUrl = process.env.AI_URL;
    if (!aiUrl) {
      // Fallback: mini rule-based
      const lower = String(input).trim().toLowerCase();
      const reply =
        lower === '/start'
          ? 'Yo, bot nyala. Tembak pertanyaan lo.'
          : `🤖 ${input}`;
      return res.status(200).json({ reply });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.AI_API_KEY) headers['Authorization'] = `Bearer ${process.env.AI_API_KEY}`;

    const r = await fetch(aiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: input, user: chatId ?? user }),
    });

    if (!r.ok) return res.status(r.status).json({ error: `AI upstream ${r.status}` });
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'AI error' });
  }
}
