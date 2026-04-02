/**
 * ══════════════════════════════════════════
 * API.JS - External API Calls
 * ══════════════════════════════════════════
 * Handles all external API requests for prices
 */

import { S, DATA, setPrice, setFxRate, setFxStatus, setStatus, setStockPrice, setAltcoinPrice } from './state.js';
import { saveDailySnapshot, saveDataToCloud } from '../firebase/firebase-config.js';
import { CG_IDS, FX_PAIRS, RANGE_DAYS } from './config.js';

// ── CoinGecko Price Fetch ────────────────────────────────────────
export async function fetchCG() {
  const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple&vs_currencies=idr,usd');
  if (!r.ok) throw new Error(`CoinGecko error: HTTP ${r.status}`);
  const d = await r.json();
  const usdIdr = (d.bitcoin?.usd && d.bitcoin?.idr) ? Math.round(d.bitcoin.idr / d.bitcoin.usd) : null;
  return { btcIdr: d.bitcoin?.idr, ethIdr: d.ethereum?.idr, xrpIdr: d.ripple?.idr, usdIdr };
}

// ── [Fix 1] Fetch Altcoin Prices (SOL, ADA, BNB, dll) ────────────
export async function fetchAltcoinPrices() {
  const MAJOR = new Set(['BTC', 'ETH', 'XRP']);
  const coins = [...new Set(
    DATA.crypto
      .map(a => (a.coin || '').toUpperCase())
      .filter(c => !MAJOR.has(c) && CG_IDS[c])
  )];
  if (coins.length === 0) return;

  const ids = coins.map(c => CG_IDS[c]).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=idr`;

  // Try direct first, then proxy fallback
  let d = null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (r.ok) d = await r.json();
  } catch (_) {}

  if (!d) {
    try {
      const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(9000) });
      if (r.ok) d = await r.json();
    } catch (_) {}
  }

  if (!d) { console.warn('[API] fetchAltcoinPrices: all sources failed'); return; }

  let updated = 0;
  for (const coin of coins) {
    const priceIdr = d[CG_IDS[coin]]?.idr;
    if (priceIdr > 0) { setAltcoinPrice(coin, priceIdr); updated++; }
  }
  console.log(`[API] Altcoin prices: ${updated}/${coins.length} updated`);
}

// ── CORS Proxy Fetch (allorigins → corsproxy.io fallback) ────────
const _PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

async function _proxyFetch(url) {
  for (const makeProxy of _PROXIES) {
    try {
      const r = await fetch(makeProxy(url), { signal: AbortSignal.timeout(9000) });
      if (r.ok) return r;
    } catch (_) {}
  }
  throw new Error(`[API] All proxies failed for: ${url}`);
}

// ── Yahoo Finance Price Fetch ────────────────────────────────────
export async function fetchYahoo(sym) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
  const r = await _proxyFetch(url);
  const d = await r.json();
  const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!p) throw new Error(`Yahoo Finance: no price data for ${sym}`);
  return p;
}

// ── Logam Mulia Gold Price (IDR/gram langsung, no conversion needed) ──
// Source: https://www.logammulia.com/id/harga-emas-hari-ini
// Harga Jual 1 gram Antam — angka dalam IDR langsung
export async function fetchLogamMulia() {
  const LM_URL = 'https://www.logammulia.com/id/harga-emas-hari-ini';

  let html = null;

  // Try via allorigins first, then corsproxy.io fallback
  for (const proxyFn of [
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ]) {
    try {
      const r = await fetch(proxyFn(LM_URL), { signal: AbortSignal.timeout(10_000) });
      if (r.ok) { html = await r.text(); break; }
    } catch (_) {}
  }

  if (!html) throw new Error('[LM] Semua proxy gagal');

  // ── Strategi 1: cari harga di tabel dengan data-gram="1" atau td nearest "1 gr"
  // Contoh HTML Logam Mulia: <td>1 gr</td><td>Rp 1.687.000</td>
  // atau <span class="price">1.687.000</span> dekat "1 gr"

  // Cari semua angka yang kemungkinan harga IDR/gram (range 1jt – 4jt)
  // setelah teks "1 gr" atau "1 gram" atau "harga jual"

  // Pattern A: angka IDR format setelah "1 gr" atau "1 gram" dalam radius ~200 karakter
  const blockA = html.match(/1\s*gr(?:am)?.{0,200}?Rp\s*([\d.]+)/i)
               || html.match(/1\s*gr(?:am)?.{0,200}?([\d]{1,3}(?:[.,][\d]{3})+)/);
  if (blockA) {
    const price = _parseIdrHtml(blockA[1] || blockA[2]);
    if (price >= 1_000_000 && price <= 4_000_000) {
      console.log(`[LM] Harga emas (Pattern A): Rp ${price.toLocaleString('id-ID')}/gr`);
      return price;
    }
  }

  // Pattern B: cari semua angka 7-digit di halaman, ambil yang di range 1jt–4jt, paling awal
  const allPrices = [...html.matchAll(/([\d]{1,3}(?:\.[\d]{3}){2,3})/g)]
    .map(m => _parseIdrHtml(m[1]))
    .filter(p => p >= 1_000_000 && p <= 4_000_000);

  if (allPrices.length > 0) {
    // Harga 1 gram biasanya yang terkecil (termurah) di antara semua harga
    const price = Math.min(...allPrices);
    console.log(`[LM] Harga emas (Pattern B): Rp ${price.toLocaleString('id-ID')}/gr`);
    return price;
  }

  // Pattern C: cari di JSON-LD / script tag structured data
  const scriptMatch = html.match(/"price"\s*:\s*"?([\d.,]+)"?/i);
  if (scriptMatch) {
    const price = _parseIdrHtml(scriptMatch[1]);
    if (price >= 1_000_000 && price <= 4_000_000) {
      console.log(`[LM] Harga emas (Pattern C / JSON-LD): Rp ${price.toLocaleString('id-ID')}/gr`);
      return price;
    }
  }

  throw new Error('[LM] Tidak dapat menemukan harga dalam HTML');
}

/** Parse angka IDR dari HTML: "1.687.000" → 1687000 */
function _parseIdrHtml(str) {
  if (!str) return 0;
  // Hilangkan semua titik (separator ribuan IDR), ganti koma desimal jika ada
  const cleaned = String(str).replace(/\./g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned) || 0);
}

// ── Sync UI Helpers (null-safe — DOM mungkin tidak ada di test env) ─
function _syncUiStart() {
  const btn = document.getElementById('syncBtn');
  const last = document.getElementById('lastSync');
  if (btn) { btn.disabled = true; btn.classList.add('spinning'); }
  if (last) last.textContent = 'syncing...';
}

function _syncUiEnd(errorMsg = null) {
  const btn = document.getElementById('syncBtn');
  const last = document.getElementById('lastSync');
  if (btn) { btn.disabled = false; btn.classList.remove('spinning'); }
  if (last) {
    if (errorMsg) {
      last.textContent = errorMsg;
    } else {
      const now = new Date();
      last.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' (auto)';
    }
  }
}

// ── Sync All Prices ──────────────────────────────────────────────
export async function syncAllPrices() {
  if (_syncAllPricesPromise) return _syncAllPricesPromise;

  _syncAllPricesPromise = (async () => {
    _syncUiStart();
    S.isSyncing = true;

    const FALLBACK = {
      btcIdr: 1_590_000_000,
      ethIdr: 52_000_000,
      xrpIdr: 10_800,
      goldGramIdr: 2_700_000,
      usdIdr: 16_200
    };

    try {
      // 1a. Major crypto via CoinGecko
      const cg = await fetchCG().catch(() => FALLBACK);
      setPrice('btcIdr', cg.btcIdr || FALLBACK.btcIdr);
      setPrice('ethIdr', cg.ethIdr || FALLBACK.ethIdr);
      setPrice('xrpIdr', cg.xrpIdr || FALLBACK.xrpIdr);
      if (cg.usdIdr) setPrice('usdIdr', cg.usdIdr);

      setStatus('btc', 'live');
      setStatus('eth', 'live');
      setStatus('xrp', 'live');

      // 1b. Altcoins — batched, non-fatal jika gagal
      await fetchAltcoinPrices();

      // 2. FX via ExchangeRate-API
      const fxRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD',
        { signal: AbortSignal.timeout(7000) }).catch(() => ({ ok: false }));
      if (fxRes.ok) {
        const fx = await fxRes.json();
        const toIDR = c => Math.round((fx.rates.IDR || S.usdIdr) / (fx.rates[c] || 1));
        setPrice('usdIdr', Math.round(fx.rates.IDR || S.usdIdr));
        S.fxRates = {
          USD: S.usdIdr, IDR: 1,
          AUD: toIDR('AUD'), SGD: toIDR('SGD'), JPY: Math.round((fx.rates.IDR || S.usdIdr) / (fx.rates.JPY || 1)),
          HKD: toIDR('HKD'), EUR: toIDR('EUR'), GBP: toIDR('GBP'),
          NZD: toIDR('NZD'), CHF: toIDR('CHF'), CAD: toIDR('CAD'), CNH: toIDR('CNY')
        };
        setStatus('fx', 'live');
      } else {
        console.warn('[API] FX fetch failed — savings in foreign currency may show stale rates');
        setStatus('fx', 'stale');
      }

      // 3. Gold — Logam Mulia primary (IDR/gram langsung), metals.live & Yahoo fallback
      let goldGramIdr = null;

      // 3a. Logam Mulia (sumber utama — harga resmi Antam dalam IDR)
      try {
        const lmPrice = await fetchLogamMulia();
        if (lmPrice >= 1_000_000 && lmPrice <= 4_000_000) {
          goldGramIdr = lmPrice;
          console.log(`[API] Gold (Logam Mulia): Rp ${lmPrice.toLocaleString('id-ID')}/gr`);
        }
      } catch (e) {
        console.warn('[API] Logam Mulia fetch gagal:', e.message);
      }

      // 3b. Fallback: metals.live (USD/oz) → konversi ke IDR/gram
      if (!goldGramIdr) {
        try {
          const mRes = await fetch('https://api.metals.live/v1/spot/gold', { signal: AbortSignal.timeout(7000) });
          if (mRes.ok) {
            const mData = await mRes.json();
            const entry = Array.isArray(mData) ? mData[0] : mData;
            const goldUsd = entry?.price || entry?.gold || null;
            if (goldUsd && goldUsd > 3000) {
              goldGramIdr = Math.round((goldUsd / 31.1035) * S.usdIdr);
              console.log(`[API] Gold (metals.live fallback): $${goldUsd}/oz → Rp ${goldGramIdr.toLocaleString('id-ID')}/gr`);
            }
          }
        } catch (_) {}
      }

      // 3c. Fallback: Yahoo Finance GC=F
      if (!goldGramIdr) {
        try {
          const yGold = await fetchYahoo('GC=F');
          if (yGold && yGold > 3000) {
            goldGramIdr = Math.round((yGold / 31.1035) * S.usdIdr);
            console.log(`[API] Gold (Yahoo fallback): $${yGold}/oz → Rp ${goldGramIdr.toLocaleString('id-ID')}/gr`);
          }
        } catch (_) {}
      }

      if (goldGramIdr) {
        setPrice('goldGramIdr', goldGramIdr);
        setStatus('gold', 'live');
      } else {
        if (!S.goldGramIdr || S.goldGramIdr < 1_000_000) {
          setPrice('goldGramIdr', 1_700_000); // fallback default ~harga Antam saat ini
        }
        setStatus('gold', 'stale');
        console.warn('[API] Gold price unavailable — using last known value');
      }

      // 4. Stocks — silent=true: syncAllPrices dispatches once after all prices ready
      await syncStocksOnly(true);

      console.log('[API] Sync complete');

      // Save last rates to cloud
      DATA.lastRates = {
        usdIdr: S.usdIdr,
        fxRates: { ...S.fxRates },
        goldGramIdr: S.goldGramIdr,
        btcIdr: S.btcIdr,
        ethIdr: S.ethIdr,
        xrpIdr: S.xrpIdr,
        timestamp: Date.now()
      };

      _syncUiEnd();

      window.dispatchEvent(new CustomEvent('portfolio:update'));

      // Update app badge with total net worth (in Jt)
      try {
        if ('setAppBadge' in navigator) {
          const total = Object.values(window.__portfolioTotals || {}).reduce((s, v) => s + (v || 0), 0);
          if (total > 0) navigator.setAppBadge(Math.round(total / 1_000_000));
        }
      } catch (_) {}

      await saveDailySnapshot();

    } catch (e) {
      console.error('Sync error:', e);
      _syncUiEnd('sync error');
      S.isSyncing = false;
      return;
    } finally {
      S.isSyncing = false;
    }
  })().finally(() => {
    _syncAllPricesPromise = null;
  });

  return _syncAllPricesPromise;
}

// ── Sync Stocks Only ──────────────────────────────────────────────
export async function syncStocksOnly(silent = false) {
  await Promise.allSettled(
    DATA.stocks.map(h => {
      // IDX → append .JK; INDEX and US → use ticker as-is (^GSPC, SPY, etc.)
      const sym = h.market === 'IDX' ? `${h.ticker}.JK` : h.ticker;
      return fetchYahoo(sym)
        .then(p => {
          // INDEX: IDR-based indices (^IHSG, ^LQ45, ^IDX30) store price as-is
          // INDEX USD-based (^GSPC, SPY, QQQ etc.) and US → multiply by usdIdr
          const isIdrIndex = h.market === 'INDEX' &&
            (h.ticker.startsWith('^IH') || h.ticker.startsWith('^LQ') || h.ticker.startsWith('^ID'));
          const priceIdr = (h.market === 'IDX' || isIdrIndex) ? p : Math.round(p * S.usdIdr);
          setStockPrice(h.ticker, priceIdr);
        })
        .catch(() => {
          console.warn(`[API] ${h.ticker}: live price unavailable, showing seed price`);
        });
    })
  );

  // Only dispatch when called standalone — syncAllPrices dispatches after all prices are done
  if (!silent) {
    window.dispatchEvent(new CustomEvent('portfolio:update'));
  }
}

// ── [Fix 13] Asset Price History Cache dengan TTL 10 menit ───────
const _CACHE_TTL = 10 * 60 * 1000;
const _historyCache = {};  // { key: { pts, ts } }

function _cacheGet(key) {
  const entry = _historyCache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > _CACHE_TTL) { delete _historyCache[key]; return null; }
  return entry.pts;
}
function _cacheSet(key, pts) {
  _historyCache[key] = { pts, ts: Date.now() };
}

// ── Fetch Asset Price History ─────────────────────────────────────
export async function fetchAssetPriceHistory(item, type, range) {
  const days = RANGE_DAYS[range] || 90;
  const cacheKey = `${type}:${item.id}:${range}`;

  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  try {
    if (type === 'crypto') {
      const cgId = CG_IDS[item.coin];
      if (!cgId) return null;

      const url = `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=idr&days=${days}&interval=daily`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return null;

      const d = await r.json();
      const pts = (d.prices || []).map(([ts, price]) => ({
        ts, price,
        value: Math.round(item.amount * price)
      }));

      _cacheSet(cacheKey, pts);
      return pts;
    }

    if (type === 'stocks') {
      // IDX → append .JK; INDEX and US → ticker as-is
      const sym = item.market === 'IDX' ? `${item.ticker}.JK` : item.ticker;
      const rangeStr = { 30: '1mo', 90: '3mo', 180: '6mo', 365: '1y' }[days] || '3mo';
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${rangeStr}`;

      const raw = await _proxyFetch(url).catch(() => null);
      if (!raw) return null;

      const d = await raw.json();
      const result = d?.chart?.result?.[0];
      if (!result) return null;

      const times = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      const mul = (item.market === 'IDX' && !item.ticker?.startsWith('^')) ? item.shares * 100 : item.shares;

      // INDEX: IDR-based (^IHSG etc.) store price as-is; USD-based → convert
      const isIdrIndex = item.market === 'INDEX' &&
        (item.ticker.startsWith('^IH') || item.ticker.startsWith('^LQ') || item.ticker.startsWith('^ID'));
      const toIdr = (price) =>
        (item.market === 'IDX' || isIdrIndex) ? price : Math.round(price * S.usdIdr);

      const pts = times.map((ts, i) => {
        const price = closes[i];
        if (!price) return null;
        const priceIdr = toIdr(price);
        return { ts: ts * 1000, price: priceIdr, value: Math.round(mul * priceIdr) };
      }).filter(Boolean);

      _cacheSet(cacheKey, pts);
      return pts;
    }

    if (type === 'gold') {
      const rangeStr = { 30: '1mo', 90: '3mo', 180: '6mo', 365: '1y' }[days] || '3mo';
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=${rangeStr}`;

      const raw = await _proxyFetch(url).catch(() => null);
      if (!raw) return null;

      const d = await raw.json();
      const result = d?.chart?.result?.[0];
      if (!result) return null;

      const times = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      const OZ_TO_GRAM = 31.1035;

      const pts = times.map((ts, i) => {
        const priceUsdOz = closes[i];
        if (!priceUsdOz) return null;
        const priceIdrGram = (priceUsdOz / OZ_TO_GRAM) * S.usdIdr;
        return { ts: ts * 1000, price: Math.round(priceIdrGram), value: Math.round(item.grams * priceIdrGram) };
      }).filter(Boolean);

      _cacheSet(cacheKey, pts);
      return pts;
    }

  } catch (e) {
    console.warn('[API] fetch history failed', e);
  }

  return null;
}

console.log('[API] API module loaded');
