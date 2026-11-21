#!/usr/bin/env node
// Checks that every published package is ready to go to npm. Run before
// `changeset publish`; `pnpm release` does. Fails until a license is chosen:
// "UNLICENSED" means nobody may use the code, which is wrong for a public package.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const problems = [];
const versions = new Set();
const REPOSITORY = "git+https://github.com/teradata-labs/surfaces-ui.git";
// Every published package shares one version: changesets bumps only the
// packages in its `fixed` group together, so one left out would drift.
const fixed = new Set(JSON.parse(fs.readFileSync(path.join(root, ".changeset", "config.json"), "utf8")).fixed?.[0] ?? []);

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
  // npm checks provenance against repository.url, and refuses a publish
  // whose repository does not match the workflow that built it.
  if (pkg.repository?.url !== REPOSITORY || pkg.repository?.directory !== at) {
    problems.push(`${at}: set repository to { url: "${REPOSITORY}", directory: "${at}" }`);
  }
  if (!fixed.has(pkg.name)) problems.push(`${at}: add ${pkg.name} to the fixed group in .changeset/config.json`);
  if (!fs.existsSync(path.join(root, "packages", dir, "dist"))) problems.push(`${at}: not built (run pnpm build)`);
  // Apache-2.0 asks that the license and the NOTICE go out with the code; npm adds LICENSE by itself but not NOTICE.
  for (const name of ["LICENSE", "NOTICE"]) {
    const copy = path.join(root, "packages", dir, name);
    if (!fs.existsSync(copy) || fs.readFileSync(copy, "utf8") !== fs.readFileSync(path.join(root, name), "utf8")) problems.push(`${at}: copy ${name} from the repository root`);
  }
  if (!pkg.files?.includes("NOTICE")) problems.push(`${at}: add "NOTICE" to files`);
  if (!fs.existsSync(path.join(root, "packages", dir, "README.md"))) problems.push(`${at}: add a README (node scripts/package-readmes.mjs)`);
  if (!Array.isArray(pkg.keywords) || pkg.keywords.length === 0) problems.push(`${at}: add keywords`);
  for (const [name, spec] of Object.entries({ ...pkg.dependencies, ...pkg.peerDependencies })) {
    if (String(spec).startsWith("file:") || String(spec).startsWith("link:")) problems.push(`${at}: ${name} points at a local path`);
  }
}
if (!fs.existsSync(path.join(root, "LICENSE"))) problems.push("LICENSE: add the license text at the repository root");
try {
  execFileSync(process.execPath, [path.join(root, "scripts", "package-readmes.mjs"), "--check"], { stdio: "pipe" });
} catch {
  problems.push("README: a package README is stale (node scripts/package-readmes.mjs)");
}
if (versions.size > 1) problems.push(`versions differ (${[...versions].join(", ")}); the packages are released together`);

if (problems.length > 0) {
  console.error(`Not ready to publish:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("Every package is ready to publish.");
