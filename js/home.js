/* ============================================================
   portfolio.sys — HOME tab data wiring
   Reads from js/state.js (S, DATA) and js/storage.js (totals,
   cryptoPrice, stockPrice, savingsIdr, stockMul). Renders into
   the static DOM provided by app.html's #tab-home section.
   ============================================================ */

import { S, DATA } from './state.js';
import { totals, cryptoPrice, stockPrice, savingsIdr, stockMul } from './storage.js';

const i18n = (window.psys && window.psys.i18n) || null;
function t(k, fb) { return i18n ? i18n.t(k, fb) : (fb || k); }
function fmtIDR(n, opts) { return i18n ? i18n.fmtIDR(n, opts) : ('Rp ' + Math.round(n).toLocaleString('id-ID')); }
function fmtDeltaIDR(n, opts) { return i18n ? i18n.fmtDeltaIDR(n, opts) : ((n >= 0 ? '+' : '−') + fmtIDR(Math.abs(n), opts)); }
function fmtPct(n, digits) { return i18n ? i18n.fmtPct(n, digits) : ((n >= 0 ? '+' : '−') + Math.abs(n).toFixed(digits || 2) + '%'); }
function relTime(d) { return i18n ? i18n.relTime(d) : new Date(d).toLocaleString(); }
function getLang() { return i18n ? i18n.getLang() : 'id'; }

let currentRange = '7D';
const RANGE_DAYS = { '1D': 1, '7D': 7, '1M': 30, '1Y': 365 };

/* ---- GREETING ---- */
function renderGreeting() {
  const prefix = document.querySelector('[data-greeting-prefix]');
  if (prefix && i18n) {
    const key = i18n.greetingKey();
    prefix.setAttribute('data-i18n', key);
    prefix.textContent = t(key);
  }
  const nameEl = document.querySelector('[data-user-name]');
  if (nameEl) {
    const display = (document.getElementById('userDisplayName')?.textContent || '').trim();
    const first = display ? display.split(/[\s@]/)[0] : '';
    nameEl.textContent = first ? first + '.' : '…';
  }
}

/* ---- TOTAL + DELTA ---- */
function renderTotal() {
  const T = totals();
  const total = T.t || 0;

  // Day delta: prefer last history entry vs current total, fallback to 0
  const hist = DATA.history || [];
  const lastSnap = hist.length ? hist[hist.length - 1].value : total;
  const delta = total - lastSnap;
  const pct = lastSnap > 0 ? (delta / lastSnap) * 100 : 0;

  const totalEl = document.querySelector('[data-total]');
  const deltaEl = document.querySelector('[data-total-delta]');
  const pctEl   = document.querySelector('[data-total-pct]');
  const arrowEl = document.querySelector('[data-total-arrow]');
  const deltaContainer = document.querySelector('.total__delta__main');

  if (totalEl) totalEl.textContent = fmtIDR(total);
  if (deltaEl) deltaEl.textContent = fmtDeltaIDR(delta);
  if (pctEl)   pctEl.textContent   = fmtPct(pct);
  if (arrowEl) arrowEl.textContent = delta >= 0 ? '▲' : '▼';
  if (deltaContainer) {
    deltaContainer.classList.toggle('down', delta < 0);
  }
}

/* ---- SPARKLINE ---- */
function renderSparkline(rangeKey) {
  const hist = DATA.history || [];
  const lineEl = document.querySelector('[data-sparkline-line]');
  const areaEl = document.querySelector('[data-sparkline-area]');
  const tipEl  = document.querySelector('[data-sparkline-tip]');
  if (!lineEl || !areaEl || !tipEl) return;
  if (!hist.length) {
    lineEl.setAttribute('d', '');
    areaEl.setAttribute('d', '');
    tipEl.setAttribute('cx', '0'); tipEl.setAttribute('cy', '0');
    return;
  }
  const days = RANGE_DAYS[rangeKey] || 7;
  // history is sparse — take last N entries proportional to range
  const slice = hist.slice(-Math.min(hist.length, Math.max(2, days)));
  // map values to SVG path. ViewBox is 320 × 120.
  const W = 320, H = 120, PAD = 10;
  const ys = slice.map(p => p.value);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const pts = slice.map((p, i) => {
    const x = PAD + (W - PAD * 2) * (i / Math.max(1, slice.length - 1));
    const y = PAD + (H - PAD * 2) * (1 - (p.value - min) / span);
    return [x, y];
  });
  const lineD = 'M ' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L ');
  const areaD = lineD + ` L ${pts[pts.length - 1][0].toFixed(1)},${H} L ${pts[0][0].toFixed(1)},${H} Z`;
  lineEl.setAttribute('d', lineD);
  areaEl.setAttribute('d', areaD);
  tipEl.setAttribute('cx', pts[pts.length - 1][0].toFixed(1));
  tipEl.setAttribute('cy', pts[pts.length - 1][1].toFixed(1));
}

function wireRangePills() {
  const pills = document.querySelectorAll('[data-range-pills] button[data-range]');
  pills.forEach(b => {
    b.addEventListener('click', () => {
      pills.forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      currentRange = b.getAttribute('data-range');
      renderSparkline(currentRange);
    });
  });
}

/* ---- MARKET RAIL ----
   Dot states (CSS in app.css):
     default green = live data
     .is-stale gray = closing / cached / fallback
     .is-down red   = stale + error                                       */

function setMarketCard(key, opts) {
  const card = document.querySelector(`[data-market="${key}"]`);
  if (!card) return;
  const valEl = card.querySelector('.market__val');
  const dEl   = card.querySelector('.market__delta');
  const dot   = card.querySelector('.market__label__dot');
  if (valEl) valEl.textContent = opts.value;
  if (dEl)   dEl.textContent   = opts.delta;
  if (dot) {
    dot.classList.remove('is-stale', 'is-down');
    if (opts.live === false) dot.classList.add('is-stale');
  }
  if (dEl) {
    dEl.classList.remove('up', 'down', 'mute');
    if (opts.tone === 'up')   dEl.classList.add('up');
    if (opts.tone === 'down') dEl.classList.add('down');
    if (opts.tone === 'mute') dEl.classList.add('mute');
  }
}

// Last known IHSG closing — used when live data not available
// (idx weekly close, refresh manually as needed).
const IHSG_CLOSING = { value: 7184.32, date: '2026-05-23' };

function fmtClosingDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(getLang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderMarketRail() {
  // IHSG
  const ihsgLive = S.stockPrices && S.stockPrices['^IHSG'];
  const ihsgSeed = (DATA.stocks || []).find(h => h.ticker === '^IHSG');
  const isLive   = !!ihsgLive;
  let   ihsg     = ihsgLive || (ihsgSeed ? ihsgSeed.seedPrice : null) || IHSG_CLOSING.value;
  const seed     = ihsgSeed ? ihsgSeed.seedPrice : ihsg;
  const ihsgPct  = seed > 0 ? ((ihsg - seed) / seed) * 100 : 0;
  setMarketCard('ihsg', {
    value: ihsg.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 2 }),
    delta: isLive
      ? fmtPct(ihsgPct) + (getLang() === 'id' ? ' · live' : ' · live')
      : (getLang() === 'id' ? 'closing ' : 'closing ') + fmtClosingDate(IHSG_CLOSING.date),
    tone:  isLive ? (ihsgPct > 0.05 ? 'up' : ihsgPct < -0.05 ? 'down' : 'mute') : 'mute',
    live:  isLive,
  });

  // USD / IDR
  const usdidr = S.usdIdr || 0;
  setMarketCard('usdidr', {
    value: usdidr ? usdidr.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-US') : '…',
    delta: getLang() === 'id' ? 'kurs harian' : 'daily rate',
    tone:  'mute',
    live:  usdidr > 0,
  });

  // Gold per gram
  const gold = S.goldGramIdr || 0;
  setMarketCard('gold', {
    value: gold ? 'Rp ' + gold.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-US') : '…',
    delta: getLang() === 'id' ? 'per gram (IDR)' : 'per gram (IDR)',
    tone:  'mute',
    live:  gold > 0,
  });

  // BTC
  const btc = S.btcIdr || 0;
  setMarketCard('btc', {
    value: btc ? fmtIDR(btc, { compact: true }) : '…',
    delta: getLang() === 'id' ? 'IDR / koin' : 'IDR / coin',
    tone:  'mute',
    live:  btc > 0,
  });
}

/* ---- HOLDINGS PREVIEW ---- */
function categoryOf(item) {
  if (item._kind === 'crypto') return 'crypto';
  if (item._kind === 'gold')   return 'gold';
  if (item._kind === 'stocks') return 'stocks';
  if (item._kind === 'savings')return 'savings';
  return 'other';
}
function valueOf(item) {
  if (item._kind === 'crypto')  return (item.amount || 0) * cryptoPrice(item);
  if (item._kind === 'gold')    return (item.grams || 0) * (S.goldGramIdr || 0);
  if (item._kind === 'stocks')  return (item.shares || 0) * stockMul(item) * stockPrice(item);
  if (item._kind === 'savings') return savingsIdr(item);
  return 0;
}
function nameOf(item) {
  if (item._kind === 'crypto')  return { ticker: item.coin, desc: item.name || '' };
  if (item._kind === 'gold')    return { ticker: item.name || 'Emas', desc: (item.grams || 0) + ' gr · Antam' };
  if (item._kind === 'stocks')  return { ticker: item.ticker, desc: item.name || '' };
  if (item._kind === 'savings') return { ticker: item.name || 'Savings', desc: (item.bank || '').toUpperCase() };
  return { ticker: '?', desc: '' };
}
// Category icons — small inline SVG, one per asset class.
// 24×24 viewBox, draws within parent .holding__icon (36×36 container).
const CATEGORY_ICON = {
  crypto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
    <path d="M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z"/>
    <circle cx="12" cy="12" r="3.5"/>
  </svg>`,
  stocks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
    <line x1="5"  y1="20" x2="5"  y2="14"/>
    <line x1="12" y1="20" x2="12" y2="9"/>
    <line x1="19" y1="20" x2="19" y2="4"/>
  </svg>`,
  gold: `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <rect x="3" y="9" width="18" height="9" rx="1.5"/>
    <rect x="6" y="6" width="12" height="3" rx="1" opacity="0.55"/>
  </svg>`,
  savings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
    <path d="M3 9 L12 4 L21 9"/>
    <line x1="5"  y1="11" x2="5"  y2="18"/>
    <line x1="12" y1="11" x2="12" y2="18"/>
    <line x1="19" y1="11" x2="19" y2="18"/>
    <line x1="3"  y1="20" x2="21" y2="20"/>
  </svg>`,
};
function categoryIconSvg(item) {
  return CATEGORY_ICON[item._kind] || CATEGORY_ICON.stocks;
}

// Real ticker logos for major crypto + IDX. Falls back to category
// icon when ticker is unknown. SVG paths drawn at 32x32 viewBox,
// rendered at 28x28 inside the 36x36 .holding__icon container.
const TICKER_LOGO = {
  BTC: `<svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#F7931A"/>
    <path fill="#fff" d="M22.86 13.66c.3-2.04-1.25-3.13-3.36-3.86l.69-2.74-1.67-.42-.66 2.66c-.44-.11-.89-.21-1.34-.32l.67-2.69-1.66-.42-.69 2.74c-.36-.08-.71-.17-1.06-.25l-2.3-.57-.44 1.78s1.24.28 1.21.3c.67.17.79.62.77.97l-.78 3.13c.05.01.11.03.17.06l-.18-.04-1.09 4.38c-.08.21-.29.51-.75.4.02.03-1.21-.3-1.21-.3l-.83 1.9 2.18.54.97.26-.7 2.78 1.66.42.69-2.75c.45.12.88.23 1.31.34l-.69 2.73 1.66.42.7-2.78c2.82.53 4.94.32 5.83-2.23.72-2.05-.04-3.24-1.52-4.01 1.08-.25 1.89-.96 2.11-2.43zm-3.78 5.29c-.51 2.05-3.96.94-5.08.66l.92-3.69c1.12.28 4.7.84 4.16 3.03zm.51-5.32c-.46 1.86-3.34.91-4.27.69l.84-3.36c.93.23 3.92.66 3.43 2.67z"/>
  </svg>`,
  ETH: `<svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#627EEA"/>
    <g fill="#fff" fill-rule="nonzero">
      <path fill-opacity=".602" d="M16.498 4v8.87l7.497 3.35z"/>
      <path d="M16.498 4L9 16.22l7.498-3.35z"/>
      <path fill-opacity=".602" d="M16.498 21.968v6.027L24 17.616z"/>
      <path d="M16.498 27.995v-6.028L9 17.616z"/>
      <path fill-opacity=".2" d="M16.498 20.573l7.497-4.353-7.497-3.348z"/>
      <path fill-opacity=".602" d="M9.001 16.22l7.497 4.353v-7.701z"/>
    </g>
  </svg>`,
  XRP: `<svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#23292F"/>
    <path fill="#fff" d="M23.07 8h2.495l-5.19 5.14a6.245 6.245 0 0 1-8.763 0L6.418 8h2.499l3.946 3.91a4.49 4.49 0 0 0 6.26 0L23.07 8zM8.886 24.054H6.39l5.225-5.175a6.245 6.245 0 0 1 8.763 0l5.225 5.175h-2.494l-3.978-3.94a4.49 4.49 0 0 0-6.26 0l-3.978 3.94z"/>
  </svg>`,
  SOL: `<svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#000"/>
    <defs><linearGradient id="solg" x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient></defs>
    <path fill="url(#solg)" d="M8.5 20.5c.2-.2.5-.3.8-.3h14.4c.5 0 .7.6.4 1l-2.5 2.5c-.2.2-.5.3-.8.3H6.4c-.5 0-.7-.6-.4-1l2.5-2.5zm0-9.4c.2-.2.5-.3.8-.3h14.4c.5 0 .7.6.4 1L21.6 14c-.2.2-.5.3-.8.3H6.4c-.5 0-.7-.6-.4-1l2.5-2.2zm15.2 4.7c-.2-.2-.5-.3-.8-.3H8.5c-.5 0-.7.6-.4 1l2.5 2.5c.2.2.5.3.8.3h14.4c.5 0 .7-.6.4-1l-2.5-2.5z"/>
  </svg>`,
  BNB: `<svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#F3BA2F"/>
    <path fill="#fff" d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.003-.003 2.263-2.257zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.188-.002h.002V16L16 18.294l-2.291-2.29-.004-.004.004-.003.401-.402.195-.195L16 13.706l2.293 2.293z"/>
  </svg>`,
  ADA: `<svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#0033AD"/>
    <g fill="#fff">
      <circle cx="16" cy="16" r="1.4"/>
      <circle cx="11" cy="16" r=".9"/><circle cx="21" cy="16" r=".9"/>
      <circle cx="16" cy="11" r=".9"/><circle cx="16" cy="21" r=".9"/>
      <circle cx="12.5" cy="12.5" r=".7"/><circle cx="19.5" cy="12.5" r=".7"/>
      <circle cx="12.5" cy="19.5" r=".7"/><circle cx="19.5" cy="19.5" r=".7"/>
      <circle cx="8" cy="13.5" r=".5"/><circle cx="8" cy="18.5" r=".5"/>
      <circle cx="24" cy="13.5" r=".5"/><circle cx="24" cy="18.5" r=".5"/>
      <circle cx="13.5" cy="8" r=".5"/><circle cx="18.5" cy="8" r=".5"/>
      <circle cx="13.5" cy="24" r=".5"/><circle cx="18.5" cy="24" r=".5"/>
    </g>
  </svg>`,
  DOGE: `<svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#C2A633"/>
    <path fill="#fff" d="M13.5 8.5h5.6c2 0 3.7.6 4.9 1.8 1.3 1.3 1.9 3.1 1.9 5.4v.8c0 2.3-.6 4.1-1.9 5.4-1.2 1.2-2.9 1.8-4.9 1.8H13.5v-5.3h-2v-4.5h2V8.5zm3.7 4.4v6.4h1.7c1 0 1.7-.3 2.2-.8.5-.5.7-1.3.7-2.5v-.2c0-1.1-.2-1.9-.7-2.4-.5-.5-1.2-.8-2.2-.8h-1.7z"/>
  </svg>`,
  AVAX: `<svg viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#E84142"/>
    <path fill="#fff" d="M21.5 22h3.5c.7 0 1-.5.6-1.1L19 9.3c-.3-.5-1-.5-1.3 0l-1.4 2.4c-.2.3-.2.7 0 1l5.6 9.7c.1.4.4.6.6.6zm-7.3-3.4c-.3-.5-1-.5-1.3 0L9.4 25.4c-.3.5 0 1.1.6 1.1h6.9c.7 0 1-.5.6-1.1l-3.3-6.8z"/>
  </svg>`,
  // IDX stocks — text-on-tinted-square logos (no real ticker SVGs available)
  BBCA: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#003D7A"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="10" font-weight="700">BBCA</text></svg>`,
  BBRI: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#1E5BAA"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="10" font-weight="700">BBRI</text></svg>`,
  BMRI: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#003B6F"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="10" font-weight="700">BMRI</text></svg>`,
  TLKM: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#C8202F"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="10" font-weight="700">TLKM</text></svg>`,
  ASII: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#0066B3"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="10" font-weight="700">ASII</text></svg>`,
  GOTO: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#00AA13"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="10" font-weight="700">GOTO</text></svg>`,
  UNVR: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#1F36C7"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="10" font-weight="700">UNVR</text></svg>`,
  AAPL: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#1d1d1f"/><path fill="#fff" d="M18.5 11.6c-.7-.8-1.7-1.3-2.7-1.3-1.3 0-2 .8-2.9.8-.9 0-1.6-.7-2.7-.7-1.5 0-3.1 1-3.1 3.3 0 2.7 2.2 5.6 4.4 5.6.8 0 1.3-.5 2.3-.5s1.4.5 2.3.5c1 0 2-.6 2.7-1.5.3-.4.5-.7.7-1.1-1.4-.6-1.9-2.5-.7-3.7-.5-.4-.9-.7-1.3-1.4zm-3.5-1.6c.1-.6.4-1.1.9-1.5.5-.4 1.1-.5 1.5-.4-.1.5-.4 1.1-.9 1.5-.5.4-1.1.6-1.5.4z"/></svg>`,
  MSFT: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#000"/><rect x="7" y="7" width="8.5" height="8.5" fill="#F25022"/><rect x="16.5" y="7" width="8.5" height="8.5" fill="#7FBA00"/><rect x="7" y="16.5" width="8.5" height="8.5" fill="#00A4EF"/><rect x="16.5" y="16.5" width="8.5" height="8.5" fill="#FFB900"/></svg>`,
  NVDA: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#76B900"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="10" font-weight="700">NVDA</text></svg>`,
  TSLA: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#CC0000"/><text x="16" y="20" text-anchor="middle" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="10" font-weight="700">TSLA</text></svg>`,
  AMZN: `<svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="6" fill="#232F3E"/><text x="16" y="20" text-anchor="middle" fill="#FF9900" font-family="ui-sans-serif,system-ui" font-size="10" font-weight="700">AMZN</text></svg>`,
};

function logoSvg(item) {
  // Crypto: try coin symbol
  if (item._kind === 'crypto') {
    var coin = (item.coin || '').toUpperCase();
    if (TICKER_LOGO[coin]) return TICKER_LOGO[coin];
  }
  // Stocks: try ticker symbol
  if (item._kind === 'stocks') {
    var t = (item.ticker || '').toUpperCase();
    if (TICKER_LOGO[t]) return TICKER_LOGO[t];
  }
  // Else fall back to category icon
  return categoryIconSvg(item);
}

function hasTickerLogo(item) {
  if (item._kind === 'crypto')  return !!TICKER_LOGO[(item.coin   || '').toUpperCase()];
  if (item._kind === 'stocks')  return !!TICKER_LOGO[(item.ticker || '').toUpperCase()];
  return false;
}
function detailOf(item) {
  if (item._kind === 'crypto')  return (item.amount || 0).toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 4 }) + ' × ' + Math.round(cryptoPrice(item)).toLocaleString('id-ID');
  if (item._kind === 'gold')    return (item.grams || 0) + ' g × Rp ' + Math.round(S.goldGramIdr || 0).toLocaleString('id-ID');
  if (item._kind === 'stocks')  return (item.shares || 0) + ' × Rp ' + Math.round(stockPrice(item)).toLocaleString('id-ID');
  if (item._kind === 'savings') return (item.bank || '').toUpperCase();
  return '';
}

function aggregateHoldings() {
  // Flatten all four arrays with a _kind tag
  const items = [
    ...(DATA.crypto  || []).map(x => ({ ...x, _kind: 'crypto'  })),
    ...(DATA.gold    || []).map(x => ({ ...x, _kind: 'gold'    })),
    ...(DATA.stocks  || []).map(x => ({ ...x, _kind: 'stocks'  })),
    ...(DATA.savings || []).map(x => ({ ...x, _kind: 'savings' })),
  ];
  // Group identical assets (same kind + same identifier) so multi-platform/multi-lot
  // holdings show as a single row.
  const keyOf = (it) => {
    if (it._kind === 'crypto')  return 'crypto:' + (it.coin || '');
    if (it._kind === 'stocks')  return 'stocks:' + (it.ticker || '');
    if (it._kind === 'gold')    return 'gold:' + (it.name || '');
    if (it._kind === 'savings') return 'savings:' + (it.name || '') + ':' + (it.bank || '');
    return it._kind + ':' + (it.id || '');
  };
  const map = new Map();
  for (const it of items) {
    const k = keyOf(it);
    const v = valueOf(it);
    if (!map.has(k)) {
      map.set(k, { ...it, _value: v, _qty: it.amount || it.grams || it.shares || 0 });
    } else {
      const e = map.get(k);
      e._value += v;
      e._qty += (it.amount || it.grams || it.shares || 0);
      // merge amount/grams/shares for representative display
      if (it._kind === 'crypto')  e.amount = (e.amount || 0) + (it.amount || 0);
      if (it._kind === 'gold')    e.grams  = (e.grams  || 0) + (it.grams  || 0);
      if (it._kind === 'stocks')  e.shares = (e.shares || 0) + (it.shares || 0);
    }
  }
  return [...map.values()].sort((a, b) => b._value - a._value);
}

function renderHoldings() {
  const root = document.querySelector('[data-holdings]');
  if (!root) return;
  const all = aggregateHoldings();
  const T = totals();
  const grand = T.t || all.reduce((s, x) => s + x._value, 0) || 1;

  const top = all.slice(0, 5);
  if (!top.length) {
    root.innerHTML = '<div class="holdings__empty">' + t('home.empty', 'Belum ada posisi.') + '</div>';
  } else {
    root.innerHTML = top.map(item => {
      const n = nameOf(item);
      const v = item._value;
      const weight = (v / grand) * 100;
      // delta unknown without time-series per-asset — use cost-basis pseudo-delta where possible
      let delta = 0, deltaPct = 0;
      if (item._kind === 'crypto' && item.costBasisIdr) { delta = v - item.costBasisIdr; deltaPct = item.costBasisIdr > 0 ? (delta / item.costBasisIdr) * 100 : 0; }
      if (item._kind === 'stocks' && item.seedPrice)    { const cost = item.shares * stockMul(item) * item.seedPrice; delta = v - cost; deltaPct = cost > 0 ? (delta / cost) * 100 : 0; }
      if (item._kind === 'gold'   && item.costBasisPerGram) { const cost = item.grams * item.costBasisPerGram; delta = v - cost; deltaPct = cost > 0 ? (delta / cost) * 100 : 0; }
      const dDir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
      const dArrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '▪';
      const hasLogo = hasTickerLogo(item);
      return `
        <div class="holding">
          <div class="holding__icon ${hasLogo ? 'holding__icon--logo' : 'holding__icon--' + item._kind}">${logoSvg(item)}</div>
          <div class="holding__name">
            <span class="ticker">${esc(n.ticker)}</span>
            <span class="desc">${esc(n.desc)}</span>
          </div>
          <div class="holding__val">${fmtIDR(v, { compact: v >= 1e7 })}<span class="sub">${esc(detailOf(item))}</span></div>
          <div class="holding__weight">
            <div class="holding__weight__bar"><div style="width: ${Math.min(100, Math.max(2, weight)).toFixed(1)}%"></div></div>
            <span class="holding__weight__num">${weight.toFixed(1)}%</span>
          </div>
          <div class="holding__delta ${dDir}">${dArrow} ${fmtPct(deltaPct)}</div>
          <div class="holding__chart">
            ${miniSparklineSvg(dDir)}
          </div>
        </div>
      `;
    }).join('');
  }

  const moreEl = document.querySelector('[data-pos-more]');
  if (moreEl) moreEl.textContent = (getLang() === 'id' ? 'Semua ' : 'All ') + all.length + (getLang() === 'id' ? ' aset →' : ' assets →');
}

function miniSparklineSvg(dir) {
  // 9-point pseudo-walk; direction biases the slope
  const pts = [];
  let y = 14;
  for (let i = 0; i <= 8; i++) {
    const bias = dir === 'up' ? -0.8 : dir === 'down' ? 0.8 : 0;
    y = Math.max(2, Math.min(26, y + (Math.random() - 0.5) * 4 + bias));
    pts.push((i * 10) + ',' + y.toFixed(1));
  }
  const color = dir === 'up' ? 'var(--up)' : dir === 'down' ? 'var(--down)' : 'var(--warn)';
  return `<svg viewBox="0 0 80 28" preserveAspectRatio="none"><path d="M ${pts.join(' L ')}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
}

/* ---- ACTIVITY FEED ---- */
function actionToType(action, kind) {
  const a = (action || '').toLowerCase();
  if (a === 'buy')  return 't-buy';
  if (a === 'sell') return 't-sell';
  if (a === 'div' || a === 'dividen') return 't-div';
  if (a === 'fee')  return 't-fee';
  if (a === 'add')  return 't-add';
  if (a === 'tax')  return 't-tax';
  return 't-add';
}
function actionLabel(action) {
  const a = (action || '').toLowerCase();
  if (a === 'buy')  return 'BUY';
  if (a === 'sell') return 'SELL';
  if (a === 'div')  return 'DIV';
  if (a === 'fee')  return 'FEE';
  if (a === 'add')  return 'ADD';
  if (a === 'tax')  return 'TAX';
  return a.toUpperCase();
}
function renderActivity() {
  const root = document.querySelector('[data-activity]');
  if (!root) return;
  const log = (DATA.txLog || []).slice().sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 5);
  if (!log.length) {
    root.innerHTML = '<div class="activity__empty">' + t('home.act-empty', 'Belum ada aktivitas.') + '</div>';
    return;
  }
  root.innerHTML = log.map(tx => `
    <div class="activity__row">
      <span class="activity__when">${esc(relTime(tx.ts))}</span>
      <span class="activity__type ${actionToType(tx.action)}">${actionLabel(tx.action)}</span>
      <span class="activity__what">${esc(tx.detail || (tx.name || ''))}</span>
      <span class="activity__amt"></span>
      <span class="activity__price">${esc((tx.name || '') + (tx.type ? ' · ' + tx.type : ''))}</span>
    </div>
  `).join('');
}

/* ---- DIVERSIFICATION ---- */
function renderDiversification() {
  const T = totals();
  const grand = T.t || 0;
  const rows = [
    { key: 'stocks',  cls: '',          label: getLang() === 'id' ? 'Saham' : 'Stocks',  val: T.k },
    { key: 'crypto',  cls: 'c-crypto',  label: 'Crypto',                                  val: T.c },
    { key: 'savings', cls: 'c-savings', label: getLang() === 'id' ? 'Tabungan / cash' : 'Savings / cash', val: T.sv },
    { key: 'gold',    cls: 'c-gold',    label: 'Emas',                                    val: T.g },
  ];
  const bars = document.querySelector('[data-div-bars]');
  if (bars) {
    bars.innerHTML = rows.map(r => {
      const pct = grand > 0 ? (r.val / grand) * 100 : 0;
      return `
        <div class="div-bar">
          <span class="div-bar__label">${esc(r.label)}</span>
          <div class="div-bar__track"><div class="div-bar__fill ${r.cls}" style="width: ${Math.min(100, pct).toFixed(1)}%"></div></div>
          <span class="div-bar__num">${pct.toFixed(1)}%</span>
        </div>
      `;
    }).join('');
  }
  // headline + body + insight
  const headEl    = document.querySelector('[data-div-head]');
  const bodyEl    = document.querySelector('[data-div-body]');
  const insightEl = document.querySelector('[data-div-insight]');
  const targets = S.rebalTargets || { stocks: 30, crypto: 40, gold: 15, savings: 15 };
  if (headEl) headEl.textContent = getLang() === 'id'
    ? `Target profil kamu`
    : `Your profile target`;
  if (bodyEl) bodyEl.textContent = getLang() === 'id'
    ? `Saham ${targets.stocks}%, crypto ${targets.crypto}%, emas ${targets.gold}%, tabungan ${targets.savings}%. Sistem ngebandingin posisi sekarang dengan target. Lihat panel di bawah.`
    : `Stocks ${targets.stocks}%, crypto ${targets.crypto}%, gold ${targets.gold}%, savings ${targets.savings}%. We compare current allocation to this target. See panel below.`;
  if (insightEl) {
    // pick most over-weighted vs target
    const actual = grand > 0 ? {
      stocks:  (T.k  / grand) * 100,
      crypto:  (T.c  / grand) * 100,
      gold:    (T.g  / grand) * 100,
      savings: (T.sv / grand) * 100,
    } : null;
    if (actual) {
      const diffs = Object.entries(actual).map(([k, v]) => ({ k, diff: v - (targets[k] || 0), v, target: targets[k] || 0 })).sort((a, b) => b.diff - a.diff);
      const worst = diffs[0];
      if (worst && Math.abs(worst.diff) > 3) {
        const label = { stocks: getLang() === 'id' ? 'saham' : 'stocks', crypto: 'crypto', gold: getLang() === 'id' ? 'emas' : 'gold', savings: getLang() === 'id' ? 'tabungan' : 'savings' }[worst.k];
        insightEl.hidden = false;
        insightEl.textContent = getLang() === 'id'
          ? `${cap(label)} kamu ${worst.v.toFixed(1)}%, ${worst.diff > 0 ? 'di atas' : 'di bawah'} target ${worst.target}%. Pertimbangkan rebalance.`
          : `Your ${label} is at ${worst.v.toFixed(1)}%, ${worst.diff > 0 ? 'above' : 'below'} target ${worst.target}%. Consider rebalancing.`;
      } else {
        insightEl.hidden = true;
      }
    }
  }
}

/* QUICK-ADD UI wiring lives in js/quickadd-ui.js (shared between HOME + TRANSAKSI).
   home.js only re-renders when a successful quickadd fires portfolio:update. */

/* ---- ORCHESTRATION ---- */
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function rerender() {
  renderGreeting();
  renderTotal();
  renderSparkline(currentRange);
  renderMarketRail();
  renderHoldings();
  renderActivity();
  renderDiversification();
  // scroll-reveal sections
  document.querySelectorAll('#tab-home .reveal:not(.in)').forEach(el => el.classList.add('in'));
}

function init() {
  // Apply i18n if available (covers any new keys)
  if (i18n) i18n.applyI18n();
  wireRangePills();
  rerender();

  // Re-render on data + locale + theme + auth changes
  window.addEventListener('portfolio:update', rerender);
  window.addEventListener('psys:lang-change', rerender);
  window.addEventListener('psys:theme-change', rerender);
  // when user signs in, #userDisplayName updates — re-render greeting
  const nameEl = document.getElementById('userDisplayName');
  if (nameEl) new MutationObserver(renderGreeting).observe(nameEl, { childList: true, characterData: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Expose for debugging
if (typeof window !== 'undefined') {
  window.psys = window.psys || {};
  window.psys.home = { rerender };
}
