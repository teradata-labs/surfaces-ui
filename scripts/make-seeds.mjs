// Writes every seed's tables to packages/seeds/data/<seed>/<table>.parquet, from the
// generator SQL in @surfaces-ui/seeds. Deterministic: the same parameters give
// the same files.
//
//   pnpm --filter @surfaces-ui/seeds build && node scripts/make-seeds.mjs [--scale 1] [--seed 42] [--only retail]
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "packages/engine-duckdb/package.json"));
const duckdb = require("@duckdb/node-bindings");
const { seeds } = await import(path.join(root, "packages/seeds/dist/index.js"));

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(" ")
    .split("--")
    .filter(Boolean)
    .map((part) => part.trim().split(/\s+/)),
);
const params = { ...(args.scale ? { scale: Number(args.scale) } : {}), ...(args.seed ? { seed: Number(args.seed) } : {}) };
const out = path.resolve(root, args.out ?? "packages/seeds/data");

for (const seed of seeds.filter((s) => !args.only || s.id === args.only)) {
  const db = await duckdb.open(":memory:");
  const conn = await duckdb.connect(db);
  const started = Date.now();
  for (const statement of seed.sql(params)) await duckdb.query(conn, statement);
  const dir = path.join(out, seed.id);
  fs.mkdirSync(dir, { recursive: true });
  const sizes = [];
  for (const table of seed.tables) {
    const file = path.join(dir, `${table.name}.parquet`);
    // Sorted by the primary key so the bytes do not depend on thread scheduling.
    await duckdb.query(conn, `COPY (SELECT * FROM ${table.name} ORDER BY ${table.primaryKey.join(", ")}) TO '${file.replace(/'/g, "''")}' (FORMAT parquet, COMPRESSION zstd)`);
    sizes.push(`${table.name} ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }
  duckdb.disconnect_sync(conn);
  duckdb.close_sync(db);
  console.log(`${seed.id}: ${sizes.join(", ")} (${Date.now() - started} ms)`);
}
