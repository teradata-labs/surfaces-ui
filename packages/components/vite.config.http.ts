import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

/**
 * HTTP build configuration - DEPRECATED
 *
 * This config was used for HTTP server builds with Monaco Editor.
 * Now replaced by vite.config.apps.ts which builds single-file HTML bundles
 * with CodeMirror for Claude Desktop MCP Apps.
 *
 * Kept for reference but no longer actively used.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist/http',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // No input files - this config is deprecated
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    open: false,
  },
});
