/**
 * Vercel serverless function — CoinGecko simple-price proxy.
 *
 * Fallback for when the browser can't reach CoinGecko directly (rate limit,
 * network filter). Replaces the old allorigins.win public CORS proxy so no
 * third party sits between us and the price source.
 *
 *   GET /api/crypto?ids=bitcoin,ethereum&vs=idr,usd
 *
 * Returns the raw CoinGecko JSON: { bitcoin: { idr: ..., usd: ... }, ... }
 */
import { blockCrossSite } from './_guard.js';

export default async function handler(req, res) {
  if (blockCrossSite(req, res)) return;

  const ids = String(req.query.ids || '').trim().toLowerCase();
  const vs  = String(req.query.vs  || 'idr').trim().toLowerCase();

  // Whitelist shape: coingecko ids are lowercase slugs, comma-separated.
  if (!/^[a-z0-9-]{1,40}(,[a-z0-9-]{1,40}){0,29}$/.test(ids)) {
    res.status(400).json({ error: 'invalid ids' });
    return;
  }
  if (!/^[a-z]{2,5}(,[a-z]{2,5}){0,4}$/.test(vs)) {
    res.status(400).json({ error: 'invalid vs' });
    return;
  }

  const url = `https://api.coingecko.com/api/v3/simple/price`
    + `?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!r.ok) {
      res.status(502).json({ error: `coingecko ${r.status}` });
      return;
    }
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
}
