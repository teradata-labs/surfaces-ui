// Run after `vite build`: fails when the bundle carries what it should borrow
// or leave out (a second ECharts, CodeMirror) or grows past its budget.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const file = path.join(import.meta.dirname, "dist", "surfaces-page.js");
const code = fs.readFileSync(file, "utf8");
const problems = [];
if (/zrender|ZRender/.test(code)) problems.push("ECharts is inside; the page's own window.echarts should be used (src/echarts-global.ts).");
if (/cm-editor|cm-content/.test(code)) problems.push("CodeMirror is inside; the SQL editor should be the plain one (src/plain-editor.tsx).");
const gzipped = zlib.gzipSync(code).length;
const BUDGET = 400 * 1024;
if (gzipped > BUDGET) problems.push(`It is ${Math.round(gzipped / 1024)} KB gzipped, over the ${BUDGET / 1024} KB budget.`);
if (problems.length > 0) {
  console.error(`surfaces-page.js:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`surfaces-page.js: ${Math.round(gzipped / 1024)} KB gzipped, no ECharts or CodeMirror inside.`);
