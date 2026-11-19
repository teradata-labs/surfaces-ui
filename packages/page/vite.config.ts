import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// One classic script (global `surfaces`) and one stylesheet, for pages with no
// build step that load their scripts with <script src>. React is inside;
// ECharts is not: the page loads its own copy first (window.echarts), so a host
// that already ships ECharts does not carry a second one.
const echartsShim = path.resolve(import.meta.dirname, "src/echarts-global.ts");
// The SQL editor is CodeMirror, about a third of the bundle; pages get a plain text box instead.
const plainEditor = path.resolve(import.meta.dirname, "src/plain-editor.tsx");

export default defineConfig({
  plugins: [
    react(),
    {
      name: "surfaces-plain-editor",
      enforce: "pre",
      resolveId(source, importer) {
        if (!source.endsWith("editor/SqlEditor.js") || !importer?.includes(`${path.sep}components${path.sep}`)) return null;
        return plainEditor;
      },
    },
  ],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: {
    alias: [{ find: /^echarts(\/.*)?$/, replacement: echartsShim }],
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
    lib: {
      entry: path.resolve(import.meta.dirname, "src/index.tsx"),
      name: "surfaces",
      formats: ["iife"],
      fileName: () => "surfaces-page.js",
      cssFileName: "surfaces-page",
    },
  },
});
