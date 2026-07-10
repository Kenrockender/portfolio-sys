/* ============================================================
   portfolio.sys — ASET (HOLDINGS) tab
   Per-platform / per-broker breakdown. Reads from state.js DATA
   arrays and uses storage.js price helpers. Grouped by category
   with optional sort + category filter.

   Imports: state.js (S, DATA), storage.js (price helpers).
   ============================================================ */

import { S, DATA } from './state.js';
import { cryptoPrice, stockPrice, stockMul, savingsIdr } from './storage.js';

const i18n = (typeof window !== 'undefined' && window.psys && window.psys.i18n) || null;
function t(k, fb)        { return i18n ? i18n.t(k, fb) : (fb || k); }
function lang()          { return i18n ? i18n.getLang() : 'id'; }
function fmtIDR(n, opts) { return i18n ? i18n.fmtIDR(n, opts) : ('Rp ' + Math.round(n || 0).toLocaleString('id-ID')); }
function fmtDeltaIDR(n, opts) { return i18n ? i18n.fmtDeltaIDR(n, opts) : ((n >= 0 ? '+' : '−') + fmtIDR(Math.abs(n), opts)); }
function fmtPct(n, d)    { return i18n ? i18n.fmtPct(n, d) : ((n >= 0 ? '+' : '−') + Math.abs(n).toFixed(d || 2) + '%'); }

const state = {
  cat: 'all',          // all | crypto | stocks | gold | savings
  sort: 'value-desc',
};

function esc(s) {
  return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
  });
}

/* ---- BUILD UNIFIED ROW LIST ---- */
function flatten() {
  const rows = [];
  (DATA.crypto || []).forEach(function (h) {
    const price = cryptoPrice(h);
    const val = (h.amount || 0) * price;
    const cost = h.costBasisIdr || 0;
    const pnl = val - cost;
    const ret = cost > 0 ? (pnl / cost) * 100 : 0;
    rows.push({
      kind: 'crypto',
      ticker: h.coin || '?',
      name: h.name || h.coin,
      platform: (h.platform || '').toUpperCase(),
      qty: h.amount, qtyLabel: (h.amount || 0).toLocaleString(lang() === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 6 }) + ' ' + (h.coin || ''),
      price: price,
      val: val, cost: cost, pnl: pnl, ret: ret,
      raw: h,
    });
  });
  (DATA.stocks || []).forEach(function (h) {
    const price = stockPrice(h);
    const mul = stockMul(h);
    const shares = h.shares || 0;
    const val = shares * mul * price;
    const cost = shares * mul * (h.seedPrice || 0);
    const pnl = val - cost;
    const ret = cost > 0 ? (pnl / cost) * 100 : 0;
    rows.push({
      kind: 'stocks',
      ticker: h.ticker || '?',
      name: h.name || h.ticker,
      platform: (h.broker || h.market || '').toUpperCase(),
      qty: shares, qtyLabel: shares + (lang() === 'id' ? ' lembar' : ' shares') + (mul > 1 ? ' (' + (shares * mul) + ' shares)' : ''),
      price: price,
      val: val, cost: cost, pnl: pnl, ret: ret,
      raw: h,
    });
  });
  (DATA.gold || []).forEach(function (h) {
    const price = S.goldGramIdr || 0;
    const val = (h.grams || 0) * price;
    const cost = (h.grams || 0) * (h.costBasisPerGram || 0);
    const pnl = val - cost;
    const ret = cost > 0 ? (pnl / cost) * 100 : 0;
    rows.push({
      kind: 'gold',
      ticker: 'EMAS',
      name: h.name || 'Antam',
      platform: (lang() === 'id' ? 'FISIK' : 'PHYSICAL'),
      qty: h.grams, qtyLabel: (h.grams || 0) + ' gr',
      price: price,
      val: val, cost: cost, pnl: pnl, ret: ret,
      raw: h,
    });
  });
  (DATA.savings || []).forEach(function (h) {
    const val = savingsIdr(h);
    rows.push({
      kind: 'savings',
      ticker: (h.name || 'SAVINGS'),
      name: h.note || (h.currency + ' · ' + (h.annualYield || 0) + '% p.a.'),
      platform: (h.bank || '').toUpperCase(),
      qty: h.foreignAmt || h.idr || 0,
      qtyLabel: h.currency === 'IDR'
        ? 'Rp ' + (h.foreignAmt || h.idr || 0).toLocaleString('id-ID')
        : (h.currency || '') + ' ' + (h.foreignAmt || 0).toLocaleString(lang() === 'id' ? 'id-ID' : 'en-US'),
      price: 0,
      val: val, cost: 0, pnl: 0, ret: h.annualYield || 0,
      raw: h,
    });
  });
  return rows;
}

function filtered() {
  let rows = flatten();
  if (state.cat !== 'all') {rows = rows.filter(function (r) { return r.kind === state.cat; });}
  switch (state.sort) {
    case 'value-asc':  rows.sort(function (a, b) { return a.val - b.val; }); break;
    case 'pnl-desc':   rows.sort(function (a, b) { return b.pnl - a.pnl; }); break;
    case 'pnl-asc':    rows.sort(function (a, b) { return a.pnl - b.pnl; }); break;
    case 'ret-desc':   rows.sort(function (a, b) { return b.ret - a.ret; }); break;
    case 'name':       rows.sort(function (a, b) { return (a.ticker || '').localeCompare(b.ticker || ''); }); break;
    case 'platform':   rows.sort(function (a, b) { return (a.platform || '').localeCompare(b.platform || ''); }); break;
    case 'value-desc':
    default:           rows.sort(function (a, b) { return b.val - a.val; });
  }
  return rows;
}

/* ---- CATEGORY ICON / LOGO ---- */
// Reuses the logo map exposed by home.js via window.psys.logos when available.
function rowLogoSvg(row) {
  // Try ticker-specific logo from window.psys (set by home.js)
  if (window.psys && window.psys.logos && window.psys.logos[row.ticker]) {
    return { svg: window.psys.logos[row.ticker], variant: 'logo' };
  }
  // Fallback: category icon
  return { svg: categorySvg(row.kind), variant: row.kind };
}
function categorySvg(kind) {
  const ICON = {
    crypto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 2 L20 7 L20 17 L12 22 L4 17 L4 7 Z"/><circle cx="12" cy="12" r="3.5"/></svg>',
    stocks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><line x1="5" y1="20" x2="5" y2="14"/><line x1="12" y1="20" x2="12" y2="9"/><line x1="19" y1="20" x2="19" y2="4"/></svg>',
    gold:   '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><rect x="3" y="9" width="18" height="9" rx="1.5"/><rect x="6" y="6" width="12" height="3" rx="1" opacity="0.55"/></svg>',
    savings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M3 9 L12 4 L21 9"/><line x1="5" y1="11" x2="5" y2="18"/><line x1="12" y1="11" x2="12" y2="18"/><line x1="19" y1="11" x2="19" y2="18"/><line x1="3" y1="20" x2="21" y2="20"/></svg>',
  };
  return ICON[kind] || ICON.stocks;
}

/* ---- RENDER ---- */
function renderHead(rows) {
  const sub = document.querySelector('[data-hd-sub]');
  if (sub) {
    const classes = ['crypto','stocks','gold','savings'].filter(function (k) { return rows.some(function (r) { return r.kind === k; }); }).length;
    sub.textContent = rows.length + (lang() === 'id' ? ' aset · ' : ' assets · ') + classes + (lang() === 'id' ? ' kelas' : ' classes');
  }
}

function renderSummary() {
  const all = flatten();
  const total = all.reduce(function (s, r) { return s + r.val; }, 0);
  const cost  = all.reduce(function (s, r) { return s + r.cost; }, 0);
  const pnl   = all.reduce(function (s, r) { return s + r.pnl; }, 0);
  const ret   = cost > 0 ? (pnl / cost) * 100 : 0;
  function set(sel, val, meta) {
    const v = document.querySelector(sel); if (v) {v.textContent = val;}
    if (meta != null) { const m = document.querySelector(sel.replace(/\]$/, '-meta]')); if (m) {m.textContent = meta;} }
  }
  set('[data-hd-total]', fmtIDR(total, { compact: true }), all.length + (lang() === 'id' ? ' posisi' : ' positions'));
  set('[data-hd-cost]',  fmtIDR(cost,  { compact: true }), lang() === 'id' ? 'total dibayar' : 'total paid');
  set('[data-hd-pnl]',   fmtDeltaIDR(pnl, { compact: true }), fmtPct(ret, 1) + ' return');
  const pnlEl = document.querySelector('[data-hd-pnl]');
  if (pnlEl) {
    pnlEl.classList.remove('is-pos','is-neg','is-mute');
    pnlEl.classList.add(pnl > 0 ? 'is-pos' : pnl < 0 ? 'is-neg' : 'is-mute');
  }
  set('[data-hd-count]', String(all.length), ['crypto','stocks','gold','savings'].filter(function (k) { return all.some(function (r) { return r.kind === k; }); }).length + (lang() === 'id' ? ' kelas aset' : ' asset classes'));

  // Per-category counts in the filter pills
  const counts = { all: all.length, crypto: 0, stocks: 0, gold: 0, savings: 0 };
  all.forEach(function (r) { counts[r.kind]++; });
  ['all','crypto','stocks','gold','savings'].forEach(function (k) {
    const el = document.querySelector('[data-hd-count-' + k + ']');
    if (el) {el.textContent = counts[k];}
  });
}

const CATEGORY_LABEL = {
  crypto:  { id: 'Crypto', en: 'Crypto' },
  stocks:  { id: 'Saham',  en: 'Stocks' },
  gold:    { id: 'Emas',   en: 'Gold'   },
  savings: { id: 'Tabungan & cash', en: 'Savings & cash' },
};

function rowHtml(r) {
  const logo = rowLogoSvg(r);
  const pnlDir = r.pnl > 0 ? 'up' : r.pnl < 0 ? 'down' : 'mute';
  const hasPnl = r.cost > 0;
  const id = (r.raw && r.raw.id) || '';
  return ''
    + '<div class="hd-row" data-hd-edit="' + esc(r.kind) + ':' + esc(id) + '" title="' + esc(lang() === 'id' ? 'Klik untuk edit' : 'Click to edit') + '">'
    + '  <div class="hd-row__icon hd-row__icon--' + esc(logo.variant) + '">' + logo.svg + '</div>'
    + '  <div class="hd-row__name">'
    + '    <div class="hd-row__name__main">'
    + '      <span class="ticker">' + esc(r.ticker) + '</span>'
    + '      <span class="label-name">' + esc(r.name) + '</span>'
    + '    </div>'
    + (r.platform ? '    <span class="hd-row__plat">' + esc(r.platform) + '</span>' : '')
    + '  </div>'
    + '  <div class="hd-row__qty"><b>' + esc(r.qtyLabel) + '</b>'
    + (r.price ? '<span class="sub">@ ' + esc(fmtIDR(Math.round(r.price))) + '</span>' : '')
    + '  </div>'
    + '  <div class="hd-row__val">' + esc(fmtIDR(r.val, { compact: r.val >= 1e7 }))
    + (hasPnl ? '<span class="sub">cost ' + esc(fmtIDR(r.cost, { compact: r.cost >= 1e7 })) + '</span>' : '')
    + '  </div>'
    + '  <div class="hd-row__pnl ' + pnlDir + '">'
    + (hasPnl
        ? '<span class="abs">' + esc(fmtDeltaIDR(r.pnl, { compact: Math.abs(r.pnl) >= 1e7 })) + '</span><span class="pct">' + esc(fmtPct(r.ret, 1)) + '</span>'
        : (r.kind === 'savings'
            ? '<span class="abs">' + esc(fmtPct(r.ret, 1)) + ' p.a.</span><span class="pct">' + esc(lang() === 'id' ? 'yield tahunan' : 'annual yield') + '</span>'
            : '<span class="abs" style="color:var(--ink-faint);">' + esc(lang() === 'id' ? 'cost basis kosong' : 'no cost basis') + '</span>'))
    + '  </div>'
    + '</div>';
}

function renderGroups() {
  const root = document.querySelector('[data-hd-groups]');
  if (!root) {return;}
  const rows = filtered();

  if (!rows.length) {
    root.innerHTML = '<div class="hd__empty">' + esc(lang() === 'id'
      ? 'Belum ada aset di kategori ini.'
      : 'No assets in this category yet.') + '</div>';
    return;
  }

  // When a specific category is selected, render a single group;
  // when "all", group by category in a fixed order.
  const order = ['crypto', 'stocks', 'gold', 'savings'];
  const groups = {};
  rows.forEach(function (r) { (groups[r.kind] = groups[r.kind] || []).push(r); });

  let html = '';
  order.forEach(function (k) {
    if (!groups[k] || !groups[k].length) {return;}
    const groupRows = groups[k];
    const total = groupRows.reduce(function (s, r) { return s + r.val; }, 0);
    html += ''
      + '<div class="hd-group">'
      + '  <div class="hd-group__head">'
      + '    <h3>' + esc(CATEGORY_LABEL[k][lang() === 'id' ? 'id' : 'en']) + '</h3>'
      + '    <span class="hd-group__head__meta">' + groupRows.length + (lang() === 'id' ? ' aset' : ' assets') + '</span>'
      + '    <span class="hd-group__head__total">' + esc(lang() === 'id' ? 'Total: ' : 'Total: ') + '<b>' + esc(fmtIDR(total, { compact: true })) + '</b></span>'
      + '    <button class="hd-group__add" data-hd-add="' + esc(k) + '" title="' + esc(lang() === 'id' ? 'Tambah aset' : 'Add asset') + '">+ ' + esc(lang() === 'id' ? 'Tambah' : 'Add') + '</button>'
      + '  </div>'
      + '  <div class="hd-group__rows">' + groupRows.map(rowHtml).join('') + '</div>'
      + '</div>';
  });

  // If a single category is selected and has no entries, show a single
  // empty group with an Add CTA.
  if (state.cat !== 'all' && (!groups[state.cat] || !groups[state.cat].length)) {
    html = ''
      + '<div class="hd__empty" style="display: flex; flex-direction: column; gap: var(--sp-m); align-items: center;">'
      + '<span>' + esc(lang() === 'id' ? 'Belum ada aset di kategori ini.' : 'No assets in this category yet.') + '</span>'
      + '<button class="btn btn--primary" data-hd-add="' + esc(state.cat) + '">+ ' + esc(lang() === 'id' ? 'Tambah ' : 'Add ') + esc(CATEGORY_LABEL[state.cat][lang() === 'id' ? 'id' : 'en']) + '</button>'
      + '</div>';
  }

  root.innerHTML = html;
}

function rerender() {
  renderSummary();
  renderHead(filtered());
  renderGroups();
}

/* ---- WIRING ---- */
function wireFilters() {
  document.querySelectorAll('[data-hd-cat]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-hd-cat]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      state.cat = b.getAttribute('data-hd-cat');
      renderGroups();
      renderHead(filtered());
    });
  });
}
function wireSort() {
  const s = document.querySelector('[data-hd-sort]');
  if (!s) {return;}
  s.addEventListener('change', function () {
    state.sort = s.value;
    renderGroups();
  });
}

function findItem(kind, id) {
  const arr = ({ crypto: DATA.crypto, stocks: DATA.stocks, gold: DATA.gold, savings: DATA.savings })[kind];
  if (!arr) {return null;}
  return arr.find(function (x) { return x.id === id; }) || null;
}

function wireRowActions() {
  // Delegated click: row → edit, +Tambah/group-add → add new
  document.addEventListener('click', function (e) {
    // +Tambah button (group head or empty-state CTA)
    const addBtn = e.target.closest('[data-hd-add]');
    if (addBtn) {
      e.preventDefault();
      const kind = addBtn.getAttribute('data-hd-add');
      if (window.psys && window.psys.assetEditor) {window.psys.assetEditor.open(kind, null);}
      return;
    }
    // Row click → open editor
    const row = e.target.closest('[data-hd-edit]');
    if (row) {
      e.preventDefault();
      const payload = row.getAttribute('data-hd-edit') || '';
      const parts = payload.split(':');
      const kind2 = parts[0], id = parts[1];
      if (!kind2 || !id) {return;}
      const item = findItem(kind2, id);
      if (item && window.psys && window.psys.assetEditor) {window.psys.assetEditor.open(kind2, item);}
    }
  });
}

function init() {
  if (i18n) {i18n.applyI18n();}
  wireFilters();
  wireSort();
  wireRowActions();
  rerender();

  window.addEventListener('portfolio:update', rerender);
  window.addEventListener('psys:lang-change', rerender);
  window.addEventListener('psys:tab-change', function (e) {
    if (e && e.detail && e.detail.tab === 'aset') {rerender();}
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

if (typeof window !== 'undefined') {
  window.psys = window.psys || {};
  window.psys.holdings = { rerender: rerender };
}
