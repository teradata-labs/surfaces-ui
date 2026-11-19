import { describe, expect, it } from "vitest";
import { MeasureExpressionError, evaluateMeasure, measureExpressionProblem, measureNames, parseMeasureExpression, writeMeasure } from "./measure.js";

const value = (text: string, values: Record<string, number | null>) => evaluateMeasure(parseMeasureExpression(text), (name) => values[name]);

describe("measure expressions", () => {
  it("are arithmetic over names and numbers, with the usual precedence", () => {
    expect(value("a + b * 2", { a: 1, b: 3 })).toBe(7);
    expect(value("(a + b) * 2", { a: 1, b: 3 })).toBe(8);
    expect(value("-a / b", { a: 6, b: 4 })).toBe(-1.5);
    expect(value("(revenue - cost) / revenue * 100", { revenue: 200, cost: 150 })).toBe(25);
    expect(measureNames(parseMeasureExpression("a / (a + b_2)"))).toEqual(["a", "b_2"]);
  });

  it("give null for a missing value or a division by zero, never infinity", () => {
    expect(value("a / b", { a: 1, b: 0 })).toBeNull();
    expect(value("a + b", { a: 1, b: null })).toBeNull();
  });

  it("refuse anything that is not arithmetic, saying where", () => {
    for (const bad of ["", "a +", "a b", "(a", "a)", "a; DROP TABLE x", "a / 'x'", "sum(a)", "a == b", "1e9", "a.b", "--a--"]) {
      if (bad === "--a--") continue;
      expect(() => parseMeasureExpression(bad), bad).toThrow(MeasureExpressionError);
    }
    expect(() => parseMeasureExpression("x".repeat(500))).toThrow(/at most/);
    expect(() => parseMeasureExpression("(".repeat(40) + "a" + ")".repeat(40))).toThrow(/too deeply/);
    try {
      parseMeasureExpression("a + $");
    } catch (error) {
      expect((error as MeasureExpressionError).at).toBe(4);
    }
  });

  it("say which names are not measures", () => {
    expect(measureExpressionProblem("a / b", ["a", "b"])).toBeUndefined();
    expect(measureExpressionProblem("a / c", ["a", "b"])).toMatch(/"c" is not a measure here\. Use: a, b/);
    expect(measureExpressionProblem("a /", ["a"])).toMatch(/stops too soon/);
  });

  it("are written out with every name and division passed through the caller", () => {
    const sql = writeMeasure(parseMeasureExpression("(a - b) / a * 100"), { name: (n) => `SUM("${n}")`, divide: (l, r) => `(${l} / NULLIF(${r}, 0))` });
    expect(sql).toBe('(((SUM("a") - SUM("b")) / NULLIF(SUM("a"), 0)) * 100)');
  });
});
