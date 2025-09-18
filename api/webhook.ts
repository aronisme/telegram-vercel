import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Only POST allowed');

  const update = req.body;
  const text = update?.message?.text;
  const chatId = update?.message?.chat?.id;

  if (!text || !chatId) return res.status(200).json({ ok: true });

  // Call Gemini AI endpoint
  const aiRes = await fetch(`${process.env.BASE_URL}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: text })
  });

  const aiData = await aiRes.json();
  const reply = aiData.reply || '(no reply)';

  // Send reply to Telegram
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: reply
    })
  });

  res.status(200).json({ ok: true });
}
