import { EngineError, type Param } from "@surfaces-ui/engine";
import { SqlDialect } from "@surfaces-ui/proto";
import { blankLiterals } from "@surfaces-ui/sql";

/**
 * One value as SQL text. A database's MCP server takes a statement and
 * nothing else, so values cannot be bound; they are written so that no value
 * can change the statement.
 *
 * - Numbers are checked to be numbers.
 * - Postgres text is dollar-quoted with a tag the value does not contain. A
 *   dollar-quoted string has no escapes at all, whatever the server's
 *   `standard_conforming_strings`, and is an untyped literal, so it compares
 *   with a date or a number column as a bound value would.
 * - DuckDB and Teradata text is single-quoted with quotes doubled. Neither
 *   reads a backslash as an escape in a plain string, so a doubled quote is
 *   the only thing with meaning inside one.
 */
export function literal(value: Param, dialect: SqlDialect): string {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new EngineError("UNSUPPORTED", "A filter value is not a finite number.");
    return String(value);
  }
  if (typeof value === "boolean") return dialect === SqlDialect.TERADATA ? (value ? "1" : "0") : value ? "TRUE" : "FALSE";
  if (value.includes("\0")) throw new EngineError("UNSUPPORTED", "A filter value holds a character a database cannot take.");
  if (dialect === SqlDialect.POSTGRES) {
    let tag = "v";
    while (value.includes(`$${tag}$`)) tag += "v";
    return `$${tag}$${value}$${tag}$`;
  }
  if (dialect === SqlDialect.DUCKDB || dialect === SqlDialect.TERADATA) return `'${value.replace(/'/g, "''")}'`;
  throw new EngineError("UNSUPPORTED", "This SQL dialect cannot be sent to a data server yet.");
}

/**
 * Replaces the placeholders the SQL rewriter produced (`?`, or `$1` for
 * Postgres) with values. Placeholders inside string literals, quoted names
 * and comments are left alone, and every placeholder must have a value.
 */
export function inlineParams(sql: string, params: Param[], dialect: SqlDialect): string {
  if (params.length === 0) return sql;
  const bare = blankLiterals(sql);
  const numbered = dialect === SqlDialect.POSTGRES;
  let out = "";
  let at = 0;
  let next = 0;
  for (const match of bare.matchAll(numbered ? /\$(\d+)/g : /\?/g)) {
    const index = numbered ? Number(match[1]) - 1 : next++;
    if (index < 0 || index >= params.length) throw new EngineError("ENGINE", "The query refers to a value that was not given.");
    out += sql.slice(at, match.index) + literal(params[index]!, dialect);
    at = match.index + match[0].length;
  }
  if (!numbered && next !== params.length) throw new EngineError("ENGINE", "The query was given more values than it has places for.");
  return out + sql.slice(at);
}
