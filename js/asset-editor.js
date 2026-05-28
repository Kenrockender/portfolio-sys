/* ============================================================
   portfolio.sys — asset editor (add / edit / delete)
   Used by the ASET tab. Renders a category-aware form in the
   #assetModal, validates, mutates DATA in place, fires
   portfolio:update, and best-effort-saves to Firestore.

   Public API: window.psys.assetEditor.open(kind, item?)
   ============================================================ */

import { S, DATA, uid } from './state.js';
import { saveDataToCloud } from '../firebase/firebase-config.js';

var i18n = (typeof window !== 'undefined' && window.psys && window.psys.i18n) || null;
function lang() { return i18n ? i18n.getLang() : 'id'; }

var editing = null;  // { kind, id?: string }

/* ---- FIELD DEFINITIONS PER CATEGORY ---- */
function fieldsFor(kind) {
  return ({
    crypto: [
      { name: 'coin',          label: { id: 'Symbol koin',          en: 'Coin symbol' },         type: 'text',   required: true,  ph: 'BTC, ETH, SOL…' },
      { name: 'name',          label: { id: 'Nama koin',            en: 'Coin name' },           type: 'text',   required: true,  ph: 'Bitcoin' },
      { name: 'amount',        label: { id: 'Jumlah',               en: 'Amount' },              type: 'number', required: true,  step: 'any', ph: '0.5' },
      { name: 'platform',      label: { id: 'Platform / exchange',  en: 'Platform / exchange' }, type: 'text',   required: true,  ph: 'indodax, pluang, floq…' },
      { name: 'costBasisIdr',  label: { id: 'Cost basis (IDR)',     en: 'Cost basis (IDR)' },    type: 'number', required: false, step: 'any', ph: '0' },
      { name: 'date',          label: { id: 'Tanggal beli',         en: 'Buy date' },            type: 'date',   required: false },
    ],
    stocks: [
      { name: 'ticker',        label: { id: 'Ticker',                en: 'Ticker' },             type: 'text',   required: true,  ph: 'BBCA, AAPL…' },
      { name: 'name',          label: { id: 'Nama perusahaan',       en: 'Company name' },       type: 'text',   required: true,  ph: 'Bank Central Asia' },
      { name: 'shares',        label: { id: 'Jumlah lot (IDX) / shares (US)', en: 'Lots (IDX) / shares (US)' }, type: 'number', required: true, step: '1', ph: '5' },
      { name: 'seedPrice',     label: { id: 'Harga rata-rata',       en: 'Avg cost / share' },   type: 'number', required: true,  step: 'any', ph: '9000' },
      { name: 'broker',        label: { id: 'Broker',                en: 'Broker' },             type: 'text',   required: true,  ph: 'stockbit, bibit…' },
      { name: 'market',        label: { id: 'Market',                en: 'Market' },             type: 'select', required: true,  options: [{ v: 'IDX', l: 'IDX' }, { v: 'US', l: 'US' }] },
      { name: 'annualYield',   label: { id: 'Dividend yield (% p.a.)', en: 'Dividend yield (% p.a.)' }, type: 'number', required: false, step: '0.01', ph: '2.5' },
      { name: 'date',          label: { id: 'Tanggal beli',          en: 'Buy date' },           type: 'date',   required: false },
    ],
    gold: [
      { name: 'name',             label: { id: 'Nama / unit',          en: 'Name / unit' },        type: 'text',   required: true,  ph: 'Antam 10g Bar' },
      { name: 'grams',            label: { id: 'Berat (gram)',         en: 'Weight (gram)' },      type: 'number', required: true,  step: '0.01', ph: '10' },
      { name: 'costBasisPerGram', label: { id: 'Cost per gram (IDR)',  en: 'Cost per gram (IDR)' }, type: 'number', required: false, step: 'any', ph: '1300000' },
      { name: 'date',             label: { id: 'Tanggal beli',         en: 'Buy date' },           type: 'date',   required: false },
    ],
    savings: [
      { name: 'name',          label: { id: 'Nama akun',           en: 'Account name' },     type: 'text', required: true,  ph: 'BCA Tabungan' },
      { name: 'bank',          label: { id: 'Bank',                en: 'Bank' },             type: 'text', required: true,  ph: 'bca, mandiri, krom…' },
      { name: 'currency',      label: { id: 'Mata uang',           en: 'Currency' },         type: 'select', required: true, options: [{ v: 'IDR', l: 'IDR' }, { v: 'USD', l: 'USD' }, { v: 'SGD', l: 'SGD' }, { v: 'AUD', l: 'AUD' }, { v: 'EUR', l: 'EUR' }, { v: 'GBP', l: 'GBP' }, { v: 'JPY', l: 'JPY' }, { v: 'HKD', l: 'HKD' }, { v: 'CHF', l: 'CHF' }, { v: 'CAD', l: 'CAD' }, { v: 'CNH', l: 'CNH' }, { v: 'NZD', l: 'NZD' }] },
      { name: 'foreignAmt',    label: { id: 'Jumlah saldo',         en: 'Balance amount' },   type: 'number', required: true, step: 'any', ph: '5000000' },
      { name: 'annualYield',   label: { id: 'Bunga (% p.a.)',       en: 'Interest (% p.a.)' }, type: 'number', required: false, step: '0.01', ph: '5.0' },
      { name: 'note',          label: { id: 'Catatan',              en: 'Note' },             type: 'text', required: false, ph: 'Dana darurat' },
      { name: 'date',          label: { id: 'Tanggal buka',         en: 'Open date' },        type: 'date', required: false },
    ],
  })[kind] || [];
}

var CATEGORY_TITLE = {
  crypto:  { id: 'Crypto',   en: 'Crypto' },
  stocks:  { id: 'Saham',    en: 'Stock' },
  gold:    { id: 'Emas',     en: 'Gold' },
  savings: { id: 'Tabungan', en: 'Savings account' },
};

function arrayForKind(kind) {
  return ({ crypto: DATA.crypto, stocks: DATA.stocks, gold: DATA.gold, savings: DATA.savings })[kind];
}

/* ---- BUILD FORM ---- */
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }

function fieldHtml(f, item) {
  var lab = f.label[lang()] || f.label.id;
  var val = (item && item[f.name] != null) ? item[f.name] : '';
  var req = f.required ? 'required' : '';
  var ph  = f.ph ? ' placeholder="' + esc(f.ph) + '"' : '';
  var step= f.step ? ' step="' + esc(f.step) + '"' : '';
  var marker = f.required ? ' <span style="color: var(--down);">*</span>' : '';
  if (f.type === 'select') {
    var opts = f.options.map(function (o) {
      return '<option value="' + esc(o.v) + '"' + (String(val).toUpperCase() === String(o.v).toUpperCase() ? ' selected' : '') + '>' + esc(o.l) + '</option>';
    }).join('');
    return '<div class="modal__field">'
      +    '<label>' + esc(lab) + marker + '</label>'
      +    '<select name="' + esc(f.name) + '" ' + req + '>' + opts + '</select>'
      +  '</div>';
  }
  return '<div class="modal__field">'
    +    '<label>' + esc(lab) + marker + '</label>'
    +    '<input type="' + esc(f.type) + '" name="' + esc(f.name) + '" value="' + esc(val) + '"' + ph + step + ' ' + req + '>'
    +  '</div>';
}

/* ---- OPEN ---- */
function open(kind, item) {
  if (!kind || !arrayForKind(kind)) return;
  editing = { kind: kind, id: item ? item.id : null };

  // Populate modal form
  var form = document.querySelector('[data-asset-form]');
  if (!form) return;
  var fields = fieldsFor(kind);
  form.innerHTML = fields.map(function (f) { return fieldHtml(f, item); }).join('');

  // Title + sub
  var title = document.querySelector('#assetModal .modal__title');
  var sub   = document.querySelector('#assetModal .modal__sub');
  var catLabel = CATEGORY_TITLE[kind][lang()] || CATEGORY_TITLE[kind].id;
  if (title) title.textContent = (item ? (lang() === 'id' ? 'Edit ' : 'Edit ') : (lang() === 'id' ? 'Tambah ' : 'Add ')) + catLabel;
  if (sub)   sub.textContent   = lang() === 'id' ? 'Isi atau ubah field di bawah, lalu Simpan.' : 'Fill or update fields below, then Save.';

  // Delete only available when editing existing
  var delBtn = document.querySelector('[data-asset-delete]');
  if (delBtn) delBtn.hidden = !item;

  // Open modal
  if (window.psys && window.psys.modal) window.psys.modal.open('assetModal');
}

/* ---- SAVE ---- */
function save() {
  if (!editing) return;
  var form = document.querySelector('[data-asset-form]');
  if (!form) return;
  var arr = arrayForKind(editing.kind);
  if (!arr) return;

  var inputs = form.querySelectorAll('input, select');
  var record = {};
  var missing = [];
  inputs.forEach(function (inp) {
    var v = inp.value;
    if (inp.required && (v == null || v === '')) missing.push(inp.name);
    if (inp.type === 'number') v = parseFloat(v); if (Number.isNaN(v)) v = 0;
    record[inp.name] = v;
  });
  if (missing.length) {
    alert((lang() === 'id' ? 'Isi field wajib: ' : 'Required fields: ') + missing.join(', '));
    return;
  }

  if (editing.id) {
    var idx = arr.findIndex(function (x) { return x.id === editing.id; });
    if (idx >= 0) {
      // Preserve id, mutate the rest
      var keep = arr[idx].id;
      arr[idx] = Object.assign({}, arr[idx], record, { id: keep });
    }
  } else {
    record.id = uid();
    arr.push(record);
  }

  // Special: savings.idr derived from foreignAmt × fxRate
  if (editing.kind === 'savings') {
    var target = editing.id ? arr.find(function (x) { return x.id === editing.id; }) : arr[arr.length - 1];
    if (target) {
      var rate = (S.fxRates && S.fxRates[target.currency]) || 1;
      target.idr = (target.foreignAmt || 0) * rate;
    }
  }
  // Default crypto symbol uppercase
  if (editing.kind === 'crypto') {
    var ct = editing.id ? arr.find(function (x) { return x.id === editing.id; }) : arr[arr.length - 1];
    if (ct && ct.coin) ct.coin = String(ct.coin).toUpperCase();
  }
  if (editing.kind === 'stocks') {
    var st = editing.id ? arr.find(function (x) { return x.id === editing.id; }) : arr[arr.length - 1];
    if (st && st.ticker) st.ticker = String(st.ticker).toUpperCase();
  }

  // Persist
  try { saveDataToCloud(); } catch (e) { console.warn('[asset-editor] save error:', e); }
  window.dispatchEvent(new CustomEvent('portfolio:update'));
  if (window.psys && window.psys.modal) window.psys.modal.close('assetModal');
  editing = null;
}

/* ---- DELETE ---- */
function remove() {
  if (!editing || !editing.id) return;
  if (!confirm(lang() === 'id' ? 'Yakin mau hapus aset ini? Tidak bisa dibatalin.' : 'Delete this asset? This cannot be undone.')) return;
  var arr = arrayForKind(editing.kind);
  if (!arr) return;
  var idx = arr.findIndex(function (x) { return x.id === editing.id; });
  if (idx >= 0) arr.splice(idx, 1);
  try { saveDataToCloud(); } catch (e) {}
  window.dispatchEvent(new CustomEvent('portfolio:update'));
  if (window.psys && window.psys.modal) window.psys.modal.close('assetModal');
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
