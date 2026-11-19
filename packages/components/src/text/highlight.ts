/**
 * A small syntax highlighter for the languages this library shows: JSON,
 * SQL, TypeScript and JavaScript, shell, Protocol Buffers, YAML and CSS.
 * It splits code into tokens with a kind; colours come from the theme
 * (`--sf-code-*`), so highlighting changes with it. Text is never turned
 * into HTML: the tokens are drawn as React text.
 */

export type TokenKind = "keyword" | "string" | "number" | "literal" | "comment" | "property" | "function" | "type" | "punctuation";

export interface CodeToken {
  text: string;
  /** Plain text has no kind. */
  kind?: TokenKind;
}

/** Longer code is shown as plain text: highlighting it would cost more than it helps. */
export const HIGHLIGHT_LIMIT = 100_000;

type Rule = [RegExp, TokenKind | ((match: RegExpExecArray, rest: string) => TokenKind | undefined)];

const words = (list: string) => new Set(list.split(/\s+/).filter(Boolean));

const SQL_KEYWORDS = words(`
  select from where and or not in is null as on join inner left right full outer cross natural using group by order having limit offset top
  qualify window over partition rows range between unbounded preceding following current row distinct all union intersect except minus with
  recursive case when then else end asc desc nulls first last insert into values update set delete merge create replace table view temporary temp
  drop alter add column primary key foreign references unique check default if exists cast try_cast like ilike similar escape any some sample
  explain describe show filter within lateral pivot unpivot fetch next only interval at time zone collate returning materialized
`);
const SQL_TYPES = words(`
  integer int smallint bigint tinyint hugeint byteint decimal numeric real float double precision boolean bool varchar char character text string
  date timestamp timestamptz time blob bytea json uuid varbinary struct list map array number clob
`);
const SQL_LITERALS = words("true false null");

const JS_KEYWORDS = words(`
  const let var function return if else for while do switch case break continue default new delete typeof instanceof in of try catch finally throw
  class extends super this import export from as async await yield static get set type interface enum implements declare readonly keyof satisfies
  abstract private protected public namespace void
`);
const JS_LITERALS = words("true false null undefined NaN Infinity");
const JS_TYPES = words("string number boolean bigint symbol object unknown any never");

const SHELL_KEYWORDS = words("if then else elif fi for in do done while until case esac function return export local set unset source alias");
const PROTO_KEYWORDS = words("syntax edition package import public weak option message enum service rpc returns stream repeated optional required oneof map reserved extend to max");
const PROTO_TYPES = words("double float int32 int64 uint32 uint64 sint32 sint64 fixed32 fixed64 sfixed32 sfixed64 bool string bytes");

const IDENT = /[A-Za-z_][\w$]*/y;

/** An identifier: a keyword, type, literal, function call or plain name. */
function ident(keywords: Set<string>, types: Set<string>, literals: Set<string>, caseless: boolean): Rule {
  return [
    IDENT,
    (match, rest) => {
      const word = caseless ? match[0].toLowerCase() : match[0];
      if (literals.has(word)) return "literal";
      if (keywords.has(word)) return "keyword";
      if (types.has(word)) return "type";
      if (/^\s*\(/.test(rest)) return "function";
      return undefined;
    },
  ];
}

const NUMBER: Rule = [/-?(?:0x[\da-fA-F]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?n?)\b/y, "number"];
const PUNCTUATION: Rule = [/[{}[\]();,.:=<>+\-*/%!&|^~?@]+/y, "punctuation"];
const SPACE: Rule = [/\s+/y, () => undefined];

const LANGUAGES: Record<string, Rule[]> = {
  json: [
    SPACE,
    [/"(?:[^"\\\n]|\\.)*"(?=\s*:)/y, "property"],
    [/"(?:[^"\\\n]|\\.)*"?/y, "string"],
    NUMBER,
    [/\b(?:true|false|null)\b/y, "literal"],
    [/[{}[\],:]/y, "punctuation"],
  ],
  sql: [
    SPACE,
    [/--[^\n]*/y, "comment"],
    [/\/\*[\s\S]*?(?:\*\/|$)/y, "comment"],
    [/'(?:[^']|'')*'?/y, "string"],
    [/"(?:[^"]|"")*"?/y, "property"],
    [/(?<=\.)[A-Za-z_]\w*/y, "property"],
    NUMBER,
    [/[?$]\d*/y, "literal"],
    ident(SQL_KEYWORDS, SQL_TYPES, SQL_LITERALS, true),
    PUNCTUATION,
  ],
  ts: [
    SPACE,
    [/\/\/[^\n]*/y, "comment"],
    [/\/\*[\s\S]*?(?:\*\/|$)/y, "comment"],
    [/`(?:[^`\\]|\\.)*`?/y, "string"],
    [/"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/y, "string"],
    NUMBER,
    [/(?<=\.)[A-Za-z_$][\w$]*(?!\s*\()/y, "property"],
    [/[A-Za-z_$][\w$]*(?=\s*\??:(?!:))/y, "property"],
    [/[A-Z][\w$]*/y, "type"],
    ident(JS_KEYWORDS, JS_TYPES, JS_LITERALS, false),
    PUNCTUATION,
  ],
  shell: [
    SPACE,
    [/#[^\n]*/y, "comment"],
    [/"(?:[^"\\]|\\.)*"?|'[^']*'?/y, "string"],
    [/\$\{?[\w@*#?]+\}?/y, "property"],
    [/(?<=^|\s)--?[\w-]+/y, "type"],
    [/(?<=^|[|;&]\s*|\n\s*)[\w./@-]+/y, "function"],
    NUMBER,
    ident(SHELL_KEYWORDS, new Set(), new Set(), false),
    PUNCTUATION,
  ],
  proto: [
    SPACE,
    [/\/\/[^\n]*/y, "comment"],
    [/\/\*[\s\S]*?(?:\*\/|$)/y, "comment"],
    [/"(?:[^"\\\n]|\\.)*"?/y, "string"],
    NUMBER,
    [/[A-Z][\w.]*/y, "type"],
    ident(PROTO_KEYWORDS, PROTO_TYPES, words("true false"), false),
    PUNCTUATION,
  ],
  yaml: [
    SPACE,
    [/#[^\n]*/y, "comment"],
    [/(?<=^|\n)[ \t]*(?:- )?[\w./-]+(?=:(?:\s|$))/y, "property"],
    [/"(?:[^"\\\n]|\\.)*"?|'[^'\n]*'?/y, "string"],
    NUMBER,
    [/\b(?:true|false|null|yes|no|on|off)\b/y, "literal"],
    [/[:\-[\]{},|>]/y, "punctuation"],
  ],
  css: [
    SPACE,
    [/\/\*[\s\S]*?(?:\*\/|$)/y, "comment"],
    [/"[^"\n]*"?|'[^'\n]*'?/y, "string"],
    [/--[\w-]+/y, "property"],
    [/[\w-]+(?=\s*:)/y, "property"],
    [/@[\w-]+/y, "keyword"],
    [/#[\da-fA-F]{3,8}\b/y, "number"],
    [/-?\d*\.?\d+(?:px|rem|em|%|s|ms|vh|vw|deg)?/y, "number"],
    [/[\w-]+(?=\()/y, "function"],
    [/[.#][\w-]+/y, "type"],
    PUNCTUATION,
  ],
};

const ALIASES: Record<string, string> = {
  javascript: "ts",
  js: "ts",
  jsx: "ts",
  mjs: "ts",
  typescript: "ts",
  tsx: "ts",
  bash: "shell",
  sh: "shell",
  zsh: "shell",
  console: "shell",
  protobuf: "proto",
  yml: "yaml",
  jsonc: "json",
  json5: "json",
  a2ui: "json",
  duckdb: "sql",
  teradata: "sql",
  postgres: "sql",
  postgresql: "sql",
};

/** The highlighter's name for a code fence's language, or undefined when it has none. */
export function languageOf(language: string | undefined): string | undefined {
  const name = (language ?? "").trim().toLowerCase();
  if (!name) return undefined;
  const resolved = ALIASES[name] ?? name;
  return resolved in LANGUAGES ? resolved : undefined;
}

/**
 * Splits code into tokens. Unknown languages, and code past
 * `HIGHLIGHT_LIMIT`, come back as a single plain token. Joining the tokens'
 * text always gives back the code exactly.
 */
export function highlight(code: string, language: string | undefined): CodeToken[] {
  const rules = LANGUAGES[languageOf(language) ?? ""];
  if (!rules || code.length > HIGHLIGHT_LIMIT) return [{ text: code }];
  const out: CodeToken[] = [];
  const push = (text: string, kind?: TokenKind) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push(kind ? { text, kind } : { text });
  };
  let at = 0;
  outer: while (at < code.length) {
    for (const [pattern, kind] of rules) {
      pattern.lastIndex = at;
      const match = pattern.exec(code);
      if (!match || match[0].length === 0) continue;
      const resolved = typeof kind === "function" ? kind(match, code.slice(at + match[0].length, at + match[0].length + 4)) : kind;
      push(match[0], resolved);
      at += match[0].length;
      continue outer;
    }
    push(code[at]!);
    at++;
  }
  return out;
}
