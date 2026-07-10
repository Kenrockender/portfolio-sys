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

const i18n = (typeof window !== 'undefined' && window.psys && window.psys.i18n) || null;

function lang() { return i18n ? i18n.getLang() : 'id'; }
function parseAmount(s) {
  if (i18n && typeof i18n.parseAmount === 'function') {return i18n.parseAmount(s);}
  return parseFloat(String(s || '').replace(/[^\d.,-]/g, ''));
}

/* ---- KEYWORD MAP ---- */
const KEYWORDS = {
  buy:     ['beli', 'buy'],
  sell:    ['jual', 'sell'],
  div:     ['div', 'dividen', 'dividend'],
  fee:     ['biaya', 'fee'],
  expense: ['expense', 'keluar', 'exp', 'out'],
  income:  ['income', 'masuk', 'in'],
  tax:     ['pajak', 'tax', 'pph'],
};

function detectAction(token) {
  const t = String(token || '').toLowerCase();
  for (const k in KEYWORDS) {
    if (KEYWORDS[k].indexOf(t) !== -1) {return k;}
  }
  return null;
}

/* ---- TICKER RESOLUTION ---- */
function resolveTicker(s) {
  if (!s) {return null;}
  const u = String(s).toUpperCase();
  const c = (DATA.crypto || []).find(function (x) { return (x.coin || '').toUpperCase() === u; });
  if (c) {return { kind: 'crypto', symbol: u, name: c.name || u, ref: c };}
  const st = (DATA.stocks || []).find(function (x) { return (x.ticker || '').toUpperCase() === u; });
  if (st) {return { kind: 'stocks', symbol: u, name: st.name || u, ref: st };}
  return { kind: 'unknown', symbol: u, name: String(s) };
}

/* ---- HINT MESSAGES ---- */
function hint(kind) {
  const id = {
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
  const en = {
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
  if (!cmd) {return null;}
  const tokens = String(cmd).trim().split(/\s+/);
  if (!tokens.length || !tokens[0]) {return null;}
  const action = detectAction(tokens[0]);
  if (!action) {return err('unknown_keyword');}
  const rest = tokens.slice(1);

  /* --- BUY / SELL --- */
  if (action === 'buy' || action === 'sell') {
    if (rest.length < 2) {return err('need_qty_ticker');}
    const qty = parseAmount(rest[0]);
    if (isNaN(qty) || qty <= 0) {return err('bad_qty');}

    const ticker = resolveTicker(rest[1]);
    if (!ticker || !ticker.symbol) {return err('bad_ticker');}

    let price = null;
    const atIdx = rest.indexOf('@');
    if (atIdx >= 0 && rest[atIdx + 1] != null) {
      price = parseAmount(rest[atIdx + 1]);
    } else if (rest.some(function (t) { return String(t).toLowerCase() === 'market'; })) {
      if (ticker.kind === 'crypto' && ticker.ref) {price = cryptoPrice(ticker.ref);}
      else if (ticker.kind === 'stocks' && ticker.ref) {price = stockPrice(ticker.ref);}
      else {return err('no_market');}
    }
    if (price == null || isNaN(price) || price <= 0) {return err('need_price');}

    const total = qty * price;
    const detail = action === 'buy' ? detailBuy(qty, ticker.symbol, price) : detailSell(qty, ticker.symbol, price);
    const tx = {
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
    if (rest.length < 2) {return err('need_ticker_amount');}
    const t2 = resolveTicker(rest[0]);
    if (!t2 || !t2.symbol) {return err('bad_ticker');}
    const divAmt = parseAmount(rest.slice(1).join(' '));
    if (isNaN(divAmt) || divAmt <= 0) {return err('bad_amount');}
    const detD = detailDiv(t2.symbol, divAmt);
    const txD = {
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
    if (rest.length < 1) {return err('need_amount');}
    const amt = parseAmount(rest[0]);
    if (isNaN(amt) || amt <= 0) {return err('bad_amount');}
    let desc = rest.slice(1).join(' ');
    const defaultDesc = {
      fee:     lang() === 'id' ? 'Biaya'      : 'Fee',
      expense: lang() === 'id' ? 'Pengeluaran': 'Expense',
      income:  lang() === 'id' ? 'Pendapatan' : 'Income',
      tax:     lang() === 'id' ? 'Pajak'      : 'Tax',
    }[action];
    if (!desc) {desc = defaultDesc;}
    const sign = action === 'income' ? 1 : -1;
    const detF = desc + ': ' + (sign >= 0 ? '+' : '−') + fmtRupiah(amt);
    const txF = {
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
  const parsed = parse(cmd);
  if (!parsed) {return null;}
  if (!parsed.ok) {return parsed;}

  if (!DATA.txLog) {DATA.txLog = [];}
  DATA.txLog.unshift(parsed.tx);
  // Same cap as asset-editor.js — the whole DATA object lives in ONE
  // Firestore doc (1 MB limit), so the ledger must not grow unbounded.
  if (DATA.txLog.length > 200) {DATA.txLog.length = 200;}

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
