import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'src/theme/tailwind-preset.ts',  // Build config, not runtime code
      ],
      thresholds: {
        // Actual coverage as of 2026-02-19: lines 62%, branches 78%, functions 52%, statements 62%
        // Coverage was never enforced in CI (coverage-v8 v4 / vitest v1 mismatch).
        // Set realistic floor and ratchet up as tests are added.
        lines: 60,
        branches: 75,
        functions: 50,
        statements: 60,
      },
    },
  },
});
