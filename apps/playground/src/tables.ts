import type { DataSource } from "@surfaces-ui/data";
import { useCallback, useEffect, useState } from "react";

/**
 * The tables a person is building with on a source that has no sample model
 * (a warehouse, their own database): picked in the composer's object browser,
 * told to the agent, and used when a component is added by hand. Any number
 * of tables, of any shape.
 */
export interface WorkingTable {
  /** The database or schema the table is in, when the source has more than one. */
  schema?: string;
  table: string;
  /** Read from the source when the table is picked. Names and types only. */
  columns: TableColumn[];
}

export interface TableColumn {
  name: string;
  /** The engine's own type name ("DECIMAL(12,2)", "TIMESTAMP(0)"). */
  nativeType: string;
  primaryKey?: boolean;
}

export type ColumnPart = "number" | "date" | "text" | "other";

/** What part a column could play, from its type name alone. */
export function columnPart(nativeType: string): ColumnPart {
  const type = nativeType.toUpperCase();
  if (/\b(DATE|TIMESTAMP|DATETIME)\b/.test(type)) return "date";
  if (/\b(INT|INTEGER|BIGINT|SMALLINT|TINYINT|BYTEINT|HUGEINT|DECIMAL|NUMERIC|NUMBER|FLOAT|REAL|DOUBLE)\b/.test(type) || /^U?INT\d*$/.test(type)) return "number";
  if (/\b(CHAR|VARCHAR|TEXT|STRING|ENUM)\b/.test(type) || type === "BOOLEAN") return "text";
  return "other";
}

/** A column that names a row rather than describing it: keys and anything ending in "id". */
const keyLike = (column: TableColumn) => column.primaryKey || /(^|_)(id|key|code|uuid|guid|number|no|nbr)$/i.test(column.name) || /Id$/.test(column.name);
/** Text that is written for reading, not for grouping. */
const proseLike = (name: string) => /(name|desc|comment|note|text|address|email|phone|url|title)/i.test(name);

/**
 * Which columns could be a measure, a date and categories, guessed from names
 * and types only (no values are read): the first number that is not a key,
 * the first date, and up to two text columns that look like categories.
 */
export function tableParts(columns: TableColumn[]): { measure?: string; date?: string; categories: string[] } {
  const of = (part: ColumnPart) => columns.filter((c) => columnPart(c.nativeType) === part);
  const text = of("text");
  const categories = [...text.filter((c) => !keyLike(c) && !proseLike(c.name)), ...text.filter((c) => !keyLike(c) && proseLike(c.name))].slice(0, 2);
  return { measure: of("number").find((c) => !keyLike(c))?.name, date: of("date")[0]?.name, categories: categories.map((c) => c.name) };
}

const sqlName = (name: string) => (/^[A-Za-z_]\w*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`);

/** The table's name as SQL writes it: `database.table` when it has a database or schema. */
export const tableSqlName = (table: Pick<WorkingTable, "schema" | "table">) => [table.schema, table.table].filter(Boolean).map((part) => sqlName(part!)).join(".");

/** "order_amount" and "OrderAmount" as "Order amount". */
export function columnLabel(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words[0]!.toUpperCase() + words.slice(1) : name;
}

/** Components that need no table: they are added with the catalog's own example. */
const NEEDS_TABLE = new Set(["Metric", "DataGrid", "QueryResult", "Chart", "PivotTable", "Sparkline", "BulletGraph", "SqlProposal", "QueryPlan", "SqlEditor", "ObjectDetail", "RelationshipGraph", "ContextBuilder", "ModelDiagram", "Table", "Explorer", "ReportBuilder", "FilterBar"]);

/**
 * Props for a component added by hand over a real table, or why it cannot be
 * drawn from that table. A grid works on any table; a chart needs something
 * to group by; a trend needs a date. Nothing is assumed about the table.
 */
export function tableProps(name: string, sourceId: string, table: WorkingTable | undefined, all: WorkingTable[] = table ? [table] : []): { props: Record<string, unknown> } | { missing: string } | undefined {
  if (!NEEDS_TABLE.has(name)) return undefined;
  if (!table) return { missing: `Pick a table first, under Tables on the right: ${name} needs data to draw.` };
  const sql = `SELECT * FROM ${tableSqlName(table)}`;
  const { measure, date, categories } = tableParts(table.columns);
  const [first, second] = categories;
  const what = measure ? columnLabel(measure) : "Rows";
  const y = measure ? [{ column: measure, aggregate: "sum", label: what }] : [{ aggregate: "count", label: "Rows" }];
  const named = tableSqlName(table);
  const lacks = (need: string) => ({ missing: `${named} has no ${need}, which ${name} needs. Pick another table, or ask the agent to write a query that has one.` });
  switch (name) {
    case "DataGrid":
    case "QueryResult":
    case "Table":
      return { props: { sourceId, sql } };
    case "SqlEditor":
      return { props: { value: sql, dialect: "standard" } };
    // Pills are generated from the table's own columns, so these need nothing but the table.
    case "Explorer":
      return { props: { sourceId, sql } };
    case "ReportBuilder":
      return { props: { sourceId, sql, title: `${named} report` } };
    case "FilterBar":
      return { props: { sourceId, sql, filters: { "@path": "/filters" } } };
    case "Metric":
      return { props: measure ? { sourceId, sql, column: measure, aggregate: "sum", label: `Total ${what.toLowerCase()}`, format: "compact" } : { sourceId, sql, column: table.columns[0]?.name, aggregate: "count", label: "Rows", format: "compact" } };
    case "Chart":
      if (first) return { props: { sourceId, sql, type: "bar", x: first, y, yTitle: what, label: `${what} by ${columnLabel(first).toLowerCase()}, largest first` } };
      if (date) return { props: { sourceId, sql, type: "line", x: date, xGrain: "month", y, yTitle: what, label: `${what} by month` } };
      return lacks("text or date column to group by");
    case "PivotTable":
      if (!first) return lacks("text column for its rows");
      return { props: { sourceId, sql, rows: [first], ...(second ? { columns: [second] } : date ? { columns: [{ column: date, grain: "quarter" }] } : {}), measures: y } };
    case "Sparkline":
      if (!date) return lacks("date or time column");
      return { props: { sourceId, sql, x: date, grain: "month", ...(measure ? { column: measure, aggregate: "sum" } : { column: date, aggregate: "count" }), label: `${what} by month`, format: "compact" } };
    case "BulletGraph":
      return { missing: "A bullet graph needs a target and bands that mean something for this measure. Ask the agent for one, or write it in the messages." };
    case "SqlProposal":
    case "QueryPlan": {
      const grouped = first ? `SELECT ${sqlName(first)}, COUNT(*) AS n\nFROM ${named}\nGROUP BY ${sqlName(first)}\nORDER BY n DESC` : sql;
      return { props: name === "SqlProposal" ? { sourceId, title: first ? `Rows by ${columnLabel(first).toLowerCase()}` : named, sql: grouped } : { sourceId, sql: grouped } };
    }
    case "ObjectDetail":
    case "RelationshipGraph":
      return { props: { sourceId, table: table.table } };
    case "ContextBuilder":
      return { props: { name: columnLabel(table.table), tables: all.map((t) => ({ sourceId, table: t.table })) } };
    case "ModelDiagram":
      return { props: { sourceId, tables: all.map((t) => t.table), joins: [] } };
    default:
      return undefined;
  }
}

/**
 * What the agent is told about the tables in use: names, columns and types,
 * and how the source writes SQL. With none picked it is told how to look.
 * Values are never read.
 */
export function tablesOutline(sourceId: string, dialect: string, tables: WorkingTable[]): string {
  const head = `Source "${sourceId}" (${dialect} SQL). Name tables as written here.`;
  if (tables.length === 0) return `${head} The person has not picked tables yet: find them with list_tables (use its search) and describe_table before writing SQL.`;
  return [
    `${head} The person is working with these tables:`,
    ...tables.map((t) => `- ${tableSqlName(t)}(${t.columns.map((c) => `${c.name} ${c.nativeType}${c.primaryKey ? " key" : ""}`).join(", ")})`),
    "Other tables can be found with list_tables (use its search) and describe_table.",
  ].join("\n");
}

const KEY = "surfaces.playground.tables";
type Kept = { schema?: string; table: string }[];

function loadKept(sourceId: string): Kept {
  try {
    const found = (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>)[sourceId];
    if (!Array.isArray(found)) return [];
    return found.filter((t): t is { schema?: string; table: string } => !!t && typeof t === "object" && typeof (t as { table?: unknown }).table === "string").slice(0, 12);
  } catch {
    return [];
  }
}

function saveKept(sourceId: string, tables: Kept): void {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    all[sourceId] = tables.map(({ schema, table }) => ({ ...(schema ? { schema } : {}), table }));
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage is off: the choice lasts for this page only.
  }
}

const same = (a: { schema?: string; table: string }, b: { schema?: string; table: string }) => (a.schema ?? "").toLowerCase() === (b.schema ?? "").toLowerCase() && a.table.toLowerCase() === b.table.toLowerCase();

/** The tables in use for a source: kept in this browser by name, with their columns read again from the source on load. */
export function useWorkingTables(dataSource: Pick<DataSource, "describeTable">, sourceId: string) {
  const [tables, setTables] = useState<WorkingTable[]>([]);
  const [status, setStatus] = useState<{ text: string; error?: boolean }>({ text: "" });

  const read = useCallback(
    async (ref: { catalog?: string; schema?: string; table: string }): Promise<WorkingTable> => {
      const detail = (await dataSource.describeTable({ sourceId, ref })).table;
      return { schema: ref.schema || undefined, table: ref.table, columns: (detail?.columns ?? []).map((c) => ({ name: c.name, nativeType: c.nativeType, primaryKey: c.primaryKey })) };
    },
    [dataSource, sourceId],
  );

  useEffect(() => {
    let current = true;
    setTables([]);
    const kept = loadKept(sourceId);
    if (kept.length === 0) return;
    void Promise.all(kept.map((t) => read(t).catch(() => undefined))).then((found) => {
      if (current) setTables(found.filter((t): t is WorkingTable => !!t));
    });
    return () => {
      current = false;
    };
  }, [sourceId, read]);

  const add = useCallback(
    async (ref: { catalog?: string; schema?: string; table: string }) => {
      const name = tableSqlName(ref);
      setStatus({ text: `Reading ${name}…` });
      try {
        const table = await read(ref);
        setTables((list) => {
          const next = [...list.filter((t) => !same(t, table)), table].slice(-12);
          saveKept(sourceId, next);
          return next;
        });
        setStatus({ text: `Added ${name}: ${table.columns.length} columns.` });
      } catch (error) {
        setStatus({ text: `Could not read ${name}: ${error instanceof Error ? error.message : String(error)}`, error: true });
      }
    },
    [read, sourceId],
  );

  const remove = useCallback(
    (table: { schema?: string; table: string }) =>
      setTables((list) => {
        const next = list.filter((t) => !same(t, table));
        saveKept(sourceId, next);
        return next;
      }),
    [sourceId],
  );

  return { tables, add, remove, status };
}

/**
 * Ways to start on a real source, each a full instruction for an agent that
 * has list_tables and describe_table. They ask it to look before it draws,
 * to say what it chose and why, and to leave the person a next step to press.
 */
export function onboarding(sourceLabel: string, sourceId: string, tables: WorkingTable[]): { label: string; instruction: string }[] {
  const scope = tables.length > 0 ? `Start from the tables in use (${tables.map(tableSqlName).join(", ")}); look further only if they are not enough.` : `Use list_tables (with its search) and describe_table on the "${sourceId}" source to look at up to eight tables first.`;
  const rules = "Read names and types only, never values. Name every table as database.table where it has a database. Say in two sentences which tables you chose and why, writing table and column names in backticks.";
  return [
    {
      label: "Show me what is here",
      instruction: `Onboard me to ${sourceLabel}. ${scope} Then build the surface: a title; a Markdown summary of what this source seems to hold, in three or four bullets; a Chips control offering the three to five most useful tables to start with; and a QueryResult that shows whichever one I press, with no further turn. To do that give each chip a label (the table's name) and a value (its SELECT), set the Chips' \`selected\` to a data path such as /sql, bind the QueryResult's \`sql\` to the same path, and set that path in the data model to the SELECT of the table you think is most useful. ${rules}`,
    },
    {
      label: "Build a starter dashboard",
      instruction: `Build me a starter dashboard on ${sourceLabel}. ${scope} Choose the table that suits a dashboard best: a date or time column, a number to add up, and one or two text columns to group by. Then build: a title; a headline Metric with a Sparkline of it by month beside it; a bar Chart of it by a category; and the rows as a QueryResult. If no table has all of that, build what the best one allows and say what is missing. Offer two other tables as Chips whose values are their SELECT statements, with \`selected\` set to the data path the QueryResult's \`sql\` is bound to, so pressing one shows its rows. ${rules}`,
    },
    {
      label: "Model how tables join",
      instruction: `Show me how the main tables of ${sourceLabel} join. ${scope} Pick up to five that look related by their key columns, draw them in a ModelDiagram with the joins you infer, and list each join in Markdown, saying that it is inferred from names and types. ${rules}`,
    },
  ];
}
