/**
 * ══════════════════════════════════════════
 * UI.JS - DOM & UX Logic
 * ══════════════════════════════════════════
 * Contains all DOM manipulation and UI functions
 */

import { S, DATA, t, uid, setPrice, setStatus, setStockPrice, setAltcoinPrice } from './state.js';
import { PLAT_COLORS, POPULAR_STOCKS, POPULAR_STOCKS_IDX, US_STOCKS, INDEX_FUNDS, BANK_OPTS, CCY_OPTS, AC_ACCENT } from './config.js';
import { toDisp, dispPrice, formatChartY, totals, computeMetrics, assetMetrics, filterAssets, dispForeign, computeAnnualIncome, savingsIdr, refreshSavingsIdr, computePortfolioAnalytics, cryptoPrice, stockMul } from './storage.js';
import { syncAllPrices, syncStocksOnly } from './api.js';
import { saveDataToCloud } from '../firebase/firebase-config.js';
import { fetchAssetPriceHistory } from './api.js';

// ── Platform/Currency Tag Helpers ────────────────────────────────
export function ptag(key) {
  const k = String(key).toLowerCase();
  const M = {
    floq: 't-floq', triv: 't-triv', pintu: 't-pintu', pluang: 't-pluang',
    indodax: 't-indodax', tokocrypto: 't-tokocrypto',
    binance: 't-binance', bitget: 't-bitget', physical: 't-physical', manual: 't-manual',
    bibit: 't-bibit', indopremier: 't-indopremier', stockbit: 't-stockbit',
    bca: 't-bca', bri: 't-bri', bni: 't-bni', mandiri: 't-mandiri',
    ocbc: 't-ocbc', krom: 't-krom', cash: 't-cash', other: 't-other'
  };
  const L = {
    floq: 'FLOQ', triv: 'TRIV', pintu: 'PINTU', pluang: 'PLUANG',
    indodax: 'INDODAX', tokocrypto: 'TOKOCRYPTO',
    binance: 'BINANCE', bitget: 'BITGET', physical: 'PHYSICAL', manual: 'MANUAL',
    bibit: 'BIBIT', indopremier: 'INDOPREMIER', stockbit: 'STOCKBIT',
    bca: 'BCA', bri: 'BRI', bni: 'BNI', mandiri: 'MANDIRI',
    ocbc: 'OCBC', krom: 'KROM', cash: 'CASH', other: 'OTHER'
  };
  return `<span class="ptag ${M[k] || 't-other'}">${L[k] || key.toUpperCase()}</span>`;
}

export function ctag(ccy) {
  return `<span class="c-tag c-${ccy.toLowerCase()}">${ccy}</span>`;
}

// ── Apply I18N ────────────────────────────────────────────────────
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val) el.textContent = val;
  });

  document.getElementById('searchInput').placeholder = S.lang === 'id' ? 'Cari aset / ticker…' : 'Search asset / ticker…';
  document.querySelectorAll('#platformFilter option[data-i18n]').forEach(opt => {
    opt.textContent = t(opt.getAttribute('data-i18n'));
  });
}

// ── Theme Management ──────────────────────────────────────────────
export function applyTheme() {
  document.documentElement.setAttribute('data-theme', S.theme);
  localStorage.setItem('portfolio-theme', S.theme);
  _updateThemePickerActive();
}

// Daftar semua tema tersedia
export const THEMES = [
  { id: 'dark',      label: 'Dark',      bg: '#07070f', bg2: '#0c0c1e', accent: '#8b5cf6', bar: '#22d3ee' },
  { id: 'light',     label: 'Light',     bg: '#f8f9fc', bg2: '#ffffff', accent: '#6366f1', bar: '#0284c7' },
  { id: 'midnight',  label: 'Midnight',  bg: '#060b18', bg2: '#0a1122', accent: '#3b82f6', bar: '#06b6d4' },
  { id: 'forest',    label: 'Forest',    bg: '#060e09', bg2: '#0a1610', accent: '#34d399', bar: '#6ee7b7' },
  { id: 'dracula',    label: 'Dracula',    bg: '#1a1226', bg2: '#211630', accent: '#bd93f9', bar: '#ff79c6' },
  { id: 'amoled',    label: 'AMOLED',    bg: '#000000', bg2: '#080808', accent: '#a78bfa', bar: '#34d399' },
  { id: 'solarized', label: 'Solarized', bg: '#fdf6e3', bg2: '#eee8d5', accent: '#6c71c4', bar: '#268bd2' },
  { id: 'colorful',  label: 'Colorful',  bg: '#0d0d14', bg2: '#131320', accent: '#f472b6', bar: '#34d399' },
  { id: 'cyberpunk', label: 'Cyberpunk', bg: '#0a0700', bg2: '#110e00', accent: '#ffe600', bar: '#00f5ff' },
  { id: 'matrix',    label: 'Matrix',    bg: '#000000', bg2: '#040d04', accent: '#00ff41', bar: '#39ff14' },
];

export function setTheme(id) {
  S.theme = id;
  applyTheme();
  if (typeof window._destroyAllCharts === 'function') window._destroyAllCharts();
  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

// Backward compat — dark/light toggle
export function toggleTheme() {
  setTheme(S.theme === 'dark' ? 'light' : 'dark');
}

export function openThemePicker() {
  const overlay = document.getElementById('themePickerOverlay');
  if (!overlay) return;
  _buildThemePicker();
  overlay.classList.add('open');
}

export function closeThemePicker() {
  document.getElementById('themePickerOverlay')?.classList.remove('open');
}

function _buildThemePicker() {
  const grid = document.getElementById('themePickerGrid');
  if (!grid) return;
  grid.innerHTML = THEMES.map(th => {
    const isLight = th.id === 'light' || th.id === 'solarized';
    const textCol = isLight ? '#1e293b' : '#dde4f0';
    return `<div class="theme-card ${S.theme === th.id ? 'active' : ''}"
      id="tc-${th.id}" onclick="setTheme('${th.id}');closeThemePicker()">
      <div class="theme-preview" style="background:${th.bg}">
        <div class="tp-bar" style="background:${th.accent}"></div>
        <div class="tp-bar" style="background:${th.bar};width:60%"></div>
        <div class="tp-dot" style="background:${th.accent};opacity:.5"></div>
        <div style="display:flex;gap:3px;margin-top:2px">
          <div style="width:12px;height:5px;border-radius:2px;background:${th.bg2}"></div>
          <div style="width:20px;height:5px;border-radius:2px;background:${th.bg2}"></div>
        </div>
      </div>
      <div class="theme-card-label" style="background:${th.bg2};color:${textCol}">${th.label}</div>
    </div>`;
  }).join('');
}

function _updateThemePickerActive() {
  THEMES.forEach(th => {
    document.getElementById('tc-' + th.id)?.classList.toggle('active', S.theme === th.id);
  });
  // Update topbar theme button icon
  const btn = document.getElementById('themeToggle');
  if (btn) {
    const cur = THEMES.find(t => t.id === S.theme);
    const icons = { dark:'Dark', light:'Light', midnight:'Midnight', forest:'Forest', dracula:'Dracula', amoled:'AMOLED', solarized:'Solar', colorful:'Color' };
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="13.5" cy="6.5" r="1.3"/><circle cx="17.5" cy="10.5" r="1.3"/><circle cx="8.5" cy="7.5" r="1.3"/><circle cx="6.5" cy="12.5" r="1.3"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.98 0 1.78-.81 1.78-1.78 0-.47-.19-.9-.5-1.2-.29-.3-.5-.73-.5-1.14 0-.98.78-1.78 1.78-1.78H16c2.76 0 5-2.24 5-5 0-4.97-4.03-9-9-9z"/></svg>`;
    btn.title = `Theme: ${cur?.label || S.theme}`;
  }
  // Update mobile button
  const mb = document.getElementById('mbtnTheme');
  if (mb) {
    const icons = { dark:'Dark', light:'Light', midnight:'Midnight', forest:'Forest', dracula:'Dracula', amoled:'AMOLED', solarized:'Solarized', colorful:'Colorful' };
    mb.textContent = (icons[S.theme] || 'THEME').toUpperCase();
  }
}

// ── Tab Navigation ────────────────────────────────────────────────
export function setTab(tab) {
  // Redirect legacy ML tab → analytics
  if (tab === 'ml') tab = 'analytics';

  ['home', 'holdings', 'history', 'analytics', 'txlog', 'rebalance'].forEach(id => {
    document.getElementById('panel' + id.charAt(0).toUpperCase() + id.slice(1))?.classList.toggle('active', id === tab);
    document.getElementById('tab'   + id.charAt(0).toUpperCase() + id.slice(1))?.classList.toggle('active', id === tab);
    document.getElementById('mtab'  + id.charAt(0).toUpperCase() + id.slice(1))?.classList.toggle('active', id === tab);
  });
  if (tab === 'analytics') {
    renderAnalytics();
    requestAnimationFrame(() => {
      if (typeof window.renderMLPanel === 'function') window.renderMLPanel();
    });
  }
  if (tab === 'history')   renderHistoryPanel();
  if (tab === 'txlog')     renderTxLog();
  if (tab === 'rebalance') renderRebalance();
  if (tab === 'home') window.dispatchEvent(new CustomEvent('portfolio:update'));
}

// ── Tax Mode Toggle ───────────────────────────────────────────────
export function setTaxMode(mode) {
  S.taxMode = mode;
  document.querySelectorAll('.tax-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tax === mode);
  });
  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

// ── Render History Panel ──────────────────────────────────────────
function renderHistoryPanel() {
  const list = document.getElementById('snapshotList');
  if (!list) return;
  
  const history = S.historyData || [];
  
  if (history.length === 0) {
    list.innerHTML = `
      <p style="text-align:center;padding:20px;line-height:1.8">
        Sync harga setiap hari untuk membangun data historis.<br>
        Setiap klik Sync → snapshot otomatis tersimpan.
      </p>`;
    return;
  }
  
  // Show last 30 snapshots
  const recent = history.slice(-30).reverse();
  list.innerHTML = recent.map((h, i) => `
    <div class="snapshot-row" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--text)">${h.date}</span>
      <span style="font-family:'Syne',sans-serif;font-weight:600">${toDisp(h.value)}</span>
    </div>
  `).join('');
}

// ── Currency Toggle ───────────────────────────────────────────────
export function setCurrency(c) {
  S.currency = c;
  // Invalidate fingerprints — display format changes for all values
  Object.keys(_rowFp).forEach(k => { _rowFp[k] = null; });
  document.getElementById('btnIDR')?.classList.toggle('active', c === 'IDR');
  document.getElementById('btnUSD')?.classList.toggle('active', c === 'USD');
  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

// ── Language Toggle ───────────────────────────────────────────────
export function setLang(l) {
  S.lang = l;
  document.getElementById('btnLangID')?.classList.toggle('active', l === 'id');
  document.getElementById('btnLangEN')?.classList.toggle('active', l === 'en');
  localStorage.setItem('portfolio-lang', l);
  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

// ── History Range ─────────────────────────────────────────────────
export function setHistoryRange(r) {
  // Preserve language state before updating
  const savedLang = S.lang;
  S.historyRange = r;
  
  // Ensure language is preserved after render
  window.dispatchEvent(new CustomEvent('portfolio:update'));
  // Re-apply language state
  document.getElementById('btnLangID')?.classList.toggle('active', savedLang === 'id');
  document.getElementById('btnLangEN')?.classList.toggle('active', savedLang === 'en');
  applyI18n();
}

// ── Benchmark Controls ────────────────────────────────────────────
export function setBenchTab(tab) {
  S.benchTab = tab;
  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

export function setBenchRange(r) {
  S.benchRange = r;
  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

// ── Search & Filter ───────────────────────────────────────────────
export function handleSearch(q) {
  S.searchQuery = q.trim();
  updateClearBtn();
  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

export function handleFilter(p) {
  S.filterPlatform = p;
  updateClearBtn();
  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

export function clearFilters() {
  S.searchQuery = '';
  S.filterPlatform = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('platformFilter').value = '';
  updateClearBtn();
  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

function updateClearBtn() {
  document.getElementById('clearFilterBtn')?.classList.toggle('visible', !!(S.searchQuery || S.filterPlatform));
}

let _lastPlatformKey = '';

export function buildPlatformOptions() {
  const platforms = new Set();
  DATA.crypto.forEach(a => { if (a.platform) platforms.add(a.platform); });
  DATA.gold.forEach(() => platforms.add('physical'));
  DATA.stocks.forEach(h => { if (h.broker) platforms.add(h.broker); });
  DATA.savings.forEach(a => { if (a.bank) platforms.add(a.bank); });

  const key = [...platforms].sort().join('|');
  const sel = document.getElementById('platformFilter');
  const cur = sel?.value;

  // Only rebuild DOM if platform list actually changed
  if (key === _lastPlatformKey) return;
  _lastPlatformKey = key;

  sel.innerHTML = `<option value="">${t('all_platforms')}</option>` +
    [...platforms].sort().map(p => `<option value="${p}"${p === cur ? ' selected' : ''}>${p.toUpperCase()}</option>`).join('');
}

function updateSearchCount() {
  const total = DATA.crypto.length + DATA.gold.length + DATA.stocks.length + DATA.savings.length;
  const filtered = filterAssets(DATA.crypto, 'crypto').length +
    filterAssets(DATA.gold, 'gold').length +
    filterAssets(DATA.stocks, 'stocks').length +
    filterAssets(DATA.savings, 'savings').length;

  document.getElementById('searchCount').textContent = (S.searchQuery || S.filterPlatform) ? `${filtered} / ${total}` : '';
}

function updateSectionVisibility() {
  const hasQuery = S.searchQuery || S.filterPlatform;
  if (!hasQuery) {
    ['cardCrypto', 'cardStocks', 'cardGold', 'cardSavings'].forEach(id => {
      document.getElementById(id)?.classList.remove('hidden-section');
    });
    return;
  }

  document.getElementById('cardCrypto')?.classList.toggle('hidden-section', filterAssets(DATA.crypto, 'crypto').length === 0);
  document.getElementById('cardStocks')?.classList.toggle('hidden-section', filterAssets(DATA.stocks, 'stocks').length === 0);
  document.getElementById('cardGold')?.classList.toggle('hidden-section', filterAssets(DATA.gold, 'gold').length === 0);
  document.getElementById('cardSavings')?.classList.toggle('hidden-section', filterAssets(DATA.savings, 'savings').length === 0);
}

// ── Render KPI Strip ──────────────────────────────────────────────
export function renderKPIs(T, M) {
  const gGrams = DATA.gold.reduce((s, h) => s + h.grams, 0);

  document.getElementById('kpiTotal').textContent = toDisp(T.t);
  document.getElementById('kpiTotalSub').textContent = `${gGrams}g gold · ${DATA.crypto.length} crypto · ${DATA.stocks.length} stocks`;

  const pnlEl = document.getElementById('kpiTotalPnl');
  if (M.total.pnl != null) {
    const isUp = M.total.pnl >= 0;
    pnlEl.textContent = `${isUp ? '+' : ''}${toDisp(Math.abs(M.total.pnl))} (${M.total.ret?.toFixed(1)}%)`;
    pnlEl.className = `kpi-pnl ${isUp ? 'up' : 'down'}`;
  } else {
    pnlEl.textContent = '';
  }

  const pct = Math.min(T.t / S.goalTarget * 100, 100);
  document.getElementById('goalBarFill').style.width = `${pct}%`;
  document.getElementById('goalBarPct').textContent = `${pct.toFixed(1)}% → ${toDisp(S.goalTarget)}`;
  const targetEl = document.getElementById('goalTargetLabel');
  if (targetEl && !targetEl.querySelector('input')) {
    targetEl.textContent = toDisp(S.goalTarget);
  }

  // Sub KPIs
  [
    ['kpiCrypto', 'kpiCryptoPnl', 'kpiCryptoSub', T.c, M.crypto, toDisp(T.c), 'crypto'],
    ['kpiGold', 'kpiGoldPnl', 'kpiGoldSub', T.g, M.gold, `${gGrams}g gold`, 'gold'],
    ['kpiStocks', 'kpiStocksPnl', 'kpiStocksSub', T.k, M.stocks, `${DATA.stocks.length} holdings`, 'stocks']
  ].forEach(([valId, pnlId, subId, val, m, sub, type]) => {
    document.getElementById(valId).textContent = toDisp(val);
    document.getElementById(subId).textContent = sub;
    const pe = document.getElementById(pnlId);
    if (m.pnl != null) {
      pe.textContent = `${m.pnl >= 0 ? '+' : ''}${toDisp(Math.abs(m.pnl))} (${m.ret?.toFixed(1)}%)`;
      pe.className = `kpi-pnl ${m.pnl >= 0 ? 'up' : 'down'}`;
    } else {
      pe.textContent = '';
    }
  });
}

// ── Edit Goal Target ──────────────────────────────────────────────
export function editGoalTarget() {
  const el = document.getElementById('goalTargetLabel');
  if (!el || el.querySelector('input')) return;

  // Tampilkan nilai dalam IDR penuh, bukan "Jt" — lebih jelas saat edit
  const current = S.goalTarget;
  const isEN = S.lang === 'en';
  const placeholder = isEN ? 'e.g. 1000000000' : 'mis. 1000000000';
  const hint = isEN ? 'IDR' : 'IDR';

  el.style.borderBottom = 'none';
  el.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;">
    <span style="font-size:9px;color:var(--muted)">Rp</span>
    <input id="goalInput" type="number" min="1000000" step="1000000"
      value="${current}"
      placeholder="${placeholder}"
      style="width:120px;background:var(--bg3);border:1px solid var(--crypto);
             border-radius:4px;padding:2px 6px;color:var(--text);
             font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;
             outline:none;"
      onblur="saveGoalTarget(this.value)"
      onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){window.dispatchEvent(new CustomEvent('portfolio:update'))}"
    >
  </span>`;

  const inp = el.querySelector('input');
  inp.focus();
  inp.select();
}

export function saveGoalTarget(val) {
  const num = parseFloat(val);
  if (!isNaN(num) && num >= 1_000_000) {
    S.goalTarget = Math.round(num);
    localStorage.setItem('portfolio-goal', S.goalTarget);
  }
  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

// ── Render Price Bar ──────────────────────────────────────────────
export function renderPriceBar() {
  const s = (id, p, st) => {
    const d = document.getElementById('d-' + id), v = document.getElementById('p-' + id);
    if (d) d.className = `pdot ${st}`;
    if (v) { v.className = `val ${st}`; v.textContent = p; }
  };

  s('btc', dispPrice(S.btcIdr), S.status.btc);
  s('eth', dispPrice(S.ethIdr), S.status.eth);
  s('xrp', dispPrice(S.xrpIdr), S.status.xrp || 'stale');
  s('xau', dispPrice(S.goldGramIdr) + '/g', S.status.gold);
  s('fx', `${S.usdIdr.toLocaleString('id-ID')}`, S.status.fx);

  // Stocks bar — deduplicate by ticker so multiple lots of same stock show once
  const bar = document.getElementById('pbar-stk');
  if (bar) {
    const seen = new Set();
    const unique = DATA.stocks.filter(h => {
      if (!S.stockPrices[h.ticker] || seen.has(h.ticker)) return false;
      seen.add(h.ticker);
      return true;
    });
    bar.innerHTML = unique.slice(0, 4).map(h =>
      `<div class="pi"><span class="lbl">${h.ticker}</span><span class="val live">${h.market === 'IDX' ? `Rp ${S.stockPrices[h.ticker].toLocaleString('id-ID')}` : `$${S.stockPrices[h.ticker].toFixed(2)}`}</span></div>`
    ).join('');
  }
}

// ── Render FX Ticker Bar ──────────────────────────────────────────
export function renderFxTickerBar() {
  const bar = document.getElementById('fxTickerBar');
  if (!bar) return;

  const shown = ['USD', 'SGD', 'EUR', 'GBP', 'AUD', 'JPY'];
  bar.innerHTML = shown.map(ccy =>
    `<div class="fx-chip"><span class="cc">${ccy}</span><span class="rv ${S.fxStatus[ccy] || 'stale'}">Rp ${Math.round(S.fxRates[ccy] || 0).toLocaleString('id-ID')}</span></div>`
  ).join('');
}

// ── Build Asset Row ───────────────────────────────────────────────
function buildRow({ id, type, iconCls, icon, name, tagsHtml, sub, val, pct, barCol, liveStr, liveSt, metrics, yieldPct }) {
  const pnlBadge = metrics?.pnl != null
    ? `<span class="pnl-badge ${metrics.pnl >= 0 ? 'up' : 'down'}">${metrics.pnl >= 0 ? '+' : ''}${metrics.ret?.toFixed(1)}%</span>`
    : `<span class="pnl-badge na">N/A</span>`;

  const yieldBadge = yieldPct ? `<span class="asset-yield-badge">${yieldPct}% p.a.</span>` : '';
  const liveStr2 = liveStr ? `<div class="asset-live ${liveSt || ''}">${liveStr}</div>` : '';

  return `<div class="asset-row" id="row-${id}" onclick="openAssetChart('${id}','${type}')" style="cursor:pointer">
    <div class="asset-icon ${iconCls}">${icon}</div>
    <div class="asset-info">
      <div class="asset-name">${name}${tagsHtml}${yieldBadge}</div>
      <div class="asset-sub">${sub}</div>
      <div class="alloc-bar-wrap"><div class="alloc-bar" style="width:${pct.toFixed(1)}%;background:${barCol}"></div></div>
    </div>
    <div class="asset-right">
      <div class="asset-value-row">
        <div class="asset-value">${val}</div>${pnlBadge}
      </div>
      <div class="asset-qty">${pct.toFixed(1)}% of class</div>
      ${liveStr2}
    </div>
    <div class="asset-actions" onclick="event.stopPropagation()">
      <button class="edit-btn" onclick="event.stopPropagation();openModal('${type}','${id}')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      <button class="del-btn" onclick="event.stopPropagation();del('${id}')" title="Del"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
    </div>
    <span class="asset-expand-chevron" style="opacity:.35"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="12" height="12"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg></span>
  </div>`;
}

// ── Row Fingerprints — skip full innerHTML rebuild on price-only updates ──
// Key: section name. Value: string of asset IDs + filter state.
// If only prices change, asset IDs stay the same → do targeted DOM updates.
// If assets are added/removed/reordered, fingerprint changes → full rebuild.
const _rowFp = { crypto: null, gold: null, stocks: null, savings: null };

function _sectionFp(assets, type) {
  return (S.searchQuery || '') + '|' + (S.filterPlatform || '') + '|' +
    assets.map(a => a.id).join(',');
}

// Update a single value node by id (no-op if element absent)
function _set(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (cls !== undefined) el.className = cls;
}

// ── Render Crypto Rows ────────────────────────────────────────────
export function renderCrypto(T) {
  document.getElementById('cryptoTotal').textContent = toDisp(T.c);

  const assets = filterAssets(DATA.crypto, 'crypto');
  if (assets.length === 0) {
    _rowFp.crypto = null;
    const isSearch = S.searchQuery || S.filterPlatform;
    document.getElementById('cryptoRows').innerHTML = `<div class="no-results">${
      isSearch
        ? `No crypto matches "<b>${S.searchQuery || S.filterPlatform}</b>"`
        : '+ Tambah aset kripto dengan tombol <b>Add</b> di atas'
    }</div>`;
    return;
  }

  const fp = _sectionFp(assets, 'crypto');
  if (fp === _rowFp.crypto) {
    // Price-only update — patch value nodes in place
    assets.forEach(a => {
      const p = cryptoPrice(a), v = a.amount * p, pct = T.c > 0 ? v / T.c * 100 : 0;
      const m = assetMetrics('crypto', a);
      const row = document.getElementById('row-' + a.id);
      if (!row) return;
      row.querySelector('.asset-value').textContent = toDisp(v);
      row.querySelector('.asset-qty').textContent = pct.toFixed(1) + '% of class';
      row.querySelector('.alloc-bar').style.width = pct.toFixed(1) + '%';
      const pnlEl = row.querySelector('.pnl-badge');
      if (pnlEl) {
        if (m.pnl != null) {
          pnlEl.textContent = (m.pnl >= 0 ? '+' : '') + m.ret?.toFixed(1) + '%';
          pnlEl.className = 'pnl-badge ' + (m.pnl >= 0 ? 'up' : 'down');
        } else {
          pnlEl.textContent = 'N/A'; pnlEl.className = 'pnl-badge na';
        }
      }
      const liveEl = row.querySelector('.asset-live');
      const MAJORS = ['BTC','ETH','XRP'];
      const priceLabel = a.coin === 'BTC' ? dispPrice(S.btcIdr)
        : a.coin === 'ETH' ? dispPrice(S.ethIdr)
        : a.coin === 'XRP' ? dispPrice(S.xrpIdr)
        : p > 0 ? dispPrice(p) : '–';
      const liveSt = MAJORS.includes(a.coin)
        ? (S.status[a.coin.toLowerCase()] || 'stale')
        : (S.isSyncing ? 'syncing' : p > 0 ? 'live' : 'stale');
      if (liveEl) { liveEl.textContent = `${priceLabel} / ${a.coin}`; liveEl.className = `asset-live ${liveSt}`; }
    });
    return;
  }

  _rowFp.crypto = fp;
  document.getElementById('cryptoRows').innerHTML = assets.map(a => {
    const p = cryptoPrice(a), v = a.amount * p, pct = T.c > 0 ? v / T.c * 100 : 0;
    const m = assetMetrics('crypto', a);
    const dateStr = a.date ? ` · ${a.date}` : '';
    const iconCls = a.coin === 'BTC' ? 'icon-btc' : a.coin === 'ETH' ? 'icon-eth' : a.coin === 'XRP' ? 'icon-xrp' : 'icon-alt';
    const MAJORS = ['BTC','ETH','XRP'];
    const priceLabel = a.coin === 'BTC' ? dispPrice(S.btcIdr)
      : a.coin === 'ETH' ? dispPrice(S.ethIdr)
      : a.coin === 'XRP' ? dispPrice(S.xrpIdr)
      : p > 0 ? dispPrice(p) : '–';
    const liveSt = MAJORS.includes(a.coin)
      ? (S.status[a.coin.toLowerCase()] || 'stale')
      : (S.isSyncing ? 'syncing' : p > 0 ? 'live' : 'stale');

    return buildRow({
      id: a.id, type: 'crypto', iconCls, icon: a.coin, name: a.name,
      tagsHtml: ptag(a.platform), sub: `${a.amount} ${a.coin}${dateStr}`,
      val: toDisp(v), pct, barCol: a.coin === 'BTC' ? '#f7931a' : a.coin === 'ETH' ? '#627eea' : '#00a7e4',
      liveStr: `${priceLabel} / ${a.coin}`, liveSt,
      metrics: m
    });
  }).join('');
}

// ── Render Gold Rows ──────────────────────────────────────────────
export function renderGold(T) {
  document.getElementById('goldTotal').textContent = toDisp(T.g);

  // Update gold info panel
  const totalGrams = DATA.gold.reduce((s, h) => s + (h.grams || 0), 0);
  const totalCost  = DATA.gold.reduce((s, h) => s + (h.grams || 0) * (h.costBasisPerGram || 0), 0);
  const avgBuy     = totalGrams > 0 ? totalCost / totalGrams : 0;
  const pp = document.getElementById('goldPanelPrice');
  const pg = document.getElementById('goldPanelGrams');
  const pa = document.getElementById('goldPanelAvgBuy');
  if (pp) pp.textContent = dispPrice(S.goldGramIdr);
  if (pg) pg.textContent = totalGrams.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' g';
  if (pa) pa.textContent = avgBuy > 0 ? dispPrice(avgBuy) : '–';

  const assets = filterAssets(DATA.gold, 'gold');
  if (assets.length === 0) {
    _rowFp.gold = null;
    const isSearch = S.searchQuery || S.filterPlatform;
    document.getElementById('goldRows').innerHTML = `<div class="no-results">${
      isSearch ? 'No gold matches the filter' : '+ Tambah kepemilikan emas dengan tombol <b>Add</b>'
    }</div>`;
    return;
  }

  const fp = _sectionFp(assets, 'gold');
  if (fp === _rowFp.gold) {
    assets.forEach(h => {
      const v = h.grams * S.goldGramIdr, pct = T.g > 0 ? v / T.g * 100 : 0;
      const m = assetMetrics('gold', h);
      const row = document.getElementById('row-' + h.id);
      if (!row) return;
      row.querySelector('.asset-value').textContent = toDisp(v);
      row.querySelector('.asset-qty').textContent = pct.toFixed(1) + '% of class';
      row.querySelector('.alloc-bar').style.width = pct.toFixed(1) + '%';
      const pnlEl = row.querySelector('.pnl-badge');
      if (pnlEl) {
        if (m.pnl != null) {
          pnlEl.textContent = (m.pnl >= 0 ? '+' : '') + m.ret?.toFixed(1) + '%';
          pnlEl.className = 'pnl-badge ' + (m.pnl >= 0 ? 'up' : 'down');
        } else { pnlEl.textContent = 'N/A'; pnlEl.className = 'pnl-badge na'; }
      }
      const liveEl = row.querySelector('.asset-live');
      if (liveEl) { liveEl.textContent = `${dispPrice(S.goldGramIdr)} / g`; liveEl.className = `asset-live ${S.status.gold}`; }
    });
    return;
  }

  _rowFp.gold = fp;
  document.getElementById('goldRows').innerHTML = assets.map(h => {
    const v = h.grams * S.goldGramIdr, pct = T.g > 0 ? v / T.g * 100 : 0;
    const m = assetMetrics('gold', h), dateStr = h.date ? ` · ${h.date}` : '';
    return buildRow({
      id: h.id, type: 'gold', iconCls: 'icon-gold', icon: 'Au', name: h.name,
      tagsHtml: ptag('physical'), sub: `${h.grams}g${dateStr}`,
      val: toDisp(v), pct, barCol: 'var(--gold)',
      liveStr: `${dispPrice(S.goldGramIdr)} / g`, liveSt: S.status.gold,
      metrics: m
    });
  }).join('');
}

// ── Render Stocks Rows (grouped by ticker) ────────────────────────
// Tampilan: 1 baris per ticker (total lot + weighted avg cost)
// Expand: klik baris → sub-rows per entri individual (edit/hapus)
export function renderStocks(T) {
  document.getElementById('stocksTotal').textContent = toDisp(T.k);

  const assets = filterAssets(DATA.stocks, 'stocks');
  if (assets.length === 0) {
    _rowFp.stocks = null;
    const isSearch = S.searchQuery || S.filterPlatform;
    document.getElementById('stocksRows').innerHTML = `<div class="no-results">${
      isSearch
        ? `No stocks match "<b>${S.searchQuery || S.filterPlatform}</b>"`
        : '+ Tambah saham IDX atau US dengan tombol <b>Add</b>'
    }</div>`;
    return;
  }

  // Group by ticker
  const groups = {};
  assets.forEach(h => {
    const key = h.ticker;
    if (!groups[key]) groups[key] = [];
    groups[key].push(h);
  });

  const fp = _sectionFp(assets, 'stocks');
  if (fp === _rowFp.stocks) {
    // Targeted update per ticker group
    Object.entries(groups).forEach(([ticker, entries]) => {
      const first = entries[0];
      const mul = stockMul(first);
      const p = S.stockPrices[ticker] ?? first.seedPrice;
      const st = S.stockPrices[ticker] ? 'live' : 'stale';
      const isIDX = first.market === 'IDX';
      const totalShares = entries.reduce((s, h) => s + h.shares, 0);
      const totalCost = entries.reduce((s, h) => s + h.shares * mul * (h.seedPrice || 0), 0);
      const totalVal = totalShares * mul * p;
      const pct = T.k > 0 ? totalVal / T.k * 100 : 0;
      const pnl = totalCost > 0 ? totalVal - totalCost : null;
      const ret = totalCost > 0 ? pnl / totalCost * 100 : null;
      const liveStr = `${isIDX ? `Rp ${Math.round(p).toLocaleString('id-ID')}` : dispPrice(p)} / share`;

      const groupEl = document.getElementById(`stkgrp-${ticker}`);
      if (!groupEl) return;
      const mainRow = groupEl.querySelector('.asset-row');
      if (!mainRow) return;
      mainRow.querySelector('.asset-value').textContent = toDisp(totalVal);
      mainRow.querySelector('.asset-qty').textContent = pct.toFixed(1) + '% of class';
      mainRow.querySelector('.alloc-bar').style.width = pct.toFixed(1) + '%';
      const pnlEl = mainRow.querySelector('.pnl-badge');
      if (pnlEl) {
        if (pnl != null) {
          pnlEl.textContent = (pnl >= 0 ? '+' : '') + ret?.toFixed(1) + '%';
          pnlEl.className = 'pnl-badge ' + (pnl >= 0 ? 'up' : 'down');
        } else { pnlEl.textContent = 'N/A'; pnlEl.className = 'pnl-badge na'; }
      }
      const liveEl = mainRow.querySelector('.asset-live');
      if (liveEl) { liveEl.textContent = liveStr; liveEl.className = `asset-live ${st}`; }

      // Update sub-rows if expanded
      if (entries.length > 1) {
        entries.forEach(h => {
          const subRow = document.getElementById(`subrow-${h.id}`);
          if (!subRow) return;
          const hVal = h.shares * mul * p;
          const hCost = h.shares * mul * (h.seedPrice || 0);
          const hPnl = hCost > 0 ? hVal - hCost : null;
          const hRet = hCost > 0 ? hPnl / hCost * 100 : null;
          subRow.querySelector('.stk-sub-val').textContent = toDisp(hVal);
          const subPnl = subRow.querySelector('.pnl-badge');
          if (subPnl) {
            if (hPnl != null) {
              subPnl.textContent = (hPnl >= 0 ? '+' : '') + hRet?.toFixed(1) + '%';
              subPnl.className = 'pnl-badge ' + (hPnl >= 0 ? 'up' : 'down') + ' ' + subPnl.style.cssText;
            } else { subPnl.textContent = 'N/A'; }
          }
        });
      }
    });
    return;
  }

  _rowFp.stocks = fp;
  document.getElementById('stocksRows').innerHTML = Object.entries(groups).map(([ticker, entries]) => {
    const first   = entries[0];
    const isIDX   = first.market === 'IDX';
    const mul     = stockMul(first);
    const p       = S.stockPrices[ticker] ?? first.seedPrice;
    const st      = S.stockPrices[ticker] ? 'live' : 'stale';
    const unitStr = isIDX ? 'lot' : 'shares';

    const totalShares = entries.reduce((s, h) => s + h.shares, 0);
    const totalCost   = entries.reduce((s, h) => s + h.shares * mul * (h.seedPrice || 0), 0);
    const totalVal    = totalShares * mul * p;
    const pct         = T.k > 0 ? totalVal / T.k * 100 : 0;
    const pnl         = totalCost > 0 ? totalVal - totalCost : null;
    const ret         = totalCost > 0 ? pnl / totalCost * 100 : null;
    const avgCost     = totalShares > 0 ? totalCost / (totalShares * mul) : 0;
    const liveStr     = `${isIDX ? `Rp ${Math.round(p).toLocaleString('id-ID')}` : dispPrice(p)} / share`;

    const pnlBadge = pnl != null
      ? `<span class="pnl-badge ${pnl >= 0 ? 'up' : 'down'}">${pnl >= 0 ? '+' : ''}${ret?.toFixed(1)}%</span>`
      : `<span class="pnl-badge na">N/A</span>`;

    const multiTag = entries.length > 1
      ? `<span class="ptag" style="background:rgba(99,102,241,.15);color:#818cf8;border-color:rgba(99,102,241,.3)">${entries.length}×</span>`
      : '';
    const brokerTags = [...new Set(entries.map(h => h.broker || 'other'))].map(b => ptag(b)).join('');
    const yieldAvg = entries.reduce((s, h) => s + (h.annualYield || 0), 0) / entries.length;
    const yieldBadge = yieldAvg > 0
      ? `<span class="asset-yield-badge">${yieldAvg.toFixed(1)}% p.a.</span>` : '';

    const groupId = `stkgrp-${ticker}`;

    const subRows = entries.length > 1 ? entries.map(h => {
      const hVal     = h.shares * mul * p;
      const hCost    = h.shares * mul * (h.seedPrice || 0);
      const hPnl     = hCost > 0 ? hVal - hCost : null;
      const hRet     = hCost > 0 ? hPnl / hCost * 100 : null;
      const dateStr  = h.date ? ` · ${h.date}` : '';
      return `<div class="stk-sub-row" id="subrow-${h.id}">
        <div class="stk-sub-info">
          <span class="stk-sub-lot">${h.shares.toLocaleString('id-ID')} ${unitStr}</span>
          ${ptag(h.broker || 'other')}
          <span class="stk-sub-cost">avg Rp ${Math.round(h.seedPrice||0).toLocaleString('id-ID')}${dateStr}</span>
        </div>
        <div class="stk-sub-right">
          <span class="stk-sub-val">${toDisp(hVal)}</span>
          ${hPnl != null ? `<span class="pnl-badge ${hPnl>=0?'up':'down'}" style="font-size:8px">${hPnl>=0?'+':''}${hRet?.toFixed(1)}%</span>` : ''}
          <div class="asset-actions" style="opacity:1;position:relative;margin-left:4px;">
            <button class="edit-btn" onclick="event.stopPropagation();openModal('stocks','${h.id}')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="del-btn"  onclick="event.stopPropagation();del('${h.id}')" title="Del"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
        </div>
      </div>`;
    }).join('') : '';

    return `<div class="stk-group" id="${groupId}">
      <div class="asset-row" onclick="${entries.length > 1 ? `toggleStkGroup('${groupId}')` : `openAssetChart('${entries[0].id}','stocks')`}" style="cursor:pointer">
        <div class="asset-icon icon-stk"><span style="font-size:8px;font-weight:700">${ticker}</span></div>
        <div class="asset-info">
          <div class="asset-name">${first.name || ticker}${multiTag}${brokerTags}${yieldBadge}</div>
          <div class="asset-sub">${totalShares.toLocaleString('id-ID')} ${unitStr} · avg Rp ${Math.round(avgCost).toLocaleString('id-ID')}</div>
          <div class="alloc-bar-wrap"><div class="alloc-bar" style="width:${pct.toFixed(1)}%;background:var(--stocks)"></div></div>
        </div>
        <div class="asset-right">
          <div class="asset-value-row">
            <div class="asset-value">${toDisp(totalVal)}</div>${pnlBadge}
          </div>
          <div class="asset-qty">${pct.toFixed(1)}% of class</div>
          <div class="asset-live ${st}">${liveStr}</div>
        </div>
        <div class="asset-actions" onclick="event.stopPropagation()">
          <button class="edit-btn" onclick="event.stopPropagation();openModal('stocks','${entries[0].id}')" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="del-btn"  onclick="event.stopPropagation();del('${entries[0].id}')" title="Del"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
        ${entries.length > 1
          ? `<span class="asset-expand-chevron" id="chev-${groupId}" style="opacity:.5;transition:transform .25s">▾</span>`
          : `<span class="asset-expand-chevron" style="opacity:.35"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg></span>`
        }
      </div>
      ${entries.length > 1 ? `<div class="stk-sub-list" id="sub-${groupId}" style="display:none">${subRows}</div>` : ''}
    </div>`;
  }).join('');
}

// ── Toggle stock group expand/collapse ───────────────────────────
window.toggleStkGroup = function(groupId) {
  const subList = document.getElementById('sub-' + groupId);
  const chev    = document.getElementById('chev-' + groupId);
  if (!subList) return;
  const isOpen = subList.style.display !== 'none';
  subList.style.display = isOpen ? 'none' : 'block';
  if (chev) chev.style.transform = isOpen ? '' : 'rotate(180deg)';
};

// ── Render Savings Rows ───────────────────────────────────────────
export function renderSavings(T) {
  document.getElementById('savingsTotal').textContent = toDisp(T.sv);

  const assets = filterAssets(DATA.savings, 'savings');
  if (assets.length === 0) {
    _rowFp.savings = null;
    const isSearch = S.searchQuery || S.filterPlatform;
    document.getElementById('savingsRows').innerHTML = `<div class="no-results">${
      isSearch ? 'No accounts match the filter' : '+ Tambah rekening tabungan dengan tombol <b>Add</b>'
    }</div>`;
    return;
  }

  const fp = _sectionFp(assets, 'savings');
  if (fp === _rowFp.savings) {
    assets.forEach(a => {
      const aIdr = savingsIdr(a);
      const pct = T.sv > 0 ? aIdr / T.sv * 100 : 0;
      const row = document.getElementById('row-' + a.id);
      if (!row) return;
      row.querySelector('.asset-value').textContent = toDisp(aIdr);
      row.querySelector('.asset-qty').textContent = pct.toFixed(1) + '% of class';
      row.querySelector('.alloc-bar').style.width = pct.toFixed(1) + '%';
      const liveEl = row.querySelector('.asset-live');
      if (liveEl && a.currency !== 'IDR') {
        liveEl.textContent = `1 ${a.currency} = Rp ${Math.round(S.fxRates[a.currency] || 0).toLocaleString('id-ID')}`;
        liveEl.className = `asset-live ${S.fxStatus[a.currency] || 'stale'}`;
      }
    });
    return;
  }

  _rowFp.savings = fp;
  document.getElementById('savingsRows').innerHTML = assets.map(a => {
    const aIdr = savingsIdr(a);
    const pct = T.sv > 0 ? aIdr / T.sv * 100 : 0;
    const noteTag = a.note ? `<span class="ptag t-manual">${a.note}</span>` : '';
    const foreignDisp = a.currency !== 'IDR' ? dispForeign(a.foreignAmt, a.currency) : '';
    const dateStr = a.date ? ` · ${a.date}` : '';
    const sub = a.currency !== 'IDR' ? `${foreignDisp} → ${toDisp(aIdr)}${dateStr}` : `TABUNGAN${dateStr}`;
    const m = assetMetrics('savings', a);
    return buildRow({
      id: a.id, type: 'savings', iconCls: 'icon-save', icon: S.currency === 'USD' ? '$' : 'Rp',
      name: a.name, tagsHtml: ptag(a.bank) + ctag(a.currency) + (noteTag ? ' ' + noteTag : ''),
      sub, val: toDisp(aIdr), pct, barCol: 'var(--savings)',
      liveStr: a.currency !== 'IDR' ? `1 ${a.currency} = Rp ${Math.round(S.fxRates[a.currency] || 0).toLocaleString('id-ID')}` : null,
      liveSt: a.currency !== 'IDR' ? (S.fxStatus[a.currency] || 'stale') : '',
      metrics: m, yieldPct: a.annualYield || null
    });
  }).join('');
}

// ── Render Section Metrics ────────────────────────────────────────
export function renderSectionMetrics(M, income) {
  // income is pre-computed by renderAll — no need to call computeAnnualIncome() again
  if (!income) income = computeAnnualIncome();
  const f = (id, v, cls) => {
    const el = document.getElementById(id);
    if (el) { el.textContent = v; el.className = `sm-val ${cls}`; }
  };

  // Crypto
  f('smCryptoCost', M.crypto.cost > 0 ? toDisp(M.crypto.cost) : '–', '');
  f('smCryptoVal',  toDisp(M.crypto.val), '');
  if (M.crypto.pnl != null) {
    f('smCryptoPnl', `${M.crypto.pnl >= 0 ? '+' : ''}${toDisp(Math.abs(M.crypto.pnl))}`, M.crypto.pnl >= 0 ? 'up' : 'down');
    f('smCryptoRet', `${M.crypto.ret?.toFixed(1)}%`, M.crypto.ret >= 0 ? 'up' : 'down');
  }

  // Gold
  f('smGoldCost', M.gold.cost > 0 ? toDisp(M.gold.cost) : '–', '');
  f('smGoldVal',  toDisp(M.gold.val), '');
  if (M.gold.pnl != null) {
    f('smGoldPnl', `${M.gold.pnl >= 0 ? '+' : ''}${toDisp(Math.abs(M.gold.pnl))}`, M.gold.pnl >= 0 ? 'up' : 'down');
    f('smGoldRet', `${M.gold.ret?.toFixed(1)}%`, M.gold.ret >= 0 ? 'up' : 'down');
  }

  // Stocks
  f('smStocksCost', M.stocks.cost > 0 ? toDisp(M.stocks.cost) : '–', '');
  f('smStocksVal',  toDisp(M.stocks.val), '');
  if (M.stocks.pnl != null) {
    f('smStocksPnl', `${M.stocks.pnl >= 0 ? '+' : ''}${toDisp(Math.abs(M.stocks.pnl))}`, M.stocks.pnl >= 0 ? 'up' : 'down');
    f('smStocksRet', `${M.stocks.ret?.toFixed(1)}%`, M.stocks.ret >= 0 ? 'up' : 'down');
  }

  // Savings
  const savingsTotal = M.total.val - M.crypto.val - M.gold.val - M.stocks.val;
  f('smSavingsVal',   savingsTotal > 0 ? toDisp(savingsTotal) : '–', '');
  f('smSavingsIdr',   savingsTotal > 0 ? toDisp(savingsTotal) : '–', '');
  f('smSavingsYield', income.savings > 0 ? toDisp(income.savings) : '–', 'up');
}

// ── Render Analytics ──────────────────────────────────────────────
export function renderAnalytics() {
  const stats = computePortfolioAnalytics();
  const grid = document.getElementById('analyticsGrid');
  const note = document.getElementById('analyticsNote');

  if (!stats) {
    grid.innerHTML = `
      <div class="analytics-stat"><div class="an-label">Volatilitas</div><div class="an-value an-na">–</div></div>
      <div class="analytics-stat"><div class="an-label">Sharpe Ratio</div><div class="an-value an-na">–</div></div>
      <div class="analytics-stat"><div class="an-label">Max Drawdown</div><div class="an-value an-na">–</div></div>
      <div class="analytics-stat"><div class="an-label">Total Return</div><div class="an-value an-na">–</div></div>
      <div class="analytics-stat"><div class="an-label">Daily Change</div><div class="an-value an-na">–</div></div>
      <div class="analytics-stat"><div class="an-label">Weekly Change</div><div class="an-value an-na">–</div></div>`;
    note.textContent = "Butuh minimal 2 snapshot historis (sync tiap hari)";
    return;
  }

  const volCls = stats.annualVol < 20 ? 'good' : stats.annualVol < 40 ? 'warn' : 'bad';
  const shCls = stats.sharpe > 1 ? 'good' : stats.sharpe > 0 ? 'warn' : 'bad';
  const ddCls = stats.maxDD < 10 ? 'good' : stats.maxDD < 25 ? 'warn' : 'bad';
  const retCls = stats.totalReturn >= 0 ? 'good' : 'bad';
  const dayCls = stats.dailyChange >= 0 ? 'good' : 'bad';
  const weekCls = stats.weeklyChange >= 0 ? 'good' : 'bad';

  grid.innerHTML = `
    <div class="analytics-stat"><div class="an-label">Volatilitas</div><div class="an-value ${volCls}">${stats.annualVol.toFixed(1)}%</div></div>
    <div class="analytics-stat"><div class="an-label">Sharpe Ratio</div><div class="an-value ${shCls}">${stats.sharpe.toFixed(2)}</div></div>
    <div class="analytics-stat"><div class="an-label">Max Drawdown</div><div class="an-value ${ddCls}">-${stats.maxDD.toFixed(1)}%</div></div>
    <div class="analytics-stat"><div class="an-label">Total Return</div><div class="an-value ${retCls}">${stats.totalReturn.toFixed(1)}%</div></div>
    <div class="analytics-stat"><div class="an-label">Daily Change</div><div class="an-value ${dayCls}">${stats.dailyChange.toFixed(2)}%</div><div class="an-sub">24 jam terakhir</div></div>
    <div class="analytics-stat"><div class="an-label">Weekly Change</div><div class="an-value ${weekCls}">${stats.weeklyChange.toFixed(2)}%</div><div class="an-sub">7 hari terakhir</div></div>`;

  note.textContent = `${stats.dataPoints} snapshots`;

  // Render yield row
  const income = computeAnnualIncome();
  const yieldRow = document.getElementById('yieldRow');
  if (yieldRow) {
    yieldRow.innerHTML = `
      <div class="yield-chip">
        <div class="yc-label">Dividen Saham</div>
        <div class="yc-val">${toDisp(income.stocks)}</div>
      </div>
      <div class="yield-chip">
        <div class="yc-label">Bunga Deposito</div>
        <div class="yc-val">${toDisp(income.savings)}</div>
      </div>
      <div class="yield-chip">
        <div class="yc-label">Total Est. Income</div>
        <div class="yc-val">${toDisp(income.total)}</div>
      </div>`;
  }

  // Render ML / Risk Intelligence panel (merged into analytics)
  if (typeof window.renderMLPanel === 'function') window.renderMLPanel();
}

// ── Render All ────────────────────────────────────────────────────
export function renderAll(T) {
  if (!T) T = totals();
  const M = computeMetrics(T);
  const income = computeAnnualIncome();

  buildPlatformOptions();
  renderKPIs(T, M);
  renderPriceBar();
  renderSectionMetrics(M, income);
  renderCrypto(T);
  renderGold(T);
  renderStocks(T);
  renderSavings(T);
  renderFxTickerBar();
  updateSearchCount();
  updateSectionVisibility();
  applyI18n();
}

// ── Modal Logic ───────────────────────────────────────────────────
let _sec = null, _editId = null, _pendingDelId = null;
let _pendingDelItem = null, _pendingDelType = null;

// ── Transaction Log Helper ────────────────────────────────────────
function _logTx(action, type, item, prevItem = null) {
  if (!DATA.txLog) DATA.txLog = [];

  const typeLabels = { crypto: 'Crypto', gold: 'Gold', stocks: 'Stocks', savings: 'Savings' };
  let name = '–', detail = '';

  if (type === 'crypto' && item) {
    name = `${item.coin} (${item.platform || '–'})`;
    detail = `${item.amount} ${item.coin} @ Rp ${(item.costBasisIdr||0).toLocaleString('id-ID')}`;
  } else if (type === 'gold' && item) {
    name = item.name || 'Gold';
    detail = `${item.grams}g @ Rp ${(item.costBasisPerGram||0).toLocaleString('id-ID')}/g`;
  } else if (type === 'stocks' && item) {
    name = `${item.ticker} (${item.broker || '–'})`;
    detail = `${item.shares} lot/shares @ Rp ${(item.seedPrice||0).toLocaleString('id-ID')}`;
  } else if (type === 'savings' && item) {
    name = item.name || 'Savings';
    detail = `${item.currency} ${(item.foreignAmt||0).toLocaleString('en-US')}`;
  }

  // For EDIT, show what changed
  if (action === 'EDIT' && prevItem) {
    const changes = [];
    if (type === 'crypto') {
      if (prevItem.amount !== item?.amount) changes.push(`amount: ${prevItem.amount} → ${item?.amount}`);
      if (prevItem.costBasisIdr !== item?.costBasisIdr) changes.push(`cost: Rp ${(prevItem.costBasisIdr||0).toLocaleString('id-ID')} → Rp ${(item?.costBasisIdr||0).toLocaleString('id-ID')}`);
    } else if (type === 'stocks') {
      if (prevItem.shares !== item?.shares) changes.push(`shares: ${prevItem.shares} → ${item?.shares}`);
      if (prevItem.seedPrice !== item?.seedPrice) changes.push(`price: ${prevItem.seedPrice} → ${item?.seedPrice}`);
    } else if (type === 'savings') {
      if (prevItem.foreignAmt !== item?.foreignAmt) changes.push(`balance: ${prevItem.foreignAmt} → ${item?.foreignAmt}`);
    }
    if (changes.length) detail = changes.join(', ');
  }

  DATA.txLog.unshift({
    id:     uid(),
    ts:     new Date().toISOString(),
    action,                            // 'ADD' | 'EDIT' | 'DELETE'
    type:   typeLabels[type] || type,
    name,
    detail,
  });

  // Simpan max 200 entri
  if (DATA.txLog.length > 200) DATA.txLog.length = 200;
}

const MODALS = {
  crypto: {
    get title() { return t('modal_crypto_title'); },
    get sub() { return t('modal_crypto_sub'); },
    getHtml(ed) {
      const knownCoins = [
        ['BTC','Bitcoin'], ['ETH','Ethereum'], ['XRP','XRP'],
        ['SOL','Solana'], ['BNB','BNB'], ['ADA','Cardano'], ['DOGE','Dogecoin'],
        ['AVAX','Avalanche'], ['MATIC','Polygon'], ['LINK','Chainlink'],
        ['DOT','Polkadot'], ['ATOM','Cosmos'], ['UNI','Uniswap'],
        ['NEAR','NEAR Protocol'], ['TRX','TRON'], ['ARB','Arbitrum'],
        ['OP','Optimism'], ['SUI','Sui'], ['APT','Aptos'],
        ['ONDO','Ondo Finance'], ['TON','Toncoin'], ['PEPE','Pepe'],
        ['SHIB','Shiba Inu'], ['LTC','Litecoin'], ['USDT','Tether'],
        ['USDC','USD Coin'],
      ];
      const isCustom = ed?.coin && !knownCoins.find(([c]) => c === ed.coin);
      const selectedCoin = isCustom ? 'OTHER' : (ed?.coin || '');
      const coinOpts = knownCoins
        .map(([val, label]) => `<option value="${val}" ${selectedCoin === val ? 'selected' : ''}>${val} — ${label}</option>`)
        .join('');
      return `<div class="form-group"><label class="form-label">${t('f_coin')}</label>
        <select id="f-coin" class="form-select" onchange="onCoinChange()">
          ${coinOpts}
          <option value="OTHER" ${selectedCoin === 'OTHER' ? 'selected' : ''}>Lainnya (custom)…</option>
        </select>
        <input id="f-coin-custom" type="text" class="form-input"
          placeholder="Kode coin, mis: AAVE, FIL, CRV"
          style="display:${isCustom ? 'block' : 'none'};margin-top:8px;text-transform:uppercase"
          oninput="this.value=this.value.toUpperCase()"
          value="${isCustom ? (ed?.coin || '') : ''}">
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">${t('f_amount')}</label>
            <input id="f-amount" type="number" step="0.0001" class="form-input" value="${ed?.amount || ''}" placeholder="0.05"></div>
          <div class="form-group"><label class="form-label">${t('f_costbasis')}</label>
            <input id="f-costbasis" type="number" class="form-input" value="${ed?.costBasisIdr || ''}" placeholder="95000000">
            <div class="form-hint">${t('f_costbasis_hint')}</div></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">${t('f_platform')}</label>
            <select id="f-platform" class="form-select" onchange="toggleCustomInput(this,'f-platform-custom')">
              <option value="floq" ${ed?.platform === 'floq' ? 'selected' : ''}>FLOQ</option>
              <option value="triv" ${ed?.platform === 'triv' ? 'selected' : ''}>TRIV</option>
              <option value="pintu" ${ed?.platform === 'pintu' ? 'selected' : ''}>PINTU</option>
              <option value="pluang" ${ed?.platform === 'pluang' ? 'selected' : ''}>PLUANG</option>
              <option value="indodax" ${ed?.platform === 'indodax' ? 'selected' : ''}>INDODAX</option>
              <option value="tokocrypto" ${ed?.platform === 'tokocrypto' ? 'selected' : ''}>TOKOCRYPTO</option>
              <option value="binance" ${ed?.platform === 'binance' ? 'selected' : ''}>BINANCE</option>
              <option value="bitget" ${ed?.platform === 'bitget' ? 'selected' : ''}>BITGET</option>
              <option value="other" ${ed && !['floq','triv','pintu','pluang','indodax','tokocrypto','binance','bitget'].includes(ed.platform) ? 'selected' : ''}>Lainnya</option>
            </select>
            <input id="f-platform-custom" type="text" class="form-input" placeholder="${t('custom_platform')}" style="display:none;margin-top:8px;" value="${ed && !['floq','triv','pintu','pluang','indodax','tokocrypto','binance','bitget'].includes(ed?.platform) ? ed.platform : ''}"></div>
          <div class="form-group"><label class="form-label">${t('f_date')}</label>
            <input id="f-date" type="date" class="form-input" value="${ed?.date || ''}"></div>
        </div>`;
    },
    getData() {
      const pv = document.getElementById('f-platform').value;
      const fp = pv === 'other' ? (document.getElementById('f-platform-custom').value || 'Other') : pv;
      const dv = document.getElementById('f-date').value || new Date().toISOString().split('T')[0];
      const cs = document.getElementById('f-coin');
      let coinVal = cs.value;
      if (coinVal === 'OTHER') {
        const custom = document.getElementById('f-coin-custom')?.value?.trim().toUpperCase();
        coinVal = custom || 'OTHER';
      }
      const COIN_NAMES_MAP = {
        BTC:'Bitcoin', ETH:'Ethereum', XRP:'XRP', SOL:'Solana', BNB:'BNB',
        ADA:'Cardano', DOGE:'Dogecoin', AVAX:'Avalanche', MATIC:'Polygon',
        LINK:'Chainlink', DOT:'Polkadot', ATOM:'Cosmos', UNI:'Uniswap',
        NEAR:'NEAR Protocol', TRX:'TRON', ARB:'Arbitrum', OP:'Optimism',
        SUI:'Sui', APT:'Aptos', ONDO:'Ondo Finance', TON:'Toncoin',
        PEPE:'Pepe', SHIB:'Shiba Inu', LTC:'Litecoin', USDT:'Tether', USDC:'USD Coin',
      };
      return {
        coin: coinVal,
        name: COIN_NAMES_MAP[coinVal] || coinVal,
        amount: parseFloat(document.getElementById('f-amount').value) || 0,
        costBasisIdr: parseFloat(document.getElementById('f-costbasis').value) || 0,
        platform: fp,
        date: dv
      };
    },
    save() { DATA.crypto.push({ id: uid(), ...this.getData() }); },
    edit(id) {
      const i = DATA.crypto.findIndex(x => x.id === id);
      if (i >= 0) DATA.crypto[i] = { ...DATA.crypto[i], ...this.getData() };
    }
  },
  gold: {
    get title() { return t('modal_gold_title'); },
    get sub() { return t('modal_gold_sub'); },
    getHtml(ed) {
      return `<div class="form-group"><label class="form-label">${t('f_desc')}</label>
        <input id="f-name" type="text" class="form-input" value="${ed?.name || ''}" placeholder="e.g. Antam 10g Bar"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">${t('f_grams')}</label>
            <input id="f-grams" type="number" step="0.01" class="form-input" value="${ed?.grams || ''}" placeholder="10"></div>
          <div class="form-group"><label class="form-label">${t('f_price_per_gram')}</label>
            <input id="f-costpergram" type="number" step="1000" class="form-input" value="${ed?.costBasisPerGram || ''}" placeholder="1250000"></div>
        </div>
        <div class="form-group"><label class="form-label">${t('f_date')}</label>
          <input id="f-date" type="date" class="form-input" value="${ed?.date || ''}"></div>`;
    },
    getData() {
      return {
        name: document.getElementById('f-name').value || 'Gold',
        grams: parseFloat(document.getElementById('f-grams').value) || 0,
        costBasisPerGram: parseFloat(document.getElementById('f-costpergram').value) || 0,
        date: document.getElementById('f-date').value || new Date().toISOString().split('T')[0]
      };
    },
    save() { DATA.gold.push({ id: uid(), ...this.getData() }); },
    edit(id) {
      const i = DATA.gold.findIndex(x => x.id === id);
      if (i >= 0) DATA.gold[i] = { ...DATA.gold[i], ...this.getData() };
    }
  },
  stocks: {
    get title() { return t('modal_stocks_title'); },
    get sub() { return t('modal_stocks_sub'); },
    getHtml(ed) {
      const mkt = ed?.market || 'IDX';
      const listEntries = mkt === 'IDX'
        ? Object.entries(POPULAR_STOCKS_IDX)
        : mkt === 'US'
        ? Object.entries(US_STOCKS)
        : Object.entries(INDEX_FUNDS);
      const sharesLabel = mkt === 'IDX' ? 'Lot' : mkt === 'INDEX' ? 'Unit / Lembar' : 'Shares';
      return `<datalist id="stock-list">${listEntries.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</datalist>
        <div class="form-row">
          <div class="form-group"><label class="form-label">${t('f_ticker')}</label>
            <input id="f-ticker" type="text" class="form-input" value="${ed?.ticker || ''}" placeholder="${mkt === 'IDX' ? 'BBCA' : mkt === 'US' ? 'AAPL' : 'SPY'}" list="stock-list" oninput="this.value=this.value.toUpperCase();autoFillStockName(this.value)" onblur="previewPrice()" ${ed ? 'readonly' : ''}><div class="fetch-hint" id="tickerHint">${t('fetch_price_hint')}</div></div>
          <div class="form-group"><label class="form-label">${t('f_market')}</label>
            <select id="f-market" class="form-select" onchange="onMarketChange();previewPrice()" ${ed ? 'disabled' : ''}>
              <option value="IDX" ${mkt === 'IDX' ? 'selected' : ''}>IDX (Indonesia)</option>
              <option value="US" ${mkt === 'US' ? 'selected' : ''}>US Market</option>
              <option value="INDEX" ${mkt === 'INDEX' ? 'selected' : ''}>Index / ETF</option>
            </select></div>
        </div>
        <div class="form-group"><label class="form-label">${t('f_company')}</label>
          <input id="f-name" type="text" class="form-input" value="${ed?.name || ''}" placeholder="Auto-fill…" ${ed ? '' : 'readonly'}></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label" id="f-shares-label">${sharesLabel}</label>
            <input id="f-shares" type="number" class="form-input" value="${ed?.shares || ''}" placeholder="10"></div>
          <div class="form-group"><label class="form-label">${t('f_price')}</label>
            <input id="f-price" type="number" class="form-input" value="${ed?.seedPrice || ''}" placeholder="auto / manual"><div class="form-hint">${t('f_price_hint')}</div></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">${t('f_annual_yield')} (%)</label>
            <input id="f-yield" type="number" step="0.01" class="form-input" value="${ed?.annualYield || ''}" placeholder="3.5"><div class="form-hint">${t('f_yield_hint')}</div></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">${t('f_broker')}</label>
            <select id="f-broker" class="form-select" onchange="toggleCustomInput(this,'f-broker-custom')">
              <option value="bibit" ${ed?.broker === 'bibit' ? 'selected' : ''}>Bibit</option>
              <option value="indopremier" ${ed?.broker === 'indopremier' ? 'selected' : ''}>Indopremier</option>
              <option value="stockbit" ${ed?.broker === 'stockbit' ? 'selected' : ''}>Stockbit</option>
              <option value="other" ${ed && !['bibit', 'indopremier', 'stockbit'].includes(ed.broker) ? 'selected' : ''}>Lainnya</option>
            </select>
            <input id="f-broker-custom" type="text" class="form-input" placeholder="${t('custom_broker')}" style="display:none;margin-top:8px;" value="${ed && !['bibit', 'indopremier', 'stockbit'].includes(ed?.broker) ? ed.broker : ''}"></div>
          <div class="form-group"><label class="form-label">${t('f_date')}</label>
            <input id="f-date" type="date" class="form-input" value="${ed?.date || ''}"></div>
        </div>`;
    },
    getData() {
      const bv = document.getElementById('f-broker').value;
      const fb = bv === 'other' ? (document.getElementById('f-broker-custom').value || 'Other') : bv;
      const nf = document.getElementById('f-name'); if (nf) nf.readOnly = false;
      return {
        ticker: document.getElementById('f-ticker').value,
        name: document.getElementById('f-name').value || document.getElementById('f-ticker').value,
        market: document.getElementById('f-market').value,
        shares: parseFloat(document.getElementById('f-shares').value) || 0,
        seedPrice: parseFloat(document.getElementById('f-price').value) || 0,
        broker: fb,
        date: document.getElementById('f-date').value || new Date().toISOString().split('T')[0],
        annualYield: parseFloat(document.getElementById('f-yield').value) || 0
      };
    },
    save() { DATA.stocks.push({ id: uid(), ...this.getData() }); },
    edit(id) {
      const i = DATA.stocks.findIndex(x => x.id === id);
      if (i >= 0) DATA.stocks[i] = { ...DATA.stocks[i], ...this.getData() };
    }
  },
  savings: {
    get title() { return t('modal_savings_title'); },
    get sub() { return t('modal_savings_sub'); },
    getHtml(ed) {
      return `<div class="form-group"><label class="form-label">${t('f_desc')}</label>
        <input id="f-name" type="text" class="form-input" value="${ed?.name || ''}" placeholder="e.g. BCA Tabungan"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">${t('f_bank')}</label>
            <select id="f-bank" class="form-select" onchange="toggleCustomInput(this,'f-bank-custom')">
              ${BANK_OPTS.replace(`value="${ed?.bank}"`, `value="${ed?.bank}" selected`)}
            </select>
            <input id="f-bank-custom" type="text" class="form-input" placeholder="${t('custom_bank')}" style="display:none;margin-top:8px;" value="${ed && !['bca', 'bri', 'bni', 'mandiri', 'ocbc', 'krom', 'cash'].includes(ed?.bank) ? ed.bank : ''}"></div>
          <div class="form-group"><label class="form-label">${t('f_currency')}</label>
            <select id="f-ccy" class="form-select" onchange="onSavingsCcyChange()" ${ed ? 'disabled' : ''}>${CCY_OPTS.replace(`value="${ed?.currency || 'IDR'}"`, `value="${ed?.currency || 'IDR'}" selected`)}</select></div>
        </div>
        <div class="form-group"><label class="form-label" id="f-amt-label">${t('f_balance')} (${ed?.currency || 'IDR'})</label>
          <input id="f-amt" type="number" step="1000" class="form-input" value="${ed?.foreignAmt || ''}" placeholder="10000000">
          <div class="fetch-hint" id="fxHint"></div></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">${t('f_annual_yield')} (%)</label>
            <input id="f-yield" type="number" step="0.01" class="form-input" value="${ed?.annualYield || ''}" placeholder="3.5"><div class="form-hint">${t('f_yield_hint')}</div></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">${t('f_note')}</label>
            <input id="f-note" type="text" class="form-input" value="${ed?.note || ''}" placeholder="e.g. 6% p.a."></div>
          <div class="form-group"><label class="form-label">${t('f_date')}</label>
            <input id="f-date" type="date" class="form-input" value="${ed?.date || ''}"></div>
        </div>`;
    },
    getData() {
      const ccy = document.getElementById('f-ccy').value;
      const amt = parseFloat(document.getElementById('f-amt').value) || 0;
      const bv = document.getElementById('f-bank').value;
      const fb = bv === 'other' ? (document.getElementById('f-bank-custom').value || 'Other') : bv;
      return {
        name: document.getElementById('f-name').value || 'Savings',
        bank: fb,
        currency: ccy,
        foreignAmt: amt,
        idr: amt * (S.fxRates[ccy] ?? 1),
        note: document.getElementById('f-note').value || '',
        date: document.getElementById('f-date').value || new Date().toISOString().split('T')[0],
        annualYield: parseFloat(document.getElementById('f-yield').value) || 0
      };
    },
    save() { DATA.savings.push({ id: uid(), ...this.getData() }); },
    edit(id) {
      const i = DATA.savings.findIndex(x => x.id === id);
      if (i >= 0) DATA.savings[i] = { ...DATA.savings[i], ...this.getData() };
    }
  }
};

// ── Modal Validation (Fix 3 + Fix 12) ───────────────────────────
function validateModal(sec) {
  document.querySelectorAll('.modal-field-error').forEach(el => el.remove());
  document.querySelectorAll('.form-input.input-error,.form-select.input-error').forEach(el => {
    el.classList.remove('input-error');
  });
  const errors = [];
  const markErr = (id, msg) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('input-error');
    const e = document.createElement('div');
    e.className = 'modal-field-error';
    e.textContent = '' + msg;
    el.parentNode.insertBefore(e, el.nextSibling);
    errors.push(msg);
  };
  const num = id => parseFloat(document.getElementById(id)?.value) || 0;
  const str = id => (document.getElementById(id)?.value || '').trim();
  const validateDate = () => {
    const dv = str('f-date');
    if (!dv) return;
    const d = new Date(dv);
    if (isNaN(d.getTime())) { markErr('f-date', 'Format tanggal tidak valid'); return; }
    const today = new Date(); today.setHours(23,59,59,999);
    if (d > today) markErr('f-date', 'Tanggal tidak boleh di masa depan');
    if (d < new Date('2000-01-01')) markErr('f-date', 'Tanggal terlalu jauh ke belakang');
  };
  if (sec === 'crypto') {
    if (num('f-amount') <= 0)      markErr('f-amount',    'Jumlah harus lebih dari 0');
    if (num('f-costbasis') < 0)    markErr('f-costbasis', 'Modal beli tidak boleh negatif');
    validateDate();
  }
  if (sec === 'gold') {
    if (!str('f-name'))            markErr('f-name',       'Deskripsi wajib diisi');
    if (num('f-grams') <= 0)       markErr('f-grams',      'Berat harus lebih dari 0');
    if (num('f-costpergram') <= 0) markErr('f-costpergram','Harga beli/gram harus lebih dari 0');
    validateDate();
  }
  if (sec === 'stocks') {
    if (!str('f-ticker'))          markErr('f-ticker', 'Kode saham wajib diisi');
    if (num('f-shares') <= 0)      markErr('f-shares', 'Jumlah lot/lembar harus lebih dari 0');
    const y = parseFloat(document.getElementById('f-yield')?.value);
    if (!isNaN(y) && (y < 0 || y > 100)) markErr('f-yield', 'Yield harus antara 0–100%');
    validateDate();
  }
  if (sec === 'savings') {
    if (!str('f-name'))            markErr('f-name', 'Nama rekening wajib diisi');
    if (num('f-amt') <= 0)         markErr('f-amt',  'Saldo harus lebih dari 0');
    const y = parseFloat(document.getElementById('f-yield')?.value);
    if (!isNaN(y) && (y < 0 || y > 100)) markErr('f-yield', 'Yield harus antara 0–100%');
    validateDate();
  }
  return errors.length === 0;
}

export function openModal(sec, editId = null) {
  _sec = sec; _editId = editId;
  const m = MODALS[sec], isEdit = !!editId;
  let ed = isEdit ? DATA[sec].find(x => x.id === editId) || null : null;

  document.getElementById('modalTitle').textContent = (isEdit ? t('label_edit_mode') + ' — ' : '') + m.title;
  document.getElementById('modalSub').textContent = m.sub;
  document.getElementById('modalEditBadge').innerHTML = isEdit ? `<div class="modal-edit-badge">${t('label_edit_mode')}</div>` : '';
  document.getElementById('modalBody').innerHTML = m.getHtml(ed);
  document.getElementById('modalSaveBtn').textContent = isEdit ? t('save_changes') : t('add_asset');
  document.getElementById('modalOverlay').classList.add('open');

  if (!isEdit) {
    const df = document.getElementById('f-date');
    if (df) df.value = new Date().toISOString().split('T')[0];
  }

  ['f-platform', 'f-broker', 'f-bank'].forEach(id => {
    const el = document.getElementById(id), ci = document.getElementById(id + '-custom');
    if (el && ci && el.value === 'other') ci.style.display = 'block';
  });
}

export function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  _sec = null; _editId = null;
}

export function saveModal() {
  if (!_sec) return;
  if (!validateModal(_sec)) return;
  const m = MODALS[_sec];
  const isEdit = !!_editId;

  // Snapshot item sebelum edit (untuk log)
  const prevItem = isEdit ? JSON.parse(JSON.stringify(DATA[_sec]?.find(x => x.id === _editId) || {})) : null;

  if (isEdit) m.edit(_editId); else m.save();

  // Log transaction
  const newItem = isEdit
    ? DATA[_sec]?.find(x => x.id === _editId)
    : DATA[_sec]?.[DATA[_sec].length - 1];
  _logTx(isEdit ? 'EDIT' : 'ADD', _sec, newItem, prevItem);

  closeModal();
  saveDataToCloud();
  if (_sec === 'stocks') syncStocksOnly(); else renderAll();
}

// ── Delete Logic ──────────────────────────────────────────────────
export function del(id) {
  let nm = id, _delItem = null, _delType = null;
  for (const type of ['crypto', 'gold', 'stocks', 'savings']) {
    const f = DATA[type].find(x => x.id === id);
    if (f) { nm = f.name || (f.coin ? `${f.amount} ${f.coin}` : id); _delItem = f; _delType = type; break; }
  }
  _pendingDelId = id;
  _pendingDelItem = _delItem ? JSON.parse(JSON.stringify(_delItem)) : null;
  _pendingDelType = _delType;
  document.getElementById('confirmAssetName').textContent = nm;
  document.getElementById('confirmOverlay').classList.add('open');
}

export function confirmDel() {
  if (!_pendingDelId) return;
  _logTx('DELETE', _pendingDelType, _pendingDelItem);
  ['crypto', 'gold', 'stocks', 'savings'].forEach(k => { DATA[k] = DATA[k].filter(x => x.id !== _pendingDelId); });
  _pendingDelId = null; _pendingDelItem = null; _pendingDelType = null;
  document.getElementById('confirmOverlay').classList.remove('open');
  renderAll();
  saveDataToCloud();
}

export function cancelDel() {
  _pendingDelId = null;
  document.getElementById('confirmOverlay').classList.remove('open');
}

// ── Modal Helpers ─────────────────────────────────────────────────
window.toggleCustomInput = function (sel, ciId) {
  const ci = document.getElementById(ciId);
  if (ci) {
    if (sel.value === 'other') { ci.style.display = 'block'; ci.focus(); }
    else { ci.style.display = 'none'; ci.value = ''; }
  }
};

window.onCoinChange = function () {
  const v = document.getElementById('f-coin')?.value;
  const ci = document.getElementById('f-coin-custom');
  if (!ci) return;
  if (v === 'OTHER') { ci.style.display = 'block'; ci.focus(); }
  else { ci.style.display = 'none'; ci.value = ''; }
};

window.onSavingsCcyChange = function () {
  const ccy = document.getElementById('f-ccy')?.value;
  if (!ccy) return;
  const lbl = document.getElementById('f-amt-label'), hint = document.getElementById('fxHint');
  if (lbl) lbl.textContent = `${t('f_balance')} (${ccy})`;
  if (hint) {
    const rate = S.fxRates[ccy];
    if (ccy === 'IDR') { hint.textContent = ''; }
    else if (rate) { hint.textContent = `Rate: 1 ${ccy} = Rp ${Math.round(rate).toLocaleString('id-ID')}`; hint.className = 'fetch-hint ok'; }
    else { hint.textContent = 'FX rate belum di-sync'; hint.className = 'fetch-hint spin'; }
  }
};

window.autoFillStockName = function (ticker) {
  const ni = document.getElementById('f-name');
  const mktEl = document.getElementById('f-market');
  if (!ni || !mktEl) return;

  // Auto-detect correct market from ticker if not editing
  const allMaps = [
    { map: POPULAR_STOCKS_IDX, mkt: 'IDX' },
    { map: US_STOCKS,          mkt: 'US'  },
    { map: INDEX_FUNDS,        mkt: 'INDEX' },
  ];
  for (const { map, mkt } of allMaps) {
    if (map[ticker]) {
      ni.value = map[ticker];
      ni.readOnly = true;
      if (!mktEl.disabled) {
        mktEl.value = mkt;
        _updateStockDatalist(mkt);
        _updateSharesLabel(mkt);
      }
      return;
    }
  }
  // Unknown ticker — leave name editable
  ni.readOnly = false;
};

// Rebuild datalist and shares label when market dropdown changes
window.onMarketChange = function () {
  const mkt = document.getElementById('f-market')?.value;
  if (!mkt) return;
  _updateStockDatalist(mkt);
  _updateSharesLabel(mkt);
  // Clear ticker and name when market changes so user picks from correct list
  const tickerEl = document.getElementById('f-ticker');
  const nameEl   = document.getElementById('f-name');
  if (tickerEl) tickerEl.value = '';
  if (nameEl)   { nameEl.value = ''; nameEl.readOnly = true; }
};

function _updateStockDatalist(mkt) {
  const dl = document.getElementById('stock-list');
  if (!dl) return;
  const entries = mkt === 'IDX' ? Object.entries(POPULAR_STOCKS_IDX)
    : mkt === 'US' ? Object.entries(US_STOCKS)
    : Object.entries(INDEX_FUNDS);
  dl.innerHTML = entries.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
}

function _updateSharesLabel(mkt) {
  const lbl = document.getElementById('f-shares-label');
  if (!lbl) return;
  lbl.textContent = mkt === 'IDX' ? 'Lot' : mkt === 'INDEX' ? 'Unit / Lembar' : 'Shares';
}

async function previewPrice() {
  const ticker = document.getElementById('f-ticker')?.value?.trim()?.toUpperCase();
  const mk = document.getElementById('f-market')?.value;
  const hint = document.getElementById('tickerHint'), pe = document.getElementById('f-price');
  if (!ticker || !hint) return;
  hint.textContent = '↻ mengambil harga live…'; hint.className = 'fetch-hint spin';
  try {
    // IDX → append .JK; INDEX and US → use ticker as-is (^GSPC, SPY, AAPL etc.)
    const sym = mk === 'IDX' ? `${ticker}.JK` : ticker;
    const p = await fetchYahoo(sym);
    // For INDEX: ^IHSG/^LQ45/^IDX30 are IDR-based, all others are USD
    const isIdrIndex = mk === 'INDEX' && (ticker.startsWith('^IH') || ticker.startsWith('^LQ') || ticker.startsWith('^ID'));
    const pIdr = (mk === 'US' || (mk === 'INDEX' && !isIdrIndex)) ? Math.round(p * S.usdIdr) : Math.round(p);
    hint.textContent = `${dispPrice(pIdr)} (live)`; hint.className = 'fetch-hint ok';
    if (pe) pe.value = pIdr;
  } catch {
    hint.textContent = t('ticker_not_found'); hint.className = 'fetch-hint err';
  }
}

async function fetchYahoo(sym) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
  const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw 0;
  const d = await r.json();
  const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!p) throw 0;
  return p;
}

// ══════════════════════════════════════════
// MANUAL PRICE — Modal & Inline Price Bar Edit
// ══════════════════════════════════════════

export function openManualPrice() {
  const overlay = document.getElementById('manualPriceOverlay');
  if (!overlay) return;

  // Pre-fill current values
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('mp-btc', S.btcIdr);
  set('mp-eth', S.ethIdr);
  set('mp-xrp', S.xrpIdr);
  set('mp-xau', S.goldGramIdr);
  set('mp-usd', S.usdIdr);

  // Build stocks grid dynamically
  const stocksGrid = document.getElementById('mp-stocks-grid');
  if (stocksGrid) {
    stocksGrid.innerHTML = DATA.stocks.map(h => {
      const cur = S.stockPrices[h.ticker] ?? h.seedPrice;
      const unit = h.market === 'IDX' ? 'IDR/lbr' : 'USD/share';
      // For IDX, stored as IDR. For US, stored as IDR (price * usdIdr). Show in original unit.
      const displayVal = h.market === 'US' && S.usdIdr > 0
        ? (cur / S.usdIdr).toFixed(2)
        : Math.round(cur);
      return `<div class="mp-row">
        <span class="mp-lbl">${h.ticker} <span style="opacity:.5;font-size:8px">${unit}</span></span>
        <input id="mp-stk-${h.ticker}" class="mp-input" type="number"
          step="${h.market === 'US' ? '0.01' : '1'}"
          value="${displayVal}"
          placeholder="${displayVal}">
      </div>`;
    }).join('') || '<div style="font-size:10px;color:var(--muted);padding:4px 0">Belum ada saham</div>';
  }

  // Build altcoins grid
  const MAJOR = new Set(['BTC','ETH','XRP']);
  const altCoins = [...new Set(DATA.crypto.map(a => (a.coin||'').toUpperCase()).filter(c => !MAJOR.has(c)))];
  const altSection = document.getElementById('mp-altcoins-section');
  const altGrid = document.getElementById('mp-altcoins-grid');
  if (altSection && altGrid) {
    if (altCoins.length > 0) {
      altSection.style.display = 'block';
      altGrid.innerHTML = altCoins.map(coin => {
        const cur = S.altcoinPrices?.[coin] || 0;
        return `<div class="mp-row">
          <span class="mp-lbl">${coin} (IDR)</span>
          <input id="mp-alt-${coin}" class="mp-input" type="number"
            value="${cur || ''}" placeholder="harga IDR">
        </div>`;
      }).join('');
    } else {
      altSection.style.display = 'none';
    }
  }

  overlay.classList.add('open');
}

export function closeManualPrice() {
  document.getElementById('manualPriceOverlay')?.classList.remove('open');
}

export function saveManualPrice() {
  const getVal = id => {
    const v = parseFloat(document.getElementById(id)?.value);
    return isNaN(v) || v <= 0 ? null : v;
  };

  let changed = false;

  // Major crypto
  const btc = getVal('mp-btc');
  if (btc) { setPrice('btcIdr', btc); setStatus('btc', 'manual'); changed = true; }

  const eth = getVal('mp-eth');
  if (eth) { setPrice('ethIdr', eth); setStatus('eth', 'manual'); changed = true; }

  const xrp = getVal('mp-xrp');
  if (xrp) { setPrice('xrpIdr', xrp); setStatus('xrp', 'manual'); changed = true; }

  // Gold
  const xau = getVal('mp-xau');
  if (xau) { setPrice('goldGramIdr', xau); setStatus('gold', 'manual'); changed = true; }

  // USD/IDR — update fxRates sekaligus
  const usd = getVal('mp-usd');
  if (usd) {
    setPrice('usdIdr', usd);
    S.fxRates.USD = usd;
    setStatus('fx', 'manual');
    changed = true;
  }

  // Stocks
  DATA.stocks.forEach(h => {
    const v = getVal(`mp-stk-${h.ticker}`);
    if (v != null) {
      const priceIdr = h.market === 'US' ? Math.round(v * S.usdIdr) : v;
      setStockPrice(h.ticker, priceIdr);
      changed = true;
    }
  });

  // Altcoins
  const MAJOR = new Set(['BTC','ETH','XRP']);
  const altCoins = [...new Set(DATA.crypto.map(a => (a.coin||'').toUpperCase()).filter(c => !MAJOR.has(c)))];
  altCoins.forEach(coin => {
    const v = getVal(`mp-alt-${coin}`);
    if (v != null) { setAltcoinPrice(coin, v); changed = true; }
  });

  closeManualPrice();

  if (changed) {
    DATA.lastRates = {
      usdIdr: S.usdIdr,
      fxRates: { ...S.fxRates },
      goldGramIdr: S.goldGramIdr,
      btcIdr: S.btcIdr,
      ethIdr: S.ethIdr,
      xrpIdr: S.xrpIdr,
      timestamp: Date.now()
    };
    saveDataToCloud();
    window.dispatchEvent(new CustomEvent('portfolio:update'));
  }
}

// ── Price Bar Inline Edit ─────────────────────────────────────────
// Klik item di price bar → langsung bisa edit inline
const _PBAR_CFG = {
  btc: { label: 'BTC (IDR)',    get: () => S.btcIdr,      set: v => { setPrice('btcIdr', v); setStatus('btc', 'manual'); } },
  eth: { label: 'ETH (IDR)',    get: () => S.ethIdr,      set: v => { setPrice('ethIdr', v); setStatus('eth', 'manual'); } },
  xrp: { label: 'XRP (IDR)',    get: () => S.xrpIdr,      set: v => { setPrice('xrpIdr', v); setStatus('xrp', 'manual'); } },
  xau: { label: 'XAU/g (IDR)', get: () => S.goldGramIdr, set: v => { setPrice('goldGramIdr', v); setStatus('gold', 'manual'); } },
  fx:  { label: 'USD/IDR',     get: () => S.usdIdr,      set: v => { setPrice('usdIdr', v); S.fxRates.USD = v; setStatus('fx', 'manual'); } },
};

window.pbarInlineEdit = function(key) {
  const cfg = _PBAR_CFG[key];
  if (!cfg) return;
  const el = document.getElementById('p-' + key);
  if (!el || el.querySelector('input')) return; // sudah ada input

  const cur = cfg.get();
  el.innerHTML = `<input
    id="pbar-inp-${key}"
    type="number"
    value="${cur}"
    style="width:90px;background:var(--bg3);border:1px solid #fbbf24;border-radius:4px;
           padding:1px 4px;color:var(--text);font-family:'JetBrains Mono',monospace;
           font-size:10px;font-weight:600;outline:none;"
    onblur="pbarInlineSave('${key}',this.value)"
    onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){window.dispatchEvent(new CustomEvent('portfolio:update'))}"
  >`;
  const inp = document.getElementById(`pbar-inp-${key}`);
  if (inp) { inp.focus(); inp.select(); }
};

window.pbarInlineSave = function(key, val) {
  const cfg = _PBAR_CFG[key];
  if (!cfg) return;
  const v = parseFloat(val);
  if (!isNaN(v) && v > 0) cfg.set(v);
  window.dispatchEvent(new CustomEvent('portfolio:update'));
};

// ── Export Portfolio Data ─────────────────────────────────────────
export function exportCSV() {
  const rows = [];
  const h = ['type','name','ticker_coin','amount_shares_grams',
             'cost_basis_idr','current_value_idr','platform_broker_bank',
             'market_currency','annual_yield_pct','date'];
  rows.push(h.join(','));

  DATA.crypto.forEach(a => {
    const val = Math.round(a.amount * (S.altcoinPrices?.[a.coin] || (a.coin==='BTC'?S.btcIdr:a.coin==='ETH'?S.ethIdr:S.xrpIdr) || 0));
    rows.push([
      'crypto', `"${a.name}"`, a.coin, a.amount,
      a.costBasisIdr || 0, val, a.platform, '', '', a.date || ''
    ].join(','));
  });

  DATA.gold.forEach(a => {
    const val = Math.round(a.grams * S.goldGramIdr);
    rows.push([
      'gold', `"${a.name}"`, 'XAU', a.grams,
      Math.round(a.grams * (a.costBasisPerGram || 0)), val, 'physical', '', '', a.date || ''
    ].join(','));
  });

  DATA.stocks.forEach(a => {
    const mul = stockMul(a);
    const price = S.stockPrices[a.ticker] ?? a.seedPrice;
    const val = Math.round(a.shares * mul * price);
    rows.push([
      'stocks', `"${a.name}"`, a.ticker, a.shares,
      Math.round(a.shares * mul * a.seedPrice), val,
      a.broker, a.market, a.annualYield || 0, a.date || ''
    ].join(','));
  });

  DATA.savings.forEach(a => {
    const idr = a.currency === 'IDR'
      ? (a.foreignAmt ?? a.idr ?? 0)
      : (a.foreignAmt ?? 0) * (S.fxRates[a.currency] ?? 1);
    rows.push([
      'savings', `"${a.name}"`, '', a.foreignAmt,
      Math.round(idr), Math.round(idr),
      a.bank, a.currency, a.annualYield || 0, a.date || ''
    ].join(','));
  });

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portfolio_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON() {
  const payload = {
    exported_at: new Date().toISOString(),
    rates: {
      usdIdr: S.usdIdr, btcIdr: S.btcIdr, ethIdr: S.ethIdr,
      xrpIdr: S.xrpIdr, goldGramIdr: S.goldGramIdr
    },
    portfolio: {
      crypto:  DATA.crypto,
      gold:    DATA.gold,
      stocks:  DATA.stocks,
      savings: DATA.savings,
    },
    history: DATA.history || []
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portfolio_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════
// TRANSACTION LOG
// ══════════════════════════════════════════

export function renderTxLog() {
  const el = document.getElementById('txLogList');
  if (!el) return;

  const log = DATA.txLog || [];
  if (log.length === 0) {
    el.innerHTML = `<div class="tx-empty">
      <div style="opacity:.3;margin-bottom:8px;display:flex;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" width="36" height="36"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
      <div>Belum ada aktivitas tercatat.</div>
      <div style="font-size:9px;margin-top:4px;opacity:.6">Setiap tambah, edit, atau hapus aset akan muncul di sini.</div>
    </div>`;
    return;
  }

  const ACTION_META = {
    ADD:    { label: 'TAMBAH', cls: 'tx-add' },
    EDIT:   { label: 'EDIT',   cls: 'tx-edit' },
    DELETE: { label: 'HAPUS',  cls: 'tx-del' },
  };

  el.innerHTML = log.map(tx => {
    const meta = ACTION_META[tx.action] || { label: tx.action, cls: '' };
    const dt = new Date(tx.ts);
    const dateStr = dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `<div class="tx-row">
      <div class="tx-left">
        <span class="tx-badge ${meta.cls}">${meta.label}</span>
        <div class="tx-info">
          <div class="tx-name">${tx.name}</div>
          <div class="tx-detail">${tx.detail || '–'}</div>
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-type-tag">${tx.type}</span>
        <div class="tx-time">${dateStr} · ${timeStr}</div>
      </div>
    </div>`;
  }).join('');
}

export function exportTxLog() {
  const log = DATA.txLog || [];
  if (log.length === 0) return;
  const rows = ['Timestamp,Action,Type,Name,Detail'];
  log.forEach(tx => {
    rows.push([tx.ts, tx.action, tx.type, `"${tx.name}"`, `"${tx.detail || ''}"`].join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `tx_log_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════
// REBALANCING CALCULATOR
// ══════════════════════════════════════════

export function renderRebalance() {
  const el = document.getElementById('rebalPanel');
  if (!el) return;

  const T = totals();
  if (T.t <= 0) {
    el.innerHTML = `<div class="tx-empty">Tambah aset terlebih dahulu untuk melihat rebalancing.</div>`;
    return;
  }

  // Load saved targets dari localStorage
  const saved = localStorage.getItem('portfolio-rebal-targets');
  if (saved) {
    try { Object.assign(S.rebalTargets, JSON.parse(saved)); } catch (_) {}
  }

  const classes = [
    { key: 'crypto',  label: 'Crypto',  val: T.c,  color: 'var(--crypto)' },
    { key: 'gold',    label: 'Gold',    val: T.g,  color: 'var(--gold)' },
    { key: 'stocks',  label: 'Stocks',  val: T.k,  color: 'var(--stocks)' },
    { key: 'savings', label: 'Savings', val: T.sv, color: 'var(--savings)' },
  ];

  const totalTarget = classes.reduce((s, c) => s + (S.rebalTargets[c.key] || 0), 0);
  const targetWarn = Math.abs(totalTarget - 100) > 0.5;

  // ── Asset class section ──
  const classRows = classes.map(c => {
    const curPct  = T.t > 0 ? c.val / T.t * 100 : 0;
    const tgtPct  = S.rebalTargets[c.key] || 0;
    const diff    = tgtPct - curPct;
    const diffIdr = diff / 100 * T.t;
    const action  = Math.abs(diffIdr) < 10000 ? 'ok' : diffIdr > 0 ? 'buy' : 'sell';
    const actionLabels = { ok: 'OK', buy: '↑ Buy', sell: '↓ Sell' };
    const actionCls = { ok: 'up', buy: 'up', sell: 'down' };
    return `<div class="rebal-row">
      <div class="rebal-label" style="color:${c.color}">${c.label}</div>
      <div class="rebal-cur">${curPct.toFixed(1)}%</div>
      <div class="rebal-target-wrap">
        <input class="rebal-input" type="number" min="0" max="100" step="1"
          value="${tgtPct}"
          onchange="updateRebalTarget('${c.key}', this.value)"
          oninput="updateRebalTarget('${c.key}', this.value)">
        <span style="font-size:9px;color:var(--muted)">%</span>
      </div>
      <div class="rebal-diff ${actionCls[action]}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%</div>
      <div class="rebal-action ${actionCls[action]}">
        <span class="rebal-badge-${action}">${actionLabels[action]}</span>
        ${action !== 'ok' ? `<span class="rebal-idr">${toDisp(Math.abs(diffIdr))}</span>` : ''}
      </div>
    </div>`;
  }).join('');

  // ── Ticker-level section ──
  // Gabungkan semua aset untuk target individual
  const allAssets = [
    ...DATA.crypto.map(a => ({
      key: a.id, ticker: a.coin, name: a.name || a.coin,
      val: a.amount * cryptoPrice(a), type: 'crypto'
    })),
    ...DATA.stocks.map(h => ({
      key: h.id, ticker: h.ticker, name: h.name || h.ticker,
      val: h.shares * stockMul(h) * (S.stockPrices[h.ticker] ?? h.seedPrice),
      type: 'stocks'
    })),
  ];

  // Group by ticker
  const tickerMap = {};
  allAssets.forEach(a => {
    if (!tickerMap[a.ticker]) tickerMap[a.ticker] = { ...a, val: 0 };
    tickerMap[a.ticker].val += a.val;
  });
  const tickerList = Object.values(tickerMap).sort((a, b) => b.val - a.val);

  const tickerRows = tickerList.map(a => {
    const curPct = T.t > 0 ? a.val / T.t * 100 : 0;
    const tgtPct = S.rebalTargets.tickers?.[a.ticker] ?? 0;
    const diff   = tgtPct - curPct;
    const diffIdr = diff / 100 * T.t;
    const action = Math.abs(diffIdr) < 10000 ? 'ok' : diffIdr > 0 ? 'buy' : 'sell';
    const actionCls = { ok: 'up', buy: 'up', sell: 'down' };
    return `<div class="rebal-row">
      <div class="rebal-label">${a.ticker} <span style="font-size:9px;color:var(--muted)">${a.name !== a.ticker ? a.name : ''}</span></div>
      <div class="rebal-cur">${curPct.toFixed(1)}%</div>
      <div class="rebal-target-wrap">
        <input class="rebal-input" type="number" min="0" max="100" step="0.5"
          value="${tgtPct || ''}" placeholder="–"
          onchange="updateRebalTickerTarget('${a.ticker}', this.value)"
          oninput="updateRebalTickerTarget('${a.ticker}', this.value)">
        <span style="font-size:9px;color:var(--muted)">%</span>
      </div>
      <div class="rebal-diff ${actionCls[action]}">${tgtPct > 0 ? (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%' : '–'}</div>
      <div class="rebal-action ${actionCls[action]}">
        ${tgtPct > 0 && action !== 'ok' ? `<span class="rebal-badge-${action}">${diffIdr > 0 ? '↑ Buy' : '↓ Sell'}</span><span class="rebal-idr">${toDisp(Math.abs(diffIdr))}</span>` : action === 'ok' && tgtPct > 0 ? '<span class="rebal-badge-ok">OK</span>' : '–'}
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="rebal-section">
      <div class="rebal-section-title">ALOKASI PER KELAS ASET</div>
      ${targetWarn ? `<div class="rebal-warn">Total target = ${totalTarget.toFixed(1)}% (harus 100%)</div>` : ''}
      <div class="rebal-header">
        <span>Kelas</span><span>Saat ini</span><span>Target</span><span>Selisih</span><span>Aksi</span>
      </div>
      ${classRows}
      <div class="rebal-total-row">
        <span>TOTAL</span>
        <span>${(T.t > 0 ? 100 : 0).toFixed(1)}%</span>
        <span class="${targetWarn ? 'down' : 'up'}">${totalTarget.toFixed(1)}%</span>
        <span></span><span></span>
      </div>
    </div>

    ${tickerList.length > 0 ? `
    <div class="rebal-section" style="margin-top:20px;">
      <div class="rebal-section-title">ALOKASI PER TICKER / KOIN <span style="font-weight:400;opacity:.5">(opsional)</span></div>
      <div class="rebal-header">
        <span>Ticker</span><span>Saat ini</span><span>Target</span><span>Selisih</span><span>Aksi</span>
      </div>
      ${tickerRows}
    </div>` : ''}

    <div style="margin-top:16px;font-size:9px;color:var(--muted);letter-spacing:.06em;">
      ⓘ Target tersimpan otomatis. Simulasi berdasarkan nilai portofolio saat ini: ${toDisp(T.t)}
    </div>`;
}

window.updateRebalTarget = function(key, val) {
  if (!S.rebalTargets) S.rebalTargets = { crypto:0, gold:0, stocks:0, savings:0, tickers:{} };
  S.rebalTargets[key] = parseFloat(val) || 0;
  localStorage.setItem('portfolio-rebal-targets', JSON.stringify(S.rebalTargets));
  renderRebalance();
};

window.updateRebalTickerTarget = function(ticker, val) {
  if (!S.rebalTargets.tickers) S.rebalTargets.tickers = {};
  S.rebalTargets.tickers[ticker] = parseFloat(val) || 0;
  localStorage.setItem('portfolio-rebal-targets', JSON.stringify(S.rebalTargets));
  // Debounce re-render agar tidak flicker saat mengetik
  clearTimeout(window._rebalDebounce);
  window._rebalDebounce = setTimeout(() => renderRebalance(), 600);
};

// ══════════════════════════════════════════
// EXPORT PDF (menggunakan jsPDF via CDN)
// ══════════════════════════════════════════

export async function exportPDF() {
  // Pastikan jsPDF sudah loaded
  if (typeof window.jspdf === 'undefined') {
    alert('PDF library sedang dimuat, coba lagi dalam 2 detik.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const T = totals();
  const M = computeMetrics(T);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210, PL = 16, PR = 16, CW = W - PL - PR;
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  let y = 0;

  // ── Helpers ──
  const hex2rgb = hex => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return [r,g,b];
  };
  const setColor = (hex, type = 'fill') => {
    const [r,g,b] = hex2rgb(hex.replace(/[^#a-fA-F0-9]/g,'').slice(0,7).padEnd(7,'0'));
    if (type === 'fill') doc.setFillColor(r,g,b);
    else doc.setTextColor(r,g,b);
  };
  const txt = (text, x, yy, size = 10, color = '#0f172a', align = 'left', bold = false) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    setColor(color, 'text');
    doc.text(String(text), x, yy, { align });
  };
  const line = (yy, col = '#e2e8f0') => {
    setColor(col, 'fill'); doc.setFillColor(...hex2rgb(col));
    doc.setDrawColor(...hex2rgb(col));
    doc.line(PL, yy, W - PR, yy);
  };

  // ── HEADER ──
  setColor('#0f172a','fill'); doc.setFillColor(15,23,42);
  doc.rect(0, 0, W, 28, 'F');
  txt('PORTFOLIO.SYS', PL, 11, 16, '#ffffff', 'left', true);
  txt('Personal Net Worth Dashboard', PL, 17, 8, '#94a3b8');
  txt(`Laporan per ${dateStr}`, W - PR, 11, 9, '#94a3b8', 'right');
  y = 36;

  // ── KPI STRIP ──
  const kpis = [
    { label: 'Total Net Worth', val: toDisp(T.t), color: '#8b5cf6' },
    { label: 'Crypto', val: toDisp(T.c), color: '#8b5cf6' },
    { label: 'Gold', val: toDisp(T.g), color: '#f5c518' },
    { label: 'Stocks', val: toDisp(T.k), color: '#22d3ee' },
    { label: 'Savings', val: toDisp(T.sv), color: '#f472b6' },
  ];
  const kw = CW / kpis.length;
  kpis.forEach((k, i) => {
    const kx = PL + i * kw;
    setColor('#f8fafc','fill'); doc.setFillColor(248,250,252);
    doc.roundedRect(kx, y, kw - 2, 18, 2, 2, 'F');
    txt(k.label, kx + 4, y + 6, 7, '#64748b');
    txt(k.val, kx + 4, y + 13, 9, k.color, 'left', true);
  });

  if (M.total.pnl != null) {
    const pnlColor = M.total.pnl >= 0 ? '#16a34a' : '#dc2626';
    const pnlStr = `P&L: ${M.total.pnl >= 0 ? '+' : ''}${toDisp(Math.abs(M.total.pnl))} (${M.total.ret?.toFixed(1)}%)`;
    txt(pnlStr, W - PR, y + 6, 8, pnlColor, 'right', true);
  }
  y += 24;

  // ── ASSET ALLOCATION TABLE ──
  txt('ALOKASI ASET', PL, y, 9, '#475569', 'left', true);
  y += 5; line(y); y += 4;

  const allocRows = [
    ['Crypto',  toDisp(T.c),  T.t > 0 ? (T.c/T.t*100).toFixed(1)+'%' : '0%', M.crypto.pnl != null ? (M.crypto.pnl>=0?'+':'')+toDisp(Math.abs(M.crypto.pnl)) : '–', M.crypto.ret != null ? M.crypto.ret.toFixed(1)+'%' : '–'],
    ['Gold',    toDisp(T.g),  T.t > 0 ? (T.g/T.t*100).toFixed(1)+'%' : '0%', M.gold.pnl != null ? (M.gold.pnl>=0?'+':'')+toDisp(Math.abs(M.gold.pnl)) : '–', M.gold.ret != null ? M.gold.ret.toFixed(1)+'%' : '–'],
    ['Stocks',  toDisp(T.k),  T.t > 0 ? (T.k/T.t*100).toFixed(1)+'%' : '0%', M.stocks.pnl != null ? (M.stocks.pnl>=0?'+':'')+toDisp(Math.abs(M.stocks.pnl)) : '–', M.stocks.ret != null ? M.stocks.ret.toFixed(1)+'%' : '–'],
    ['Savings', toDisp(T.sv), T.t > 0 ? (T.sv/T.t*100).toFixed(1)+'%' : '0%', '–', '–'],
  ];
  const cols = [40, 45, 25, 45, 25];
  const headers = ['Kelas Aset', 'Nilai', 'Alokasi', 'P&L', 'Return'];
  headers.forEach((h, i) => {
    txt(h, PL + cols.slice(0,i).reduce((a,b)=>a+b,0), y, 8, '#64748b', 'left', true);
  });
  y += 4; line(y, '#e2e8f0'); y += 4;
  allocRows.forEach(row => {
    row.forEach((cell, i) => {
      const cx = PL + cols.slice(0,i).reduce((a,b)=>a+b,0);
      const color = i >= 3 ? (cell.startsWith('+') ? '#16a34a' : cell.startsWith('–') ? '#94a3b8' : '#dc2626') : '#0f172a';
      txt(cell, cx, y, 8, color);
    });
    y += 6;
  });
  y += 4; line(y); y += 8;

  // ── HOLDINGS PER CATEGORY ──
  const sections = [
    { title: 'CRYPTO HOLDINGS', items: DATA.crypto, render: (a) => [`${a.name} (${a.platform||'–'})`, `${a.amount} ${a.coin}`, toDisp(a.amount * cryptoPrice(a)), a.costBasisIdr > 0 ? toDisp(a.costBasisIdr) : '–', a.date || '–'] },
    { title: 'GOLD HOLDINGS', items: DATA.gold, render: (h) => [h.name, `${h.grams}g`, toDisp(h.grams * S.goldGramIdr), toDisp(h.grams*(h.costBasisPerGram||0)), h.date||'–'] },
    { title: 'STOCK HOLDINGS', items: DATA.stocks, render: (h) => [`${h.name} (${h.broker||'–'})`, `${h.shares} lot`, toDisp(h.shares*stockMul(h)*(S.stockPrices[h.ticker]??h.seedPrice)), toDisp(h.shares*stockMul(h)*h.seedPrice), h.date||'–'] },
    { title: 'SAVINGS', items: DATA.savings, render: (a) => [a.name, `${a.currency} ${(a.foreignAmt||0).toLocaleString('en-US')}`, toDisp(savingsIdr(a)), '–', a.date||'–'] },
  ];
  const holdCols = [55, 30, 40, 40, 25];
  const holdHeaders = ['Nama', 'Qty', 'Nilai', 'Modal', 'Tanggal'];

  for (const sec of sections) {
    if (!sec.items || sec.items.length === 0) continue;
    if (y > 250) { doc.addPage(); y = 20; }

    txt(sec.title, PL, y, 9, '#475569', 'left', true);
    y += 5; line(y); y += 4;

    holdHeaders.forEach((h, i) => {
      txt(h, PL + holdCols.slice(0,i).reduce((a,b)=>a+b,0), y, 7.5, '#64748b', 'left', true);
    });
    y += 4; line(y, '#e2e8f0'); y += 4;

    sec.items.forEach((item, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const cells = sec.render(item);
      if (idx % 2 === 0) {
        setColor('#f8fafc','fill'); doc.setFillColor(248,250,252);
        doc.rect(PL, y - 3, CW, 6, 'F');
      }
      cells.forEach((cell, i) => {
        txt(String(cell).slice(0, 30), PL + holdCols.slice(0,i).reduce((a,b)=>a+b,0), y, 7.5, '#1e293b');
      });
      y += 6;
    });
    y += 6;
  }

  // ── FOOTER ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setColor('#0f172a','fill'); doc.setFillColor(15,23,42);
    doc.rect(0, 290, W, 10, 'F');
    txt(`PORTFOLIO.SYS — Digenerate ${now.toLocaleString('id-ID')}`, PL, 296, 7, '#94a3b8');
    txt(`Halaman ${i} dari ${pageCount}`, W - PR, 296, 7, '#94a3b8', 'right');
  }

  doc.save(`portfolio_report_${now.toISOString().split('T')[0]}.pdf`);
}

console.log('[UI] UI module loaded');
