import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

/**
 * Builds the SQL Editor as a regular Vite app for HTTP serving.
 * Produces separate JS/CSS files with proper code splitting and asset handling.
 * This enables Monaco Editor web workers and other features that don't work in single-file bundles.
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
        'sql-editor': resolve(__dirname, 'src/apps/sql-editor.html'),
      },
      output: {
        // Organize output files in a clean structure
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Enable code splitting for better performance
    chunkSizeWarningLimit: 1000,
  },
  // Development server configuration
  server: {
    port: 5173,
    open: false,
  },
});
