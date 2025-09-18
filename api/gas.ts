import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function gas(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const gas = process.env.GAS_URL;
  if (!gas) return res.status(200).json({ ok: true, note: 'GAS_URL not set' });

  try {
    const r = await fetch(gas, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {}),
    });
    const data = await r.json().catch(() => ({}));
    return res.status(200).json({ ok: true, data });
  } catch {
    return res.status(200).json({ ok: true, note: 'gas failed (ignored)' });
  }
}
