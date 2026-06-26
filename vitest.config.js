import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // storage.js attaches window._getTotals on import, so we need a DOM global.
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
  },
});
