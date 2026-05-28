/* ============================================================
   portfolio.sys — TRANSAKSI tab renderer
   Day-grouped ledger from DATA.txLog. Summary strip, mode toggle
   (Semua / Transaksi / Arus kas), search filter, "show more"
   pagination.

   Imports DATA from state.js. Listens to portfolio:update,
   psys:lang-change, psys:quickadd, psys:tab-change.
   ============================================================ */

import { DATA } from './state.js';

var i18n = (typeof window !== 'undefined' && window.psys && window.psys.i18n) || null;

function t(k, fb) { return i18n ? i18n.t(k, fb) : (fb || k); }
function lang()   { return i18n ? i18n.getLang() : 'id'; }
function fmtIDR(n, opts) { return i18n ? i18n.fmtIDR(n, opts) : ('Rp ' + Math.round(n || 0).toLocaleString('id-ID')); }
function fmtDeltaIDR(n, opts) { return i18n ? i18n.fmtDeltaIDR(n, opts) : ((n >= 0 ? '+' : '−') + fmtIDR(Math.abs(n), opts)); }
function relTime(d) { return i18n ? i18n.relTime(d) : new Date(d).toLocaleString(); }

var state = {
  mode: 'all',           // all | trades | cashflow
  search: '',
  limit: 20,
};

var TRADE_ACTIONS = ['buy', 'sell', 'div'];
var CASHFLOW_ACTIONS = ['income', 'expense'];
var FEE_ACTIONS = ['fee', 'tax'];

function classifyForMode(action) {
  var a = String(action || '').toLowerCase();
  if (TRADE_ACTIONS.indexOf(a) !== -1)    return 'trades';
  if (CASHFLOW_ACTIONS.indexOf(a) !== -1) return 'cashflow';
  if (FEE_ACTIONS.indexOf(a) !== -1)      return 'trades';  // fees+tax follow trades by default
  return 'trades';
}

function esc(s) {
  return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
  });
}

function startOfDay(d) {
  var dt = new Date(d); dt.setHours(0,0,0,0); return dt;
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
  var d = diffDays(now, date);
  if (d === 0) return lang() === 'id' ? 'Hari ini' : 'Today';
  if (d === 1) return lang() === 'id' ? 'Kemarin' : 'Yesterday';
  if (d > 1 && d < 7) {
    var weekday = date.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  if (d >= 7 && d < 14) return lang() === 'id' ? 'Minggu lalu' : 'Last week';
  return date.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dayDateText(date) {
  return date.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isInCurrentMonth(d) {
  var n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

function monthLabel() {
  var n = new Date();
  return n.toLocaleDateString(lang() === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' });
}

/* ---- TYPE PILL ---- */
function typeClass(action) {
  var a = String(action || '').toLowerCase();
  return ({
    buy: 't-buy', sell: 't-sell', div: 't-div', fee: 't-fee',
    income: 't-in', expense: 't-out', add: 't-add', tax: 't-tax',
  })[a] || 't-add';
}
function typeLabel(action) {
  var a = String(action || '').toLowerCase();
  if (a === 'buy')     return 'BUY';
  if (a === 'sell')    return 'SELL';
  if (a === 'div')     return 'DIV';
  if (a === 'fee')     return 'FEE';
  if (a === 'income')  return 'IN';
  if (a === 'expense') return 'OUT';
  if (a === 'tax')     return 'TAX';
  if (a === 'add')     return 'ADD';
  return a.toUpperCase();
}

/* ---- FILTER ---- */
function filtered() {
  var log = (DATA.txLog || []).slice().sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
  var q = (state.search || '').trim().toLowerCase();
  return log.filter(function (tx) {
    var cls = classifyForMode(tx.action);
    if (state.mode === 'trades' && cls !== 'trades') return false;
    if (state.mode === 'cashflow' && cls !== 'cashflow') return false;
    if (!q) return true;
    var hay = (tx.detail || '') + ' ' + (tx.name || '') + ' ' + (tx.type || '') + ' ' + (tx.action || '');
    return hay.toLowerCase().indexOf(q) !== -1;
  });
}

/* ---- COUNTS for mode toggle ---- */
function counts() {
  var log = DATA.txLog || [];
  var c = { all: 0, trades: 0, cashflow: 0 };
  for (var i = 0; i < log.length; i++) {
    c.all++;
    var cls = classifyForMode(log[i].action);
    if (cls === 'trades') c.trades++;
    if (cls === 'cashflow') c.cashflow++;
  }
  return c;
}

/* ---- SUMMARY ---- */
/* Rolling 90-day window anchored to MAX(today, last tx) — so seed
   data still shows numbers, and a fresh signed-in user sees recent
   activity rather than a zero summary. */
function summary() {
  var log = DATA.txLog || [];
  var s = { buy: 0, sell: 0, div: 0, fee: 0, tax: 0, income: 0, expense: 0, count: 0, cfCount: 0 };
  if (!log.length) { s.net = 0; return s; }

  // anchor = whichever is later: today or latest tx
  var latest = new Date(log[0].ts);
  for (var k = 0; k < log.length; k++) {
    var ts = new Date(log[k].ts);
    if (ts > latest) latest = ts;
  }
  var now    = new Date();
  var anchor = latest > now ? latest : now;
  var cutoff = new Date(anchor); cutoff.setDate(cutoff.getDate() - 90);

  for (var i = 0; i < log.length; i++) {
    var tx = log[i];
    var d  = new Date(tx.ts);
    if (d < cutoff) continue;
    var a   = String(tx.action || '').toLowerCase();
    var amt = Math.abs(Number(tx.amount) || 0);
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
  var month = monthLabel();
  var c = counts();
  var monthEl = document.querySelector('[data-tx-month]');
  if (monthEl) monthEl.textContent = month;
  var countEl = document.querySelector('[data-tx-count]');
  if (countEl) countEl.textContent = c.all + (lang() === 'id' ? ' entri' : ' entries');

  var ca = document.querySelector('[data-count-all]');
  var ct = document.querySelector('[data-count-trades]');
  var cf = document.querySelector('[data-count-cf]');
  if (ca) ca.textContent = c.all;
  if (ct) ct.textContent = c.trades;
  if (cf) cf.textContent = c.cashflow;
}

function renderSummary() {
  var s = summary();
  function set(sel, val, meta) {
    var v = document.querySelector(sel);
    if (v) v.textContent = val;
    if (meta) {
      // selector `[data-foo]` → `[data-foo-meta]`
      var metaSel = sel.replace(/\]$/, '-meta]');
      var m = document.querySelector(metaSel);
      if (m) m.textContent = meta;
    }
  }
  var netEl = document.querySelector('[data-tx-sum-net]');
  if (netEl) {
    netEl.classList.remove('is-pos','is-neg','is-mute');
    netEl.classList.add(s.net > 0 ? 'is-pos' : (s.net < 0 ? 'is-neg' : 'is-mute'));
    netEl.textContent = fmtDeltaIDR(s.net, { compact: true });
  }
  var netMeta = document.querySelector('[data-tx-sum-net-meta]');
  if (netMeta) netMeta.textContent = (lang() === 'id' ? s.count + ' transaksi · ' + s.cfCount + ' arus kas' : s.count + ' trades · ' + s.cfCount + ' cashflow');

  set('[data-tx-sum-buy]',  fmtIDR(s.buy, { compact: true }),  (lang() === 'id' ? 'masuk portfolio' : 'into portfolio'));
  set('[data-tx-sum-sell]', fmtIDR(s.sell, { compact: true }), (lang() === 'id' ? 'realisasi' : 'realised'));
  set('[data-tx-sum-div]',  '+' + fmtIDR(s.div, { compact: true }), (lang() === 'id' ? 'dividen masuk' : 'dividends'));
  set('[data-tx-sum-fee]',  fmtIDR(s.fee + s.tax, { compact: true }), 'broker + PPh');
}

function rowHtml(tx) {
  var ts = new Date(tx.ts);
  var hh = String(ts.getHours()).padStart(2,'0');
  var mm = String(ts.getMinutes()).padStart(2,'0');
  var timeStr = hh + ':' + mm;
  var amt = Number(tx.amount) || 0;
  var amtClass = amt > 0 ? 'is-pos' : amt < 0 ? 'is-neg' : 'is-mute';
  var amtStr = (amt > 0 ? '+' : amt < 0 ? '−' : '') + fmtIDR(Math.abs(amt), { compact: Math.abs(amt) >= 1e7 });
  var qtyStr = (tx.qty && tx.price)
    ? esc(tx.qty.toLocaleString(lang() === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 4 })) + ' <span class="x">×</span> Rp ' + esc(Math.round(tx.price).toLocaleString('id-ID'))
    : '';
  var what = esc(tx.detail || (tx.name || ''));
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
  var root = document.querySelector('[data-tx-ledger]');
  if (!root) return;
  var rows = filtered();
  var endline = document.querySelector('[data-tx-endline]');

  if (!rows.length) {
    root.innerHTML = '<div class="placeholder" style="border:1px dashed var(--rule); margin: 0;"><h2 class="serif">' + esc(lang() === 'id' ? 'Belum ada catatan' : 'No entries yet') + '</h2><p>' + esc(lang() === 'id' ? 'Pakai quick-add di atas atau tombol + Tambah.' : 'Use the quick-add above or the + Add button.') + '</p></div>';
    if (endline) endline.innerHTML = '';
    return;
  }

  var visible = rows.slice(0, state.limit);
  var groups = []; // [{ date: Date, rows: [], net: 0 }]
  for (var i = 0; i < visible.length; i++) {
    var d = startOfDay(new Date(visible[i].ts));
    var g = groups[groups.length - 1];
    if (!g || !sameDay(g.date, d)) {
      g = { date: d, rows: [], net: 0 };
      groups.push(g);
    }
    g.rows.push(visible[i]);
    g.net += Number(visible[i].amount) || 0;
  }

  var now = new Date();
  var html = '';
  for (var k = 0; k < groups.length; k++) {
    var grp = groups[k];
    var netClass = grp.net > 0 ? 'is-pos' : grp.net < 0 ? 'is-neg' : '';
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
      var remaining = rows.length - state.limit;
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
function wireModes() {
  var btns = document.querySelectorAll('[data-tx-mode]');
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      btns.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      state.mode = b.getAttribute('data-tx-mode');
      state.limit = 20;
      renderLedger();
    });
  });
}
function wireSearch() {
  var s = document.querySelector('[data-tx-search]');
  if (!s) return;
  var deb = null;
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
    var more = e.target.closest('[data-tx-more]');
    if (more) {
      state.limit += 20;
      renderLedger();
    }
  });
}
function wireActions() {
  var imp = document.querySelector('[data-tx-import]');
  var exp = document.querySelector('[data-tx-export]');
  var add = document.querySelector('[data-tx-add]');
  function todo(label) { alert((lang() === 'id' ? 'Belum diimplementasi: ' : 'Not implemented yet: ') + label); }
  if (imp) imp.addEventListener('click', function () { todo('Impor CSV (Phase 7)'); });
  if (exp) exp.addEventListener('click', function () { todo('Ekspor (Phase 7)'); });
  if (add) add.addEventListener('click', function () {
    var input = document.querySelector('#tab-transaksi .quickadd__input input');
    if (input) { input.focus(); input.select(); }
  });
}

function init() {
  if (i18n) i18n.applyI18n();
  wireModes();
  wireSearch();
  wireMore();
  wireActions();
  rerender();

  window.addEventListener('portfolio:update', rerender);
  window.addEventListener('psys:lang-change', rerender);
  window.addEventListener('psys:tab-change',  function (e) {
    if (e && e.detail && e.detail.tab === 'transaksi') rerender();
  });
  window.addEventListener('psys:quickadd',   function () {
    rerender();
    // flag the newest row as just-added so CSS animates
    var first = document.querySelector('[data-tx-ledger] .row');
    if (first) first.classList.add('is-new');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

if (typeof window !== 'undefined') {
  window.psys = window.psys || {};
  window.psys.transaksi = { rerender: rerender, setMode: function (m) { state.mode = m; renderLedger(); } };
}
