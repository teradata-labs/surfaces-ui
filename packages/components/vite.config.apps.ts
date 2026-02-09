import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

/**
 * Builds the SQL Editor as a standalone HTML app for MCP Apps protocol.
 * Produces a self-contained HTML file with inlined JS/CSS.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist/apps',
    rollupOptions: {
      input: resolve(__dirname, 'src/apps/sql-editor.html'),
      output: {
        // Flatten output - put all files directly in outDir
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  // Ensure HTML files are output at root of outDir
  experimental: {
    renderBuiltUrl(filename) {
      return filename.replace(/^src\/apps\//, '');
    },
  },
});
