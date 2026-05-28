/* ============================================================
   portfolio.sys — quick-add command parser
   Spec §7.4. Bahasa- or English-keyword grammar. Mutates
   DATA.txLog (state.js), best-effort cloud save, fires
   portfolio:update for renderers.

   Public API: window.psys.quickadd = { run, parse }
   ============================================================ */

import { DATA, uid } from './state.js';
import { cryptoPrice, stockPrice } from './storage.js';
import { saveDataToCloud } from '../firebase/firebase-config.js';

var i18n = (typeof window !== 'undefined' && window.psys && window.psys.i18n) || null;

function lang() { return i18n ? i18n.getLang() : 'id'; }
function parseAmount(s) {
  if (i18n && typeof i18n.parseAmount === 'function') return i18n.parseAmount(s);
  return parseFloat(String(s || '').replace(/[^\d.,-]/g, ''));
}

/* ---- KEYWORD MAP ---- */
var KEYWORDS = {
  buy:     ['beli', 'buy'],
  sell:    ['jual', 'sell'],
  div:     ['div', 'dividen', 'dividend'],
  fee:     ['biaya', 'fee'],
  expense: ['expense', 'keluar', 'exp', 'out'],
  income:  ['income', 'masuk', 'in'],
  tax:     ['pajak', 'tax', 'pph'],
};

function detectAction(token) {
  var t = String(token || '').toLowerCase();
  for (var k in KEYWORDS) {
    if (KEYWORDS[k].indexOf(t) !== -1) return k;
  }
  return null;
}

/* ---- TICKER RESOLUTION ---- */
function resolveTicker(s) {
  if (!s) return null;
  var u = String(s).toUpperCase();
  var c = (DATA.crypto || []).find(function (x) { return (x.coin || '').toUpperCase() === u; });
  if (c) return { kind: 'crypto', symbol: u, name: c.name || u, ref: c };
  var st = (DATA.stocks || []).find(function (x) { return (x.ticker || '').toUpperCase() === u; });
  if (st) return { kind: 'stocks', symbol: u, name: st.name || u, ref: st };
  return { kind: 'unknown', symbol: u, name: String(s) };
}

/* ---- HINT MESSAGES ---- */
function hint(kind) {
  var id = {
    unknown_keyword:    'Format tidak dikenali. Contoh: beli 10 BBCA @ 9.425',
    need_qty_ticker:    'Butuh kuantitas dan ticker. Contoh: beli 10 BBCA @ 9.425',
    need_ticker_amount: 'Butuh ticker dan amount. Contoh: div BMRI 250.000',
    need_amount:        'Butuh amount. Contoh: expense 35.000 makan siang',
    need_price:         'Butuh harga "@ <harga>" atau "market".',
    bad_qty:            'Kuantitas tidak valid.',
    bad_ticker:         'Ticker tidak dikenali. Coba tambahkan asetnya dulu, atau pakai kode IDX/crypto.',
    bad_amount:         'Amount tidak valid.',
    no_market:          'Harga "market" belum tersedia untuk ticker ini.',
  };
  var en = {
    unknown_keyword:    'Unrecognised format. Try: buy 10 BBCA @ 9425',
    need_qty_ticker:    'Need quantity and ticker. Try: buy 10 BBCA @ 9425',
    need_ticker_amount: 'Need ticker and amount. Try: div BMRI 250000',
    need_amount:        'Need amount. Try: expense 35000 lunch',
    need_price:         'Need price "@ <price>" or "market".',
    bad_qty:            'Invalid quantity.',
    bad_ticker:         'Unknown ticker. Add the asset first, or use a known IDX/crypto symbol.',
    bad_amount:         'Invalid amount.',
    no_market:          'Market price not available for this ticker.',
  };
  return (lang() === 'id' ? id : en)[kind] || 'Parse error.';
}

function ok(msg, tx) { return { ok: true,  message: msg, tx: tx }; }
function err(kind)   { return { ok: false, message: hint(kind), hint: kind }; }

/* ---- FORMATTER FOR DETAIL LINES ---- */
function fmtRupiah(n) {
  return 'Rp ' + Math.round(n).toLocaleString(lang() === 'id' ? 'id-ID' : 'en-US');
}
function detailBuy(qty, sym, price) {
  return (lang() === 'id' ? 'Beli ' : 'Buy ') + qty + ' ' + sym + ' @ ' + fmtRupiah(price);
}
function detailSell(qty, sym, price) {
  return (lang() === 'id' ? 'Jual ' : 'Sell ') + qty + ' ' + sym + ' @ ' + fmtRupiah(price);
}
function detailDiv(sym, amount) {
  return (lang() === 'id' ? 'Dividen ' : 'Dividend ') + sym + ': ' + fmtRupiah(amount);
}

/* ---- PARSER ---- */
function parse(cmd) {
  if (!cmd) return null;
  var tokens = String(cmd).trim().split(/\s+/);
  if (!tokens.length || !tokens[0]) return null;
  var action = detectAction(tokens[0]);
  if (!action) return err('unknown_keyword');
  var rest = tokens.slice(1);

  /* --- BUY / SELL --- */
  if (action === 'buy' || action === 'sell') {
    if (rest.length < 2) return err('need_qty_ticker');
    var qty = parseAmount(rest[0]);
    if (isNaN(qty) || qty <= 0) return err('bad_qty');

    var ticker = resolveTicker(rest[1]);
    if (!ticker || !ticker.symbol) return err('bad_ticker');

    var price = null;
    var atIdx = rest.indexOf('@');
    if (atIdx >= 0 && rest[atIdx + 1] != null) {
      price = parseAmount(rest[atIdx + 1]);
    } else if (rest.some(function (t) { return String(t).toLowerCase() === 'market'; })) {
      if (ticker.kind === 'crypto' && ticker.ref) price = cryptoPrice(ticker.ref);
      else if (ticker.kind === 'stocks' && ticker.ref) price = stockPrice(ticker.ref);
      else return err('no_market');
    }
    if (price == null || isNaN(price) || price <= 0) return err('need_price');

    var total = qty * price;
    var detail = action === 'buy' ? detailBuy(qty, ticker.symbol, price) : detailSell(qty, ticker.symbol, price);
    var tx = {
      id: uid(),
      ts: new Date().toISOString(),
      action: action,
      type: ticker.kind,
      name: ticker.symbol,
      qty: qty,
      price: price,
      amount: total * (action === 'buy' ? -1 : 1),
      detail: detail,
      snapshot: null,
      via: 'quickadd',
    };
    return ok(detail, tx);
  }

  /* --- DIV --- */
  if (action === 'div') {
    if (rest.length < 2) return err('need_ticker_amount');
    var t2 = resolveTicker(rest[0]);
    if (!t2 || !t2.symbol) return err('bad_ticker');
    var divAmt = parseAmount(rest.slice(1).join(' '));
    if (isNaN(divAmt) || divAmt <= 0) return err('bad_amount');
    var detD = detailDiv(t2.symbol, divAmt);
    var txD = {
      id: uid(),
      ts: new Date().toISOString(),
      action: 'div',
      type: t2.kind,
      name: t2.symbol,
      amount: divAmt,
      detail: detD,
      snapshot: null,
      via: 'quickadd',
    };
    return ok(detD, txD);
  }

  /* --- FEE / EXPENSE / INCOME / TAX --- */
  if (action === 'fee' || action === 'expense' || action === 'income' || action === 'tax') {
    if (rest.length < 1) return err('need_amount');
    var amt = parseAmount(rest[0]);
    if (isNaN(amt) || amt <= 0) return err('bad_amount');
    var desc = rest.slice(1).join(' ');
    var defaultDesc = {
      fee:     lang() === 'id' ? 'Biaya'      : 'Fee',
      expense: lang() === 'id' ? 'Pengeluaran': 'Expense',
      income:  lang() === 'id' ? 'Pendapatan' : 'Income',
      tax:     lang() === 'id' ? 'Pajak'      : 'Tax',
    }[action];
    if (!desc) desc = defaultDesc;
    var sign = action === 'income' ? 1 : -1;
    var detF = desc + ': ' + (sign >= 0 ? '+' : '−') + fmtRupiah(amt);
    var txF = {
      id: uid(),
      ts: new Date().toISOString(),
      action: action,
      type: (action === 'income' || action === 'expense') ? 'cashflow' : action,
      name: desc,
      amount: amt * sign,
      detail: detF,
      snapshot: null,
      via: 'quickadd',
    };
    return ok(detF, txF);
  }

  return err('unknown_keyword');
}

/* ---- RUN (parse + commit) ---- */
function run(cmd) {
  var parsed = parse(cmd);
  if (!parsed) return null;
  if (!parsed.ok) return parsed;

  if (!DATA.txLog) DATA.txLog = [];
  DATA.txLog.unshift(parsed.tx);

  // Best-effort cloud save
  try { saveDataToCloud(); } catch (e) { /* not signed in or no network */ }

  // Notify renderers
  try {
    window.dispatchEvent(new CustomEvent('portfolio:update'));
    window.dispatchEvent(new CustomEvent('psys:quickadd', { detail: { tx: parsed.tx } }));
  } catch (e) {}

  return parsed;
}

/* ---- EXPORT ---- */
if (typeof window !== 'undefined') {
  window.psys = window.psys || {};
  window.psys.quickadd = { run: run, parse: parse };
}
