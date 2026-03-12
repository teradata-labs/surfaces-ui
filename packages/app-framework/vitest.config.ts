import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'vite/**/*.test.ts'],
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [
      // Vite plugin tests run in Node (override jsdom default)
      ['vite/**/*.test.ts', 'node'],
    ],
    setupFiles: ['src/__tests__/setup.ts'],
  },
});
