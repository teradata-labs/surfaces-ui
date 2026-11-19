import { EngineError } from "@surfaces-ui/engine";

type Code = EngineError["code"];

/** Teradata error numbers the UI can say something useful about. */
const CODES: Record<string, Code> = {
  // Syntax.
  "3706": "SYNTAX",
  "3707": "SYNTAX",
  "3704": "SYNTAX",
  // Object or database does not exist.
  "3807": "UNKNOWN_TABLE",
  "3802": "UNKNOWN_TABLE",
  // Column does not exist, or is not in the table named.
  "3810": "UNKNOWN_COLUMN",
  "5628": "UNKNOWN_COLUMN",
  // The request was aborted by the user (3110) or by a workload rule (3156).
  "3110": "CANCELLED",
  "3156": "CANCELLED",
};

/** What a person can do about a failure the message alone does not explain. */
const HINTS: Record<string, string> = {
  "3523": "This user has no access to it. Ask for SELECT on the object, or choose another.",
  "2646": "The query ran out of spool space. Narrow it with a filter, fewer columns or a coarser grouping.",
  "2644": "The database is out of space.",
  "3610": "Teradata hit an internal error running this query. Try a simpler form of it.",
  "2631": "The query was stopped by a deadlock. Run it again.",
};

/**
 * Turns a Teradata failure into an EngineError. `code` is the error number
 * when the transport gives it separately; otherwise it is read from the
 * `[Error 3807]` tag drivers put in the message.
 *
 * Teradata reports no character position for an error (a syntax error names
 * the words it sits between instead), so none is set.
 */
export function teradataError(code: string | number | undefined, message: string): EngineError {
  const tagged = /\[Error (\d+)\]/.exec(message)?.[1];
  const number = String(code ?? "").trim() || tagged || "";
  // Drivers wrap the message in tags: [Teradata Database] [TeraJDBC 20.00] [Error 3807] [SQLState 42S02] ...
  const lines = message.split("\n").map((line) => line.replace(/^(\s*\[[^\]]*\])+\s*/, "").trim());
  const clean = lines.find((line) => line !== "") ?? "";
  const hint = HINTS[number];
  const text = [clean, hint].filter(Boolean).join(" ") || "The query failed.";
  return new EngineError(CODES[number] ?? "ENGINE", text, number);
}

/** Replaces every occurrence of the given secrets, in any of the forms given, so none can leave in a message. */
export function scrub(text: string, secrets: (string | undefined)[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join("***");
  }
  return out;
}
