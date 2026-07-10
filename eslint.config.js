import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        history: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        indexedDB: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        FileList: 'readonly',
        Image: 'readonly',
        ImageData: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        CustomEvent: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        DOMParser: 'readonly',
        XMLHttpRequest: 'readonly',
        WebSocket: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        cancelIdleCallback: 'readonly',
        queueMicrotask: 'readonly',
        structuredClone: 'readonly',
        crypto: 'readonly',
        performance: 'readonly',
        getComputedStyle: 'readonly',
        matchMedia: 'readonly',
        MutationObserver: 'readonly',
        module: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        Node: 'readonly',
        Element: 'readonly',
        // Chart.js
        Chart: 'readonly',
        // PDF.js
        pdfjsLib: 'readonly',
        // Tesseract
        Tesseract: 'readonly',
        // jsPDF
        jsPDF: 'readonly',
        // Firebase
        firebase: 'readonly',
        // Service Worker
        self: 'readonly',
        caches: 'readonly',
        clients: 'readonly',
        skipWaiting: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'all'],
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'no-multiple-empty-lines': ['warn', { max: 2 }],
      'comma-dangle': ['warn', 'only-multiline'],
      'no-trailing-spaces': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    ignores: [
      'firebase/firebase-config.js',
      'js/parsers/portfolio-sys-parser-fix.js',
      'node_modules/**',
      'dist/**'
    ]
  }
];
