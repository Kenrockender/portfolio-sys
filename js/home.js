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
    nameEl.textContent = first ? first + '.' : '—';
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

/* ---- MARKET RAIL ---- */
function setMarketCard(key, val, deltaStr, dir, valFmt) {
  const card = document.querySelector(`[data-market="${key}"]`);
  if (!card) return;
  const valEl = card.querySelector('.market__val');
  const dEl   = card.querySelector('.market__delta');
  const dot   = card.querySelector('.market__label__dot');
  if (valEl) valEl.textContent = valFmt || val;
  if (dEl)   dEl.textContent   = deltaStr;
  if (dot) {
    dot.classList.remove('is-down', 'is-flat');
    if (dir === 'down') dot.classList.add('is-down');
    else if (dir === 'flat') dot.classList.add('is-flat');
  }
  if (dEl) {
    dEl.classList.remove('up', 'down');
    if (dir === 'up')   dEl.classList.add('up');
    if (dir === 'down') dEl.classList.add('down');
  }
}

function renderMarketRail() {
  // IHSG — try stockPrices['^IHSG'] then DATA.stocks find ticker ^IHSG seedPrice
  const ihsgLive = S.stockPrices && S.stockPrices['^IHSG'];
  const ihsgSeed = (DATA.stocks || []).find(h => h.ticker === '^IHSG');
  const ihsg = ihsgLive || (ihsgSeed ? ihsgSeed.seedPrice : 0);
  if (ihsg) {
    const seed = ihsgSeed ? ihsgSeed.seedPrice : ihsg;
    const pct = seed > 0 ? ((ihsg - seed) / seed) * 100 : 0;
    setMarketCard('ihsg',
      ihsg,
      fmtPct(pct),
      pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat',
      ihsg.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 2 }));
  } else {
    setMarketCard('ihsg', 0, '—', 'flat', '—');
  }

  // USD / IDR
  const usdidr = S.usdIdr || 0;
  if (usdidr) {
    setMarketCard('usdidr', usdidr, getLang() === 'id' ? 'kurs harian' : 'daily rate', 'flat',
      usdidr.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-US'));
  }

  // Gold per gram
  const gold = S.goldGramIdr || 0;
  if (gold) {
    setMarketCard('gold', gold, getLang() === 'id' ? 'per gram (IDR)' : 'per gram (IDR)', 'flat',
      'Rp ' + gold.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-US'));
  }

  // BTC
  const btc = S.btcIdr || 0;
  if (btc) {
    setMarketCard('btc', btc,
      getLang() === 'id' ? 'IDR / koin' : 'IDR / coin',
      'flat',
      fmtIDR(btc, { compact: true }));
  }
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
function iconLetter(item) {
  const n = nameOf(item);
  return (n.ticker || '?')[0].toUpperCase();
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
      return `
        <div class="holding">
          <div class="holding__icon">${iconLetter(item)}</div>
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
      <span class="activity__amt">—</span>
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
    ? `Saham ${targets.stocks}%, crypto ${targets.crypto}%, emas ${targets.gold}%, tabungan ${targets.savings}%. Sistem ngebandingin posisi sekarang dengan target — lihat panel di bawah.`
    : `Stocks ${targets.stocks}%, crypto ${targets.crypto}%, gold ${targets.gold}%, savings ${targets.savings}%. We compare current allocation to this target — see below.`;
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
          ? `${cap(label)} kamu ${worst.v.toFixed(1)}% — ${worst.diff > 0 ? 'di atas' : 'di bawah'} target ${worst.target}%. Pertimbangkan rebalance.`
          : `Your ${label} is at ${worst.v.toFixed(1)}% — ${worst.diff > 0 ? 'above' : 'below'} target ${worst.target}%. Consider rebalancing.`;
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
