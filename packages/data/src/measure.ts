/**
 * Arithmetic over a query's aggregates, by name: `refunded / revenue`,
 * `(revenue - cost) / revenue * 100`. This is the whole language of a
 * derived measure: names, numbers, + - * / and parentheses. It has no
 * functions, strings or comparisons, so an expression can be written by a
 * person or a model and still only ever do arithmetic on summarised numbers.
 *
 * One parser is used everywhere: a form checks what a person typed, the SQL
 * rewriter writes it out for the engine, and the in-memory source works it
 * out for tests.
 */
export type MeasureNode =
  | { kind: "number"; value: number }
  | { kind: "name"; name: string }
  | { kind: "negate"; of: MeasureNode }
  | { kind: "binary"; op: "+" | "-" | "*" | "/"; left: MeasureNode; right: MeasureNode };

/** Thrown for an expression that cannot be read, with where the problem is. */
export class MeasureExpressionError extends Error {
  constructor(
    message: string,
    /** 0-based position in the expression. */
    readonly at: number,
  ) {
    super(message);
    this.name = "MeasureExpressionError";
  }
}

const MAX_LENGTH = 400;
const MAX_DEPTH = 24;

interface Token {
  type: "number" | "name" | "op" | "open" | "close";
  text: string;
  at: number;
}

function tokens(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const number = /^\d+(\.\d+)?/.exec(text.slice(i));
    if (number) {
      out.push({ type: "number", text: number[0], at: i });
      i += number[0].length;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i));
    if (name) {
      out.push({ type: "name", text: name[0], at: i });
      i += name[0].length;
      continue;
    }
    if ("+-*/".includes(ch)) out.push({ type: "op", text: ch, at: i });
    else if (ch === "(") out.push({ type: "open", text: ch, at: i });
    else if (ch === ")") out.push({ type: "close", text: ch, at: i });
    else throw new MeasureExpressionError(`"${ch}" cannot be used here. A calculation takes names, numbers, + - * / and parentheses.`, i);
    i++;
  }
  return out;
}

/** Reads an expression. Throws `MeasureExpressionError` for anything that is not arithmetic over names and numbers. */
export function parseMeasureExpression(text: string): MeasureNode {
  if (text.trim() === "") throw new MeasureExpressionError("The calculation is empty.", 0);
  if (text.length > MAX_LENGTH) throw new MeasureExpressionError(`A calculation can be at most ${MAX_LENGTH} characters.`, MAX_LENGTH);
  const list = tokens(text);
  let at = 0;
  const peek = () => list[at];
  const end = () => new MeasureExpressionError("The calculation stops too soon.", text.length);

  const primary = (depth: number): MeasureNode => {
    if (depth > MAX_DEPTH) throw new MeasureExpressionError("The calculation is nested too deeply.", peek()?.at ?? text.length);
    const token = list[at++];
    if (!token) throw end();
    if (token.type === "number") return { kind: "number", value: Number(token.text) };
    if (token.type === "name") return { kind: "name", name: token.text };
    if (token.type === "op" && token.text === "-") return { kind: "negate", of: primary(depth + 1) };
    if (token.type === "open") {
      const inner = sum(depth + 1);
      const close = list[at++];
      if (!close) throw end();
      if (close.type !== "close") throw new MeasureExpressionError("A closing parenthesis is missing.", close.at);
      return inner;
    }
    throw new MeasureExpressionError(`"${token.text}" is not expected here.`, token.at);
  };
  const product = (depth: number): MeasureNode => {
    let left = primary(depth);
    for (let next = peek(); next?.type === "op" && (next.text === "*" || next.text === "/"); next = peek()) {
      at++;
      left = { kind: "binary", op: next.text as "*" | "/", left, right: primary(depth) };
    }
    return left;
  };
  const sum = (depth: number): MeasureNode => {
    let left = product(depth);
    for (let next = peek(); next?.type === "op" && (next.text === "+" || next.text === "-"); next = peek()) {
      at++;
      left = { kind: "binary", op: next.text as "+" | "-", left, right: product(depth) };
    }
    return left;
  };

  const tree = sum(0);
  const extra = peek();
  if (extra) throw new MeasureExpressionError(`"${extra.text}" is not expected here.`, extra.at);
  return tree;
}

/** The names an expression uses, each once, in the order they appear. */
export function measureNames(node: MeasureNode): string[] {
  const found: string[] = [];
  const walk = (n: MeasureNode) => {
    if (n.kind === "name") {
      if (!found.includes(n.name)) found.push(n.name);
    } else if (n.kind === "negate") walk(n.of);
    else if (n.kind === "binary") {
      walk(n.left);
      walk(n.right);
    }
  };
  walk(node);
  return found;
}

/**
 * Why an expression cannot be used, or undefined when it can: it must read
 * and every name must be one of `known`.
 */
export function measureExpressionProblem(text: string, known: Iterable<string>): string | undefined {
  try {
    const have = new Set(known);
    const missing = measureNames(parseMeasureExpression(text)).filter((name) => !have.has(name));
    return missing.length > 0 ? `${missing.map((n) => `"${n}"`).join(" and ")} ${missing.length === 1 ? "is" : "are"} not a measure here. Use: ${[...have].join(", ") || "nothing yet"}.` : undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Works an expression out from values by name. A missing value, or a division by zero, gives null. */
export function evaluateMeasure(node: MeasureNode, values: (name: string) => number | null | undefined): number | null {
  switch (node.kind) {
    case "number":
      return node.value;
    case "name": {
      const value = values(node.name);
      return value == null || Number.isNaN(Number(value)) ? null : Number(value);
    }
    case "negate": {
      const of = evaluateMeasure(node.of, values);
      return of === null ? null : -of;
    }
    case "binary": {
      const left = evaluateMeasure(node.left, values);
      const right = evaluateMeasure(node.right, values);
      if (left === null || right === null) return null;
      if (node.op === "+") return left + right;
      if (node.op === "-") return left - right;
      if (node.op === "*") return left * right;
      return right === 0 ? null : left / right;
    }
  }
}

/**
 * Writes an expression out as text, with each name replaced by `name(...)`
 * and each division by `divide(left, right)`. The SQL rewriter uses it so
 * that a division is guarded and done in floating point in every dialect.
 */
export function writeMeasure(node: MeasureNode, write: { name(name: string): string; divide(left: string, right: string): string }): string {
  switch (node.kind) {
    case "number":
      return String(node.value);
    case "name":
      return write.name(node.name);
    case "negate":
      return `(-${writeMeasure(node.of, write)})`;
    case "binary": {
      const left = writeMeasure(node.left, write);
      const right = writeMeasure(node.right, write);
      return node.op === "/" ? write.divide(left, right) : `(${left} ${node.op} ${right})`;
    }
  }
}
