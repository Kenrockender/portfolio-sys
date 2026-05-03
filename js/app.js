/**
 * ══════════════════════════════════════════
 * APP.JS - Main Entry Point
 * ══════════════════════════════════════════
 * Orchestrates all modules and initializes the application
 */

// ── Import All Modules ────────────────────────────────────────────
import { S, DATA, t, setHistoryData, uid, setDATA} from './state.js';
import { I18N, PLAT_COLORS, FX_PAIRS, POPULAR_STOCKS, AC_ACCENT, RANGE_DAYS } from './config.js';
import { toDisp, dispPrice, formatChartY, totals, computeMetrics, assetMetrics, computePortfolioAnalytics, filterAssets } from './storage.js';
import { syncAllPrices, syncStocksOnly, fetchAssetPriceHistory } from './api.js';
import { initCloud, saveDataToCloud, loadDataFromCloud, saveDailySnapshot, isAuthInProgress } from '../firebase/firebase-config.js';
import {
  renderAll, renderAnalytics, setTab, setCurrency, setHistoryRange,
  setBenchTab, setBenchRange, setLang, toggleTheme, applyTheme, setTheme,
  openThemePicker, closeThemePicker,
  handleSearch, handleFilter, clearFilters, openModal, closeModal,
  saveModal, del, confirmDel, cancelDel, ptag, ctag, applyI18n, setTaxMode,
  exportCSV, exportJSON, exportPDF, editGoalTarget, saveGoalTarget,
  openManualPrice, closeManualPrice, saveManualPrice,
  renderTxLog, exportTxLog, renderRebalance,
} from './ui.js';
import { renderCharts, renderBenchChart, renderHistoryLineChart, cryptoSlide, stkSlide, savSlide, cryptoAccumRange, stkAccumRange, savAccumRange, setStkPieTab, setSavPieTab, destroyAllCharts } from './charts.js';

// ── Asset Chart Popup State ───────────────────────────────────────
let _acChart = null;
let _acId = null;
let _acType = null;
let _acRange = '3M';

const _LIGHT_THEMES = new Set(['light', 'solarized']);
function _isLight() { return _LIGHT_THEMES.has(S.theme); }
function tooltipBg()     { return _isLight() ? '#ffffff'              : '#12122a'; }
function tooltipBorder() { return _isLight() ? 'rgba(0,0,0,.12)'      : 'rgba(255,255,255,.1)'; }
function tooltipTitle()  { return _isLight() ? '#0f172a'              : '#e2e8f0'; }
function tooltipBody()   { return _isLight() ? '#475569'              : '#94a3b8'; }
function gridColor()     { return _isLight() ? 'rgba(0,0,0,.06)'      : 'rgba(255,255,255,.04)'; }
function tickColor()     { return _isLight() ? '#64748b'              : '#475569'; }
function borderColor()   { return _isLight() ? 'rgba(0,0,0,.08)'      : 'rgba(255,255,255,.06)'; }

// ── Asset Chart Popup Functions ───────────────────────────────────
function openAssetChart(id, type) {
  _acId = id; _acType = type; _acRange = '3M';
  const overlay = document.getElementById('acOverlay');
  const box = document.getElementById('acBox');

  const accent = AC_ACCENT[type] || AC_ACCENT.crypto;
  box.style.setProperty('--ac-accent', accent.hex);
  box.style.setProperty('--ac-accent-rgb', accent.rgb);

  const item = _acFindItem(id, type);
  if (!item) { console.warn('openAssetChart: item not found', id, type); return; }

  // Populate header
  const iconEl = document.getElementById('acIcon');
  const nameEl = document.getElementById('acName');
  const subEl = document.getElementById('acSub');

  iconEl.className = 'ac-icon ' + _acIconClass(type, item);
  iconEl.innerHTML = _acIconLabel(type, item);
  nameEl.textContent = _acDisplayName(type, item);
  subEl.innerHTML = _acSubLine(type, item);

  // Populate KPIs
  const m = assetMetrics(type, item);
  document.getElementById('acVal').textContent = toDisp(m.val ?? 0);
  document.getElementById('acCost').textContent = m.cost > 0 ? toDisp(m.cost) : '–';

  const pnlEl = document.getElementById('acPnl');
  const retEl = document.getElementById('acRet');
  if (m.pnl != null) {
    pnlEl.textContent = (m.pnl >= 0 ? '+' : '') + toDisp(Math.abs(m.pnl));
    pnlEl.className = 'ac-kpi-val ' + (m.pnl >= 0 ? 'up' : 'down');
    retEl.textContent = (m.ret >= 0 ? '+' : '') + m.ret.toFixed(2) + '%';
    retEl.className = 'ac-kpi-val ' + (m.ret >= 0 ? 'up' : 'down');
  } else {
    pnlEl.textContent = '–'; pnlEl.className = 'ac-kpi-val muted';
    retEl.textContent = '–'; retEl.className = 'ac-kpi-val muted';
  }

  const noteEl = document.getElementById('acNote');
  noteEl.textContent = S.historyData.length >= 2 ? '' : 'Kurva estimasi — belum ada data historis';

  overlay.classList.add('open');
  requestAnimationFrame(() => requestAnimationFrame(() => _acRenderChart(item, type, m)));
}

function closeAssetChart() {
  document.getElementById('acOverlay').classList.remove('open');
  if (_acChart) { _acChart.destroy(); _acChart = null; }
}

function acSetRange(r) {
  _acRange = r;
  document.querySelectorAll('.ac-range-btn').forEach(b => {
    b.classList.toggle('active', b.textContent === ({ '1M': '1B', '3M': '3B', '6M': '6B', '1Y': '1T' }[r] || r));
  });
  const item = _acFindItem(_acId, _acType);
  if (item) {
    const m = assetMetrics(_acType, item);
    requestAnimationFrame(() => _acRenderChart(item, _acType, m));
  }
}

function acEdit() { closeAssetChart(); openModal(_acType, _acId); }
function acDel() { closeAssetChart(); del(_acId); }

// ── Asset Chart Helpers ───────────────────────────────────────────
function _acFindItem(id, type) {
  const map = { crypto: DATA.crypto, gold: DATA.gold, stocks: DATA.stocks, savings: DATA.savings };
  return (map[type] || []).find(x => x.id === id) || null;
}

function _acIconClass(type, item) {
  if (type === 'crypto') return item.coin === 'BTC' ? 'icon-btc' : item.coin === 'ETH' ? 'icon-eth' : item.coin === 'XRP' ? 'icon-xrp' : 'icon-alt';
  if (type === 'gold') return 'icon-gold';
  if (type === 'stocks') return 'icon-stk';
  return 'icon-save';
}

function _acIconLabel(type, item) {
  if (type === 'crypto') return item.coin;
  if (type === 'gold') return 'Au';
  if (type === 'stocks') return `<span style="font-size:8px;font-weight:800">${item.ticker}</span>`;
  return S.currency === 'USD' ? '$' : 'Rp';
}

function _acDisplayName(type, item) {
  if (type === 'crypto') return item.name || item.coin;
  if (type === 'gold') return item.name || 'Gold';
  if (type === 'stocks') return item.name || item.ticker;
  return item.name || 'Savings';
}

function _acSubLine(type, item) {
  const tags = [];
  if (type === 'crypto') tags.push(ptag(item.platform || 'other'), `${item.amount} ${item.coin}`);
  if (type === 'gold') tags.push(ptag('physical'), `${item.grams}g`);
  if (type === 'stocks') tags.push(ptag(item.broker || 'other'), item.market === 'IDX' ? `${item.shares} lot` : `${item.shares} shares`);
  if (type === 'savings') tags.push(ptag(item.bank || 'other'), ctag(item.currency || 'IDR'));
  if (item.date) tags.push(`<span style="color:var(--muted)">${item.date}</span>`);
  return tags.join(' ');
}

async function _acRenderChart(item, type, m) {
  const accent = AC_ACCENT[type] || AC_ACCENT.crypto;
  _acShowLoader();

  const pts = await fetchAssetPriceHistory(item, type);

  if (pts && pts.length >= 4 && type !== 'savings') {
    _acDrawChart(pts, accent, false);
  } else {
    const synth = _acSyntheticPts(item, type, m);
    _acDrawChart(synth, accent, true);
  }
}

function _acShowLoader() {
  const canvas = document.getElementById('acChart');
  if (!canvas) return;
  if (_acChart) { _acChart.destroy(); _acChart = null; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const noteEl = document.getElementById('acNote');
  if (noteEl) noteEl.textContent = '⏳ Memuat data historis…';
}

function _acDrawChart(pts, accent, isSynthetic) {
  const canvas = document.getElementById('acChart');
  if (!canvas) return;
  if (_acChart) { _acChart.destroy(); _acChart = null; }

  const months = (RANGE_DAYS[_acRange] || 90) / 30;
  const labels = pts.map(p => _acFmtTs(p.ts, months));
  const values = pts.map(p => p.value);

  const isDown = values.length >= 2 && values[values.length - 1] < values[0];
  const lineCol = isDown ? '#fb7185' : accent.hex;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 190);

  if (isDown) {
    grad.addColorStop(0, 'rgba(251,113,133,.28)');
    grad.addColorStop(1, 'rgba(251,113,133,0)');
  } else {
    grad.addColorStop(0, `rgba(${accent.rgb},.32)`);
    grad.addColorStop(1, `rgba(${accent.rgb},0)`);
  }

  _acChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Nilai',
        data: values,
        borderColor: lineCol,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        backgroundColor: grad,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg(), borderColor: tooltipBorder(), borderWidth: 1,
          titleColor: tooltipTitle(), bodyColor: tooltipBody(),
          titleFont: { family: 'JetBrains Mono', size: 11 },
          bodyFont: { family: 'JetBrains Mono', size: 10 }, padding: 10
        }
      },
      scales: {
        x: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 8 }, border: { color: borderColor() } },
        y: { grid: { color: gridColor() }, ticks: { color: tickColor(), font: { family: 'JetBrains Mono', size: 9 }, callback: v => formatChartY(v) }, border: { color: borderColor() } }
      },
      animation: { duration: 700 }
    }
  });

  const noteEl = document.getElementById('acNote');
  if (noteEl) noteEl.textContent = isSynthetic ? 'Estimasi — data historis tidak tersedia' : '';
}

function _acFmtTs(ts, months) {
  const d = new Date(ts);
  return months <= 1
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function _acSyntheticPts(item, type, m) {
  const days = RANGE_DAYS[_acRange] || 90;
  const nPts = Math.min(days, Math.max(20, days / 3 | 0));
  const cost = m.cost > 0 ? m.cost : Math.round(m.val * 0.90);
  const current = m.val || cost;
  const vol = { crypto: 0.038, stocks: 0.022, gold: 0.014, savings: 0.001 }[type] || 0.018;

  let seed = 0;
  for (let i = 0; i < item.id.length; i++) seed = (seed * 31 + item.id.charCodeAt(i)) & 0x7fffffff;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 4294967296; };
  const randn = () => { const u = rand() + 1e-10, v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  const now = Date.now();
  const start = now - days * 86400000;

  return Array.from({ length: nPts }, (_, i) => {
    const t = nPts > 1 ? i / (nPts - 1) : 1;
    const ts = start + t * (now - start);
    const trend = cost + (current - cost) * t;
    const noise = trend * vol * randn();
    return { ts, price: 0, value: Math.max(1, Math.round(trend + noise)) };
  }).map((p, i, a) => {
    if (i === 0) p.value = cost;
    if (i === a.length - 1) p.value = current;
    return p;
  });
}

// ── Import Modal Functions ─────────────────────────────────────────
// [Fix 2] openImport — only ever called by the IMPORT button click.
// Guards against being triggered during the auth flow (isAuthInProgress).
function openImport() {
  // [Fix 1] Never auto-open during auth/data-load flow
  if (isAuthInProgress) {
    console.log('[IMPORT] Suppressed: auth in progress');
    return;
  }
  const overlay = document.getElementById('imp-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  // Allow pointer events while modal is open
  overlay.style.pointerEvents = 'auto';
  // Trigger CSS transition if the overlay uses opacity-based animation
  requestAnimationFrame(() => overlay.classList.add('open'));
}

// [Fix 2] closeImport — called by the X button and any cancel/backdrop click.
// Fully resets the modal so re-opening it is always a clean slate.
function closeImport() {
  const overlay = document.getElementById('imp-overlay');
  if (!overlay) return;

  // Remove open class (triggers CSS fade-out if defined)
  overlay.classList.remove('open');

  // [Fix 3] Immediately kill pointer-events so the fading overlay
  // cannot intercept clicks on the dashboard behind it.
  overlay.style.pointerEvents = 'none';

  // Wait for the CSS transition (match your transition duration; default 300ms)
  const TRANSITION_MS = 300;
  setTimeout(() => {
    overlay.style.display = 'none';

    // ── Reset all modal state so re-open is a clean slate ──
    // Clear any file input(s) inside the modal
    overlay.querySelectorAll('input[type="file"]').forEach(inp => { inp.value = ''; });

    // Clear any preview / result areas
    const preview = overlay.querySelector('#imp-preview, .imp-preview, [data-imp-preview]');
    if (preview) preview.innerHTML = '';

    const result = overlay.querySelector('#imp-result, .imp-result, [data-imp-result]');
    if (result) result.innerHTML = '';

    // Reset any status / error messages
    const status = overlay.querySelector('#imp-status, .imp-status, [data-imp-status]');
    if (status) { status.textContent = ''; status.className = status.className.replace(/\berr\b/, ''); }

    // Re-enable any submit buttons that may have been disabled during processing
    overlay.querySelectorAll('button[type="submit"], .imp-submit-btn').forEach(btn => {
      btn.disabled = false;
    });
  }, TRANSITION_MS);
}

// ── Global Render All Function ────────────────────────────────────
window._renderAll = function() {
  const T = totals();
  window.__portfolioTotals = T;
  renderAll(T);
  renderCharts(T);
  renderBenchChart(T);
  renderHistoryLineChart(T);
  // Update app badge (Android/desktop only)
  try {
    if ('setAppBadge' in navigator && T.total > 0) {
      navigator.setAppBadge(Math.round(T.total / 1_000_000));
    }
  } catch (_) {}
};

// ── portfolio:update event — used by api.js and firebase-config.js ─
// Replaces direct window._renderAll checks in those modules so they
// don't need to know about the render pipeline.
window.addEventListener('portfolio:update', () => {
  if (typeof window._renderAll === 'function') window._renderAll();
});

// ── [Fix 5] window.App — Public API Namespace ────────────────────
window.App = {
  setCurrency, setLang, toggleTheme,
  setTab, setHistoryRange, setBenchTab, setBenchRange, setTaxMode,
  syncAllPrices,
  openModal, closeModal, saveModal,
  del, confirmDel, cancelDel,
  handleSearch, handleFilter, clearFilters,
  openAssetChart, closeAssetChart, acSetRange, acEdit, acDel,
  // [Fix 2] Import modal — registered here so HTML onclick="closeImport()" works
  openImport, closeImport,
  cryptoSlide, stkSlide, savSlide,
  cryptoAccumRange, stkAccumRange, savAccumRange,
  setStkPieTab, setSavPieTab,
  renderAll: window._renderAll,
  exportCSV, exportJSON,
  editGoalTarget, saveGoalTarget,
  openManualPrice, closeManualPrice, saveManualPrice,
  setTheme, openThemePicker, closeThemePicker,
  exportPDF, renderTxLog, exportTxLog, renderRebalance,
};
Object.assign(window, window.App);

// ── Internal / Debug Utilities ────────────────────────────────────
window._setHistoryRange    = setHistoryRange;
window._destroyAllCharts   = destroyAllCharts;
window._getDATA          = () => DATA;
window._setDATA          = setDATA;
window._getS             = () => S;
window._uid              = uid;
window._saveCloud        = saveDataToCloud;
window._POPULAR_STOCKS   = POPULAR_STOCKS;

// ── Initialize Application ─────────────────────────────────────────
document.getElementById('footerDate').textContent = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });

// Initialize historyData from DATA.history
if (DATA.history && DATA.history.length > 0) {
  setHistoryData([...DATA.history]);
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[APP] Initializing...');

  // Apply theme
  const savedTheme = localStorage.getItem('portfolio-theme') || 'dark';
  S.theme = savedTheme;
  applyTheme();

  // Apply language
  const savedLang = localStorage.getItem('portfolio-lang') || 'id';
  S.lang = savedLang;
  document.getElementById('btnLangID')?.classList.toggle('active', savedLang === 'id');
  document.getElementById('btnLangEN')?.classList.toggle('active', savedLang === 'en');
  applyI18n();

  // Load goal target sekali di awal — bukan setiap render
  const savedGoal = localStorage.getItem('portfolio-goal');
  if (savedGoal && !isNaN(savedGoal)) S.goalTarget = parseInt(savedGoal);

  // Init crypto nav active state
  document.getElementById('cryptoNavAlloc')?.classList.add('crypto-active');

  // Auto sync
  console.log('[APP] Auto Sync starting...');
  try {
    await syncAllPrices();
    console.log('[APP] Auto Sync completed');
  } catch (e) {
    console.error('[APP] Auto Sync failed:', e);
  }

  // Render
  try {
    window._renderAll();
  } catch (e) {
    console.error('[APP] renderAll crashed:', e);
    const _cs1 = document.getElementById('cloudStatusText') || document.getElementById('cloudStatus'); if(_cs1) _cs1.textContent = 'renderAll crash: ' + e.message;
    document.getElementById('cloudStatus').classList.add('err');
  }

  // [Fix 2] Wire the X / close button inside the import overlay to closeImport().
  // This is a safety net in case the HTML uses onclick="closeImport()" — which now
  // works because closeImport is on window via Object.assign above.
  // If your X button uses a different selector, adjust here.
  document.querySelectorAll('[data-close-import], #imp-close, .imp-close-btn').forEach(btn => {
    btn.addEventListener('click', closeImport);
  });

  // [Fix 2] Also close on backdrop click (clicking outside the modal box)
  const impOverlay = document.getElementById('imp-overlay');
  if (impOverlay) {
    impOverlay.addEventListener('click', (e) => {
      // Only close if the click landed directly on the overlay (backdrop),
      // not on a child element inside the modal box.
      if (e.target === impOverlay) closeImport();
    });
  }

  const impOverlay = document.getElementById('imp-overlay');
  if (impOverlay) impOverlay.style.display = 'none';
  
});

// Init Cloud - wait for Firebase SDK to be ready
function initCloudSafe() {
  if (typeof window.firebase !== 'undefined' && window.firebase.initializeApp) {
    try {
      initCloud();
    } catch (e) {
      console.error('[APP] initCloud crashed:', e);
      const _cs2 = document.getElementById('cloudStatusText') || document.getElementById('cloudStatus'); if(_cs2) _cs2.textContent = 'initCloud crash: ' + e.message;
      document.getElementById('cloudStatus').classList.add('err');
    }
  } else {
    // Wait for firebase-ready event
    window.addEventListener('firebase-ready', () => {
      try {
        initCloud();
      } catch (e) {
        console.error('[APP] initCloud crashed:', e);
        const _cs2 = document.getElementById('cloudStatusText') || document.getElementById('cloudStatus'); if(_cs2) _cs2.textContent = 'initCloud crash: ' + e.message;
        document.getElementById('cloudStatus').classList.add('err');
      }
    }, { once: true });
  }
}
initCloudSafe();

// Timeout check
setTimeout(() => {
  const txt = document.getElementById('cloudStatus').textContent;
  if (txt === 'CONNECTING...' || txt.includes('CONNECTING')) {
    console.warn('[APP] Still CONNECTING after 10s');
    (document.getElementById('cloudStatusText') || document.getElementById('cloudStatus')).textContent = 'TIMEOUT';
    document.getElementById('cloudStatus').classList.add('err');
  }
}, 10000);

// Auto sync every 5 minutes
setInterval(() => {
  if (document.visibilityState === 'visible' && !S.isSyncing) {
    syncAllPrices();
  }
}, 5 * 60 * 1000);

console.log('[APP] Application initialized');
window.__syncAllPrices = syncAllPrices;
