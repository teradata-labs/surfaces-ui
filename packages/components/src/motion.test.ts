import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** The `@media (prefers-reduced-motion: reduce)` blocks, whole, so what is inside them can be told apart. */
function reducedBlocks(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const match of text.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{/g)) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (depth > 0 && i < text.length) {
      if (text[i] === "{") depth += 1;
      if (text[i] === "}") depth -= 1;
      i += 1;
    }
    out.push([match.index, i]);
  }
  return out;
}

// Under reduced motion the duration tokens are zero, so anything timed by them stands still. A duration written out
// (160ms, 1.2s) would keep moving, so outside the reduced-motion blocks every transition and animation is timed by a token.
describe("motion", () => {
  const blocks = reducedBlocks(css);

  it("times every transition and animation by the motion tokens", () => {
    const literal: string[] = [];
    for (const match of css.matchAll(/(?<![-\w])(transition|animation)(-duration)?\s*:\s*([^;]+);/g)) {
      if (blocks.some(([from, to]) => match.index >= from && match.index < to)) continue;
      const value = match[3]!.replace(/var\(--sf-duration[\w-]*\)/g, "");
      // `0s` (a visibility flip at the end of a slide) is not movement.
      const durations = [...value.matchAll(/(?<![\w-])(\d*\.?\d+)m?s\b/g)].filter((d) => Number(d[1]) !== 0);
      if (durations.length > 0) literal.push(`${match[0].trim()} (line ${css.slice(0, match.index).split("\n").length})`);
    }
    expect(literal).toEqual([]);
  });

  it("stops every library animation and transition for people who ask for less motion", () => {
    const all = blocks.map(([from, to]) => css.slice(from, to)).join("\n");
    expect(all).toMatch(/\[class\^="sf-"\]/);
    expect(all).toMatch(/animation-duration:\s*0\.01ms !important/);
    expect(all).toMatch(/transition-duration:\s*0\.01ms !important/);
  });

  it("names a keyframes rule for every animation it uses", () => {
    const defined = new Set([...css.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1]));
    const used = [...css.matchAll(/(?<![-\w])animation(?:-name)?\s*:\s*([^;]+);/g)]
      .flatMap((m) => m[1]!.split(",").map((part) => part.trim().split(/\s+/).find((word) => /^sf-[\w-]+$/.test(word))))
      .filter((name): name is string => !!name);
    expect(used.filter((name) => !defined.has(name))).toEqual([]);
  });
});
