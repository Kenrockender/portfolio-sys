/**
 * Vercel serverless function — Logam Mulia (Antam) gold price.
 *
 * Scrapes the official price page server-side and returns the 1-gram sell
 * price in IDR. Avoids the browser CORS proxy the client used before.
 *
 *   GET /api/gold  ->  { price: 1687000, source: "logammulia" }
 */
import { blockCrossSite } from './_guard.js';

const LM_URL = 'https://www.logammulia.com/id/harga-emas-hari-ini';

/** "2,902,000" or "2.902.000" -> 2902000 */
function parseIdr(str) {
  if (!str) return 0;
  return Math.round(parseFloat(String(str).trim().replace(/[.,]/g, '')) || 0);
}

export default async function handler(req, res) {
  if (blockCrossSite(req, res)) return;

  try {
    const r = await fetch(LM_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (portfolio-sys)' },
    });
    if (!r.ok) {
      res.status(502).json({ error: `logammulia ${r.status}` });
      return;
    }
    const html = await r.text();

    // Find the <tr> whose first <td> is exactly "1 gr", read the next cell.
    const rowRe = /<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi;
    for (const rowMatch of html.matchAll(rowRe)) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(c => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
      if (cells.length >= 2 && /^1\s*gr$/i.test(cells[0])) {
        const price = parseIdr(cells[1]);
        if (price >= 1_500_000 && price <= 6_000_000) {
          res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
          res.status(200).json({ price, source: 'logammulia' });
          return;
        }
      }
    }
    res.status(502).json({ error: 'price row not found' });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
}
