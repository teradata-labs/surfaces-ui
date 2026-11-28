import { SqlError } from "./errors.js";

/** Statements that can never appear in a read-only query. */
const FORBIDDEN =
  /\b(INSERT|UPDATE|UPSERT|DELETE|MERGE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|CALL|EXEC|EXECUTE|COPY|ATTACH|DETACH|INSTALL|LOAD|PRAGMA|EXPORT|IMPORT|COLLECT|CHECKPOINT|VACUUM|RENAME|COMMENT\s+ON|BEGIN\s+TRANSACTION|COMMIT|ROLLBACK|BT|ET)\b/i;

const STARTS = /^(SELECT|SEL|WITH|LOCKING|LOCK|VALUES|TABLE|FROM)\b/i;

/**
 * Replaces string literals, quoted identifiers and comments with spaces so
 * keyword checks cannot be fooled by text inside them. Length is preserved.
 */
export function blankLiterals(sql: string, mysql = false): string {
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
    } else if (mysql && c === "#") {
      const end = sql.indexOf("\n", i);
      blank(end === -1 ? sql.length : end);
    } else if (c === "'" || c === '"' || (mysql && c === "`")) {
      let j = i + 1;
      while (j < sql.length) {
        // MySQL reads a backslash in a string as an escape, so the character after it never ends the string.
        if (mysql && c !== "`" && sql[j] === "\\") j += 2;
        else if (sql[j] === c) {
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

/**
 * MySQL reads a name in double quotes as text unless a session setting says
 * otherwise, and a query sent through a server cannot set one. Everything
 * this library writes puts names in double quotes, as the standard has it,
 * so for MySQL each one is rewritten in backticks. Strings in single quotes,
 * names already in backticks and comments are left as they are. It follows
 * that on a MySQL source text is written in single quotes, never double.
 */
export function mysqlNames(sql: string): string {
  const bare = blankLiterals(sql, true);
  let out = "";
  let at = 0;
  let i = 0;
  while (i < sql.length) {
    // A double quote where the blanked text begins a run is the start of a quoted name; the run ends where the text resumes.
    if (sql[i] === '"' && bare[i] === " " && (i === 0 || bare[i - 1] !== " " || sql[i - 1] === " ")) {
      let end = i + 1;
      while (end < sql.length && !(sql[end] === '"' && sql[end + 1] !== '"')) end += sql[end] === '"' || sql[end] === "\\" ? 2 : 1;
      if (end < sql.length) {
        out += `${sql.slice(at, i)}\`${sql.slice(i + 1, end).replace(/""/g, '"').replace(/`/g, "``")}\``;
        at = end + 1;
        i = end + 1;
        continue;
      }
    }
    // Step over a string, a backticked name or a comment whole, so a double quote inside one is never taken for a name.
    if (bare[i] === " " && sql[i] !== " " && sql[i] !== "\n" && sql[i] !== "\t") {
      while (i < sql.length && bare[i] === " " && !(sql[i] === " " && bare[i + 1] !== " ")) i++;
      continue;
    }
    i++;
  }
  return out + sql.slice(at);
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
