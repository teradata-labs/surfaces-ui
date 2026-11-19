import type { DataSource } from "./datasource.js";
import { memoryDataSource } from "./memory.js";

type Row = Record<string, unknown>;

// A date ("2026-03-01") or a date and time ("2026-03-01T09:30:00Z"), as JSON writes them.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export interface PageDataSourceOptions {
  /** ID the components name in `sourceId`. Defaults to "page". */
  sourceId?: string;
  /** Where the tables sit in the data model, "/" between parts. Defaults to "tables". */
  path?: string;
}

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Rows as JSON writes them, made ready to query: every row gets every column
 * (a key missing from a row is null), and a column whose values are all ISO
 * dates becomes dates, so charts can group it by day, month or year.
 */
export function plainRows(rows: readonly Row[]): Row[] {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  const dates = new Set(
    columns.filter((c) => {
      const values = rows.map((r) => r[c]).filter((v) => v != null);
      return values.length > 0 && values.every((v) => typeof v === "string" && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)));
    }),
  );
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((c) => {
        const value = row[c] ?? null;
        return [c, value !== null && dates.has(c) ? new Date(Date.parse(value as string)) : value];
      }),
    ),
  );
}

/**
 * The tables a page carries in its own data, by name: `{tables: {bills: [{…}, …]}}`.
 * Throws, naming the table, when one is not a list of rows.
 */
export function pageTables(data: unknown, path = "tables"): Record<string, Row[]> {
  let at: unknown = data;
  for (const part of path.split("/").filter(Boolean)) at = isRow(at) ? at[part] : undefined;
  if (at === undefined) return {};
  if (!isRow(at)) throw new Error(`The page's "${path}" should hold tables by name, each a list of rows.`);
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(at)) {
    if (!Array.isArray(rows) || !rows.every(isRow)) throw new Error(`The table "${name}" should be a list of rows, each an object of column values.`);
    tables[name] = plainRows(rows);
  }
  return tables;
}

/**
 * A data source over the rows a page carries itself, so a page works with no
 * server: components name it in `sourceId` ("page") and read a table with
 * `SELECT * FROM <name>`. Sorting, filtering, grouping and paging run in the
 * page, which suits the few thousand rows a page holds.
 */
export function pageDataSource(data: unknown, options: PageDataSourceOptions = {}): DataSource {
  return memoryDataSource({ sourceId: options.sourceId ?? "page", tables: pageTables(data, options.path) });
}
