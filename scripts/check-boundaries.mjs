// Enforces the rule that the UI layer works with the data layer removed:
// UI packages may not depend on, or import, any data-layer package.
import fs from "node:fs";
import path from "node:path";

const UI = ["tokens", "components", "data", "proto", "agent", "chat", "spec", "state", "app", "seeds", "trace", "devtools"];
const FORBIDDEN = [
  /^@surfaces-ui\/(sql|engine|engine-.*|datasource-.*|dev-server|client-connect|discovery|pipelines|embedder-.*)$/,
  /^@huggingface\//,
  /^@connectrpc\//,
  /^@apache-arrow\/adbc/,
  /^@duckdb\//,
  /^@polyglot-sql\//,
  /^teradatasql$/,
];
const forbidden = (name) => FORBIDDEN.some((rule) => rule.test(name));
const problems = [];

function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "gen" ? [] : sources(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

for (const name of UI) {
  const dir = path.join("packages", name);
  if (!fs.existsSync(dir)) continue;
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    for (const dep of Object.keys(pkg[field] ?? {})) {
      if (forbidden(dep)) problems.push(`${pkg.name} lists ${dep} in ${field}`);
    }
  }
  for (const file of sources(path.join(dir, "src"))) {
    if (/\.test\.tsx?$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const spec = match[1].startsWith("@") ? match[1].split("/").slice(0, 2).join("/") : match[1].split("/")[0];
      if (forbidden(spec)) problems.push(`${file} imports ${match[1]}`);
    }
  }
}

if (problems.length > 0) {
  console.error("UI packages must not depend on the data layer:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`Boundary check passed for: ${UI.filter((n) => fs.existsSync(path.join("packages", n))).join(", ")}`);
