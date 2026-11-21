import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { analyticsCatalog, editPage, scriptSurfacePage, scriptSurfaces, surfaceKind, validateConversationScript, validatePage } from "@surfaces-ui/spec";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { semanticModelFromJson, semanticModelProblems } from "@surfaces-ui/data";
import { ORDER_LINES, REFUND_SHARE, RETAIL_FACTS, RETURNS_JOINED, SALES_LINES, STORE_REFUNDS, SUBSCRIBER_ROWS, TELCO_FACTS, seedSemanticModels, seeds } from "./index.js";

// DuckDB is a test-only dependency: the package itself is plain data.
const duckdb = createRequire(import.meta.url)("@duckdb/node-bindings");

type Conn = unknown;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-seeds-"));
let files = 0;
/** Runs a query and reads its rows back through a JSON file, which keeps the test off DuckDB's low-level value API. */
async function rowsOf(conn: Conn, sql: string): Promise<Record<string, unknown>[]> {
  const file = path.join(scratch, `${files++}.json`);
  await duckdb.query(conn, `COPY (${sql}) TO '${file}' (FORMAT json, ARRAY true)`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>[];
}
const one = async (conn: Conn, sql: string) => String((await rowsOf(conn, `SELECT (${sql}) AS v`))[0]?.v);

for (const seed of seeds) {
  describe(seed.id, () => {
    let db: unknown;
    let conn: Conn;
    beforeAll(async () => {
      db = await duckdb.open(":memory:");
      conn = await duckdb.connect(db);
      for (const statement of seed.sql()) await duckdb.query(conn, statement);
    });
    afterAll(() => {
      duckdb.disconnect_sync(conn);
      duckdb.close_sync(db);
    });

    it("creates every declared table, with exactly the declared columns, and rows in each", async () => {
      for (const table of seed.tables) {
        const columns = (await rowsOf(conn, `SELECT column_name FROM information_schema.columns WHERE table_name = '${table.name}' AND table_schema = 'main' ORDER BY ordinal_position`)).map((r) => r.column_name);
        expect(columns, table.name).toEqual(table.columns.map((c) => c.name));
        expect(Number(await one(conn, `SELECT COUNT(*) FROM ${table.name}`)), table.name).toBeGreaterThan(0);
      }
    });

    it("starts with semantic models that check, over columns their queries have", async () => {
      const models = seedSemanticModels(seed);
      expect(models.length).toBeGreaterThan(0);
      for (const json of models) {
        const model = semanticModelFromJson(json as never);
        expect(semanticModelProblems(model), model.name).toEqual([]);
        expect(model.sourceId).toBe(seed.id);
        const columns = [...model.dimensions, ...model.measures].flatMap((f) => (f.column ? [f.column] : []));
        // Every column a field names is one the model's query returns.
        await rowsOf(conn, `SELECT ${[...new Set(columns)].join(", ")} FROM (${model.sql}) LIMIT 0`);
      }
    });

    it("keeps primary keys unique", async () => {
      for (const table of seed.tables) {
        const key = table.primaryKey.join(", ");
        expect(await one(conn, `SELECT COUNT(*) FROM (SELECT ${key} FROM ${table.name} GROUP BY ${key} HAVING COUNT(*) > 1)`), table.name).toBe("0");
      }
    });

    it("joins on every foreign key, except where an orphan is a listed problem", async () => {
      for (const table of seed.tables) {
        for (const fk of table.foreignKeys ?? []) {
          const orphans = Number(await one(conn, `SELECT COUNT(*) FROM ${table.name} x LEFT JOIN ${fk.table} y ON y.${fk.references} = x.${fk.column} WHERE x.${fk.column} IS NOT NULL AND y.${fk.references} IS NULL`));
          const planted = seed.issues.some((i) => i.kind === "orphans" && i.table === table.name && i.column === fk.column);
          expect(orphans > 0, `${table.name}.${fk.column} -> ${fk.table}.${fk.references}`).toBe(planted);
        }
      }
    });

    it("contains every planted problem it lists", async () => {
      for (const issue of seed.issues) expect(Number(await one(conn, `SELECT COUNT(*) FROM (${issue.sql})`)), issue.description).toBeGreaterThan(0);
    });

    it("runs its pipeline's queries in order", async () => {
      for (const pipeline of seed.pipelines) {
        for (const dataset of pipeline.datasets) {
          await duckdb.query(conn, `CREATE OR REPLACE TEMP VIEW ${dataset.name} AS ${dataset.sql}`);
          expect(Number(await one(conn, `SELECT COUNT(*) FROM ${dataset.name}`)), dataset.name).toBeGreaterThan(0);
          for (const rule of dataset.expectations ?? []) await one(conn, `SELECT COUNT(*) FROM ${dataset.name} WHERE NOT (${rule.constraint})`);
        }
      }
    });

    it("declares what each pipeline dataset reads, and its key picks out one row", async () => {
      const tables = new Set(seed.tables.map((t) => t.name));
      for (const pipeline of seed.pipelines) {
        const earlier = new Set<string>();
        for (const dataset of pipeline.datasets) {
          for (const name of dataset.depends ?? []) expect(tables.has(name) || earlier.has(name), `${dataset.name} reads ${name}`).toBe(true);
          earlier.add(dataset.name);
          const key = dataset.primaryKey ?? [];
          if (key.length === 0) continue;
          await duckdb.query(conn, `CREATE OR REPLACE TEMP VIEW ${dataset.name} AS ${dataset.sql}`);
          const repeated = await one(conn, `SELECT COUNT(*) FROM (SELECT ${key.join(", ")} FROM ${dataset.name} GROUP BY ${key.join(", ")} HAVING COUNT(*) > 1)`);
          expect(Number(repeated), `${dataset.name} key ${key.join(", ")}`).toBe(0);
        }
      }
    });

    it("runs the SQL behind every starter component", async () => {
      for (const starter of seed.starters) {
        for (const component of starter.page.components) {
          if (typeof component.sql === "string") expect(await one(conn, `SELECT COUNT(*) FROM (${component.sql})`), `${starter.page.id}/${component.id}`).not.toBe("undefined");
        }
      }
    });

    it("runs the SQL behind every component its conversations draw, and joins that say they keep each row once do", async () => {
      for (const script of seed.conversations ?? []) {
        for (const { surface } of scriptSurfaces(script)) {
          for (const component of surface.components) {
            if (typeof component.sql !== "string" || component.sql.includes("{{")) continue;
            expect(Number(await one(conn, `SELECT COUNT(*) FROM (${component.sql})`)), `${script.id}/${surface.id}/${component.id}`).toBeGreaterThan(0);
          }
        }
      }
      if (seed.id === "retail") {
        expect(await one(conn, `SELECT COUNT(*) FROM (${RETURNS_JOINED})`)).toBe(await one(conn, "SELECT COUNT(*) FROM returns"));
        expect(await one(conn, `SELECT SUM(revenue) FROM (${REFUND_SHARE})`)).toBe(await one(conn, "SELECT SUM(line_amount) FROM order_items"));
        // The wide query for exploring keeps one row per order line and every refund.
        expect(await one(conn, `SELECT COUNT(*) FROM (${SALES_LINES})`)).toBe(await one(conn, "SELECT COUNT(*) FROM order_items"));
        expect(await one(conn, `SELECT SUM(refund_amount) FROM (${SALES_LINES})`)).toBe(await one(conn, "SELECT SUM(refund_amount) FROM returns"));
        expect(await one(conn, `SELECT SUM(refunded) FROM (${STORE_REFUNDS})`)).toBe(await one(conn, "SELECT SUM(refund_amount) FROM returns"));
        // The end-to-end conversation: its model's rows keep one row per line and every refund, and each count it states is the seed's.
        expect(await one(conn, `SELECT COUNT(*) FROM (${ORDER_LINES})`)).toBe(await one(conn, "SELECT COUNT(*) FROM order_items"));
        expect(await one(conn, `SELECT SUM(refund_amount) FROM (${ORDER_LINES})`)).toBe(await one(conn, "SELECT SUM(refund_amount) FROM returns"));
        const facts: Record<keyof typeof RETAIL_FACTS, string> = {
          lines: "SELECT COUNT(*) FROM order_items",
          orders: "SELECT COUNT(*) FROM orders",
          customers: "SELECT COUNT(*) FROM customers",
          negativeLines: "SELECT COUNT(*) FROM order_items WHERE quantity <= 0",
          orphanOrders: "SELECT COUNT(*) FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id WHERE c.customer_id IS NULL",
          repeatedEmails: "SELECT COUNT(*) FROM (SELECT email FROM customers WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1)",
          missingEmails: "SELECT COUNT(*) FROM customers WHERE email IS NULL",
          completedLinesKept: "SELECT COUNT(*) FROM order_items i JOIN orders o ON o.order_id = i.order_id WHERE o.status = 'completed' AND i.quantity > 0",
          completedLinesDropped: "SELECT COUNT(*) FROM order_items i JOIN orders o ON o.order_id = i.order_id WHERE o.status = 'completed' AND NOT (i.quantity > 0)",
        };
        for (const [name, sql] of Object.entries(facts)) expect(Number(await one(conn, sql)), name).toBe(RETAIL_FACTS[name as keyof typeof RETAIL_FACTS]);
      }
      if (seed.id === "telco") {
        expect(await one(conn, `SELECT COUNT(*) FROM (${SUBSCRIBER_ROWS})`)).toBe(await one(conn, "SELECT COUNT(*) FROM subscribers"));
        const facts: Record<keyof typeof TELCO_FACTS, string> = {
          subscribers: "SELECT COUNT(*) FROM subscribers",
          churned: `SELECT COUNT(churned_on) FROM (${SUBSCRIBER_ROWS})`,
          usageDays: "SELECT COUNT(*) FROM usage_daily",
          negativeUsageDays: "SELECT COUNT(*) FROM usage_daily WHERE data_mb < 0",
          tickets: "SELECT COUNT(*) FROM tickets",
          ticketsResolvedEarly: "SELECT COUNT(*) FROM tickets WHERE resolved_at < opened_at",
          lowerCaseRegions: "SELECT COUNT(*) FROM subscribers WHERE region <> upper(substr(region, 1, 1)) || substr(region, 2)",
          regions: `SELECT COUNT(DISTINCT region) FROM (${SUBSCRIBER_ROWS})`,
        };
        for (const [name, sql] of Object.entries(facts)) expect(Number(await one(conn, sql)), name).toBe(TELCO_FACTS[name as keyof typeof TELCO_FACTS]);
        // Every subscriber has exactly one contract, so the model's join adds one row.
        expect(await one(conn, "SELECT MAX(n) FROM (SELECT COUNT(*) AS n FROM contracts GROUP BY subscriber_id)")).toBe("1");
      }
    });

    it("is the same data every time for the same parameters, and different for another seed", async () => {
      const fingerprint = async (statements: string[]) => {
        const other = await duckdb.connect(db);
        await duckdb.query(other, "CREATE SCHEMA IF NOT EXISTS again; USE again");
        for (const statement of statements) await duckdb.query(other, statement);
        const t = seed.tables[seed.tables.length - 1]!;
        const value = await one(other, `SELECT md5(string_agg(CAST(x AS VARCHAR), '|' ORDER BY ${t.primaryKey.join(", ")})) FROM ${t.name} x`);
        await duckdb.query(other, "USE memory; DROP SCHEMA again CASCADE");
        duckdb.disconnect_sync(other);
        return value;
      };
      const t = seed.tables[seed.tables.length - 1]!;
      const original = await one(conn, `SELECT md5(string_agg(CAST(x AS VARCHAR), '|' ORDER BY ${t.primaryKey.join(", ")})) FROM ${t.name} x`);
      expect(await fingerprint(seed.sql())).toBe(original);
      expect(await fingerprint(seed.sql({ seed: 7 }))).not.toBe(original);
      // The largest seed there is: its product with the multiplier does not fit 32 bits.
      expect(await fingerprint(seed.sql({ seed: 99999 }))).not.toBe(original);
      // Builds the seed twice more; a shared CI runner takes well over the default five seconds.
    }, 60_000);
  });

  describe(`${seed.id} conversations`, () => {
    it("draws only what the catalog allows, says who answers, and ends in a surface to keep", () => {
      for (const script of seed.conversations ?? []) {
        expect(validateConversationScript(script, analyticsCatalog), script.id).toEqual([]);
        expect(script.answeredBy).toMatch(/not a model/);
        const last = script.turns.at(-1)?.reply.flatMap((part) => ("surface" in part ? [part.surface] : [])).at(-1);
        expect(last && validatePage(scriptSurfacePage(last, analyticsCatalog), analyticsCatalog), script.id).toEqual([]);
        // Every event a drawn control can send has an answer written for it.
        const sent = new Set(scriptSurfaces(script).flatMap(({ surface }) => surface.components.flatMap((c) => ((c.action as { event?: { name?: string } } | undefined)?.event?.name ? [(c.action as { event: { name: string } }).event.name] : []))));
        for (const name of sent) expect((script.events ?? []).some((event) => event.name === name), `${script.id}: ${name}`).toBe(true);
      }
    });
  });

  describe(`${seed.id} starters`, () => {
    it("has one of each kind, each a valid page whose kind is recognised", () => {
      expect(seed.starters.map((s) => s.kind).sort()).toEqual(["dag", "dashboard", "data-explorer", "form", "metadata-explorer"]);
      for (const starter of seed.starters) {
        expect(validatePage(starter.page, analyticsCatalog), starter.page.id).toEqual([]);
        expect(surfaceKind(starter.page), starter.page.id).toBe(starter.kind);
        expect(editPage(starter.page, [], analyticsCatalog).rejected).toEqual([]);
      }
    });

    it("describes every table and column, and marks invented personal data", () => {
      for (const table of seed.tables) {
        expect(table.description.length, table.name).toBeGreaterThan(10);
        for (const column of table.columns) expect(column.description, `${table.name}.${column.name}`).toBeTruthy();
      }
      expect(seed.tables.flatMap((t) => t.columns).some((c) => c.pii)).toBe(true);
    });

    it("offers a form whose fields the catalog accepts", () => {
      const form = seed.starters.find((s) => s.kind === "form")!.page.components.find((c) => c.component === "Form")!;
      expect(analyticsCatalog.validateComponent(form)).toEqual([]);
      expect(form.formId).toBe(seed.forms[0]!.id);
    });
  });
}

describe("every model's conversations", () => {
  // The Sample analysis page shows a picked model's own conversations; none may fall back to another model's.
  it("are about that model's own tables", () => {
    for (const seed of seeds) {
      expect(seed.conversations?.length, seed.id).toBeGreaterThan(0);
      const sources = new Set(seed.conversations!.flatMap((c) => scriptSurfaces(c).flatMap(({ surface }) => surface.components.map((x) => x.sourceId).filter(Boolean))));
      expect([...sources], seed.id).toEqual([seed.id]);
    }
  });
});
