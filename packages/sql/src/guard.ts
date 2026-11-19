import { SqlError } from "./errors.js";

/** Statements that can never appear in a read-only query. */
const FORBIDDEN =
  /\b(INSERT|UPDATE|UPSERT|DELETE|MERGE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|CALL|EXEC|EXECUTE|COPY|ATTACH|DETACH|INSTALL|LOAD|PRAGMA|EXPORT|IMPORT|COLLECT|CHECKPOINT|VACUUM|RENAME|COMMENT\s+ON|BEGIN\s+TRANSACTION|COMMIT|ROLLBACK|BT|ET)\b/i;

const STARTS = /^(SELECT|SEL|WITH|LOCKING|LOCK|VALUES|TABLE|FROM)\b/i;

/**
 * Replaces string literals, quoted identifiers and comments with spaces so
 * keyword checks cannot be fooled by text inside them. Length is preserved.
 */
export function blankLiterals(sql: string): string {
  let out = "";
  let i = 0;
  const blank = (end: number) => {
    out += sql.slice(i, end).replace(/[^\n]/g, " ");
    i = end;
  };
  while (i < sql.length) {
    const c = sql[i]!;
    const next = sql[i + 1];
    if (c === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      blank(end === -1 ? sql.length : end);
    } else if (c === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      blank(end === -1 ? sql.length : end + 2);
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c) {
          if (sql[j + 1] === c) j += 2;
          else break;
        } else j++;
      }
      blank(Math.min(j + 1, sql.length));
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Removes trailing whitespace and semicolons. */
export function trimStatement(sql: string): string {
  return sql.replace(/[\s;]+$/, "").trim();
}

/**
 * Text-level read-only check, used when a statement cannot be parsed. It is
 * deliberately strict: one statement, starting like a query, containing no
 * word that begins a write or an administrative command.
 */
export function guardText(sql: string): void {
  const bare = blankLiterals(trimStatement(sql));
  if (bare.trim() === "") throw new SqlError("SYNTAX", "The query is empty.");
  if (bare.includes(";")) {
    throw new SqlError("MULTIPLE_STATEMENTS", "Only one statement can run at a time.");
  }
  if (!STARTS.test(bare.trim())) {
    throw new SqlError("NOT_READ_ONLY", "Only queries (SELECT or WITH) can run here.");
  }
  const hit = FORBIDDEN.exec(bare);
  if (hit) {
    throw new SqlError("NOT_READ_ONLY", `Only queries can run here; found ${hit[1]!.toUpperCase()}.`);
  }
}
