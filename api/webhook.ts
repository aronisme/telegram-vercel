import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple in-memory dedup (best-effort; serverless not persistent)
const recent = new Map<string, number>();
const WINDOW_MS = 5000;

async function sendToTelegram(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function callAI(text: string, chatId?: number) {
  const aiUrl = process.env.AI_URL;
  if (!aiUrl) {
    // Fallback: echo dengan sedikit bumbu
    return { reply: `🧠 ${text}` };
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.AI_API_KEY) headers['Authorization'] = `Bearer ${process.env.AI_API_KEY}`;
  const r = await fetch(aiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt: text, user: chatId }),
  });
  if (!r.ok) throw new Error(`AI error: ${r.status}`);
  return r.json();
}

async function relayToGAS(payload: unknown) {
  const gas = process.env.GAS_URL;
  if (!gas) return;
  await fetch(gas, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('Telegram Webhook OK');

  // Verify Telegram secret header (set via setWebhook secret_token)
  const expected = process.env.TG_SECRET;
  if (expected) {
    const got = req.headers['x-telegram-bot-api-secret-token'];
    if (typeof got !== 'string' || got !== expected) {
      return res.status(401).json({ error: 'bad secret' });
    }
  }

  const update = req.body || {};
  const msg = update?.message;
  const chatId: number | undefined = msg?.chat?.id;
  const text: string | undefined = msg?.text;

  // Best-effort dedup by (chatId+text) within short window
  if (chatId && text) {
    const key = `${chatId}::${text}`;
    const now = Date.now();
    const last = recent.get(key) || 0;
    if (now - last < WINDOW_MS) return res.status(200).json({ ok: true, dedup: true });
    recent.set(key, now);
    // cleanup
    for (const [k, t] of Array.from(recent.entries())) if (now - t > WINDOW_MS) recent.delete(k);
  }

  // No text? Acknowledge quickly
  if (!chatId || !text) {
    await relayToGAS({ type: 'non_text_update', update });
    return res.status(200).json({ ok: true });
  }

  try {
    // 1) Call AI
    const ai = await callAI(text, chatId);

    // 2) Reply to Telegram
    const reply = ai?.reply ?? '(no reply)';
    await sendToTelegram(chatId, reply);

    // 3) Relay to GAS (log/jadwal/etc)
    await relayToGAS({
      type: 'telegram_message',
      chat_id: chatId,
      text,
      ai_reply: reply,
      date: msg.date,
    });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    // Always ACK to prevent Telegram retry storm; log to GAS
    await relayToGAS({ type: 'error', message: err?.message || String(err), text, chat_id: chatId });
    return res.status(200).json({ ok: true, error: 'handled' });
  }
}
