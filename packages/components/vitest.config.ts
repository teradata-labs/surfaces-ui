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
        // Actual coverage as of 2026-02-22 (vitest 4 + coverage-v8 4):
        //   lines 59.66%, branches 59.64%, functions ~52%, statements 59.49%
        // Set floor just below actuals and ratchet up as tests are added.
        lines: 58,
        branches: 58,
        functions: 50,
        statements: 58,
      },
    },
  },
});
