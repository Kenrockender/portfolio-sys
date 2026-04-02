/**
 * PWA Install Prompt Handler
 * Shows a dismissible install banner when the app is installable
 */

let deferredPrompt = null;
let installPromptShown = false;

export function initPWAInstallPrompt() {
  // Check if user has already dismissed or installed
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  const installed = localStorage.getItem('pwa-installed');
  
  if (dismissed === 'true' || installed === 'true') {
    return;
  }

  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show install banner after a short delay
    setTimeout(() => {
      if (!installPromptShown) {
        showInstallBanner();
        installPromptShown = true;
      }
    }, 3000);
  });

  // Listen for app installed event
  window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    localStorage.setItem('pwa-installed', 'true');
    hideInstallBanner();
    deferredPrompt = null;
  });

  // Check if already installed (standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true) {
    localStorage.setItem('pwa-installed', 'true');
  }
}

function showInstallBanner() {
  // Create banner HTML
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="pwa-install-content">
      <div class="pwa-install-icon">📱</div>
      <div class="pwa-install-text">
        <strong>Install Portfolio.sys</strong>
        <p>Add to home screen for quick access and offline use</p>
      </div>
      <div class="pwa-install-actions">
        <button id="pwa-install-btn" class="btn-install">Install</button>
        <button id="pwa-dismiss-btn" class="btn-dismiss">×</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(banner);
  
  // Animate in
  setTimeout(() => {
    banner.classList.add('show');
  }, 100);

  // Add event listeners
  document.getElementById('pwa-install-btn')?.addEventListener('click', handleInstallClick);
  document.getElementById('pwa-dismiss-btn')?.addEventListener('click', handleDismissClick);
}

function hideInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.classList.remove('show');
    setTimeout(() => {
      banner.remove();
    }, 300);
  }
}

async function handleInstallClick() {
  if (!deferredPrompt) {
    return;
  }

  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;
  
  console.log(`User response to install prompt: ${outcome}`);
  
  if (outcome === 'accepted') {
    localStorage.setItem('pwa-installed', 'true');
  } else {
    localStorage.setItem('pwa-install-dismissed', 'true');
  }
  
  // Clear the deferred prompt
  deferredPrompt = null;
  hideInstallBanner();
}

function handleDismissClick() {
  localStorage.setItem('pwa-install-dismissed', 'true');
  hideInstallBanner();
}

// Export for manual trigger
export function showInstallPrompt() {
  if (deferredPrompt && !installPromptShown) {
    showInstallBanner();
    installPromptShown = true;
  }
}

// Reset dismissal (for settings/debug)
export function resetInstallPrompt() {
  localStorage.removeItem('pwa-install-dismissed');
  localStorage.removeItem('pwa-installed');
  installPromptShown = false;
}
