import { pythonLiteral } from "./python.js";

/** One column of a result. `type` is the database's own name for it, when the server says. */
export interface SqlColumn {
  name: string;
  type?: string;
}

/** A query's rows as a database's MCP server returned them, read into one form. */
export interface SqlRows {
  /** Empty when the server sent no rows and no column list, which most do for an empty result. */
  columns: SqlColumn[];
  rows: unknown[][];
  /** True when the server said it cut the result short. */
  truncated: boolean;
}

/** What `callTool` answers with, as far as this reader needs it. */
export interface ToolAnswer {
  content?: unknown;
  structuredContent?: unknown;
  isError?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isRowObjects = (value: unknown): value is Record<string, unknown>[] => Array.isArray(value) && value.every(isRecord);

function fromObjects(rows: Record<string, unknown>[], columns?: SqlColumn[], truncated = false): SqlRows {
  const names = columns?.map((c) => c.name) ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return { columns: columns ?? names.map((name) => ({ name })), rows: rows.map((row) => names.map((name) => row[name] ?? null)), truncated };
}

/** Finds rows in a parsed value: a list of row objects, or one of the envelopes servers wrap them in. */
function fromValue(value: unknown): SqlRows | undefined {
  if (isRowObjects(value)) return fromObjects(value);
  if (!isRecord(value)) return undefined;
  const truncated = value.truncated === true || (isRecord(value.metadata) && value.metadata.truncated === true);
  // Teradata: { status, results: [row objects], metadata: { columns: [{ name, type }], truncated? } }
  if (isRowObjects(value.results)) {
    const described = isRecord(value.metadata) && Array.isArray(value.metadata.columns) ? value.metadata.columns.filter(isRecord) : undefined;
    return fromObjects(value.results, described?.map((c) => ({ name: String(c.name), ...(typeof c.type === "string" ? { type: c.type } : {}) })), truncated);
  }
  // DuckDB (MotherDuck): { success, columns: [names], columnTypes: [types], rows: [[values]] }
  if (Array.isArray(value.columns) && Array.isArray(value.rows)) {
    const types = Array.isArray(value.columnTypes) ? value.columnTypes : [];
    const columns = value.columns.map((c, i) => (isRecord(c) ? { name: String(c.name), ...(typeof c.type === "string" ? { type: c.type } : {}) } : { name: String(c), ...(typeof types[i] === "string" ? { type: types[i] as string } : {}) }));
    if (isRowObjects(value.rows) && value.rows.length > 0) return fromObjects(value.rows, columns, truncated);
    return { columns, rows: (value.rows as unknown[]).map((row) => (Array.isArray(row) ? row : [row])), truncated };
  }
  for (const key of ["rows", "result", "data", "value", "records"]) {
    const inner = value[key];
    if (isRowObjects(inner)) return { ...fromObjects(inner), truncated: truncated || "after" in value };
    // Supabase: { result: "prose <untrusted-data-…>[rows]</untrusted-data-…> prose" }
    if (typeof inner === "string") {
      const found = fromText(inner);
      if (found) return found;
    }
  }
  return undefined;
}

function fromText(text: string): SqlRows | undefined {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === "No results") return { columns: [], rows: [], truncated: false };
  const fenced = /<untrusted-data-[^>]*>\s*([\s\S]*?)\s*<\/untrusted-data-[^>]*>/.exec(trimmed);
  for (const candidate of fenced ? [trimmed, fenced[1]!] : [trimmed]) {
    if (/^[[{]/.test(candidate)) {
      try {
        const found = fromValue(JSON.parse(candidate));
        if (found) return found;
      } catch {
        // Not JSON; a Python server may have sent its own literal form.
      }
      const found = fromValue(pythonLiteral(candidate));
      if (found) return found;
    }
  }
  return undefined;
}

/** The message of a failed call, with the server's own wrapping taken off. */
export function toolError(answer: ToolAnswer): string | undefined {
  const blocks = Array.isArray(answer.content) ? answer.content.filter(isRecord) : [];
  const text = blocks.map((block) => (typeof block.text === "string" ? block.text : "")).join("\n").trim();
  const read = (source: string): string | undefined => {
    const start = source.indexOf("{");
    if (start === -1) return undefined;
    try {
      const parsed: unknown = JSON.parse(source.slice(start));
      if (isRecord(parsed) && (parsed.success === false || parsed.status === "error")) return String(parsed.error ?? parsed.message ?? "");
    } catch {
      // Plain text.
    }
    return undefined;
  };
  if (answer.isError === true) return read(text) ?? text.replace(/^Error( calling tool '[^']*')?:\s*/i, "") ?? "The data server reported an error.";
  // Some servers report a failure as ordinary text.
  if (blocks.length === 1 && /^Error:\s/.test(text)) return text.replace(/^Error:\s*/, "");
  return read(text);
}

/**
 * Reads the rows out of a query tool's answer, whatever shape the server
 * uses: structured content, JSON text (a list of row objects or an envelope
 * around one), one JSON object per text block, JSON inside prose, or a Python
 * literal. Throws when nothing in the answer is rows.
 */
export function readRows(answer: ToolAnswer): SqlRows {
  const structured = fromValue(answer.structuredContent);
  if (structured) return structured;
  const texts = (Array.isArray(answer.content) ? answer.content.filter(isRecord) : []).flatMap((block) => (typeof block.text === "string" ? [block.text] : []));
  if (texts.length === 0) return { columns: [], rows: [], truncated: false };
  for (const text of texts) {
    const found = fromText(text);
    // An empty reading of one block (a note such as a timing line read as nothing) is not the answer while others remain.
    if (found && (found.rows.length > 0 || found.columns.length > 0 || texts.length === 1 || /^\s*\[\s*\]\s*$/.test(text))) return found;
  }
  // One JSON object per block is one row per block.
  const rows: Record<string, unknown>[] = [];
  for (const text of texts) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isRecord(parsed)) return unread();
      rows.push(parsed);
    } catch {
      return unread();
    }
  }
  return fromObjects(rows);
}

function unread(): never {
  throw new Error("The data server answered in a form that is not rows. Name its query tool and check that it returns JSON.");
}
