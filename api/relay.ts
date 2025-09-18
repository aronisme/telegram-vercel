import type { VercelRequest, VercelResponse } from '@vercel/node';

async function sendToTelegram(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export default async function relay(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Simple auth agar hanya GAS yang boleh nembak
  const token = req.headers['x-relay-token'];
  if (process.env.RELAY_TOKEN && token !== process.env.RELAY_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { text, user, pushToTelegram } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Missing text' });

  // Panggil AI via internal API
  try {
    const r = await fetch(`${process.env.BASE_URL}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, chatId: user }),
    });
    const data = await r.json();

    if (pushToTelegram && user) {
      const reply = data?.reply ?? '(no reply)';
      await sendToTelegram(Number(user), reply);
    }

    return res.status(200).json({ ok: true, data });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'relay error' });
  }
}
