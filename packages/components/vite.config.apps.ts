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
 *
 * Usage: Build individual apps via APP env var
 * APP=sql-editor-cdn vite build --config vite.config.apps.ts
 * APP=json-render-cdn vite build --config vite.config.apps.ts
 */

// Determine which app to build based on APP env var
const app = process.env.APP || 'sql-editor-cdn';
const validApps = ['sql-editor-cdn', 'json-render-cdn', 'showcase', 'loom-test'];

if (!validApps.includes(app)) {
  throw new Error(`Invalid APP="${app}". Must be one of: ${validApps.join(', ')}`);
}

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist/apps',
    emptyOutDir: false, // Don't clear outDir - we're building multiple apps sequentially
    rollupOptions: {
      input: resolve(__dirname, `src/apps/${app}.html`),
      output: {
        // Flatten output - put all files directly in outDir
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
