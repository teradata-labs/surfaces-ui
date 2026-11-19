import { CheckKind, SqlDialect } from "@surfaces-ui/proto";
import { SqlError } from "./errors.js";
import { type Param, numberPlaceholders } from "./rewrite.js";

/** What a check needs to be written as SQL. The same fields as the `Check` message. */
export interface CheckSpec {
  kind: CheckKind;
  columns: string[];
  toTable?: string;
  toColumn?: string;
  values?: string[];
}

export interface CheckQuery {
  /**
   * One read-only query returning one row. Its column `failed` counts the
   * rows that break the check; for ROW_COUNT, `rows` is the number of rows
   * and the caller compares it with the bounds.
   */
  sql: string;
  params: Param[];
  /** A query listing what breaks the check, for a person to run through the read-only path. Values are written in, not bound, since it is shown. */
  failingRowsSql: string;
}

const quote = (identifier: string): string => {
  if (!identifier) throw new SqlError("INVALID_VIEW", "A check names an empty column or table.");
  return `"${identifier.replace(/"/g, '""')}"`;
};
const text = (value: string) => `'${value.replace(/'/g, "''")}'`;
const NUMBERED = new Set<SqlDialect>([SqlDialect.DATAFUSION, SqlDialect.POSTGRES]);
const varchar = (dialect: SqlDialect) => (dialect === SqlDialect.DUCKDB || dialect === SqlDialect.DATAFUSION ? "VARCHAR" : "VARCHAR(1000)");

/**
 * The SQL for one check over a built dataset (or any table), in the given
 * dialect. Every form is a single SELECT that counts, so it passes the
 * read-only check and reads no values back. Written so DuckDB, Teradata,
 * Postgres and DataFusion all accept it: no LIMIT, derived tables named,
 * values bound as parameters.
 */
export function checkQuery(check: CheckSpec, table: string, dialect: SqlDialect): CheckQuery {
  const from = quote(table);
  const one = () => {
    const column = check.columns[0];
    if (!column) throw new SqlError("INVALID_VIEW", "This check needs a column.");
    return quote(column);
  };
  let result: CheckQuery;
  switch (check.kind) {
    case CheckKind.UNIQUE: {
      if (check.columns.length === 0) throw new SqlError("INVALID_VIEW", "A unique check needs at least one column.");
      const keys = check.columns.map(quote).join(", ");
      // Rows whose key is empty are left to a not-null check, as dbt does.
      const present = check.columns.map((c) => `${quote(c)} IS NOT NULL`).join(" AND ");
      result = {
        sql: `SELECT COALESCE(SUM("n"), 0) AS "failed" FROM (SELECT COUNT(*) AS "n" FROM ${from} WHERE ${present} GROUP BY ${keys} HAVING COUNT(*) > 1) AS "repeated"`,
        params: [],
        failingRowsSql: `SELECT ${keys}, COUNT(*) AS "rows" FROM ${from} WHERE ${present} GROUP BY ${keys} HAVING COUNT(*) > 1`,
      };
      break;
    }
    case CheckKind.NOT_NULL: {
      const column = one();
      result = { sql: `SELECT COUNT(*) AS "failed" FROM ${from} WHERE ${column} IS NULL`, params: [], failingRowsSql: `SELECT * FROM ${from} WHERE ${column} IS NULL` };
      break;
    }
    case CheckKind.RELATIONSHIPS: {
      const column = one();
      if (!check.toTable || !check.toColumn) throw new SqlError("INVALID_VIEW", "A relationships check needs the table and column its values must be found in.");
      const join = `FROM ${from} AS "child" LEFT JOIN ${quote(check.toTable)} AS "parent" ON "child".${column} = "parent".${quote(check.toColumn)} WHERE "child".${column} IS NOT NULL AND "parent".${quote(check.toColumn)} IS NULL`;
      result = { sql: `SELECT COUNT(*) AS "failed" ${join}`, params: [], failingRowsSql: `SELECT "child".* ${join}` };
      break;
    }
    case CheckKind.ACCEPTED_VALUES: {
      const column = one();
      const values = check.values ?? [];
      if (values.length === 0) throw new SqlError("INVALID_VIEW", "An accepted values check needs the values allowed.");
      // Compared as text, so a number column can be checked against the values as written.
      const value = `CAST(${column} AS ${varchar(dialect)})`;
      result = {
        sql: `SELECT COUNT(*) AS "failed" FROM ${from} WHERE ${column} IS NOT NULL AND ${value} NOT IN (${values.map(() => "?").join(", ")})`,
        params: values,
        failingRowsSql: `SELECT ${column}, COUNT(*) AS "rows" FROM ${from} WHERE ${column} IS NOT NULL AND ${value} NOT IN (${values.map(text).join(", ")}) GROUP BY ${column}`,
      };
      break;
    }
    case CheckKind.ROW_COUNT:
      result = { sql: `SELECT COUNT(*) AS "rows" FROM ${from}`, params: [], failingRowsSql: "" };
      break;
    default:
      throw new SqlError("INVALID_VIEW", "This check has no kind.");
  }
  return NUMBERED.has(dialect) ? { ...result, sql: numberPlaceholders(result.sql) } : result;
}
