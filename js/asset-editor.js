/* ============================================================
   portfolio.sys — asset editor (add / edit / delete)
   Used by the ASET tab. Renders a category-aware form in the
   #assetModal, validates, mutates DATA in place, fires
   portfolio:update, and best-effort-saves to Firestore.

   Public API: window.psys.assetEditor.open(kind, item?)
   ============================================================ */

import { S, DATA, uid } from './state.js';
import { POPULAR_STOCKS_IDX, US_STOCKS, INDEX_FUNDS, PLAT_COLORS, AC_BANKS, AC_BROKERS, AC_PLATFORMS, AC_BOND_PLATFORMS, BOND_TYPE_OPTS } from './config.js';
import { bondIdr } from './storage.js';
import { saveDataToCloud } from '../firebase/firebase-config.js';

/* Ticker → company-name maps, tagged with market for auto-fill.
   US / INDEX are checked before IDX because POPULAR_STOCKS_IDX bundles a
   US-stocks sub-section, which would otherwise mis-tag tickers like AAPL as IDX. */
const STOCK_MARKETS = [
  { map: US_STOCKS,          mkt: 'US'  },
  { map: INDEX_FUNDS,        mkt: 'INDEX' },
  { map: POPULAR_STOCKS_IDX, mkt: 'IDX' },
];
function lookupStock(ticker) {
  const t = String(ticker || '').trim().toUpperCase();
  for (let i = 0; i < STOCK_MARKETS.length; i++) {
    if (STOCK_MARKETS[i].map[t]) {return { name: STOCK_MARKETS[i].map[t], mkt: STOCK_MARKETS[i].mkt };}
  }
  return null;
}

const i18n = (typeof window !== 'undefined' && window.psys && window.psys.i18n) || null;
function lang() { return i18n ? i18n.getLang() : 'id'; }

let editing = null;  // { kind, id?: string }

/* ---- FIELD DEFINITIONS PER CATEGORY ---- */
function fieldsFor(kind) {
  return ({
    crypto: [
      { name: 'coin',          label: { id: 'Symbol koin',          en: 'Coin symbol' },         type: 'text',   required: true,  ph: 'BTC, ETH, SOL…' },
      { name: 'name',          label: { id: 'Nama koin',            en: 'Coin name' },           type: 'text',   required: true,  ph: 'Bitcoin' },
      { name: 'amount',        label: { id: 'Jumlah',               en: 'Amount' },              type: 'number', required: true,  step: 'any', ph: '0.5' },
      { name: 'platform',      label: { id: 'Platform / exchange',  en: 'Platform / exchange' }, type: 'text',   required: true,  ph: 'indodax, pluang, floq…', autocomplete: true, acList: AC_PLATFORMS },
      { name: 'costBasisIdr',  label: { id: 'Cost basis (IDR)',     en: 'Cost basis (IDR)' },    type: 'number', required: false, step: 'any', ph: '0', money: true },
      { name: 'date',          label: { id: 'Tanggal beli',         en: 'Buy date' },            type: 'date',   required: false },
    ],
    stocks: [
      { name: 'ticker',        label: { id: 'Ticker',                en: 'Ticker' },             type: 'text',   required: true,  ph: 'BBCA, AAPL…', autocomplete: true },
      { name: 'name',          label: { id: 'Nama perusahaan',       en: 'Company name' },       type: 'text',   required: true,  ph: 'Bank Central Asia' },
      { name: 'shares',        label: { id: 'Jumlah lot (IDX) / shares (US)', en: 'Lots (IDX) / shares (US)' }, type: 'number', required: true, step: '1', ph: '5' },
      { name: 'seedPrice',     label: { id: 'Harga rata-rata',       en: 'Avg cost / share' },   type: 'number', required: true,  step: 'any', ph: '9000', money: true },
      { name: 'broker',        label: { id: 'Broker',                en: 'Broker' },             type: 'text',   required: true,  ph: 'stockbit, bibit…', autocomplete: true, acList: AC_BROKERS },
      { name: 'market',        label: { id: 'Market',                en: 'Market' },             type: 'select', required: true,  options: [{ v: 'IDX', l: 'IDX' }, { v: 'US', l: 'US' }] },
      { name: 'annualYield',   label: { id: 'Dividend yield (% p.a.)', en: 'Dividend yield (% p.a.)' }, type: 'number', required: false, step: '0.01', ph: '2.5' },
      { name: 'date',          label: { id: 'Tanggal beli',          en: 'Buy date' },           type: 'date',   required: false },
    ],
    gold: [
      { name: 'name',             label: { id: 'Nama / unit',          en: 'Name / unit' },        type: 'text',   required: true,  ph: 'Antam 10g Bar' },
      { name: 'grams',            label: { id: 'Berat (gram)',         en: 'Weight (gram)' },      type: 'number', required: true,  step: '0.01', ph: '10' },
      { name: 'costBasisPerGram', label: { id: 'Cost per gram (IDR)',  en: 'Cost per gram (IDR)' }, type: 'number', required: false, step: 'any', ph: '1300000', money: true },
      { name: 'date',             label: { id: 'Tanggal beli',         en: 'Buy date' },           type: 'date',   required: false },
    ],
    bonds: [
      { name: 'name',              label: { id: 'Nama / seri obligasi', en: 'Bond name / series' }, type: 'text', required: true, ph: 'SR012, ORI025…' },
      { name: 'bondType',           label: { id: 'Jenis obligasi',       en: 'Bond type' },          type: 'select', required: true, options: BOND_TYPE_OPTS.map(function (o) { return { v: o.v, l: o.l }; }) },
      { name: 'platform',           label: { id: 'Platform',             en: 'Platform' },           type: 'text', required: true, ph: 'bibit, makmur…', autocomplete: true, acList: AC_BOND_PLATFORMS },
      { name: 'nominal',            label: { id: 'Nominal (IDR)',        en: 'Nominal (IDR)' },      type: 'number', required: true, step: 'any', ph: '10000000', money: true },
      { name: 'purchasePricePct',   label: { id: 'Harga beli (% nominal)', en: 'Purchase price (% of nominal)' }, type: 'number', required: false, step: '0.01', ph: '100' },
      { name: 'couponRate',         label: { id: 'Kupon (% p.a.)',       en: 'Coupon (% p.a.)' },    type: 'number', required: false, step: '0.01', ph: '6.5' },
      { name: 'maturityDate',       label: { id: 'Tanggal jatuh tempo',  en: 'Maturity date' },      type: 'date', required: false },
      { name: 'note',               label: { id: 'Catatan',              en: 'Note' },               type: 'text', required: false, ph: 'opsional' },
      { name: 'date',               label: { id: 'Tanggal beli',         en: 'Buy date' },           type: 'date', required: false },
    ],
    savings: [
      { name: 'name',          label: { id: 'Nama akun',           en: 'Account name' },     type: 'text', required: true,  ph: 'BCA Tabungan' },
      { name: 'acctType',      label: { id: 'Jenis akun',          en: 'Account type' },     type: 'select', required: true, options: [{ v: 'tabungan', l: 'Tabungan' }, { v: 'deposito', l: 'Deposito' }, { v: 'giro', l: 'Giro' }, { v: 'cash', l: 'Cash' }] },
      { name: 'bank',          label: { id: 'Bank',                en: 'Bank' },             type: 'text', required: true,  ph: 'bca, mandiri, krom…', autocomplete: true, acList: AC_BANKS },
      { name: 'currency',      label: { id: 'Mata uang',           en: 'Currency' },         type: 'select', required: true, options: [{ v: 'IDR', l: 'IDR' }, { v: 'USD', l: 'USD' }, { v: 'SGD', l: 'SGD' }, { v: 'AUD', l: 'AUD' }, { v: 'EUR', l: 'EUR' }, { v: 'GBP', l: 'GBP' }, { v: 'JPY', l: 'JPY' }, { v: 'HKD', l: 'HKD' }, { v: 'CHF', l: 'CHF' }, { v: 'CAD', l: 'CAD' }, { v: 'CNH', l: 'CNH' }, { v: 'NZD', l: 'NZD' }] },
      { name: 'foreignAmt',    label: { id: 'Jumlah saldo',         en: 'Balance amount' },   type: 'number', required: true, step: 'any', ph: '5000000', money: true },
      { name: 'annualYield',   label: { id: 'Bunga (% p.a.)',       en: 'Interest (% p.a.)' }, type: 'number', required: false, step: '0.01', ph: '5.0' },
      { name: 'note',          label: { id: 'Catatan',              en: 'Note' },             type: 'text', required: false, ph: 'Dana darurat' },
      { name: 'date',          label: { id: 'Tanggal buka',         en: 'Open date' },        type: 'date', required: false },
    ],
  })[kind] || [];
}

const CATEGORY_TITLE = {
  crypto:  { id: 'Crypto',   en: 'Crypto' },
  stocks:  { id: 'Saham',    en: 'Stock' },
  gold:    { id: 'Emas',     en: 'Gold' },
  bonds:   { id: 'Obligasi', en: 'Bond' },
  savings: { id: 'Tabungan', en: 'Savings account' },
};

function arrayForKind(kind) {
  return ({ crypto: DATA.crypto, stocks: DATA.stocks, gold: DATA.gold, bonds: DATA.bonds, savings: DATA.savings })[kind];
}

/* ---- BUILD FORM ---- */
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }

/* ---- MONEY FORMATTING (thousand-separated IDR nominal inputs) ----
   Rendered as text inputs (not type=number) so commas can display
   while typing; parsed back to a plain number on save(). */
function formatMoneyStr(raw) {
  let s = String(raw == null ? '' : raw).replace(/[^\d.]/g, '');
  if (!s) {return '';}
  const dot = s.indexOf('.');
  if (dot >= 0) {s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');}
  const parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}
function parseMoneyStr(raw) {
  const n = parseFloat(String(raw == null ? '' : raw).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

function fieldHtml(f, item) {
  const lab = f.label[lang()] || f.label.id;
  const val = (item && item[f.name] != null) ? item[f.name] : '';
  const req = f.required ? 'required' : '';
  const ph  = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
  const step= f.step ? ' step="' + esc(f.step) + '"' : '';
  const marker = f.required ? ' <span style="color: var(--down);">*</span>' : '';
  if (f.type === 'select') {
    const opts = f.options.map(function (o) {
      return '<option value="' + esc(o.v) + '"' + (String(val).toUpperCase() === String(o.v).toUpperCase() ? ' selected' : '') + '>' + esc(o.l) + '</option>';
    }).join('');
    return '<div class="modal__field">'
      +    '<label>' + esc(lab) + marker + '</label>'
      +    '<select name="' + esc(f.name) + '" ' + req + '>' + opts + '</select>'
      +  '</div>';
  }
  // Autocomplete field gets a wrapper for the dropdown
  if (f.autocomplete) {
    return '<div class="modal__field ticker-ac-wrap" data-ac-field="' + esc(f.name) + '">'
      +    '<label>' + esc(lab) + marker + '</label>'
      +    '<input type="text" name="' + esc(f.name) + '" value="' + esc(val) + '"' + ph + ' autocomplete="off" ' + req + '>'
      +    '<div class="ticker-ac-dropdown" hidden></div>'
      +  '</div>';
  }
  // Money field: thousand-separated text input, parsed back to a number on save.
  if (f.money) {
    return '<div class="modal__field">'
      +    '<label>' + esc(lab) + marker + '</label>'
      +    '<input type="text" inputmode="decimal" name="' + esc(f.name) + '" value="' + esc(formatMoneyStr(val)) + '"' + ph + ' data-money-field="1" autocomplete="off" ' + req + '>'
      +  '</div>';
  }
  return '<div class="modal__field">'
    +    '<label>' + esc(lab) + marker + '</label>'
    +    '<input type="' + esc(f.type) + '" name="' + esc(f.name) + '" value="' + esc(val) + '"' + ph + step + ' ' + req + '>'
    +  '</div>';
}

/* ---- WIRE MONEY-FIELD LIVE FORMATTING ---- */
function wireMoneyFormatting(form) {
  form.querySelectorAll('[data-money-field]').forEach(function (inp) {
    inp.addEventListener('input', function () {
      inp.value = formatMoneyStr(inp.value);
    });
  });
}

/* ---- STOCK AUTOCOMPLETE LIST (built once, cached) ---- */
let _stockList = null;
function getStockList() {
  if (_stockList) {return _stockList;}
  const displayOrder = [
    { map: POPULAR_STOCKS_IDX, mkt: 'IDX' },
    { map: US_STOCKS,          mkt: 'US' },
    { map: INDEX_FUNDS,        mkt: 'INDEX' },
  ];
  const seen = {};
  _stockList = [];
  for (let i = 0; i < displayOrder.length; i++) {
    const map = displayOrder[i].map;
    const mkt = displayOrder[i].mkt;
    for (const t in map) {
      if (Object.prototype.hasOwnProperty.call(map, t) && !seen[t]) {
        seen[t] = 1;
        _stockList.push({ ticker: t, name: map[t], mkt: mkt });
      }
    }
  }
  return _stockList;
}

/* ---- WIRE CUSTOM AUTOCOMPLETE ---- */
function wireTickerAutocomplete(form) {
  const wrap     = form.querySelector('.ticker-ac-wrap');
  const ticker   = form.querySelector('input[name="ticker"]');
  const nameInp  = form.querySelector('input[name="name"]');
  const market   = form.querySelector('select[name="market"]');
  if (!wrap || !ticker) {return;}
  const dropdown = wrap.querySelector('.ticker-ac-dropdown');
  if (!dropdown) {return;}

  const list = getStockList();
  let activeIdx = -1;

  function renderDropdown(query) {
    const q = String(query || '').trim().toUpperCase();
    if (!q) { dropdown.hidden = true; dropdown.innerHTML = ''; activeIdx = -1; return; }

    // Filter: match ticker prefix first, then name substring
    let matches = list.filter(function (s) {
      return s.ticker.indexOf(q) === 0 || s.name.toUpperCase().indexOf(q) >= 0;
    });
    // Sort: exact ticker prefix first, then alphabetically
    matches.sort(function (a, b) {
      const aExact = a.ticker.indexOf(q) === 0 ? 0 : 1;
      const bExact = b.ticker.indexOf(q) === 0 ? 0 : 1;
      if (aExact !== bExact) {return aExact - bExact;}
      return a.ticker.localeCompare(b.ticker);
    });
    // Limit to 8 results to keep it manageable
    matches = matches.slice(0, 8);

    if (!matches.length) {
      dropdown.hidden = true;
      dropdown.innerHTML = '';
      activeIdx = -1;
      return;
    }

    let html = '';
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const mktLabel = m.mkt === 'INDEX' ? 'IDX' : m.mkt;
      html += '<div class="ticker-ac-item" data-idx="' + i + '" data-ticker="' + esc(m.ticker) + '" data-name="' + esc(m.name) + '" data-mkt="' + esc(m.mkt) + '">'
        + '<span class="ticker-ac-item__ticker">' + esc(m.ticker) + '</span>'
        + '<span class="ticker-ac-item__name">' + esc(m.name) + '</span>'
        + '<span class="ticker-ac-item__mkt ticker-ac-item__mkt--' + mktLabel.toLowerCase() + '">' + esc(mktLabel) + '</span>'
        + '</div>';
    }
    dropdown.innerHTML = html;
    dropdown.hidden = false;
    activeIdx = -1;
  }

  function highlightItem(idx) {
    const items = dropdown.querySelectorAll('.ticker-ac-item');
    items.forEach(function (el) { el.classList.remove('is-active'); });
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add('is-active');
      items[idx].scrollIntoView({ block: 'nearest' });
    }
    activeIdx = idx;
  }

  function selectItem(el) {
    if (!el) {return;}
    const t = el.getAttribute('data-ticker');
    const n = el.getAttribute('data-name');
    const m = el.getAttribute('data-mkt');
    ticker.value = t;
    if (nameInp) {nameInp.value = n;}
    if (market && (m === 'IDX' || m === 'US')) {market.value = m;}
    dropdown.hidden = true;
    dropdown.innerHTML = '';
    activeIdx = -1;
    ticker.focus();
  }

  // Input event — filter and show dropdown
  ticker.addEventListener('input', function () {
    renderDropdown(ticker.value);
    // Also do classic autofill if exact match
    const hit = lookupStock(ticker.value);
    if (hit) {
      if (nameInp) {nameInp.value = hit.name;}
      if (market && (hit.mkt === 'IDX' || hit.mkt === 'US')) {market.value = hit.mkt;}
    }
  });

  // Focus — show dropdown if there's a query
  ticker.addEventListener('focus', function () {
    if (ticker.value.trim()) {renderDropdown(ticker.value);}
  });

  // Keyboard navigation
  ticker.addEventListener('keydown', function (e) {
    if (dropdown.hidden) {return;}
    const items = dropdown.querySelectorAll('.ticker-ac-item');
    const count = items.length;
    if (!count) {return;}

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightItem(activeIdx < count - 1 ? activeIdx + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightItem(activeIdx > 0 ? activeIdx - 1 : count - 1);
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && activeIdx < count) {
        e.preventDefault();
        selectItem(items[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      dropdown.hidden = true;
      activeIdx = -1;
    }
  });

  // Click on dropdown item
  dropdown.addEventListener('mousedown', function (e) {
    // mousedown instead of click so it fires before blur
    const item = e.target.closest('.ticker-ac-item');
    if (item) {
      e.preventDefault();
      selectItem(item);
    }
  });

  // Close dropdown on blur (with small delay for click to register)
  ticker.addEventListener('blur', function () {
    setTimeout(function () { dropdown.hidden = true; activeIdx = -1; }, 180);
  });
}

/* ---- GENERIC SIMPLE AUTOCOMPLETE (bank / broker / platform) ---- */
function wireSimpleAutocomplete(form, fieldName, list) {
  const wrap   = form.querySelector('[data-ac-field="' + fieldName + '"]');
  const input  = wrap && wrap.querySelector('input[name="' + fieldName + '"]');
  if (!wrap || !input) {return;}
  const dropdown = wrap.querySelector('.ticker-ac-dropdown');
  if (!dropdown) {return;}

  let activeIdx = -1;

  function render(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) { dropdown.hidden = true; dropdown.innerHTML = ''; activeIdx = -1; return; }

    let matches = list.filter(function (item) {
      return item.value.indexOf(q) >= 0 || item.label.toLowerCase().indexOf(q) >= 0;
    });
    matches.sort(function (a, b) {
      const aExact = a.value.indexOf(q) === 0 || a.label.toLowerCase().indexOf(q) === 0 ? 0 : 1;
      const bExact = b.value.indexOf(q) === 0 || b.label.toLowerCase().indexOf(q) === 0 ? 0 : 1;
      if (aExact !== bExact) {return aExact - bExact;}
      return a.label.localeCompare(b.label);
    });
    matches = matches.slice(0, 8);

    if (!matches.length) { dropdown.hidden = true; dropdown.innerHTML = ''; activeIdx = -1; return; }

    let html = '';
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const color = (typeof PLAT_COLORS !== 'undefined' && PLAT_COLORS[m.value]) || 'var(--ink-dim)';
      html += '<div class="ticker-ac-item" data-idx="' + i + '" data-value="' + esc(m.value) + '">'
        + '<span class="ac-dot" style="background:' + color + '"></span>'
        + '<span class="ticker-ac-item__name" style="flex:none;color:var(--ink)">' + esc(m.label) + '</span>'
        + '</div>';
    }
    dropdown.innerHTML = html;
    dropdown.hidden = false;
    activeIdx = -1;
  }

  function showAll() {
    let html = '';
    const items = list.slice(0, 12);
    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      const color = (typeof PLAT_COLORS !== 'undefined' && PLAT_COLORS[m.value]) || 'var(--ink-dim)';
      html += '<div class="ticker-ac-item" data-idx="' + i + '" data-value="' + esc(m.value) + '">'
        + '<span class="ac-dot" style="background:' + color + '"></span>'
        + '<span class="ticker-ac-item__name" style="flex:none;color:var(--ink)">' + esc(m.label) + '</span>'
        + '</div>';
    }
    dropdown.innerHTML = html;
    dropdown.hidden = false;
    activeIdx = -1;
  }

  function highlight(idx) {
    const items = dropdown.querySelectorAll('.ticker-ac-item');
    items.forEach(function (el) { el.classList.remove('is-active'); });
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add('is-active');
      items[idx].scrollIntoView({ block: 'nearest' });
    }
    activeIdx = idx;
  }

  function select(el) {
    if (!el) {return;}
    input.value = el.getAttribute('data-value');
    dropdown.hidden = true;
    dropdown.innerHTML = '';
    activeIdx = -1;
    input.focus();
  }

  input.addEventListener('input', function () { render(input.value); });
  input.addEventListener('focus', function () {
    if (input.value.trim()) {render(input.value);} else {showAll();}
  });
  input.addEventListener('keydown', function (e) {
    if (dropdown.hidden) {return;}
    const items = dropdown.querySelectorAll('.ticker-ac-item');
    const count = items.length;
    if (!count) {return;}
    if (e.key === 'ArrowDown')  { e.preventDefault(); highlight(activeIdx < count - 1 ? activeIdx + 1 : 0); }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); highlight(activeIdx > 0 ? activeIdx - 1 : count - 1); }
    else if (e.key === 'Enter' && activeIdx >= 0 && activeIdx < count) { e.preventDefault(); select(items[activeIdx]); }
    else if (e.key === 'Escape')     { dropdown.hidden = true; activeIdx = -1; }
  });
  dropdown.addEventListener('mousedown', function (e) {
    const item = e.target.closest('.ticker-ac-item');
    if (item) { e.preventDefault(); select(item); }
  });
  input.addEventListener('blur', function () {
    setTimeout(function () { dropdown.hidden = true; activeIdx = -1; }, 180);
  });
}

/* ---- OPEN ---- */
function open(kind, item) {
  if (!kind || !arrayForKind(kind)) {return;}
  editing = { kind: kind, id: item ? item.id : null };

  // Populate modal form
  const form = document.querySelector('[data-asset-form]');
  if (!form) {return;}
  const fields = fieldsFor(kind);
  form.innerHTML = fields.map(function (f) { return fieldHtml(f, item); }).join('');

  // Wire the custom autocomplete for stock tickers.
  if (kind === 'stocks') {wireTickerAutocomplete(form);}

  // Wire simple autocomplete for bank / broker / platform
  fields.forEach(function (f) {
    if (f.autocomplete && f.acList) {wireSimpleAutocomplete(form, f.name, f.acList);}
  });

  // Wire thousand-separator live formatting for money fields
  wireMoneyFormatting(form);

  // Title + sub
  const title = document.querySelector('#assetModal .modal__title');
  const sub   = document.querySelector('#assetModal .modal__sub');
  const catLabel = CATEGORY_TITLE[kind][lang()] || CATEGORY_TITLE[kind].id;
  if (title) {title.textContent = (item ? (lang() === 'id' ? 'Edit ' : 'Edit ') : (lang() === 'id' ? 'Tambah ' : 'Add ')) + catLabel;}
  if (sub)   {sub.textContent   = lang() === 'id' ? 'Isi atau ubah field di bawah, lalu Simpan.' : 'Fill or update fields below, then Save.';}

  // Delete only available when editing existing
  const delBtn = document.querySelector('[data-asset-delete]');
  if (delBtn) {delBtn.hidden = !item;}

  // Open modal
  if (window.psys && window.psys.modal) {window.psys.modal.open('assetModal');}
}

/* ---- TRANSACTION LOG ----
   Append an audit entry to DATA.txLog so add / edit / delete shows up in
   the TRANSAKSI ledger. Shape matches the seed entries in state.js and what
   transaksi.js renders: { id, ts, action, type, name, detail, via, amount }.
   amount is the signed IDR cost-basis delta (only meaningful for 'edit';
   the ledger hides it for 'add' / 'delete'). */
function assetIdr(kind, r) {
  if (!r) {return 0;}
  if (kind === 'savings') {
    const rate = (S.fxRates && S.fxRates[r.currency]) || 1;
    return Number(r.idr) || (Number(r.foreignAmt) || 0) * rate;
  }
  if (kind === 'crypto') {return Number(r.costBasisIdr) || 0;}
  if (kind === 'stocks') {
    const mul = (r.market === 'IDX' || r.market === 'INDEX') ? 100 : 1;
    return (Number(r.shares) || 0) * mul * (Number(r.seedPrice) || 0);
  }
  if (kind === 'gold') {return (Number(r.grams) || 0) * (Number(r.costBasisPerGram) || 0);}
  if (kind === 'bonds') {return bondIdr(r);}
  return 0;
}
function assetLabel(kind, r) {
  if (!r) {return '';}
  if (kind === 'crypto') {return String(r.coin || r.name || '').toUpperCase();}
  if (kind === 'stocks') {return String(r.ticker || r.name || '').toUpperCase();}
  return String(r.name || '');
}
function assetVia(r) { return (r && (r.platform || r.broker || r.bank)) || ''; }

function logTx(action, kind, record, prev) {
  if (!DATA.txLog) {DATA.txLog = [];}
  const ref  = record || prev;
  const name = assetLabel(kind, ref);
  const isId = lang() === 'id';
  const verb = isId
    ? ({ add: 'Tambah', edit: 'Edit', delete: 'Hapus' })[action]
    : ({ add: 'Added', edit: 'Edited', delete: 'Deleted' })[action];
  const amount = action === 'edit' ? (assetIdr(kind, record) - assetIdr(kind, prev)) : 0;

  DATA.txLog.unshift({
    id:     uid(),
    ts:     new Date().toISOString(),
    action: action,            // 'add' | 'edit' | 'delete'
    type:   kind,              // crypto | stocks | gold | savings
    name:   name,
    detail: (verb ? verb + ' ' : '') + name,
    via:    assetVia(ref),
    amount: amount,
    snapshot: null,
  });
  if (DATA.txLog.length > 200) {DATA.txLog.length = 200;}
}

/* ---- SAVE ---- */
function save() {
  if (!editing) {return;}
  const form = document.querySelector('[data-asset-form]');
  if (!form) {return;}
  const arr = arrayForKind(editing.kind);
  if (!arr) {return;}

  const inputs = form.querySelectorAll('input, select');
  const record = {};
  const missing = [];
  inputs.forEach(function (inp) {
    let v = inp.value;
    if (inp.required && (v == null || v === '')) {missing.push(inp.name);}
    if (inp.dataset && inp.dataset.moneyField) {v = parseMoneyStr(v);}
    else if (inp.type === 'number') {v = parseFloat(v);}
    if (Number.isNaN(v)) {v = 0;}
    record[inp.name] = v;
  });
  if (missing.length) {
    alert((lang() === 'id' ? 'Isi field wajib: ' : 'Required fields: ') + missing.join(', '));
    return;
  }

  // Snapshot the pre-edit record so we can log the value delta later.
  let prev = null;
  if (editing.id) {
    const idx = arr.findIndex(function (x) { return x.id === editing.id; });
    if (idx >= 0) {
      // Preserve id, mutate the rest
      const keep = arr[idx].id;
      prev = Object.assign({}, arr[idx]);
      arr[idx] = Object.assign({}, arr[idx], record, { id: keep });
    }
  } else {
    record.id = uid();
    arr.push(record);
  }

  // Special: savings.idr derived from foreignAmt × fxRate
  if (editing.kind === 'savings') {
    const target = editing.id ? arr.find(function (x) { return x.id === editing.id; }) : arr[arr.length - 1];
    if (target) {
      const rate = (S.fxRates && S.fxRates[target.currency]) || 1;
      target.idr = (target.foreignAmt || 0) * rate;
    }
  }
  // Default crypto symbol uppercase
  if (editing.kind === 'crypto') {
    const ct = editing.id ? arr.find(function (x) { return x.id === editing.id; }) : arr[arr.length - 1];
    if (ct && ct.coin) {ct.coin = String(ct.coin).toUpperCase();}
  }
  if (editing.kind === 'stocks') {
    const st = editing.id ? arr.find(function (x) { return x.id === editing.id; }) : arr[arr.length - 1];
    if (st && st.ticker) {st.ticker = String(st.ticker).toUpperCase();}
  }
  // Bonds: purchasePricePct left blank parses to 0 — default to par (100%)
  if (editing.kind === 'bonds') {
    const bd = editing.id ? arr.find(function (x) { return x.id === editing.id; }) : arr[arr.length - 1];
    if (bd && !bd.purchasePricePct) {bd.purchasePricePct = 100;}
  }

  // Log to the transaction ledger (final record reflects derived idr / casing).
  const finalRec = editing.id ? arr.find(function (x) { return x.id === editing.id; }) : arr[arr.length - 1];
  logTx(editing.id ? 'edit' : 'add', editing.kind, finalRec, prev);

  // Persist
  try { saveDataToCloud(); } catch (e) { console.warn('[asset-editor] save error:', e); }
  window.dispatchEvent(new CustomEvent('portfolio:update'));
  if (window.psys && window.psys.modal) {window.psys.modal.close('assetModal');}
  editing = null;
}

/* ---- DELETE ---- */
function remove() {
  if (!editing || !editing.id) {return;}
  if (!confirm(lang() === 'id' ? 'Yakin mau hapus aset ini? Tidak bisa dibatalin.' : 'Delete this asset? This cannot be undone.')) {return;}
  const arr = arrayForKind(editing.kind);
  if (!arr) {return;}
  const idx = arr.findIndex(function (x) { return x.id === editing.id; });
  const removed = idx >= 0 ? arr[idx] : null;
  if (idx >= 0) {arr.splice(idx, 1);}
  if (removed) {logTx('delete', editing.kind, removed, null);}
  try { saveDataToCloud(); } catch (e) {}
  window.dispatchEvent(new CustomEvent('portfolio:update'));
  if (window.psys && window.psys.modal) {window.psys.modal.close('assetModal');}
  editing = null;
}

/* ---- WIRE ACTION BUTTONS ---- */
document.addEventListener('click', function (e) {
  if (e.target.closest('[data-asset-save]'))   { e.preventDefault(); save();   }
  if (e.target.closest('[data-asset-delete]')) { e.preventDefault(); remove(); }
});

/* ---- EXPORT ---- */
if (typeof window !== 'undefined') {
  window.psys = window.psys || {};
  window.psys.assetEditor = { open: open };
}
