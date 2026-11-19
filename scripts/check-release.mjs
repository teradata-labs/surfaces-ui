#!/usr/bin/env node
// Checks that every published package is ready to go to npm. Run before
// `changeset publish`; `pnpm release` does. Fails until a license is chosen:
// "UNLICENSED" means nobody may use the code, which is wrong for a public package.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const problems = [];
const versions = new Set();

for (const dir of fs.readdirSync(path.join(root, "packages"))) {
  const file = path.join(root, "packages", dir, "package.json");
  if (!fs.existsSync(file)) continue;
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (pkg.private) continue;
  const at = `packages/${dir}`;
  versions.add(pkg.version);
  if (!pkg.license || pkg.license === "UNLICENSED") problems.push(`${at}: choose a license (it is "${pkg.license ?? "missing"}")`);
  if (!pkg.description) problems.push(`${at}: add a description`);
  if (!Array.isArray(pkg.files) || pkg.files.length === 0) problems.push(`${at}: list "files", so only built output is published`);
  if (pkg.publishConfig?.access !== "public") problems.push(`${at}: set publishConfig.access to "public"`);
  if (!fs.existsSync(path.join(root, "packages", dir, "dist"))) problems.push(`${at}: not built (run pnpm build)`);
  for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.peerDependencies })) {
    if (String(spec).startsWith("file:") || String(spec).startsWith("link:")) problems.push(`${at}: ${name} points at a local path`);
  }
}
if (!fs.existsSync(path.join(root, "LICENSE"))) problems.push("LICENSE: add the license text at the repository root");
if (versions.size > 1) problems.push(`versions differ (${[...versions].join(", ")}); the packages are released together`);

if (problems.length > 0) {
  console.error(`Not ready to publish:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("Every package is ready to publish.");
