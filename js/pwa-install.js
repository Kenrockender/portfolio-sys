/**
 * PWA Install Prompt Handler — PORTFOLIO.SYS
 * Terminal-style install banner, theme-aware via CSS variables
 */

let deferredPrompt = null;
let installPromptShown = false;

export function initPWAInstallPrompt() {
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  const installed  = localStorage.getItem('pwa-installed');

  if (dismissed === 'true' || installed === 'true') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    setTimeout(() => {
      if (!installPromptShown) {
        showInstallBanner();
        installPromptShown = true;
      }
    }, 3000);
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Installed successfully');
    localStorage.setItem('pwa-installed', 'true');
    hideInstallBanner();
    deferredPrompt = null;
  });

  if (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true) {
    localStorage.setItem('pwa-installed', 'true');
  }
}

function showInstallBanner() {
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="pwa-install-titlebar">
      <div class="pwa-install-titlebar-dot"></div>
      <div class="pwa-install-titlebar-label">
        <span>PORTFOLIO.SYS</span> &mdash; install available
      </div>
    </div>
    <div class="pwa-install-content">
      <div class="pwa-install-icon">&gt;_</div>
      <div class="pwa-install-text">
        <strong>Install App</strong>
        <p>Add to home screen for <span class="pwa-highlight">instant access</span> &amp; offline use</p>
      </div>
      <div class="pwa-install-actions">
        <button id="pwa-install-btn" class="btn-install">+ Install</button>
        <button id="pwa-dismiss-btn" class="btn-dismiss" aria-label="Dismiss">&times;</button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => banner.classList.add('show'));
  });

  document.getElementById('pwa-install-btn')?.addEventListener('click', handleInstallClick);
  document.getElementById('pwa-dismiss-btn')?.addEventListener('click', handleDismissClick);
}

function hideInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 350);
  }
}

async function handleInstallClick() {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  console.log(`[PWA] User response: ${outcome}`);

  if (outcome === 'accepted') {
    localStorage.setItem('pwa-installed', 'true');
  } else {
    localStorage.setItem('pwa-install-dismissed', 'true');
  }

  deferredPrompt = null;
  hideInstallBanner();
}

function handleDismissClick() {
  localStorage.setItem('pwa-install-dismissed', 'true');
  hideInstallBanner();
}

export function showInstallPrompt() {
  if (deferredPrompt && !installPromptShown) {
    showInstallBanner();
    installPromptShown = true;
  }
}

export function resetInstallPrompt() {
  localStorage.removeItem('pwa-install-dismissed');
  localStorage.removeItem('pwa-installed');
  installPromptShown = false;
}
