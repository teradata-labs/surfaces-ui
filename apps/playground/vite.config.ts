import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = (pkg: string, file = "index.ts") =>
  fileURLToPath(new URL(`../../packages/${pkg}/src/${file}`, import.meta.url));

// Workspace packages resolve to their source so edits hot-reload without a build.
export default defineConfig({
  plugins: [react()],
  // A published copy is served from a path (GitHub Pages: /surfaces-ui/), given as SURFACES_BASE when it is built.
  base: process.env.SURFACES_BASE ?? "/",
  // DuckDB-wasm ships its own worker and wasm files; they are served as files, not pre-bundled.
  optimizeDeps: { exclude: ["@duckdb/duckdb-wasm"] },
  resolve: {
    alias: [
      { find: "@surfaces-ui/components/styles.css", replacement: src("components", "styles.css") },
      // The built single-file MCP app page, loaded as text for the host preview.
      { find: /^@surfaces-ui\/mcp\/app\.html/, replacement: fileURLToPath(new URL("../../packages/mcp/dist/app.html", import.meta.url)) },
      { find: "@surfaces-ui/mcp", replacement: src("mcp") },
      { find: "@surfaces-ui/spec/react", replacement: src("spec", "react/index.ts") },
      { find: "@surfaces-ui/spec", replacement: src("spec") },
      { find: "@surfaces-ui/components/app-components", replacement: src("components", "appComponents.ts") },
      { find: "@surfaces-ui/components", replacement: src("components") },
      { find: "@surfaces-ui/chat/app-components", replacement: src("chat", "appComponents.ts") },
      { find: "@surfaces-ui/chat", replacement: src("chat") },
      { find: "@surfaces-ui/trace/react", replacement: src("trace", "react.ts") },
      { find: "@surfaces-ui/trace", replacement: src("trace") },
      { find: "@surfaces-ui/devtools/panel", replacement: src("devtools", "Panel.tsx") },
      { find: "@surfaces-ui/devtools/app-components", replacement: src("devtools", "appComponents.ts") },
      { find: "@surfaces-ui/devtools", replacement: src("devtools") },
      { find: "@surfaces-ui/state/react", replacement: src("state", "react.ts") },
      { find: "@surfaces-ui/state", replacement: src("state") },
      { find: "@surfaces-ui/agent-loom", replacement: src("agent-loom") },
      { find: "@surfaces-ui/agent", replacement: src("agent") },
      { find: "@surfaces-ui/tokens", replacement: src("tokens") },
      { find: "@surfaces-ui/client-connect", replacement: src("client-connect") },
      { find: "@surfaces-ui/data", replacement: src("data") },
      { find: "@surfaces-ui/discovery", replacement: src("discovery") },
      { find: "@surfaces-ui/proto", replacement: src("proto") },
      { find: "@surfaces-ui/datasource-duckdb-wasm", replacement: src("datasource-duckdb-wasm") },
      { find: "@surfaces-ui/engine-service", replacement: src("engine-service") },
      { find: /^@surfaces-ui\/engine$/, replacement: src("engine") },
      { find: "@surfaces-ui/sql", replacement: src("sql") },
      { find: "@surfaces-ui/seeds", replacement: src("seeds") },
    ],
  },
});
