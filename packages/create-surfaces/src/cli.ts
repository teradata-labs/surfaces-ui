#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.resolve(here, "../template");
const own = JSON.parse(fs.readFileSync(path.resolve(here, "../package.json"), "utf8")) as { version: string };

/** The packages a new app uses directly. */
const APP_PACKAGES = ["@surfaces-ui/agent", "@surfaces-ui/chat", "@surfaces-ui/client-connect", "@surfaces-ui/components", "@surfaces-ui/devtools", "@surfaces-ui/spec", "@surfaces-ui/state"];
/** The packages its data server uses. */
const SERVER_PACKAGES = ["@surfaces-ui/agent-anthropic", "@surfaces-ui/dev-server"];

export interface CreateOptions {
  /** Where to create the app. Must not exist, or be empty. */
  dir: string;
  /**
   * A Surfaces UI checkout to take the packages from, for before they are
   * published: each is packed into `vendor/` and referenced by file.
   */
  fromRepo?: string;
  /** Print progress. Default true. */
  log?: (line: string) => void;
}

/** Creates a Surfaces UI app from the template. Returns the package.json written. */
export function createApp({ dir, fromRepo, log = console.log }: CreateOptions): Record<string, unknown> {
  const target = path.resolve(dir);
  if (fs.existsSync(target) && fs.readdirSync(target).length > 0) throw new Error(`${target} is not empty.`);
  const name = path.basename(target).toLowerCase().replace(/[^a-z0-9-_.]/g, "-") || "surfaces-app";
  const title = name.replace(/[-_.]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  copyTemplate(templateDir, target, { __TITLE__: title });

  const wanted = [...APP_PACKAGES, ...SERVER_PACKAGES];
  const version = `^${own.version}`;
  let surfaces: Record<string, string> = Object.fromEntries(wanted.map((p) => [p, version]));
  let overrides: Record<string, string> = {};
  if (fromRepo) {
    const packed = packFromRepo(path.resolve(fromRepo), wanted, path.join(target, "vendor"), log);
    surfaces = Object.fromEntries(wanted.map((p) => [p, packed[p]!]));
    // Packages depend on one another by version; point every one at its tarball.
    overrides = packed;
  }
  const pkg: Record<string, unknown> = {
    name,
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      serve: "surfaces-dev",
      typecheck: "tsc",
    },
    dependencies: sortKeys({ ...surfaces, "@anthropic-ai/sdk": "^1.8.0", react: "^19.2.0", "react-dom": "^19.2.0" }),
    devDependencies: sortKeys({ "@types/node": "^24.0.0", "@types/react": "^19.2.0", "@types/react-dom": "^19.2.0", "@vitejs/plugin-react": "^5.0.0", typescript: "^5.9.0", vite: "^7.1.0" }),
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
  };
  fs.writeFileSync(path.join(target, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  log(`Created ${name} in ${target}.`);
  log("");
  log(`  cd ${path.relative(process.cwd(), target) || "."}`);
  log("  npm install");
  log("  npm run serve   # data server, with sample data; set ANTHROPIC_API_KEY for the chat");
  log("  npm run dev     # the app");
  return pkg;
}

function copyTemplate(from: string, to: string, values: Record<string, string>) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    // npm drops .gitignore from published packages, so the template keeps it as _gitignore.
    const dest = path.join(to, entry.name === "_gitignore" ? ".gitignore" : entry.name);
    if (entry.isDirectory()) copyTemplate(source, dest, values);
    else {
      let text = fs.readFileSync(source, "utf8");
      for (const [key, value] of Object.entries(values)) text = text.replaceAll(key, value);
      fs.writeFileSync(dest, text);
    }
  }
}

/** Packs the named workspace packages and every workspace package they depend on. Returns name to `file:` spec. */
function packFromRepo(repo: string, names: string[], out: string, log: (line: string) => void): Record<string, string> {
  const dirs = new Map<string, string>();
  for (const group of ["packages"]) {
    for (const entry of fs.readdirSync(path.join(repo, group))) {
      const file = path.join(repo, group, entry, "package.json");
      if (fs.existsSync(file)) dirs.set((JSON.parse(fs.readFileSync(file, "utf8")) as { name: string }).name, path.dirname(file));
    }
  }
  const needed = new Set<string>();
  const visit = (name: string) => {
    if (needed.has(name) || !dirs.has(name)) return;
    needed.add(name);
    const pkg = JSON.parse(fs.readFileSync(path.join(dirs.get(name)!, "package.json"), "utf8")) as Record<string, Record<string, string> | undefined>;
    for (const deps of [pkg.dependencies, pkg.optionalDependencies]) for (const dep of Object.keys(deps ?? {})) visit(dep);
  };
  names.forEach(visit);
  fs.mkdirSync(out, { recursive: true });
  const result: Record<string, string> = {};
  for (const name of [...needed].sort()) {
    const dir = dirs.get(name)!;
    if (!fs.existsSync(path.join(dir, "dist"))) throw new Error(`${name} is not built. Run \`pnpm build\` in ${repo} first.`);
    log(`Packing ${name}`);
    const file = execFileSync("pnpm", ["pack", "--pack-destination", out], { cwd: dir, encoding: "utf8" }).trim().split("\n").at(-1)!;
    result[name] = `file:./vendor/${path.basename(file)}`;
  }
  return result;
}

function sortKeys(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

function main(argv: string[]) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: create-surfaces <dir> [--from-repo <path to a Surfaces UI checkout>]");
    return;
  }
  const from = args.indexOf("--from-repo");
  const fromRepo = from >= 0 ? args[from + 1] : undefined;
  const dir = args.find((a, i) => !a.startsWith("--") && (from < 0 || i !== from + 1)) ?? "surfaces-app";
  try {
    createApp({ dir, fromRepo });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
