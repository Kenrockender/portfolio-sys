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

// ── State ─────────────────────────────────────────────────────────
let _plan = 'free';

// ── PRO FEATURES ──────────────────────────────────────────────────
export const PRO_FEATURES = {
  export_pdf: { label: 'Export PDF Laporan',     icon: '📄' },
  ai:         { label: 'AI Insights (Gemini)',   icon: '✨' },
  rebalance:  { label: 'Rebalancing Calculator', icon: '⚖️' },
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
  showUpgradeModal(feat?.label || featureKey, feat?.icon || '⭐');
  return false;
}

// ── Upgrade Modal ─────────────────────────────────────────────────
export function showUpgradeModal(featureName = 'Fitur Pro', featureIcon = '⭐') {
  const overlay = document.getElementById('upgradeOverlay');
  if (!overlay) return;

  const featEl = document.getElementById('upgradeFeatureName');
  if (featEl) featEl.innerHTML = `${featureIcon} ${featureName}`;

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
      badge.textContent  = '⚡ PRO';
      badge.style.cssText = 'font-size:9px;padding:3px 8px;border-radius:5px;font-weight:800;letter-spacing:.1em;background:rgba(139,92,246,.2);color:#a78bfa;border:1px solid rgba(139,92,246,.4);';
    } else {
      badge.textContent   = 'FREE';
      badge.style.cssText = 'font-size:9px;padding:3px 8px;border-radius:5px;font-weight:800;letter-spacing:.1em;background:rgba(100,116,139,.12);color:#94a3b8;border:1px solid rgba(100,116,139,.2);cursor:pointer;';
      badge.onclick = () => showUpgradeModal('Pro Lifetime', '⚡');
    }
  }

  // Grey-out PDF button
  const pdfBtns = document.querySelectorAll('[onclick*="exportPDF"]');
  pdfBtns.forEach(btn => {
    if (_plan !== 'pro') {
      btn.style.opacity = '0.5';
      btn.title = '🔒 Fitur Pro — Upgrade untuk unlock';
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

  // Grey-out AI button
  const aiBtn = document.getElementById('aiBtn');
  if (aiBtn) {
    if (_plan !== 'pro') {
      aiBtn.style.opacity = '0.5';
      aiBtn.title = '🔒 Fitur Pro — Upgrade untuk unlock';
    } else {
      aiBtn.style.opacity = '1';
    }
  }
}

// ── Expose globally ───────────────────────────────────────────────
window.isPro             = isPro;
window.requiresPro       = requiresPro;
window.showUpgradeModal  = showUpgradeModal;
window.closeUpgradeModal = closeUpgradeModal;
window.getCurrentPlan    = getCurrentPlan;

console.log('[PLANS] Plan module loaded');
