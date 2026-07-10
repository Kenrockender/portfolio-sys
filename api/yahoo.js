/**
 * Vercel serverless function — Yahoo Finance chart proxy.
 *
 * Runs server-side (no browser CORS, no third-party public proxy), so stock
 * and gold prices stop depending on allorigins.win / corsproxy.io being up.
 *
 *   GET /api/yahoo?symbol=BBCA.JK&range=1mo&interval=1d
 *
 * Returns the raw Yahoo chart JSON. The client (js/api.js) parses it exactly
 * as before, so this is a drop-in for the old proxied URL.
 */
import { blockCrossSite } from './_guard.js';

export default async function handler(req, res) {
  if (blockCrossSite(req, res)) return;

  const symbol   = String(req.query.symbol   || '').trim();
  const range    = String(req.query.range    || '1d').trim();
  const interval = String(req.query.interval || '1d').trim();

  if (!symbol) {
    res.status(400).json({ error: 'symbol required' });
    return;
  }
  // Whitelist the shape of accepted params — keeps this from being a generic
  // open proxy. Yahoo tickers: letters/digits plus . ^ = - characters.
  if (!/^[A-Za-z0-9.^=:-]{1,15}$/.test(symbol)) {
    res.status(400).json({ error: 'invalid symbol' });
    return;
  }
  if (!/^[A-Za-z0-9]{1,4}$/.test(range) || !/^[A-Za-z0-9]{1,4}$/.test(interval)) {
    res.status(400).json({ error: 'invalid range/interval' });
    return;
  }

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
    + `?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;

  try {
    const ctrl = AbortSignal.timeout(9000);
    const r = await fetch(url, {
      signal: ctrl,
      headers: { 'User-Agent': 'Mozilla/5.0 (portfolio-sys)' },
    });
    if (!r.ok) {
      res.status(r.status === 404 ? 404 : 502).json({ error: `yahoo ${r.status}` });
      return;
    }
    const data = await r.json();
    // Edge-cache for 1 min, serve stale up to 5 min while revalidating.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
}
