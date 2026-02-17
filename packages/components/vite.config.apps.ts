import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';

/**
 * Builds standalone HTML apps for MCP Apps protocol.
 * Produces self-contained HTML files with inlined JS/CSS.
 *
 * Apps:
 * - sql-editor-cdn: CodeMirror SQL editor
 * - json-render-cdn: Natural language UI generator
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
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'sql-editor-cdn': resolve(__dirname, 'src/apps/sql-editor-cdn.html'),
        'json-render-cdn': resolve(__dirname, 'src/apps/json-render-cdn.html'),
      },
      output: {
        // Flatten output - put all files directly in outDir
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
