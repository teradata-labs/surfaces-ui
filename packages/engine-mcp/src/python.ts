/**
 * Reads a Python literal, which is what some database servers written in
 * Python return as text (`str(rows)`): lists, tuples, dicts, strings, numbers,
 * `None`, `True`, `False`, and calls such as `Decimal('1.50')` or
 * `datetime.date(2026, 1, 2)`, which are read as their text or ISO form.
 * Nothing is evaluated. Returns `undefined` when the text is not one.
 */
export function pythonLiteral(source: string): unknown {
  let at = 0;
  const fail = (): never => {
    throw new SyntaxError("not a Python literal");
  };
  const space = () => {
    while (/\s/.test(source[at] ?? "")) at += 1;
  };
  const text = (): string => {
    const quote = source[at]!;
    at += 1;
    let out = "";
    while (at < source.length && source[at] !== quote) {
      if (source[at] === "\\") {
        const next = source[at + 1] ?? "";
        const simple: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"', "0": "\0" };
        if (next in simple) {
          out += simple[next];
          at += 2;
        } else if (next === "x" || next === "u" || next === "U") {
          const size = next === "x" ? 2 : next === "u" ? 4 : 8;
          out += String.fromCodePoint(Number.parseInt(source.slice(at + 2, at + 2 + size), 16));
          at += 2 + size;
        } else {
          out += source[at];
          at += 1;
        }
      } else {
        out += source[at];
        at += 1;
      }
    }
    if (source[at] !== quote) fail();
    at += 1;
    return out;
  };
  const list = (close: string): unknown[] => {
    const items: unknown[] = [];
    at += 1;
    for (space(); source[at] !== close; space()) {
      items.push(value());
      space();
      if (source[at] === ",") at += 1;
      else if (source[at] !== close) fail();
    }
    at += 1;
    return items;
  };
  const pad = (n: unknown, size = 2) => String(n).padStart(size, "0");
  const call = (name: string, args: unknown[]): unknown => {
    const short = name.split(".").pop();
    if (short === "Decimal" || short === "UUID") return String(args[0]);
    if (short === "date" && args.length === 3) return `${pad(args[0], 4)}-${pad(args[1])}-${pad(args[2])}`;
    if (short === "datetime" && args.length >= 3) {
      const [y, m, d, h = 0, min = 0, s = 0, micro = 0] = args.filter((a) => typeof a === "number");
      return `${pad(y, 4)}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(s)}.${pad(micro, 6)}${args.some((a) => typeof a === "string" && /utc$/i.test(a)) ? "Z" : ""}`;
    }
    if (short === "time") return args.filter((a) => typeof a === "number").map((a) => pad(a)).join(":");
    if (short === "utc" || short === "timezone") return "utc";
    return args.length === 1 ? args[0] : JSON.stringify(args);
  };
  function value(): unknown {
    space();
    const c = source[at] ?? "";
    if (c === "[") return list("]");
    if (c === "(") return list(")");
    if (c === "'" || c === '"') return text();
    if (c === "{") {
      const out: Record<string, unknown> = {};
      at += 1;
      for (space(); source[at] !== "}"; space()) {
        const key = value();
        space();
        if (source[at] !== ":") fail();
        at += 1;
        out[String(key)] = value();
        space();
        if (source[at] === ",") at += 1;
        else if (source[at] !== "}") fail();
      }
      at += 1;
      return out;
    }
    const number = /^[+-]?(\d+\.?\d*(e[+-]?\d+)?|\.\d+|inf|nan)/i.exec(source.slice(at));
    if (number) {
      at += number[0].length;
      return Number(number[0].replace(/inf/i, "Infinity").replace(/nan/i, "NaN"));
    }
    const word = /^[A-Za-z_][\w.]*/.exec(source.slice(at));
    if (!word) return fail();
    at += word[0].length;
    if (word[0] === "None") return null;
    if (word[0] === "True") return true;
    if (word[0] === "False") return false;
    space();
    if (source[at] === "(") {
      const args: unknown[] = [];
      at += 1;
      for (space(); source[at] !== ")"; space()) {
        // A keyword argument (`tzinfo=...`) is read for its value.
        const keyword = /^[A-Za-z_]\w*\s*=/.exec(source.slice(at));
        if (keyword) at += keyword[0].length;
        args.push(value());
        space();
        if (source[at] === ",") at += 1;
        else if (source[at] !== ")") fail();
      }
      at += 1;
      return call(word[0], args);
    }
    return word[0];
  }
  try {
    const out = value();
    space();
    return at === source.length ? out : undefined;
  } catch {
    return undefined;
  }
}
