/**
 * Loading States & Skeleton Screens
 * Provides visual feedback during async operations
 */

export function showSkeletonLoader(containerId, type = 'table') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const skeletonHTML = getSkeletonHTML(type);
  container.innerHTML = `<div class="skeleton-wrapper">${skeletonHTML}</div>`;
  container.classList.add('loading');
}

export function hideSkeletonLoader(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.classList.remove('loading');
  const skeleton = container.querySelector('.skeleton-wrapper');
  if (skeleton) {
    skeleton.remove();
  }
}

export function showLoadingOverlay(message = 'Loading...') {
  let overlay = document.getElementById('loading-overlay');
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    document.body.appendChild(overlay);
  }
  
  overlay.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
  
  overlay.classList.add('active');
}

export function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }
}

export function showInlineLoader(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.classList.add('loading-inline');
  const loader = document.createElement('span');
  loader.className = 'inline-spinner';
  element.appendChild(loader);
}

export function hideInlineLoader(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.classList.remove('loading-inline');
  const loader = element.querySelector('.inline-spinner');
  if (loader) {
    loader.remove();
  }
}

function getSkeletonHTML(type) {
  switch (type) {
    case 'table':
      return `
        <div class="skeleton-table">
          ${Array(5).fill(0).map(() => `
            <div class="skeleton-row">
              <div class="skeleton-cell skeleton-avatar"></div>
              <div class="skeleton-cell skeleton-text"></div>
              <div class="skeleton-cell skeleton-text-short"></div>
              <div class="skeleton-cell skeleton-text-short"></div>
              <div class="skeleton-cell skeleton-text"></div>
            </div>
          `).join('')}
        </div>
      `;
    
    case 'card':
      return `
        <div class="skeleton-card">
          <div class="skeleton-header">
            <div class="skeleton-title"></div>
            <div class="skeleton-subtitle"></div>
          </div>
          <div class="skeleton-content">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line-short"></div>
          </div>
        </div>
      `;
    
    case 'chart':
      return `
        <div class="skeleton-chart">
          <div class="skeleton-chart-header">
            <div class="skeleton-text"></div>
          </div>
          <div class="skeleton-chart-body">
            ${Array(7).fill(0).map((_, i) => `
              <div class="skeleton-bar" style="height: ${30 + Math.random() * 60}%"></div>
            `).join('')}
          </div>
        </div>
      `;
    
    case 'stats':
      return `
        <div class="skeleton-stats">
          ${Array(4).fill(0).map(() => `
            <div class="skeleton-stat">
              <div class="skeleton-stat-label"></div>
              <div class="skeleton-stat-value"></div>
            </div>
          `).join('')}
        </div>
      `;
    
    default:
      return '<div class="skeleton-placeholder"></div>';
  }
}

// Wrapper functions for common use cases
export async function withLoadingState(asyncFn, containerId, skeletonType = 'table') {
  showSkeletonLoader(containerId, skeletonType);
  try {
    const result = await asyncFn();
    return result;
  } finally {
    hideSkeletonLoader(containerId);
  }
}

export async function withOverlay(asyncFn, message = 'Loading...') {
  showLoadingOverlay(message);
  try {
    const result = await asyncFn();
    return result;
  } finally {
    hideLoadingOverlay();
  }
}
