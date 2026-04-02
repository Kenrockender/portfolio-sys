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
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
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
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single', { avoidEscape: true }],
      'no-multiple-empty-lines': ['warn', { max: 2 }],
      'comma-dangle': ['warn', 'only-multiline'],
      'no-trailing-spaces': 'warn'
    }
  },
  {
    ignores: [
      'firebase/firebase-config.js',
      'node_modules/**',
      'dist/**'
    ]
  }
];
