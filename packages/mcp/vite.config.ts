import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the app page as one self-contained HTML file: MCP hosts load it from
// a ui:// resource in a sandboxed frame, where it cannot fetch other files.
export default defineConfig({
  root: "src/app",
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: "surfaces-app-html",
      closeBundle() {
        const out = path.resolve("dist/app");
        fs.renameSync(path.join(out, "index.html"), path.resolve("dist/app.html"));
        fs.rmSync(out, { recursive: true, force: true });
      },
    },
  ],
  build: { outDir: "../../dist/app", emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4000 },
});
