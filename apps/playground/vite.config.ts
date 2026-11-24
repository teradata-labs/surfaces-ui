import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { type Plugin, type UserConfig, createServer, defineConfig } from "vite";

const src = (pkg: string, file = "index.ts") =>
  fileURLToPath(new URL(`../../packages/${pkg}/src/${file}`, import.meta.url));

const here = fileURLToPath(new URL(".", import.meta.url));
const docsDir = fileURLToPath(new URL("../../docs/", import.meta.url));

/** Every Markdown file under a folder, as paths relative to it. */
async function markdownFiles(dir: string, under = ""): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(join(dir, under), { withFileTypes: true })) {
    const path = under ? `${under}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...(await markdownFiles(dir, path)));
    else if (entry.name.endsWith(".md")) found.push(path);
  }
  return found;
}

/**
 * After the app is built, writes a page of HTML for every route (`src/prerender.tsx`): what search engines and link
 * previews read. `SURFACES_SITE_URL` is where the site is served (the Pages workflow passes it); without it the pages
 * name https://surfaces-ui.com.
 */
function prerender(aliases: NonNullable<UserConfig["resolve"]>["alias"]): Plugin {
  let outDir = "";
  let base = "/";
  return {
    name: "surfaces-prerender",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      base = config.base;
    },
    async closeBundle() {
      const docs: Record<string, string> = {};
      for (const path of await markdownFiles(docsDir)) docs[path] = await readFile(join(docsDir, path), "utf8");
      const siteUrl = new URL(base, process.env.SURFACES_SITE_URL || "https://surfaces-ui.com/").href;
      // Through Vite, so the page can be drawn with the library's own components from their source.
      const server = await createServer({ configFile: false, root: here, base, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false }, resolve: { alias: aliases }, plugins: [react()] });
      try {
        const { prerenderSite } = (await server.ssrLoadModule("/src/prerender.tsx")) as typeof import("./src/prerender.js");
        const shell = await readFile(join(outDir, "index.html"), "utf8");
        const files = prerenderSite({ shell, docs, siteUrl, base });
        for (const [file, text] of Object.entries(files)) {
          const target = join(outDir, file);
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, text);
        }
        this.info?.(`prerendered ${Object.keys(files).length} files for ${siteUrl}`);
      } finally {
        await server.close();
      }
    },
  };
}

// Workspace packages resolve to their source so edits hot-reload without a build.
const aliases = [
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
];

export default defineConfig({
  plugins: [react(), prerender(aliases)],
  // A published copy is served from a path (GitHub Pages: /surfaces-ui/), given as SURFACES_BASE when it is built.
  base: process.env.SURFACES_BASE ?? "/",
  // DuckDB-wasm ships its own worker and wasm files; they are served as files, not pre-bundled.
  optimizeDeps: { exclude: ["@duckdb/duckdb-wasm"] },
  resolve: { alias: aliases },
});
