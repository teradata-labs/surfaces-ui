import { describe, expect, it } from "vitest";
import { highlight, languageOf } from "./highlight.js";

const kinds = (code: string, language: string) => highlight(code, language).filter((t) => t.kind).map((t) => [t.kind, t.text.trim()]);

describe("highlight", () => {
  it("gives back the code exactly, whatever the language", () => {
    for (const [code, language] of [
      ['{"a": [1, true, null, "x\\"y"]}', "json"],
      ["SELECT o.amount, sum(x) -- total\nFROM orders o WHERE region = 'Europe''s'", "sql"],
      ["const a: Theme = { b: `c${d}` }; // note\nfn(1n)", "tsx"],
      ["pnpm add @surfaces-ui/components --save # install\necho \"$HOME\"", "bash"],
      ["message A { repeated string b = 1; }", "proto"],
      ["key: value # c\n- item: 3", "yaml"],
      [".a { color: var(--sf-code-string); }", "css"],
      ["anything", "cobol"],
      ['{"unterminated', "json"],
    ] as const) {
      expect(highlight(code, language).map((t) => t.text).join("")).toBe(code);
    }
  });

  it("tells keys from values in JSON", () => {
    expect(kinds('{"sourceId": "lake", "n": 2, "ok": false}', "json")).toEqual([
      ["punctuation", "{"],
      ["property", '"sourceId"'],
      ["punctuation", ":"],
      ["string", '"lake"'],
      ["punctuation", ","],
      ["property", '"n"'],
      ["punctuation", ":"],
      ["number", "2"],
      ["punctuation", ","],
      ["property", '"ok"'],
      ["punctuation", ":"],
      ["literal", "false"],
      ["punctuation", "}"],
    ]);
  });

  it("knows SQL keywords in any case, functions, types, strings and comments", () => {
    const k = kinds("select SUM(amount) AS total, CAST(x AS integer) FROM t -- why", "sql");
    expect(k).toContainEqual(["keyword", "select"]);
    expect(k).toContainEqual(["function", "SUM"]);
    expect(k).toContainEqual(["type", "integer"]);
    expect(k).toContainEqual(["comment", "-- why"]);
    expect(kinds("WHERE a = 'it''s'", "sql")).toContainEqual(["string", "'it''s'"]);
  });

  it("maps fence names onto languages and leaves unknown ones plain", () => {
    expect(languageOf("TSX")).toBe("ts");
    expect(languageOf("sh")).toBe("shell");
    expect(languageOf("cobol")).toBeUndefined();
    expect(highlight("x", "cobol")).toEqual([{ text: "x" }]);
  });
});
