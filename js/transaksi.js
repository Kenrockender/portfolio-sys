/* ============================================================
   portfolio.sys — TRANSAKSI tab renderer
   Day-grouped ledger from DATA.txLog. Summary strip, mode toggle
   (Semua / Transaksi / Arus kas), search filter, "show more"
   pagination.

   Imports DATA from state.js. Listens to portfolio:update,
   psys:lang-change, psys:quickadd, psys:tab-change.
   ============================================================ */

import { S, DATA } from './state.js';
import { cryptoPrice, stockPrice, stockMul, savingsIdr, bondIdr } from './storage.js';

const i18n = (typeof window !== 'undefined' && window.psys && window.psys.i18n) || null;

function t(k, fb) { return i18n ? i18n.t(k, fb) : (fb || k); }
function lang()   { return i18n ? i18n.getLang() : 'id'; }
function fmtIDR(n, opts) { return i18n ? i18n.fmtIDR(n, opts) : ('Rp ' + Math.round(n || 0).toLocaleString('id-ID')); }
function fmtDeltaIDR(n, opts) { return i18n ? i18n.fmtDeltaIDR(n, opts) : ((n >= 0 ? '+' : '−') + fmtIDR(Math.abs(n), opts)); }
function relTime(d) { return i18n ? i18n.relTime(d) : new Date(d).toLocaleString(); }

const state = {
  search: '',
  limit: 20,
};

function esc(s) {
  return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
  });
}

function startOfDay(d) {
  const dt = new Date(d); dt.setHours(0,0,0,0); return dt;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}
function diffDays(a, b) {
  return Math.round((startOfDay(a) - startOfDay(b)) / 86400000);
}

function dayHeading(date, now) {
  const d = diffDays(now, date);
  if (d === 0) {return lang() === 'id' ? 'Hari ini' : 'Today';}
  if (d === 1) {return lang() === 'id' ? 'Kemarin' : 'Yesterday';}
  if (d > 1 && d < 7) {
    const weekday = date.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  if (d >= 7 && d < 14) {return lang() === 'id' ? 'Minggu lalu' : 'Last week';}
  return date.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dayDateText(date) {
  return date.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isInCurrentMonth(d) {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

function monthLabel() {
  const n = new Date();
  return n.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' });
}

/* ---- TYPE PILL ---- */
function typeClass(action) {
  const a = String(action || '').toLowerCase();
  return ({
    buy: 't-buy', sell: 't-sell', div: 't-div', fee: 't-fee',
    income: 't-in', expense: 't-out', add: 't-add', tax: 't-tax',
    edit: 't-fee', delete: 't-sell',
  })[a] || 't-add';
}
function typeLabel(action) {
  const a = String(action || '').toLowerCase();
  if (a === 'buy')     {return 'BUY';}
  if (a === 'sell')    {return 'SELL';}
  if (a === 'div')     {return 'DIV';}
  if (a === 'fee')     {return 'FEE';}
  if (a === 'income')  {return 'IN';}
  if (a === 'expense') {return 'OUT';}
  if (a === 'tax')     {return 'TAX';}
  if (a === 'add')     {return 'ADD';}
  if (a === 'edit')    {return 'EDIT';}
  if (a === 'delete')  {return 'DEL';}
  return a.toUpperCase();
}

/* ---- FILTER ---- */
/* Multiple textual forms of a date so the search box matches ISO
   (2026-03-15), numeric (15/03/2026), and month names in id + en. */
function dateHaystack(ts) {
  const d = new Date(ts);
  if (isNaN(d)) {return '';}
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return [
    d.toISOString().slice(0, 10),
    dd + '/' + mm + '/' + yyyy,
    dd + '-' + mm + '-' + yyyy,
    d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long',  year: 'numeric' }),
    d.toLocaleDateString('en-US', { day: 'numeric', month: 'long',  year: 'numeric' }),
    d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
    d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
  ].join(' ');
}

function filtered() {
  const log = (DATA.txLog || []).slice().sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
  const q = (state.search || '').trim().toLowerCase();
  if (!q) {return log;}
  return log.filter(function (tx) {
    const hay = (tx.detail || '') + ' ' + (tx.name || '') + ' ' + (tx.type || '') + ' '
            + (tx.action || '') + ' ' + dateHaystack(tx.ts);
    return hay.toLowerCase().indexOf(q) !== -1;
  });
}

/* ---- SUMMARY ---- */
/* Rolling 90-day window anchored to MAX(today, last tx) — so seed
   data still shows numbers, and a fresh signed-in user sees recent
   activity rather than a zero summary. */
function summary() {
  const log = DATA.txLog || [];
  const s = { buy: 0, sell: 0, div: 0, fee: 0, tax: 0, income: 0, expense: 0, count: 0, cfCount: 0 };
  if (!log.length) { s.net = 0; return s; }

  // anchor = whichever is later: today or latest tx
  let latest = new Date(log[0].ts);
  for (let k = 0; k < log.length; k++) {
    const ts = new Date(log[k].ts);
    if (ts > latest) {latest = ts;}
  }
  const now    = new Date();
  const anchor = latest > now ? latest : now;
  const cutoff = new Date(anchor); cutoff.setDate(cutoff.getDate() - 90);

  for (let i = 0; i < log.length; i++) {
    const tx = log[i];
    const d  = new Date(tx.ts);
    if (d < cutoff) {continue;}
    const a   = String(tx.action || '').toLowerCase();
    const amt = Math.abs(Number(tx.amount) || 0);
    if (a === 'buy')          { s.buy     += amt; s.count++; }
    else if (a === 'sell')    { s.sell    += amt; s.count++; }
    else if (a === 'div')     { s.div     += amt; s.count++; }
    else if (a === 'fee')     { s.fee     += amt; s.count++; }
    else if (a === 'tax')     { s.tax     += amt; s.count++; }
    else if (a === 'income')  { s.income  += amt; s.cfCount++; }
    else if (a === 'expense') { s.expense += amt; s.cfCount++; }
  }
  s.net = s.sell + s.div + s.income - s.buy - s.fee - s.tax - s.expense;
  return s;
}

/* ---- RENDER ---- */

function renderHead() {
  const monthEl = document.querySelector('[data-tx-month]');
  if (monthEl) {monthEl.textContent = monthLabel();}
  const countEl = document.querySelector('[data-tx-count]');
  const n = (DATA.txLog || []).length;
  if (countEl) {countEl.textContent = n + (lang() === 'id' ? ' entri' : ' entries');}
}

function renderSummary() {
  const s = summary();
  function set(sel, val, meta) {
    const v = document.querySelector(sel);
    if (v) {v.textContent = val;}
    if (meta) {
      // selector `[data-foo]` → `[data-foo-meta]`
      const metaSel = sel.replace(/\]$/, '-meta]');
      const m = document.querySelector(metaSel);
      if (m) {m.textContent = meta;}
    }
  }
  const netEl = document.querySelector('[data-tx-sum-net]');
  if (netEl) {
    netEl.classList.remove('is-pos','is-neg','is-mute');
    netEl.classList.add(s.net > 0 ? 'is-pos' : (s.net < 0 ? 'is-neg' : 'is-mute'));
    netEl.textContent = fmtDeltaIDR(s.net, { compact: true });
  }
  const netMeta = document.querySelector('[data-tx-sum-net-meta]');
  if (netMeta) {netMeta.textContent = (lang() === 'id' ? s.count + ' transaksi' : s.count + ' trades');}

  set('[data-tx-sum-buy]',  fmtIDR(s.buy, { compact: true }),  (lang() === 'id' ? 'masuk portfolio' : 'into portfolio'));
  set('[data-tx-sum-sell]', fmtIDR(s.sell, { compact: true }), (lang() === 'id' ? 'realisasi' : 'realised'));
  set('[data-tx-sum-div]',  '+' + fmtIDR(s.div, { compact: true }), (lang() === 'id' ? 'dividen masuk' : 'dividends'));
  set('[data-tx-sum-fee]',  fmtIDR(s.fee + s.tax, { compact: true }), 'broker + PPh');
}

function rowHtml(tx) {
  const ts = new Date(tx.ts);
  const hh = String(ts.getHours()).padStart(2,'0');
  const mm = String(ts.getMinutes()).padStart(2,'0');
  const timeStr = hh + ':' + mm;
  const amt = Number(tx.amount) || 0;
  const act = String(tx.action || '').toLowerCase();
  let amtClass = amt > 0 ? 'is-pos' : amt < 0 ? 'is-neg' : 'is-mute';
  let amtStr = (amt > 0 ? '+' : amt < 0 ? '−' : '') + fmtIDR(Math.abs(amt), { compact: Math.abs(amt) >= 1e7 });
  if (act === 'add' || act === 'delete') { amtStr = ''; amtClass = ''; }
  const qtyStr = (tx.qty && tx.price)
    ? esc(tx.qty.toLocaleString(lang() === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 4 })) + ' <span class="x">×</span> Rp ' + esc(Math.round(tx.price).toLocaleString('id-ID'))
    : '';
  const what = esc(tx.detail || (tx.name || ''));
  return ''
    + '<div class="row" data-tx-id="' + esc(tx.id || '') + '">'
    + '  <span class="row__time">' + esc(timeStr) + '</span>'
    + '  <span class="row__type ' + typeClass(tx.action) + '">' + esc(typeLabel(tx.action)) + '</span>'
    + '  <div class="row__what"><span class="row__what__main">' + what + '</span><span class="row__what__sub">' + esc(tx.via || tx.type || '') + '</span></div>'
    + '  <span class="row__qty">' + qtyStr + '</span>'
    + '  <span class="row__amt ' + amtClass + '">' + esc(amtStr) + '</span>'
    + '  <span class="row__menu" aria-label="More">⋯</span>'
    + '</div>';
}

function renderLedger() {
  const root = document.querySelector('[data-tx-ledger]');
  if (!root) {return;}
  const rows = filtered();
  const endline = document.querySelector('[data-tx-endline]');

  if (!rows.length) {
    root.innerHTML = '<div class="placeholder" style="border:1px dashed var(--rule); margin: 0;"><h2 class="serif">' + esc(lang() === 'id' ? 'Belum ada catatan' : 'No entries yet') + '</h2><p>' + esc(lang() === 'id' ? 'Pakai quick-add di atas atau tombol + Tambah.' : 'Use the quick-add above or the + Add button.') + '</p></div>';
    if (endline) {endline.innerHTML = '';}
    return;
  }

  const visible = rows.slice(0, state.limit);
  const groups = []; // [{ date: Date, rows: [], net: 0 }]
  for (let i = 0; i < visible.length; i++) {
    const d = startOfDay(new Date(visible[i].ts));
    let g = groups[groups.length - 1];
    if (!g || !sameDay(g.date, d)) {
      g = { date: d, rows: [], net: 0 };
      groups.push(g);
    }
    g.rows.push(visible[i]);
    g.net += Number(visible[i].amount) || 0;
  }

  const now = new Date();
  let html = '';
  for (let k = 0; k < groups.length; k++) {
    const grp = groups[k];
    const netClass = grp.net > 0 ? 'is-pos' : grp.net < 0 ? 'is-neg' : '';
    html += ''
      + '<div class="day">'
      + '  <div class="day__head">'
      + '    <h3>' + esc(dayHeading(grp.date, now)) + '</h3>'
      + '    <span class="day__head__date">' + esc(dayDateText(grp.date)) + '</span>'
      + '    <span class="day__head__net ' + netClass + '">' + esc(lang() === 'id' ? 'Net: ' : 'Net: ') + '<b>' + esc(fmtDeltaIDR(grp.net, { compact: Math.abs(grp.net) >= 1e7 })) + '</b></span>'
      + '  </div>'
      + '  <div class="day__rows">' + grp.rows.map(rowHtml).join('') + '</div>'
      + '</div>';
  }
  root.innerHTML = html;

  // endline
  if (endline) {
    if (rows.length > state.limit) {
      const remaining = rows.length - state.limit;
      endline.innerHTML =
        '<span>' + esc(lang() === 'id'
          ? 'Menampilkan ' + state.limit + ' dari ' + rows.length + ' catatan.'
          : 'Showing ' + state.limit + ' of ' + rows.length + ' entries.') + '</span> '
        + '<a data-tx-more>' + esc(lang() === 'id' ? 'Tampilkan ' + remaining + ' lagi →' : 'Show ' + remaining + ' more →') + '</a>';
    } else {
      endline.innerHTML = '<span>' + esc(lang() === 'id' ? 'Itu semua untuk filter ini.' : 'That is all for this filter.') + '</span>';
    }
  }
}

function rerender() {
  renderHead();
  renderSummary();
  renderLedger();
}

/* ---- WIRING ---- */
function wireSearch() {
  const s = document.querySelector('[data-tx-search]');
  if (!s) {return;}
  let deb = null;
  s.addEventListener('input', function () {
    clearTimeout(deb);
    deb = setTimeout(function () {
      state.search = s.value || '';
      state.limit = 20;
      renderLedger();
    }, 200);
  });
}
function wireMore() {
  document.addEventListener('click', function (e) {
    const more = e.target.closest('[data-tx-more]');
    if (more) {
      state.limit += 20;
      renderLedger();
    }
  });
}
/* ---- EXPORT HOLDINGS → CSV ---- */
function csvCell(v) {
  const s = (v == null) ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function holdingRows() {
  const rows = [];
  (DATA.crypto || []).forEach(function (h) {
    rows.push(['Crypto', h.name || h.coin, h.coin, h.amount || 0, 'coin', h.platform || '',
      Math.round(h.costBasisIdr || 0), Math.round((h.amount || 0) * cryptoPrice(h)), h.date || '']);
  });
  (DATA.stocks || []).forEach(function (h) {
    const mul = stockMul(h), shares = h.shares || 0;
    rows.push(['Stocks', h.name || h.ticker, h.ticker, shares,
      (h.market === 'US' ? 'shares' : 'lots'), h.broker || h.market || '',
      Math.round(shares * mul * (h.seedPrice || 0)), Math.round(shares * mul * stockPrice(h)), h.date || '']);
  });
  (DATA.gold || []).forEach(function (h) {
    const g = h.grams || 0;
    rows.push(['Gold', h.name || 'Antam', 'EMAS', g, 'gram', 'physical',
      Math.round(g * (h.costBasisPerGram || 0)), Math.round(g * (S.goldGramIdr || 0)), h.date || '']);
  });
  (DATA.bonds || []).forEach(function (h) {
    const val = bondIdr(h);
    rows.push(['Bonds', h.name || '', h.bondType || '', h.nominal || 0, 'IDR', h.platform || '',
      Math.round(val), Math.round(val), h.date || '']);
  });
  (DATA.savings || []).forEach(function (h) {
    rows.push(['Savings', h.name || '', h.currency || '', h.foreignAmt || h.idr || 0, h.currency || '',
      h.bank || '', Math.round(h.idr || 0), Math.round(savingsIdr(h)), h.date || '']);
  });
  return rows;
}

function exportHoldingsCsv() {
  const header = ['Category', 'Name', 'Symbol', 'Quantity', 'Unit', 'Platform', 'CostBasisIDR', 'ValueIDR', 'Date'];
  const rows = holdingRows();
  if (!rows.length) {
    alert(lang() === 'id' ? 'Belum ada aset untuk diekspor.' : 'No assets to export.');
    return;
  }
  const csv = [header].concat(rows)
    .map(function (r) { return r.map(csvCell).join(','); })
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'portfolio-holdings-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function wireActions() {
  const imp = document.querySelector('[data-tx-import]');
  const exp = document.querySelector('[data-tx-export]');
  const add = document.querySelector('[data-tx-add]');
  function todo(label) { alert((lang() === 'id' ? 'Belum diimplementasi: ' : 'Not implemented yet: ') + label); }
  if (imp) {imp.addEventListener('click', function () { if (typeof window.openImport === 'function') {window.openImport();} });}
  if (exp) {exp.addEventListener('click', function () { if (window._exportPDF) {window._exportPDF();} else {exportHoldingsCsv();} });}
  if (add) {add.addEventListener('click', function () {
    const input = document.querySelector('#tab-transaksi .quickadd__input input');
    if (input) { input.focus(); input.select(); }
  });}
}

function init() {
  if (i18n) {i18n.applyI18n();}
  wireSearch();
  wireMore();
  wireActions();
  rerender();

  window.addEventListener('portfolio:update', rerender);
  window.addEventListener('psys:lang-change', rerender);
  window.addEventListener('psys:tab-change',  function (e) {
    if (e && e.detail && e.detail.tab === 'transaksi') {rerender();}
  });
  window.addEventListener('psys:quickadd',   function () {
    rerender();
    // flag the newest row as just-added so CSS animates
    const first = document.querySelector('[data-tx-ledger] .row');
    if (first) {first.classList.add('is-new');}
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

if (typeof window !== 'undefined') {
  window.psys = window.psys || {};
  window.psys.transaksi = { rerender: rerender };
}
