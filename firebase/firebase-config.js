/**
 * ══════════════════════════════════════════
 * FIREBASE-CONFIG.JS — Auth + Cloud Sync
 * ══════════════════════════════════════════
 */

import { S, DATA, setDATA, setHistoryData, setPrice, setFxRate } from '../js/state.js';

// ══════════════════════════════════════════
// FIREBASE CONFIG — ganti dengan milikmu
// (dari Langkah 2 tutorial di atas)
// ══════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAfWmIFhKMLMAeX3RccnZdUg1HQwAo--HU",
  authDomain:        "mypersonalportfolio-5f646.firebaseapp.com",
  projectId:         "mypersonalportfolio-5f646",
  storageBucket:     "mypersonalportfolio-5f646.firebasestorage.app",
  messagingSenderId: "605280486170",
  appId:             "1:605280486170:web:ea875c74188a21528562a3"
};

// ── Exports ───────────────────────────────────────────────────────
export let currentUser = null;
export let db          = null;
export let isCanvasEnv = false;

let app  = null;
let auth = null;

// ── Helpers ───────────────────────────────────────────────────────
function setCloudStatus(text, isErr = false) {
  const el = document.getElementById('cloudStatus');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('err', isErr);
}

/** Path Firestore berdasarkan UID user yang login */
function userDocRef() {
  if (!currentUser || !db) return null;
  if (isCanvasEnv) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return firebase.doc(db, 'artifacts', appId, 'users', currentUser.uid, 'portfolio_data', 'main');
  }
  // Setiap user punya path sendiri: users/{uid}/portfolio/main
  return firebase.doc(db, 'users', currentUser.uid, 'portfolio', 'main');
}

// ── Tampilkan / Sembunyikan Login Overlay ─────────────────────────
function showLoginOverlay() {
  const el = document.getElementById('loginOverlay');
  if (!el) return;
  el.style.opacity = '0';
  el.style.display = 'flex';
  // Reset login button jika sebelumnya disabled
  const btn = document.getElementById('loginBtn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48" style="flex-shrink:0"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Masuk dengan Google`;
  }
  setLoginStatus('');
  // Fade in
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '1';
  });
}

function hideLoginOverlay() {
  const el = document.getElementById('loginOverlay');
  if (!el) return;
  el.style.opacity = '0';
  el.style.transition = 'opacity 0.4s ease';
  setTimeout(() => {
    el.style.display = 'none';
    // Show onboarding for new users
    if (typeof window.showOnboardingIfNew === 'function') {
      setTimeout(window.showOnboardingIfNew, 300);
    }
  }, 400);
}

function setLoginStatus(text, isErr = false) {
  const el = document.getElementById('loginStatus');
  if (!el) return;
  el.textContent = text;
  el.style.color = isErr ? 'var(--down)' : 'var(--muted)';
}

// ── Login State Helpers ───────────────────────────────────────────
function loginShowState(state) {
  ['Default', 'Loading', 'Error'].forEach(s => {
    const el = document.getElementById('loginState' + s);
    if (el) el.style.display = s.toLowerCase() === state ? '' : 'none';
  });
}

window._loginShowDefault = function() { loginShowState('default'); };

// ── Google Sign-In ────────────────────────────────────────────────
window._googleSignIn = async function () {
  loginShowState('loading');

  try {
    const provider = new firebase.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await firebase.signInWithPopup(auth, provider);
    // Success → hideLoginOverlay() is called by onAuthStateChanged
  } catch (e) {
    console.error('[AUTH] Google sign-in error:', e);
    let msg = 'Sign-in failed. Please try again.';
    let hint = '';
    if (e.code === 'auth/popup-closed-by-user')   { msg = 'You closed the sign-in window.'; hint = 'Tap "Try Again" to sign in.'; }
    if (e.code === 'auth/popup-blocked')           { msg = 'Pop-up was blocked by your browser.'; hint = 'Allow pop-ups for this site, then try again.'; }
    if (e.code === 'auth/unauthorized-domain')     { msg = 'This domain is not authorized.'; hint = 'Please contact the app owner.'; }
    if (e.code === 'auth/network-request-failed')  { msg = 'No internet connection.'; hint = 'Check your Wi-Fi or mobile data and try again.'; }
    if (e.code === 'auth/too-many-requests')       { msg = 'Too many attempts.'; hint = 'Please wait a moment, then try again.'; }
    if (e.code === 'auth/cancelled-popup-request') { msg = 'Sign-in was cancelled.'; hint = 'Tap "Try Again" to sign in.'; }

    const msgEl = document.getElementById('loginErrorMsg');
    if (msgEl) msgEl.innerHTML = `<strong>${msg}</strong>${hint ? '<br><span style="font-weight:400;opacity:.8">' + hint + '</span>' : ''}`;
    loginShowState('error');
  }
};

// ── Sign Out ──────────────────────────────────────────────────────
window._signOut = async function () {
  if (!confirm('Are you sure you want to sign out?')) return;
  try {
    await firebase.signOut(auth);
    // Clear data agar tidak keliatan saat overlay muncul
    setDATA({ crypto: [], gold: [], stocks: [], savings: [], history: [], lastRates: null, txLog: [] });
    setHistoryData([]);
    window.dispatchEvent(new CustomEvent('portfolio:update'));
    showLoginOverlay();
    setCloudStatus('☁️ OFFLINE');
  } catch (e) {
    console.error('[AUTH] Sign-out error:', e);
  }
};

// ── Initialize ────────────────────────────────────────────────────
export function initCloud() {
  let config = FIREBASE_CONFIG;

  // Canvas environment override (tidak perlu diubah)
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      const c = JSON.parse(__firebase_config);
      if (c.apiKey) { config = c; isCanvasEnv = true; }
    }
  } catch (_) {}

  app  = firebase.initializeApp(config);
  auth = firebase.getAuth(app);
  db   = firebase.getFirestore(app);

  // Tampilkan login overlay dulu — disembunyikan setelah auth berhasil
  showLoginOverlay();
  setCloudStatus('☁️ CONNECTING...');

  // Canvas: langsung login dengan custom token
  if (isCanvasEnv && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
    firebase.signInWithCustomToken(auth, __initial_auth_token).catch(console.error);
  }

  // Listener: dipanggil setiap kali auth state berubah
  // (login, logout, atau saat halaman dibuka & session masih aktif)
  firebase.onAuthStateChanged(auth, async (user) => {
    if (user) {
      // ── User sudah login ──────────────────────────────────────
      currentUser = user;

      // Update UI
      hideLoginOverlay();
      setCloudStatus('☁️ LOADING...');

      // Update nama di topbar jika ada elemennya
      const nameEl = document.getElementById('userDisplayName');
      if (nameEl) nameEl.textContent = user.displayName || user.email || '';

      // Load data dari cloud
      await loadDataFromCloud();
      setCloudStatus('☁️ SYNCED');

    } else {
      // ── User belum / sudah logout ────────────────────────────
      currentUser = null;
      showLoginOverlay();
      setCloudStatus('☁️ OFFLINE');
    }
  });
}

// ── Load Data from Cloud ──────────────────────────────────────────
export async function loadDataFromCloud() {
  const ref = userDocRef();
  if (!ref) return;

  try {
    const snap = await firebase.getDoc(ref);
    if (snap.exists()) {
      const cloudData = snap.data();
      setDATA(cloudData);

      if (!DATA.history) DATA.history = [];
      setHistoryData([...DATA.history]);

      if (DATA.lastRates) {
        setPrice('usdIdr',       DATA.lastRates.usdIdr      || S.usdIdr);
        setPrice('goldGramIdr',  DATA.lastRates.goldGramIdr || S.goldGramIdr);
        setPrice('btcIdr',       DATA.lastRates.btcIdr      || S.btcIdr);
        setPrice('ethIdr',       DATA.lastRates.ethIdr      || S.ethIdr);
        setPrice('xrpIdr',       DATA.lastRates.xrpIdr      || S.xrpIdr);
        if (DATA.lastRates.fxRates) {
          Object.entries(DATA.lastRates.fxRates).forEach(([ccy, rate]) => setFxRate(ccy, rate));
        }
      }

      window.dispatchEvent(new CustomEvent('portfolio:update'));
    } else {
      // User baru — belum ada data, reset semua ke kosong
      setDATA({ crypto: [], gold: [], stocks: [], savings: [], history: [], lastRates: null, txLog: [] });
      setHistoryData([]);
      window.dispatchEvent(new CustomEvent('portfolio:update'));
    }
  } catch (e) {
    console.error('[FIREBASE] Load error:', e);
    if (e.code === 'permission-denied') {
      setCloudStatus('☁️ RULES DENIED', true);
      alert('Firestore rules belum dikonfigurasi.\nIkuti Langkah 6 di tutorial firebase-config.js');
    }
  }
}

// ── Save Data to Cloud ────────────────────────────────────────────
export async function saveDataToCloud() {
  const ref = userDocRef();
  if (!ref) return;

  try {
    setCloudStatus('☁️ SAVING...');
    await firebase.setDoc(ref, DATA);
    setTimeout(() => setCloudStatus('☁️ SYNCED'), 800);
  } catch (e) {
    console.error('[FIREBASE] Save error:', e);
    const msg = e.code === 'permission-denied' ? '☁️ RULES DENIED' : '☁️ SAVE ERROR';
    setCloudStatus(msg, true);
  }
}

// ── Save Daily Snapshot ───────────────────────────────────────────
export async function saveDailySnapshot() {
  // Guard: skip if no authenticated user — DATA may still be seed/mock values
  if (!currentUser) {
    console.log('[FIREBASE] saveDailySnapshot: no authenticated user, skipping');
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  const getTotals = typeof window._getTotals === 'function' ? window._getTotals : null;
  if (!getTotals) {
    console.warn('[FIREBASE] saveDailySnapshot: _getTotals not ready, skipping');
    return;
  }

  const T = getTotals();
  if (!DATA.history) DATA.history = [];

  const idx   = DATA.history.findIndex(h => h.date === today);
  const entry = { date: today, value: T.t };
  if (idx >= 0) DATA.history[idx] = entry;
  else DATA.history.push(entry);

  // Smart retention: harian 90 hari, mingguan untuk lebih lama
  const cutoff90 = new Date();
  cutoff90.setDate(cutoff90.getDate() - 90);
  const cutoff90Str = cutoff90.toISOString().split('T')[0];

  const recent = DATA.history.filter(h => h.date >= cutoff90Str);
  const older  = DATA.history.filter(h => h.date <  cutoff90Str);

  const weekMap = new Map();
  for (const h of older) {
    const d   = new Date(h.date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    const wk  = d.toISOString().split('T')[0];
    if (!weekMap.has(wk) || h.date > weekMap.get(wk).date) weekMap.set(wk, h);
  }
  const weeklyOlder = [...weekMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  DATA.history = [...weeklyOlder, ...recent];

  setHistoryData([...DATA.history]);
  await saveDataToCloud();

  window.dispatchEvent(new CustomEvent('portfolio:update'));
}

console.log('[FIREBASE] firebase-config loaded — Google Auth ready');
