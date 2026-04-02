/**
 * ══════════════════════════════════════════
 * PLANS.JS — Plan & Feature Gating
 * ══════════════════════════════════════════
 * Mengelola plan user (free / pro) dan mengunci fitur premium.
 *
 * Firestore path: users/{uid}/subscription/plan
 * Fields:
 *   plan        : "free" | "pro"
 *   upgradedAt  : ISO string (tanggal upgrade)
 *   expiresAt   : ISO string | null (null = lifetime)
 *   note        : string (mis. "Trakteer - manual approval")
 *
 * FITUR YANG DIKUNCI (free user tidak bisa akses):
 *   - export_pdf  : Export PDF Laporan
 *   - ai          : AI Insights (Gemini)
 *   - rebalance   : Rebalancing Calculator
 */

// ── SVG Icons ─────────────────────────────────────────────────────
const _SVG = {
  bolt:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="display:inline-block;vertical-align:middle;margin-right:3px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  pdf:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  ai:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  rebalance:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="display:inline-block;vertical-align:middle;margin-right:4px"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  lock:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="display:inline-block;vertical-align:middle;margin-right:3px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  star:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="display:inline-block;vertical-align:middle;margin-right:4px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
};

// ── State ─────────────────────────────────────────────────────────
let _plan = 'free';

// ── PRO FEATURES ──────────────────────────────────────────────────
export const PRO_FEATURES = {
  export_pdf: { label: 'Export PDF Laporan',     icon: _SVG.pdf      },
  rebalance:  { label: 'Rebalancing Calculator', icon: _SVG.rebalance},
};

// ── Getters ───────────────────────────────────────────────────────
export function getCurrentPlan() { return _plan; }
export function isPro()          { return _plan === 'pro'; }

export function setPlan(plan) {
  _plan = (plan === 'pro') ? 'pro' : 'free';
  _updatePlanUI();
  console.log(`[PLANS] Plan set to: ${_plan}`);
}

// ── Gate Check ────────────────────────────────────────────────────
/**
 * Cek apakah user boleh akses fitur ini.
 * Kalau free user coba akses fitur pro → tampilkan upgrade modal → return false.
 * @param {string} featureKey
 * @returns {boolean}
 */
export function requiresPro(featureKey) {
  if (isPro()) return true;
  const feat = PRO_FEATURES[featureKey];
  showUpgradeModal(feat?.label || featureKey, feat?.icon || _SVG.star);
  return false;
}

// ── Upgrade Modal ─────────────────────────────────────────────────
export function showUpgradeModal(featureName = 'Fitur Pro', featureIcon = '') {
  const overlay = document.getElementById('upgradeOverlay');
  if (!overlay) return;

  const featEl = document.getElementById('upgradeFeatureName');
  if (featEl) featEl.innerHTML = `${featureIcon}${featureName}`;

  overlay.style.display = 'flex';
  requestAnimationFrame(() => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
  });
}

export function closeUpgradeModal() {
  const overlay = document.getElementById('upgradeOverlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(() => { overlay.style.display = 'none'; }, 250);
}

// ── Update UI ─────────────────────────────────────────────────────
function _updatePlanUI() {
  // Update plan badge di topbar
  const badge = document.getElementById('planBadge');
  if (badge) {
    if (_plan === 'pro') {
      badge.innerHTML = `${_SVG.bolt}PRO`;
      badge.style.cssText = 'font-size:9px;padding:3px 8px;border-radius:5px;font-weight:800;letter-spacing:.1em;background:rgba(139,92,246,.2);color:#a78bfa;border:1px solid rgba(139,92,246,.4);display:inline-flex;align-items:center;cursor:default;';
      badge.onclick = null;
    } else {
      badge.textContent   = 'FREE';
      badge.style.cssText = 'font-size:9px;padding:3px 8px;border-radius:5px;font-weight:800;letter-spacing:.1em;background:rgba(100,116,139,.12);color:#94a3b8;border:1px solid rgba(100,116,139,.2);cursor:pointer;';
      badge.onclick = () => showUpgradeModal('Pro Lifetime', _SVG.bolt);
    }
  }

  // Grey-out PDF button
  const pdfBtns = document.querySelectorAll('[onclick*="exportPDF"]');
  pdfBtns.forEach(btn => {
    if (_plan !== 'pro') {
      btn.style.opacity = '0.5';
      btn.title = 'Fitur Pro — Upgrade untuk unlock';
    } else {
      btn.style.opacity = '1';
      btn.title = 'Export laporan PDF';
    }
  });

  // Grey-out rebalance tab
  ['tabRebalance', 'mtabRebalance'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.opacity = _plan === 'pro' ? '1' : '0.5';
  });
}

// ── Expose globally ───────────────────────────────────────────────
window.isPro             = isPro;
window.requiresPro       = requiresPro;
window.showUpgradeModal  = showUpgradeModal;
window.closeUpgradeModal = closeUpgradeModal;
window.getCurrentPlan    = getCurrentPlan;

console.log('[PLANS] Plan module loaded');
