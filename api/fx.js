/**
 * Vercel serverless function — USD FX rates proxy.
 *
 * Fallback for when the browser can't reach exchangerate-api directly.
 *
 *   GET /api/fx  ->  raw exchangerate-api JSON ({ rates: { IDR: ..., ... } })
 *
 * Rates move slowly, so this is edge-cached aggressively (1h fresh,
 * 6h stale-while-revalidate) — most hits never reach the upstream API.
 */
import { blockCrossSite } from './_guard.js';

export default async function handler(req, res) {
  if (blockCrossSite(req, res)) return;

  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) {
      res.status(502).json({ error: `exchangerate-api ${r.status}` });
      return;
    }
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
}
