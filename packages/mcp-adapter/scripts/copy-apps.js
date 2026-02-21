/**
 * Copies built HTML app bundles from the components package into
 * packages/mcp-adapter/apps/ so the adapter ships with them baked in.
 *
 * Run automatically via the `prebuild` script after `build:apps`.
 */
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "../../components/dist/apps");
const dest = resolve(__dirname, "../apps");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });

const files = readdirSync(dest).filter((f) => f.endsWith(".html"));
console.log(`Copied ${files.length} HTML app bundle(s) to mcp-adapter/apps/`);
for (const f of files) {
  console.log(`  - ${f}`);
}
