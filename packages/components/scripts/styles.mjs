#!/usr/bin/env node
// Writes the two stylesheets a consumer can import:
// - dist/styles.css: the library's styles as they are. Its class selectors
//   beat a host's element selectors, so a page's own resets cannot undo them.
// - dist/styles.layer.css: the same styles inside `@layer surfaces`, so any
//   style the app writes outside a layer wins without fighting specificity.
//   An app with layers of its own (Tailwind) names the order:
//   `@layer theme, base, surfaces, components, utilities;`
import fs from "node:fs";
import path from "node:path";

export const LAYER = "surfaces";

/** The styles inside one named layer. Refuses text a layer block cannot hold. */
export function layered(css, layer = LAYER) {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const outside = /^\s*@(import|charset|namespace)\b/m.exec(bare);
  if (outside) throw new Error(`styles.css has @${outside[1]}, which cannot go inside @layer ${layer}; move it out of the stylesheet.`);
  return `/* Surfaces UI styles inside @layer ${layer}: styles your app writes outside a layer win. */\n@layer ${layer} {\n${css}\n}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const here = path.resolve(path.dirname(process.argv[1]), "..");
  const css = fs.readFileSync(path.join(here, "src", "styles.css"), "utf8");
  fs.mkdirSync(path.join(here, "dist"), { recursive: true });
  fs.writeFileSync(path.join(here, "dist", "styles.css"), css);
  fs.writeFileSync(path.join(here, "dist", "styles.layer.css"), layered(css));
}
