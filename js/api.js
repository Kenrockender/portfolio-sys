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
  if (!r.ok) throw 0;
  const d = await r.json();
  const usdIdr = (d.bitcoin?.usd && d.bitcoin?.idr) ? Math.round(d.bitcoin.idr / d.bitcoin.usd) : null;
  return { btcIdr: d.bitcoin.idr, ethIdr: d.ethereum.idr, xrpIdr: d.ripple.idr, usdIdr };
}

// ── [Fix 1] Fetch Altcoin Prices (SOL, ADA, BNB, dll) ────────────
// Scan DATA.crypto untuk koin selain BTC/ETH/XRP, fetch sekali batch.
export async function fetchAltcoinPrices() {
  const MAJOR = new Set(['BTC', 'ETH', 'XRP']);
  const coins = [...new Set(
    DATA.crypto
      .map(a => (a.coin || '').toUpperCase())
      .filter(c => !MAJOR.has(c) && CG_IDS[c])
  )];
  if (coins.length === 0) return;

  const ids = coins.map(c => CG_IDS[c]).join(',');
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=idr`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) throw new Error(`CG altcoin ${r.status}`);
    const d = await r.json();
    let updated = 0;
    for (const coin of coins) {
      const priceIdr = d[CG_IDS[coin]]?.idr;
      if (priceIdr > 0) { setAltcoinPrice(coin, priceIdr); updated++; }
    }
    console.log(`[API] Altcoin prices: ${updated}/${coins.length} updated`);
  } catch (e) {
    console.warn('[API] fetchAltcoinPrices failed (non-fatal):', e.message);
  }
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
  if (!p) throw 0;
  return p;
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
  _syncUiStart();
  S.isSyncing = true;

  const FALLBACK = {
    btcIdr: 1_590_000_000,
    ethIdr: 52_000_000,
    xrpIdr: 10_800,
    goldGramIdr: 1_680_000,
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

    // 3. Gold via Yahoo
    const goldUsd = await fetchYahoo('GC=F').catch(() => 2650);
    const ozToGram = 31.1035;
    setPrice('goldGramIdr', Math.round((goldUsd / ozToGram) * S.usdIdr));
    setStatus('gold', 'live');

    // 4. Stocks — silent=true: syncAllPrices dispatches once after all prices ready
    await syncStocksOnly(true);

    console.log('✅ Sync complete');

  } catch (e) {
    console.error('Sync error:', e);
    _syncUiEnd('⚠ sync error');
    S.isSyncing = false;
    return;
  } finally {
    S.isSyncing = false;
  }

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

  await saveDailySnapshot();
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
