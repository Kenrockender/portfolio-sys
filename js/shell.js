/* ============================================================
   portfolio.sys — app shell behaviours
   - Modal manager (open / close, ESC, backdrop)
   - Defensive login button binding
   - Signout flow with confirm modal
   - "Tambah Aset" custom asset modal hook
   - SW update prompt

   Classic script, no imports.
   ============================================================ */

(function () {
  'use strict';

  /* ---- MODAL MANAGER ---- */

  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.setAttribute('data-open', 'true');
    // focus first focusable inside
    var firstField = m.querySelector('input, button:not(.modal__close), [tabindex]');
    setTimeout(function () { if (firstField) firstField.focus(); }, 60);
  }
  function closeModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.removeAttribute('data-open');
  }
  function closeAllModals() {
    document.querySelectorAll('.modal[data-open="true"]').forEach(function (m) {
      m.removeAttribute('data-open');
    });
  }
  // ESC closes top-most modal
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllModals();
  });
  // Backdrop + close button wiring (delegated)
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('modal__backdrop')) {
      var modal = e.target.closest('.modal');
      if (modal) modal.removeAttribute('data-open');
    }
    var closer = e.target.closest('[data-modal-close]');
    if (closer) {
      var m = closer.closest('.modal');
      if (m) m.removeAttribute('data-open');
    }
    var opener = e.target.closest('[data-modal-open]');
    if (opener) openModal(opener.getAttribute('data-modal-open'));
  });

  /* ---- DEFENSIVE LOGIN BUTTON ---- */

  function wireLoginButton() {
    var btn = document.getElementById('loginBtn');
    if (!btn || btn.dataset.psysWired) return;
    btn.dataset.psysWired = '1';
    btn.addEventListener('click', function () {
      tryLogin();
    });
  }

  function tryLogin(attempt) {
    attempt = attempt || 0;
    var status = document.getElementById('loginStatus');
    if (typeof window._googleSignIn === 'function') {
      window._googleSignIn();
      return;
    }
    // Firebase auth not ready yet — wait up to ~3s with backoff
    if (attempt < 30) {
      if (status) status.textContent = 'Menyiapkan koneksi…';
      setTimeout(function () { tryLogin(attempt + 1); }, 100);
      return;
    }
    if (status) {
      status.textContent = 'Gagal memuat Firebase. Cek koneksi atau hard-refresh (Ctrl+Shift+R).';
      status.setAttribute('data-error', 'true');
    }
    console.warn('[SHELL] Firebase auth never became ready after 3s.');
  }

  /* ---- SIGNOUT FLOW ---- */

  function wireSignout() {
    var avatar = document.getElementById('avatarBtn');
    if (!avatar || avatar.dataset.psysWired) return;
    avatar.dataset.psysWired = '1';
    avatar.addEventListener('click', function () {
      // Only show signout if a user is signed in
      var name = (document.getElementById('userDisplayName')?.textContent || '').trim();
      if (!name) return; // nothing to sign out from
      openModal('signoutModal');
    });
  }
  function doSignout() {
    closeModal('signoutModal');
    if (typeof window._signOut === 'function') {
      // _signOut() pre-confirms via window.confirm in original code — we already
      // confirmed via our modal, so monkey-patch to skip confirm
      var origConfirm = window.confirm;
      window.confirm = function () { return true; };
      try { window._signOut(); } finally {
        // restore after the async call kicks off
        setTimeout(function () { window.confirm = origConfirm; }, 100);
      }
    }
  }

  /* ---- SERVICE WORKER UPDATE PROMPT ---- */

  function wireSWUpdate() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      // New SW activated — show a small banner to refresh for new shell
      console.log('[SHELL] New service worker activated. Refresh to load updated app shell.');
    });
  }

  /* ---- "TAMBAH ASET" custom asset modal ---- */
  // The [data-tx-add] button focuses the persistent quick-add in TRANSAKSI.
  // Full add/edit/delete (with transaction logging) lives in js/asset-editor.js.
  function wireAddAsset() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tx-add]');
      if (!btn) return;
      // Focus the persistent quickadd in TRANSAKSI instead of opening modal —
      // simpler UX for the common case.
      var input = document.querySelector('#tab-transaksi .quickadd__input input');
      if (input) {
        input.focus();
        input.select();
        return;
      }
      openModal('addAssetModal');
    });
  }

  /* ---- INIT ---- */

  function init() {
    wireLoginButton();
    wireSignout();
    wireSWUpdate();
    wireAddAsset();

    // Wire signout confirm button
    var sBtn = document.getElementById('signoutConfirm');
    if (sBtn) sBtn.addEventListener('click', doSignout);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  if (typeof window !== 'undefined') {
    window.psys = window.psys || {};
    window.psys.modal = { open: openModal, close: closeModal, closeAll: closeAllModals };
  }
})();
