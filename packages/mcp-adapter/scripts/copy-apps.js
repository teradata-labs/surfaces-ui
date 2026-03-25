/**
 * Copies built resources from the components package into
 * packages/mcp-adapter/apps/ so the adapter ships with them baked in.
 *
 * Copies:
 * - HTML app bundles from components/dist/apps/
 * - CSS stylesheets from components/dist/ and components/src/theme/
 * - Documentation from mcp-adapter/src/resources/
 *
 * Run automatically via the `prebuild` script after `build:apps`.
 */
import { cpSync, copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dest = resolve(__dirname, "../apps");

// Create destination directory
mkdirSync(dest, { recursive: true });

// ── Copy HTML app bundles ──────────────────────────────────────────
const appsSrc = resolve(__dirname, "../../components/dist/apps");
if (existsSync(appsSrc)) {
  cpSync(appsSrc, dest, { recursive: true });
  const htmlFiles = readdirSync(dest).filter((f) => f.endsWith(".html"));
  console.log(`Copied ${htmlFiles.length} HTML app bundle(s):`);
  for (const f of htmlFiles) {
    console.log(`  - ${f}`);
  }
} else {
  console.warn(`WARNING: HTML apps directory not found: ${appsSrc}`);
}

// ── Copy CSS stylesheets ───────────────────────────────────────────
const cssFiles = [
  {
    src: resolve(__dirname, "../../components/src/theme/tokens.css"),
    dest: resolve(dest, "tokens.css"),
    name: "tokens.css (design tokens)"
  },
  {
    src: resolve(__dirname, "../../components/dist/components.css"),
    dest: resolve(dest, "components.css"),
    name: "components.css (compiled styles)"
  }
];

console.log(`\nCopying CSS stylesheets:`);
for (const { src, dest: cssDest, name } of cssFiles) {
  if (existsSync(src)) {
    copyFileSync(src, cssDest);
    console.log(`  ✓ ${name}`);
  } else {
    console.warn(`  ✗ ${name} - not found at ${src}`);
  }
}

// ── Copy documentation resources ───────────────────────────────────
const docsSrc = resolve(__dirname, "../src/resources/react-components.md");
const docsDest = resolve(dest, "react-components.md");

console.log(`\nCopying documentation:`);
if (existsSync(docsSrc)) {
  copyFileSync(docsSrc, docsDest);
  console.log(`  ✓ react-components.md`);
} else {
  console.warn(`  ✗ react-components.md - not found at ${docsSrc}`);
}

console.log(`\nAll resources copied to: ${dest}`);
