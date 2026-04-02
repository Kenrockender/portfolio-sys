/**
 * Module Loader - Lazy Loading for Portfolio.sys
 * Dynamically loads heavy modules only when needed
 */

const loadedModules = new Map();

/**
 * Lazy load a module with caching
 * @param {string} modulePath - Path to the module (e.g., './charts.js')
 * @returns {Promise<any>} The module exports
 */
export async function loadModule(modulePath) {
  if (loadedModules.has(modulePath)) {
    return loadedModules.get(modulePath);
  }

  try {
    const module = await import(modulePath);
    loadedModules.set(modulePath, module);
    return module;
  } catch (error) {
    console.error(`Failed to load module: ${modulePath}`, error);
    throw error;
  }
}

/**
 * Preload modules in the background for better UX
 * @param {string[]} modulePaths - Array of module paths to preload
 */
export function preloadModules(modulePaths) {
  // Use requestIdleCallback for non-critical preloading
  const preload = () => {
    modulePaths.forEach(path => {
      if (!loadedModules.has(path)) {
        loadModule(path).catch(() => {}); // Silent fail on preload
      }
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(preload);
  } else {
    setTimeout(preload, 1000);
  }
}

/**
 * Load charts module only when needed
 * @returns {Promise<any>}
 */
export async function loadCharts() {
  const module = await loadModule('./charts.js');
  return module;
}

/**
 * Load import parsers only when import dialog opens
 * @returns {Promise<any>}
 */
export async function loadImportParsers() {
  const module = await loadModule('./import-parsers.js');
  return module;
}

/**
 * Load Gemini AI module only when AI features are used
 * @returns {Promise<any>}
 */
export async function loadGemini() {
  const [gemini, geminiUI] = await Promise.all([
    loadModule('./gemini.js'),
    loadModule('./gemini-ui.js')
  ]);
  return { gemini, geminiUI };
}

/**
 * Load ML module for portfolio predictions
 * @returns {Promise<any>}
 */
export async function loadML() {
  const [ml, mlUI] = await Promise.all([
    loadModule('./ml.js'),
    loadModule('./ml-ui.js')
  ]);
  return { ml, mlUI };
}

/**
 * Clear module cache (for development/debugging)
 */
export function clearModuleCache() {
  loadedModules.clear();
  console.log('[ModuleLoader] Cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    loaded: Array.from(loadedModules.keys()),
    count: loadedModules.size
  };
}

// Intelligent preloading based on user interaction
let interactionDetected = false;

function setupIntelligentPreload() {
  if (interactionDetected) return;
  
  const detectInteraction = () => {
    if (!interactionDetected) {
      interactionDetected = true;
      
      // Preload likely-needed modules after user shows intent
      preloadModules([
        './charts.js',
        './import-parsers.js'
      ]);
    }
  };

  // Detect first interaction
  ['mouseenter', 'touchstart', 'scroll'].forEach(event => {
    document.addEventListener(event, detectInteraction, { once: true, passive: true });
  });
}

// Auto-setup on module import
setupIntelligentPreload();
