import { CheckKind, SqlDialect } from "@surfaces-ui/proto";
import { beforeAll, describe, expect, it } from "vitest";
import { checkQuery } from "./checks.js";
import { assertReadOnly, initSql } from "./rewrite.js";

beforeAll(initSql);

describe("checkQuery", () => {
  it("counts rows that share a key, leaving empty keys to a not-null check", () => {
    const q = checkQuery({ kind: CheckKind.UNIQUE, columns: ["order_id", "line"] }, "sales_clean", SqlDialect.DUCKDB);
    expect(q.sql).toBe(
      'SELECT COALESCE(SUM("n"), 0) AS "failed" FROM (SELECT COUNT(*) AS "n" FROM "sales_clean" WHERE "order_id" IS NOT NULL AND "line" IS NOT NULL GROUP BY "order_id", "line" HAVING COUNT(*) > 1) AS "repeated"',
    );
    expect(q.failingRowsSql).toBe('SELECT "order_id", "line", COUNT(*) AS "rows" FROM "sales_clean" WHERE "order_id" IS NOT NULL AND "line" IS NOT NULL GROUP BY "order_id", "line" HAVING COUNT(*) > 1');
  });

  it("counts values not found in the other table with an anti-join", () => {
    const q = checkQuery({ kind: CheckKind.RELATIONSHIPS, columns: ["customer_id"], toTable: "customers", toColumn: "id" }, "orders", SqlDialect.TERADATA);
    expect(q.sql).toBe('SELECT COUNT(*) AS "failed" FROM "orders" AS "child" LEFT JOIN "customers" AS "parent" ON "child"."customer_id" = "parent"."id" WHERE "child"."customer_id" IS NOT NULL AND "parent"."id" IS NULL');
  });

  it("binds accepted values and compares them as text, in each dialect's placeholders", () => {
    const duck = checkQuery({ kind: CheckKind.ACCEPTED_VALUES, columns: ["status"], values: ["open", "it's done"] }, "orders", SqlDialect.DUCKDB);
    expect(duck.sql).toBe('SELECT COUNT(*) AS "failed" FROM "orders" WHERE "status" IS NOT NULL AND CAST("status" AS VARCHAR) NOT IN (?, ?)');
    expect(duck.params).toEqual(["open", "it's done"]);
    // Shown to a person, so the values are written in, quoted.
    expect(duck.failingRowsSql).toContain("NOT IN ('open', 'it''s done')");
    expect(checkQuery({ kind: CheckKind.ACCEPTED_VALUES, columns: ["status"], values: ["open"] }, "orders", SqlDialect.TERADATA).sql).toContain('CAST("status" AS VARCHAR(1000)) NOT IN (?)');
    expect(checkQuery({ kind: CheckKind.ACCEPTED_VALUES, columns: ["status"], values: ["a", "b"] }, "orders", SqlDialect.POSTGRES).sql).toContain("NOT IN ($1, $2)");
  });

  it("writes not-null and row count checks", () => {
    expect(checkQuery({ kind: CheckKind.NOT_NULL, columns: ["id"] }, "t", SqlDialect.DUCKDB).sql).toBe('SELECT COUNT(*) AS "failed" FROM "t" WHERE "id" IS NULL');
    expect(checkQuery({ kind: CheckKind.ROW_COUNT, columns: [] }, "t", SqlDialect.TERADATA).sql).toBe('SELECT COUNT(*) AS "rows" FROM "t"');
  });

  it("is read-only in every dialect, and quotes names so they cannot break out", () => {
    for (const dialect of [SqlDialect.DUCKDB, SqlDialect.TERADATA, SqlDialect.POSTGRES]) {
      for (const check of [
        { kind: CheckKind.UNIQUE, columns: ["a"] },
        { kind: CheckKind.NOT_NULL, columns: ["a"] },
        { kind: CheckKind.RELATIONSHIPS, columns: ["a"], toTable: "p", toColumn: "b" },
        { kind: CheckKind.ACCEPTED_VALUES, columns: ["a"], values: ["x"] },
        { kind: CheckKind.ROW_COUNT, columns: [] },
      ]) {
        const q = checkQuery(check, "t", dialect);
        expect(() => assertReadOnly(q.sql, dialect)).not.toThrow();
      }
    }
    expect(checkQuery({ kind: CheckKind.NOT_NULL, columns: ['a" ; DROP TABLE t; --'] }, "t", SqlDialect.DUCKDB).sql).toBe('SELECT COUNT(*) AS "failed" FROM "t" WHERE "a"" ; DROP TABLE t; --" IS NULL');
  });

  it("refuses a check that is missing what it needs", () => {
    expect(() => checkQuery({ kind: CheckKind.RELATIONSHIPS, columns: ["a"] }, "t", SqlDialect.DUCKDB)).toThrow(/table and column/);
    expect(() => checkQuery({ kind: CheckKind.ACCEPTED_VALUES, columns: ["a"], values: [] }, "t", SqlDialect.DUCKDB)).toThrow(/values allowed/);
    expect(() => checkQuery({ kind: CheckKind.UNIQUE, columns: [] }, "t", SqlDialect.DUCKDB)).toThrow(/at least one column/);
  });
});
