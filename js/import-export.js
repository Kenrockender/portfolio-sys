/* ============================================================
   portfolio.sys — IMPORT / EXPORT (native redesign)
   ------------------------------------------------------------
   Reuses the rule-based parsing engine (import-parsers.js):
     • IMPORT_RULES   — per-source regex parsers
     • autoDetectSource — guesses the source from raw text
   …but supplies its own redesign-themed modal UI, DOM-free
   text extraction (PDF.js / Tesseract.js), and a clean commit
   path into DATA + Firestore.

   Inputs : PDF, image (OCR), pasted text
   Outputs: PDF report, CSV spreadsheet

   Heavy libs (PDF.js ~300KB, Tesseract ~2MB, jsPDF) are loaded
   lazily — only when the user actually needs them.
   ============================================================ */

import { S, DATA, uid } from './state.js';
import { POPULAR_STOCKS } from './config.js';
import { saveDataToCloud } from '../firebase/firebase-config.js';
import { cryptoPrice, stockPrice, stockMul, savingsIdr, totals, computeMetrics, assetMetrics } from './storage.js';
import { IMPORT_RULES, autoDetectSource } from './import-parsers.js';

/* ---- i18n helpers ---- */
var i18n = (typeof window !== 'undefined' && window.psys && window.psys.i18n) || null;
function lang() { return i18n ? i18n.getLang() : (S.lang || 'id'); }
function tt(en, id) { return lang() === 'en' ? en : id; }
function fmtIDR(n) {
  if (i18n) return i18n.fmtIDR(n);
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
}

function esc(s) {
  return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]);
  });
}

/* ============================================================
   1.  WINDOW BRIDGES
   The legacy parser functions reach into the app via window
   getters (the redesign doesn't load the legacy app.js that
   used to set them). Wire them up here from the ES modules.
   ============================================================ */
function ensureBridges() {
  window._getDATA = function () { return DATA; };
  window._getS = function () { return S; };
  window._uid = uid;
  window._POPULAR_STOCKS = POPULAR_STOCKS;
  window._saveCloud = function () { try { return saveDataToCloud(); } catch (e) { console.warn('[import] save error', e); } };
  window._renderAll = function () { window.dispatchEvent(new CustomEvent('portfolio:update')); };
}
ensureBridges();

/* ============================================================
   2.  LAZY SCRIPT LOADER
   ============================================================ */
var _scriptCache = {};
function loadScript(src) {
  if (_scriptCache[src]) return _scriptCache[src];
  _scriptCache[src] = new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = function () { resolve(); };
    s.onerror = function () { delete _scriptCache[src]; reject(new Error('Failed to load ' + src)); };
    document.head.appendChild(s);
  });
  return _scriptCache[src];
}

var PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
var TESSERACT_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js';
var JSPDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
var HTML2CANVAS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

async function loadPdfJs() {
  if (!window['pdfjs-dist/build/pdf']) await loadScript(PDFJS_SRC);
  var lib = window['pdfjs-dist/build/pdf'];
  if (lib) lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return lib;
}
async function loadTesseract() {
  if (!window.Tesseract) await loadScript(TESSERACT_SRC);
  return window.Tesseract;
}
async function loadJsPdf() {
  if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript(JSPDF_SRC);
  return window.jspdf && window.jspdf.jsPDF;
}
async function loadHtml2Canvas() {
  if (!window.html2canvas) await loadScript(HTML2CANVAS_SRC);
  return window.html2canvas;
}

/* ============================================================
   3.  DOM-FREE TEXT EXTRACTION
   ============================================================ */
async function extractPdfText(files, onProgress) {
  var lib = await loadPdfJs();
  if (!lib) throw new Error('PDF.js gagal dimuat');
  var out = '';
  for (var fi = 0; fi < files.length; fi++) {
    var file = files[fi];
    if (onProgress) onProgress((fi / files.length) * 0.9, '(' + (fi + 1) + '/' + files.length + ') ' + tt('Reading', 'Membaca') + ': ' + file.name);
    try {
      var buf = await file.arrayBuffer();
      var pdf = await lib.getDocument({ data: buf }).promise;
      var fileText = '';
      for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        var items = content.items;
        if (!items.length) { fileText += '\n'; continue; }
        // Sort by Y desc then X asc, group items on the same row (Δy ≤ 3px)
        var sorted = items.slice().sort(function (a, b) {
          var dy = Math.round(b.transform[5]) - Math.round(a.transform[5]);
          return dy !== 0 ? dy : a.transform[4] - b.transform[4];
        });
        var lines = [], curLine = [], curY = null;
        for (var k = 0; k < sorted.length; k++) {
          var it = sorted[k];
          var y = Math.round(it.transform[5]);
          if (curY === null || Math.abs(y - curY) <= 3) { curLine.push(it.str); curY = y; }
          else { if (curLine.length) lines.push(curLine.join(' ')); curLine = [it.str]; curY = y; }
        }
        if (curLine.length) lines.push(curLine.join(' '));
        fileText += lines.join('\n') + '\n';
        if (onProgress) onProgress(((fi / files.length) + (1 / files.length) * (i / pdf.numPages)) * 0.9, file.name + ' — p' + i + '/' + pdf.numPages);
      }
      out += (fi > 0 ? '\n\n--- FILE: ' + file.name + ' ---\n\n' : '') + fileText;
    } catch (e) {
      console.error('[import] PDF error', file.name, e);
    }
  }
  if (onProgress) onProgress(1, tt('Done', 'Selesai'));
  return out;
}

async function extractOcrText(files, onProgress) {
  var T = await loadTesseract();
  if (!T) throw new Error('Tesseract gagal dimuat');
  var out = '';
  var worker = await T.createWorker(['ind', 'eng'], 1);
  try {
    for (var fi = 0; fi < files.length; fi++) {
      var file = files[fi];
      var base = fi / files.length;
      if (onProgress) onProgress(base * 0.95, 'OCR (' + (fi + 1) + '/' + files.length + '): ' + file.name);
      try {
        var res = await worker.recognize(file, {}, {
          logger: function (m) {
            if (m.status === 'recognizing text' && onProgress) {
              onProgress(base + m.progress * (0.95 / files.length), 'OCR: ' + Math.round(m.progress * 100) + '%');
            }
          }
        });
        out += (fi > 0 ? '\n\n--- FILE: ' + file.name + ' ---\n\n' : '') + res.data.text;
      } catch (e) {
        console.error('[import] OCR error', file.name, e);
      }
    }
  } finally {
    await worker.terminate();
  }
  if (onProgress) onProgress(1, tt('Done', 'Selesai'));
  return out;
}

/* ============================================================
   4.  IMPORT MODAL
   ============================================================ */
var imp = {
  step: 1,
  raw: '',
  source: 'auto',
  fileName: '',
  results: [],
  checked: {},
};

function body() { return document.querySelector('[data-imp-body]'); }
function actions() { return document.querySelector('[data-imp-actions]'); }

function sourceOptions() {
  var keys = Object.keys(IMPORT_RULES);
  var opts = '<option value="auto">' + tt('Auto-detect', 'Deteksi otomatis') + '</option>';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var label = (IMPORT_RULES[k] && IMPORT_RULES[k].label) || k;
    opts += '<option value="' + esc(k) + '"' + (k === imp.source ? ' selected' : '') + '>' + esc(label) + '</option>';
  }
  return opts;
}

function renderStep1() {
  imp.step = 1;
  var sub = document.querySelector('#importModal .modal__sub');
  if (sub) sub.textContent = tt('Upload a PDF / image (OCR) or paste text.', 'Upload PDF / gambar (OCR) atau tempel teks.');

  body().innerHTML =
    '<div class="imp-field">' +
    '  <label class="imp-label">' + tt('Source', 'Sumber') + '</label>' +
    '  <select class="imp-select" data-imp-source>' + sourceOptions() + '</select>' +
    '  <div class="imp-hint" data-imp-hint></div>' +
    '</div>' +
    '<div class="imp-drop" data-imp-drop tabindex="0">' +
    '  <div class="imp-drop__ic">⇪</div>' +
    '  <div class="imp-drop__main">' + tt('Drop PDF or image here, or click to choose', 'Letakkan PDF / gambar di sini, atau klik untuk pilih') + '</div>' +
    '  <div class="imp-drop__sub">' + tt('PDF parsed as text · images run through OCR', 'PDF dibaca sebagai teks · gambar lewat OCR') + '</div>' +
    '  <input type="file" accept="application/pdf,image/*" multiple hidden data-imp-file>' +
    '</div>' +
    '<div class="imp-progress" data-imp-progress hidden>' +
    '  <div class="imp-progress__bar"><span data-imp-progress-fill></span></div>' +
    '  <div class="imp-progress__txt" data-imp-progress-txt></div>' +
    '</div>' +
    '<div class="imp-or">' + tt('— or paste text —', '— atau tempel teks —') + '</div>' +
    '<textarea class="imp-textarea" data-imp-textarea placeholder="' +
      esc(tt('Paste transaction / holdings text here…', 'Tempel teks transaksi / holdings di sini…')) + '">' + esc(imp.raw) + '</textarea>' +
    '<div class="imp-filename" data-imp-filename>' + esc(imp.fileName) + '</div>';

  actions().innerHTML =
    '<span style="flex:1;"></span>' +
    '<button class="btn" data-modal-close>' + tt('Cancel', 'Batal') + '</button>' +
    '<button class="btn btn--primary" data-imp-next>' + tt('Preview →', 'Pratinjau →') + '</button>';

  wireStep1();
  renderHint();
}

function renderHint() {
  var hintEl = document.querySelector('[data-imp-hint]');
  if (!hintEl) return;
  if (imp.source === 'auto') {
    hintEl.textContent = tt('The source will be detected from the uploaded file / pasted text.',
      'Sumber akan dideteksi otomatis dari file / teks yang ditempel.');
    return;
  }
  var rule = IMPORT_RULES[imp.source];
  hintEl.textContent = (rule && rule.hint) ? rule.hint : '';
}

function setProgress(frac, txt) {
  var box = document.querySelector('[data-imp-progress]');
  var fill = document.querySelector('[data-imp-progress-fill]');
  var t = document.querySelector('[data-imp-progress-txt]');
  if (!box) return;
  box.hidden = false;
  if (fill) fill.style.width = Math.max(2, Math.round(frac * 100)) + '%';
  if (t) t.textContent = txt || '';
  if (frac >= 1) setTimeout(function () { if (box) box.hidden = true; }, 1800);
}

function applyDetect(raw) {
  if (imp.source !== 'auto') return;
  var d = autoDetectSource(raw);
  if (d) {
    imp.source = d;
    var sel = document.querySelector('[data-imp-source]');
    if (sel) sel.value = d;
    var fn = document.querySelector('[data-imp-filename]');
    if (fn) fn.textContent += '  ·  ' + tt('Detected', 'Terdeteksi') + ': ' + ((IMPORT_RULES[d] && IMPORT_RULES[d].label) || d);
    renderHint();
  }
}

async function handleFiles(fileList) {
  var files = Array.prototype.slice.call(fileList || []);
  if (!files.length) return;
  var pdfs = files.filter(function (f) { return f.type === 'application/pdf' || /\.pdf$/i.test(f.name); });
  var imgs = files.filter(function (f) { return f.type.indexOf('image/') === 0; });
  imp.fileName = files.length === 1 ? files[0].name : files.length + ' files';
  var fn = document.querySelector('[data-imp-filename]');
  if (fn) fn.textContent = imp.fileName;

  var text = '';
  try {
    if (pdfs.length) text += await extractPdfText(pdfs, setProgress);
    if (imgs.length) text += (text ? '\n\n' : '') + await extractOcrText(imgs, setProgress);
  } catch (e) {
    setProgress(1, tt('Failed: ', 'Gagal: ') + e.message);
    alert(tt('Failed to read file: ', 'Gagal membaca file: ') + e.message);
    return;
  }

  imp.raw = text;
  var ta = document.querySelector('[data-imp-textarea]');
  if (ta) ta.value = text;
  applyDetect(text);
}

function wireStep1() {
  var sel = document.querySelector('[data-imp-source]');
  if (sel) sel.addEventListener('change', function () { imp.source = sel.value; renderHint(); });

  var drop = document.querySelector('[data-imp-drop]');
  var file = document.querySelector('[data-imp-file]');
  if (drop && file) {
    drop.addEventListener('click', function () { file.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-drag'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-drag'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault(); drop.classList.remove('is-drag');
      handleFiles(e.dataTransfer && e.dataTransfer.files);
    });
    file.addEventListener('change', function () { handleFiles(file.files); });
  }

  var next = document.querySelector('[data-imp-next]');
  if (next) next.addEventListener('click', doParse);
}

function doParse() {
  var ta = document.querySelector('[data-imp-textarea]');
  if (ta && ta.value.trim()) imp.raw = ta.value;
  if (!imp.raw.trim()) {
    alert(tt('No data yet — upload a file or paste text first.', 'Belum ada data — upload file atau tempel teks dulu.'));
    return;
  }
  // resolve auto-detect at parse time too
  var src = imp.source;
  if (src === 'auto') {
    src = autoDetectSource(imp.raw);
    if (!src) {
      alert(tt('Could not detect the source. Pick one from the dropdown.',
        'Sumber tidak terdeteksi. Pilih sumber dari dropdown.'));
      return;
    }
    imp.source = src;
  }
  var rule = IMPORT_RULES[src];
  if (!rule || typeof rule.parse !== 'function') {
    alert(tt('No parser for this source.', 'Tidak ada parser untuk sumber ini.'));
    return;
  }
  var rows = [];
  try {
    rows = rule.parse(imp.raw) || [];
  } catch (e) {
    console.error('[import] parse error', e);
    alert(tt('Parse failed: ', 'Gagal parse: ') + e.message);
    return;
  }
  imp.results = rows;
  imp.checked = {};
  rows.forEach(function (_, i) { imp.checked[i] = true; });
  renderStep2();
}

var CAT_LABEL = {
  crypto: { en: 'Crypto', id: 'Kripto' },
  stocks: { en: 'Stocks', id: 'Saham' },
  gold: { en: 'Gold', id: 'Emas' },
  savings: { en: 'Savings', id: 'Tabungan' },
};

function rowSummary(r) {
  var t = r.type;
  if (t === 'crypto') return (r.amount != null ? r.amount + ' ' : '') + (r.coin || r.name || '') + (r.platform ? ' · ' + r.platform : '');
  if (t === 'stocks') return (r.shares != null ? r.shares + ' ' : '') + (r.ticker || r.name || '') + (r.broker ? ' · ' + r.broker : '');
  if (t === 'gold') return (r.grams != null ? r.grams + 'g ' : '') + (r.name || 'Gold');
  if (t === 'savings') return (r.name || r.bank || '') + (r.currency ? ' · ' + r.currency : '') + (r.idr != null ? ' · ' + fmtIDR(r.idr) : '');
  return r.name || JSON.stringify(r);
}

function renderStep2() {
  imp.step = 2;
  var sub = document.querySelector('#importModal .modal__sub');
  if (sub) sub.textContent = tt('Review rows, untick anything you don\'t want, then import.',
    'Periksa baris, hapus centang yang tak diinginkan, lalu impor.');

  var rows = imp.results;
  var label = (IMPORT_RULES[imp.source] && IMPORT_RULES[imp.source].label) || imp.source;

  if (!rows.length) {
    body().innerHTML = '<div class="imp-empty">' +
      tt('No rows parsed from this source. Go back and check the file / source.',
         'Tidak ada baris yang ter-parse. Kembali dan cek file / sumber.') + '</div>';
  } else {
    var trs = rows.map(function (r, i) {
      var cat = CAT_LABEL[r.type] ? (CAT_LABEL[r.type][lang()] || CAT_LABEL[r.type].id) : (r.type || '?');
      return '<tr class="imp-row' + (imp.checked[i] ? ' is-on' : '') + '" data-imp-rowidx="' + i + '">' +
        '<td class="imp-row__chk"><input type="checkbox" data-imp-chk="' + i + '"' + (imp.checked[i] ? ' checked' : '') + '></td>' +
        '<td class="imp-row__cat"><span class="imp-tag imp-tag--' + esc(r.type || '') + '">' + esc(cat) + '</span></td>' +
        '<td class="imp-row__sum">' + esc(rowSummary(r)) + '</td>' +
        '<td class="imp-row__date">' + esc(r.date || '') + '</td>' +
        '</tr>';
    }).join('');

    body().innerHTML =
      '<div class="imp-preview-head">' +
      '  <span class="imp-preview-src">' + esc(label) + '</span>' +
      '  <span class="imp-preview-count" data-imp-count></span>' +
      '  <label class="imp-checkall"><input type="checkbox" data-imp-checkall checked> ' + tt('Select all', 'Pilih semua') + '</label>' +
      '</div>' +
      '<div class="imp-table-wrap"><table class="imp-table"><tbody>' + trs + '</tbody></table></div>';
  }

  actions().innerHTML =
    '<button class="btn" data-imp-back>← ' + tt('Back', 'Kembali') + '</button>' +
    '<span style="flex:1;"></span>' +
    '<button class="btn" data-modal-close>' + tt('Cancel', 'Batal') + '</button>' +
    '<button class="btn btn--primary" data-imp-commit></button>';

  wireStep2();
  updateCount();
}

function updateCount() {
  var n = 0;
  Object.keys(imp.checked).forEach(function (k) { if (imp.checked[k]) n++; });
  var c = document.querySelector('[data-imp-count]');
  if (c) c.textContent = n + ' / ' + imp.results.length + ' ' + tt('selected', 'dipilih');
  var commit = document.querySelector('[data-imp-commit]');
  if (commit) {
    commit.textContent = tt('Import ', 'Impor ') + n + ' ' + tt('item(s)', 'item');
    commit.disabled = n === 0;
  }
}

function wireStep2() {
  var back = document.querySelector('[data-imp-back]');
  if (back) back.addEventListener('click', renderStep1);

  body().querySelectorAll('[data-imp-chk]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var i = +cb.getAttribute('data-imp-chk');
      imp.checked[i] = cb.checked;
      var tr = cb.closest('.imp-row');
      if (tr) tr.classList.toggle('is-on', cb.checked);
      updateCount();
    });
  });

  var all = document.querySelector('[data-imp-checkall]');
  if (all) all.addEventListener('change', function () {
    imp.results.forEach(function (_, i) { imp.checked[i] = all.checked; });
    body().querySelectorAll('[data-imp-chk]').forEach(function (cb) {
      cb.checked = all.checked;
      var tr = cb.closest('.imp-row'); if (tr) tr.classList.toggle('is-on', all.checked);
    });
    updateCount();
  });

  var commit = document.querySelector('[data-imp-commit]');
  if (commit) commit.addEventListener('click', commitImport);
}

function commitImport() {
  var added = 0;
  imp.results.forEach(function (r, i) {
    if (!imp.checked[i]) return;
    var bucket = r.type;
    if (!DATA[bucket] || !Array.isArray(DATA[bucket])) return;
    var rec = Object.assign({}, r);
    delete rec.type;
    rec.id = uid();
    DATA[bucket].push(rec);
    added++;
  });

  if (!added) { closeImport(); return; }

  try { saveDataToCloud(); } catch (e) { console.warn('[import] save error', e); }
  window.dispatchEvent(new CustomEvent('portfolio:update'));
  closeImport();
  alert(tt(added + ' item(s) imported.', added + ' item berhasil diimpor.'));
}

function openImport() {
  imp = { step: 1, raw: '', source: 'auto', fileName: '', results: [], checked: {} };
  renderStep1();
  if (window.psys && window.psys.modal) window.psys.modal.open('importModal');
}
function closeImport() {
  if (window.psys && window.psys.modal) window.psys.modal.close('importModal');
}

/* ============================================================
   5.  EXPORT  (PDF + CSV)
   ============================================================ */
function holdingRows() {
  var rows = [];
  DATA.crypto.forEach(function (a) {
    rows.push(['Crypto', a.name || a.coin, a.coin, a.amount, 'coin', a.platform || '',
      Math.round(a.costBasisIdr || 0), Math.round((a.amount || 0) * cryptoPrice(a)), a.date || '']);
  });
  DATA.gold.forEach(function (h) {
    rows.push(['Gold', h.name || 'Gold', '', h.grams, 'gram', '',
      Math.round((h.grams || 0) * (h.costBasisPerGram || 0)), Math.round((h.grams || 0) * (S.goldGramIdr || 0)), h.date || '']);
  });
  DATA.stocks.forEach(function (h) {
    var mul = stockMul(h);
    rows.push(['Stocks', h.name || h.ticker, h.ticker, h.shares, 'share', h.broker || '',
      Math.round((h.shares || 0) * mul * (h.seedPrice || 0)), Math.round((h.shares || 0) * mul * stockPrice(h)), h.date || '']);
  });
  DATA.savings.forEach(function (a) {
    rows.push(['Savings', a.name || a.bank, a.currency, a.foreignAmt, a.currency || 'IDR', a.bank || '',
      Math.round(savingsIdr(a)), Math.round(savingsIdr(a)), a.date || '']);
  });
  return rows;
}

function csvCell(v) {
  var s = (v == null ? '' : String(v));
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportCsv() {
  var header = ['Category', 'Name', 'Symbol', 'Quantity', 'Unit', 'Platform', 'CostBasisIDR', 'ValueIDR', 'Date'];
  var rows = holdingRows();
  if (!rows.length) { alert(tt('No assets to export.', 'Belum ada aset untuk diekspor.')); return; }
  var csv = [header].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }),
    'portfolio-holdings-' + new Date().toISOString().slice(0, 10) + '.csv');
}

/* ---- compact / percent / date formatting via i18n (with fallback) ---- */
function fmtC(n) {
  if (i18n) return i18n.fmtIDR(n, { compact: true });
  return fmtIDR(n);
}
function pctStr(n) {
  if (n == null || isNaN(n)) return '—';
  if (i18n) return i18n.fmtPct(n, 1);
  return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1) + '%';
}
function arrow(n) { return n == null ? '' : (n >= 0 ? '▲ ' : '▼ '); }
function plClass(n) { return n == null ? 'pdfr-flat' : (n >= 0 ? 'pdfr-pos' : 'pdfr-neg'); }

/* Category meta — colors match the in-app HOME allocation bars / donut
   (css: .div-bar__fill defaults + .c-crypto/.c-gold/.c-savings), so the
   report reads as the same product the user sees on screen. */
var PDFR_CATS = [
  { key: 'crypto',  label: tt('Crypto', 'Kripto'),    color: '#a78bfa' },
  { key: 'stocks',  label: tt('Stocks', 'Saham'),     color: '#34d399' },
  { key: 'gold',    label: tt('Gold', 'Emas'),        color: '#fbbf24' },
  { key: 'savings', label: tt('Savings', 'Tabungan'), color: '#38bdf8' },
];
function catColor(key) {
  for (var i = 0; i < PDFR_CATS.length; i++) if (PDFR_CATS[i].key === key) return PDFR_CATS[i].color;
  return '#8e8d80';
}

/* Per-asset detail rows with P/L. */
function holdingsDetailed() {
  var out = [];
  DATA.crypto.forEach(function (a) {
    var m = assetMetrics('crypto', a);
    out.push({ cat: 'crypto', color: catColor('crypto'), name: a.name || a.coin,
      qty: fmtNumLite(a.amount) + ' ' + (a.coin || ''), cost: m.cost, val: m.val, ret: m.ret });
  });
  DATA.stocks.forEach(function (h) {
    var m = assetMetrics('stocks', h);
    var unit = (h.market === 'IDX' && !(h.ticker || '').startsWith('^')) ? ' lot' : ' shr';
    out.push({ cat: 'stocks', color: catColor('stocks'), name: h.name || h.ticker,
      qty: fmtNumLite(h.shares) + unit, cost: m.cost, val: m.val, ret: m.ret });
  });
  DATA.gold.forEach(function (g) {
    var m = assetMetrics('gold', g);
    out.push({ cat: 'gold', color: catColor('gold'), name: g.name || 'Gold',
      qty: fmtNumLite(g.grams) + ' g', cost: m.cost, val: m.val, ret: m.ret });
  });
  DATA.savings.forEach(function (a) {
    out.push({ cat: 'savings', color: catColor('savings'), name: a.name || a.bank,
      qty: a.currency || 'IDR', cost: 0, val: savingsIdr(a), ret: null });
  });
  return out;
}
function fmtNumLite(n) {
  if (n == null || isNaN(n)) return '0';
  if (i18n) return i18n.fmtNum(n, { maximumFractionDigits: 6 });
  return String(n);
}

/* Build the offscreen "Terminal" report node. */
function ensureReportFonts() {
  if (document.getElementById('pdfr-fonts')) return;
  var l = document.createElement('link');
  l.id = 'pdfr-fonts';
  l.rel = 'stylesheet';
  // Match the app shell (app.html): IBM Plex Mono + Fraunces.
  l.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&display=swap';
  document.head.appendChild(l);
}

var PDFR_CSS =
  '#pdfReport{position:fixed;left:-9999px;top:0;width:794px;background:#0c0d0b;color:#ecebe4;' +
  'font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;padding:48px 52px;box-sizing:border-box;}' +
  '#pdfReport *{box-sizing:border-box;margin:0;padding:0;}' +
  '#pdfReport .top{display:flex;justify-content:space-between;align-items:flex-start;}' +
  '#pdfReport .sys{font-size:11px;letter-spacing:.32em;color:#34d399;}' +
  '#pdfReport h1{font-family:"Fraunces",Georgia,serif;font-size:34px;font-weight:600;margin-top:6px;letter-spacing:-.01em;}' +
  '#pdfReport .date{font-size:11px;color:#8e8d80;margin-top:4px;}' +
  '#pdfReport .tag{font-size:10px;letter-spacing:.18em;color:#0c0d0b;background:#34d399;padding:5px 10px;border-radius:4px;font-weight:700;}' +
  '#pdfReport .hero{margin:26px 0;background:linear-gradient(135deg,#14150f,#1a1c13);border:1px solid #353629;border-radius:16px;padding:26px 28px;display:flex;justify-content:space-between;align-items:center;gap:24px;}' +
  '#pdfReport .hero>div:first-child{min-width:0;flex:1;}' +
  '#pdfReport .hLbl{font-size:10px;letter-spacing:.2em;color:#8e8d80;}' +
  '#pdfReport .hVal{font-family:"Fraunces",Georgia,serif;font-size:38px;font-weight:600;letter-spacing:-.02em;margin-top:4px;white-space:nowrap;}' +
  '#pdfReport .hPL{text-align:right;flex:none;}' +
  '#pdfReport .hPL .big{font-family:"Fraunces",Georgia,serif;font-size:26px;font-weight:600;white-space:nowrap;}' +
  '#pdfReport .hPL .sub{font-size:11px;margin-top:2px;}' +
  '#pdfReport .grid{display:flex;gap:14px;}' +
  '#pdfReport .card{flex:1;background:#14150f;border:1px solid #23241d;border-radius:12px;padding:16px;position:relative;overflow:hidden;}' +
  '#pdfReport .card .bar{position:absolute;left:0;top:0;bottom:0;width:3px;}' +
  '#pdfReport .card .k{font-size:10px;letter-spacing:.14em;color:#8e8d80;text-transform:uppercase;}' +
  '#pdfReport .card .v{font-family:"Fraunces",Georgia,serif;font-size:20px;font-weight:700;margin-top:8px;}' +
  '#pdfReport .card .p{font-size:11px;margin-top:4px;}' +
  '#pdfReport .panel{margin-top:22px;display:flex;gap:30px;align-items:center;background:#14150f;border:1px solid #23241d;border-radius:14px;padding:24px;}' +
  '#pdfReport .legend{flex:1;display:flex;flex-direction:column;gap:11px;}' +
  '#pdfReport .leg{display:flex;align-items:center;gap:10px;font-size:12px;}' +
  '#pdfReport .leg .d{width:10px;height:10px;border-radius:3px;}' +
  '#pdfReport .leg .n{flex:1;}#pdfReport .leg .vv{color:#ecebe4;}#pdfReport .leg .pp{color:#8e8d80;width:46px;text-align:right;}' +
  '#pdfReport table{width:100%;border-collapse:collapse;margin-top:22px;font-size:11.5px;}' +
  '#pdfReport th{text-align:left;font-size:9px;letter-spacing:.14em;color:#8e8d80;padding:0 0 9px;border-bottom:1px solid #353629;text-transform:uppercase;}' +
  '#pdfReport td{padding:9px 0;border-bottom:1px solid #1a1c13;vertical-align:middle;}' +
  '#pdfReport .num{text-align:right;}' +
  '#pdfReport .pdfr-pos{color:#a3e635;}#pdfReport .pdfr-neg{color:#f87171;}#pdfReport .pdfr-flat{color:#8e8d80;}' +
  '#pdfReport .cdot{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:8px;vertical-align:middle;}' +
  '#pdfReport .foot{margin-top:24px;font-size:10px;color:#54534a;letter-spacing:.1em;display:flex;justify-content:space-between;}';

function donutSvg(segments) {
  // segments: [{pct, color}] using a 100-unit circumference (r = 15.9155)
  var circles = '<circle cx="18" cy="18" r="15.9155" fill="none" stroke="#23241d" stroke-width="4"/>';
  var offset = 0;
  segments.forEach(function (s) {
    var dash = Math.max(0, s.pct);
    circles += '<circle cx="18" cy="18" r="15.9155" fill="none" stroke="' + s.color +
      '" stroke-width="4" stroke-dasharray="' + dash.toFixed(2) + ' ' + (100 - dash).toFixed(2) +
      '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 18 18)"/>';
    offset += dash;
  });
  return '<svg viewBox="0 0 36 36" style="width:140px;height:140px;">' + circles + '</svg>';
}

function buildReportNode() {
  var T = totals();
  var M = computeMetrics(T);
  var now = new Date();
  var dateStr = (i18n ? i18n.fmtDate(now) : now.toLocaleDateString()) +
    ' · ' + (i18n ? i18n.fmtTime(now) : now.toLocaleTimeString());

  var catVals = { crypto: T.c, stocks: T.k, gold: T.g, savings: T.sv };
  var catM = { crypto: M.crypto, stocks: M.stocks, gold: M.gold, savings: M.savings };

  // cards
  var cardsHtml = PDFR_CATS.map(function (c) {
    var ret = catM[c.key] ? catM[c.key].ret : null;
    return '<div class="card"><div class="bar" style="background:' + c.color + '"></div>' +
      '<div class="k">' + esc(c.label) + '</div>' +
      '<div class="v">' + fmtC(catVals[c.key]) + '</div>' +
      '<div class="p ' + plClass(ret) + '">' + (ret == null ? tt('— flat', '— stabil') : arrow(ret) + pctStr(ret)) + '</div></div>';
  }).join('');

  // donut + legend (sorted by value desc, only non-zero)
  var segCats = PDFR_CATS.map(function (c) {
    return { label: c.label, color: c.color, val: catVals[c.key], pct: T.t > 0 ? (catVals[c.key] / T.t * 100) : 0 };
  }).filter(function (s) { return s.val > 0; }).sort(function (a, b) { return b.val - a.val; });

  var legendHtml = segCats.map(function (s) {
    return '<div class="leg"><span class="d" style="background:' + s.color + '"></span>' +
      '<span class="n">' + esc(s.label) + '</span><span class="vv">' + fmtC(s.val) + '</span>' +
      '<span class="pp">' + s.pct.toFixed(1) + '%</span></div>';
  }).join('');

  // holdings table
  var rows = holdingsDetailed();
  var rowsHtml = rows.map(function (r) {
    return '<tr><td><span class="cdot" style="background:' + r.color + '"></span>' + esc(r.name) + '</td>' +
      '<td class="num">' + esc(r.qty) + '</td>' +
      '<td class="num">' + (r.cost ? fmtC(r.cost) : '—') + '</td>' +
      '<td class="num">' + fmtC(r.val) + '</td>' +
      '<td class="num ' + plClass(r.ret) + '">' + (r.ret == null ? '—' : pctStr(r.ret)) + '</td></tr>';
  }).join('');

  var totalPL = M.total.pnl, totalRet = M.total.ret;

  var node = document.createElement('div');
  node.id = 'pdfReport';
  node.innerHTML =
    '<div class="top"><div>' +
      '<div class="sys">PORTFOLIO.SYS</div>' +
      '<h1>' + tt('Holdings Report', 'Laporan Holdings') + '</h1>' +
      '<div class="date">' + esc(dateStr) + '</div>' +
    '</div><div class="tag">SNAPSHOT</div></div>' +

    '<div class="hero"><div>' +
      '<div class="hLbl">' + tt('TOTAL VALUE', 'NILAI TOTAL') + '</div>' +
      '<div class="hVal">' + fmtIDR(T.t) + '</div>' +
    '</div><div class="hPL">' +
      '<div class="big ' + plClass(totalPL) + '">' + (totalPL == null ? '—' : (totalPL >= 0 ? '+' : '−') + fmtC(Math.abs(totalPL))) + '</div>' +
      '<div class="sub ' + plClass(totalRet) + '">' + (totalRet == null ? '' : arrow(totalRet) + pctStr(totalRet) + ' ' + tt('vs cost', 'sejak modal')) + '</div>' +
    '</div></div>' +

    '<div class="grid">' + cardsHtml + '</div>' +

    '<div class="panel">' + donutSvg(segCats) + '<div class="legend">' + legendHtml + '</div></div>' +

    '<table><thead><tr><th>' + tt('ASSET', 'ASET') + '</th><th class="num">' + tt('QTY', 'JUMLAH') +
      '</th><th class="num">' + tt('COST', 'MODAL') + '</th><th class="num">' + tt('VALUE', 'NILAI') +
      '</th><th class="num">P/L</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>' +

    '<div class="foot"><span>GENERATED — PORTFOLIO.SYS</span><span>' +
      (i18n ? i18n.fmtDate(now) : now.toLocaleDateString()) + '</span></div>';
  return node;
}

async function exportPdf() {
  if (!holdingsDetailed().length) { alert(tt('No assets to export.', 'Belum ada aset untuk diekspor.')); return; }

  var JsPDF, h2c;
  try {
    JsPDF = await loadJsPdf();
    h2c = await loadHtml2Canvas();
  } catch (e) {
    alert(tt('Failed to load PDF libraries.', 'Gagal memuat library PDF.'));
    return;
  }
  if (!JsPDF || !h2c) { alert(tt('PDF libraries unavailable.', 'Library PDF tidak tersedia.')); return; }

  // inject scoped CSS + fonts once
  if (!document.getElementById('pdfr-style')) {
    var st = document.createElement('style');
    st.id = 'pdfr-style';
    st.textContent = PDFR_CSS;
    document.head.appendChild(st);
  }
  ensureReportFonts();

  var node = buildReportNode();
  document.body.appendChild(node);

  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
  // small settle for webfont paint
  await new Promise(function (r) { setTimeout(r, 120); });

  // Measure "safe" break points (CSS px from node top) so multi-page slicing
  // never cuts a table row in half. We allow breaks at the top of the table
  // and at the bottom edge of every row.
  var nodeRect = node.getBoundingClientRect();
  var nodeH = nodeRect.height;
  var safeCuts = [];
  var tableEl = node.querySelector('table');
  if (tableEl) safeCuts.push(tableEl.getBoundingClientRect().top - nodeRect.top);
  node.querySelectorAll('tbody tr').forEach(function (tr) {
    safeCuts.push(tr.getBoundingClientRect().bottom - nodeRect.top);
  });
  safeCuts.push(nodeH); // always allow a break at the very end

  var canvas;
  try {
    canvas = await h2c(node, { scale: 2, backgroundColor: '#0c0d0b', useCORS: true, logging: false });
  } catch (e) {
    console.error('[export] html2canvas error', e);
    alert(tt('Failed to render report.', 'Gagal membuat laporan.'));
    if (node.parentNode) node.parentNode.removeChild(node);
    return;
  }
  if (node.parentNode) node.parentNode.removeChild(node);

  var pdf = new JsPDF({ unit: 'pt', format: 'a4' });
  var pw = pdf.internal.pageSize.getWidth();
  var ph = pdf.internal.pageSize.getHeight();

  var scaleY = canvas.height / nodeH;          // css px -> canvas px
  var pxPerPt = canvas.width / pw;             // pt -> canvas px (full-bleed width)
  var pagePxH = ph * pxPerPt;                  // one PDF page height, in canvas px

  // candidate break offsets in canvas px, sorted & de-duped
  var cutPx = [];
  safeCuts.forEach(function (c) {
    var v = Math.round(c * scaleY);
    if (v > 0 && v <= canvas.height) cutPx.push(v);
  });
  cutPx = cutPx.filter(function (v, i, a) { return a.indexOf(v) === i; })
              .sort(function (a, b) { return a - b; });

  var start = 0, firstPage = true;
  while (start < canvas.height - 1) {
    var target = start + pagePxH;
    var end;
    if (target >= canvas.height) {
      end = canvas.height;
    } else {
      end = 0;
      for (var i = 0; i < cutPx.length; i++) {
        if (cutPx[i] > start && cutPx[i] <= target) end = cutPx[i];
      }
      if (end <= start) end = Math.round(target); // a single block taller than a page → hard cut
    }
    var sliceH = end - start;
    var tmp = document.createElement('canvas');
    tmp.width = canvas.width;
    tmp.height = sliceH;
    var ctx = tmp.getContext('2d');
    ctx.fillStyle = '#0c0d0b';
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(canvas, 0, start, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (!firstPage) pdf.addPage();
    pdf.setFillColor(12, 13, 11); pdf.rect(0, 0, pw, ph, 'F');
    pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pw, sliceH / pxPerPt);
    firstPage = false;
    start = end;
  }

  pdf.save('portfolio-report-' + new Date().toISOString().slice(0, 10) + '.pdf');
}

function download(blob, name) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function openExport() {
  var pdfBtn = document.querySelector('[data-exp-pdf]');
  var csvBtn = document.querySelector('[data-exp-csv]');
  if (pdfBtn && !pdfBtn.dataset.wired) {
    pdfBtn.dataset.wired = '1';
    pdfBtn.addEventListener('click', function () { closeExport(); exportPdf(); });
  }
  if (csvBtn && !csvBtn.dataset.wired) {
    csvBtn.dataset.wired = '1';
    csvBtn.addEventListener('click', function () { closeExport(); exportCsv(); });
  }
  if (window.psys && window.psys.modal) window.psys.modal.open('exportModal');
}
function closeExport() {
  if (window.psys && window.psys.modal) window.psys.modal.close('exportModal');
}

/* ============================================================
   6.  PUBLIC HOOKS (consumed by transaksi.js buttons)
   ============================================================ */
window.openImport = openImport;
window.closeImport = closeImport;
window._exportPDF = openExport;     // export button → format chooser
window._exportMenu = openExport;
