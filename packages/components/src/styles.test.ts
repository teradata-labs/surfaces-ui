import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// @ts-expect-error: a plain build script, with no types of its own.
import { LAYER, layered } from "../scripts/styles.mjs";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");

describe("the layered stylesheet", () => {
  it("holds every rule of styles.css inside one named layer", () => {
    const out: string = layered(css);
    expect(LAYER).toBe("surfaces");
    expect(out).toContain("@layer surfaces {");
    expect(out).toContain(css);
    expect(out.trimEnd().endsWith("}")).toBe(true);
  });

  it("refuses a rule a layer block cannot hold, rather than writing a broken file", () => {
    expect(() => layered('@import "other.css";\n.sf-x { color: red; }')).toThrow(/@import/);
    expect(() => layered('/* @import "in a comment" */\n.sf-x { color: red; }')).not.toThrow();
  });
});
