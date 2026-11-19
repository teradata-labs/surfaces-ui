import { Decimal, Float64 } from "apache-arrow";
import { describe, expect, it } from "vitest";
import { rangeBinWidth } from "./Chart.js";

const range = (type: Decimal | Float64, lo: unknown, hi: unknown) => ({
  schema: { fields: [{ name: "lo", type }, { name: "hi", type }] },
  getChild: (name: string) => ({ get: () => (name === "lo" ? lo : hi) }),
});

describe("rangeBinWidth", () => {
  it("reads a DECIMAL range with its scale, so the bins fit the values", () => {
    // Order totals from -199.50 to 2,410.75 as DECIMAL(18,2): the engine sends 2-place digits without the point.
    expect(rangeBinWidth(range(new Decimal(2, 18, 64), -19950n, 241075n), 30)).toBe(100);
  });

  it("reads plain numbers as they are", () => {
    expect(rangeBinWidth(range(new Float64(), 0, 1000), 20)).toBe(50);
  });

  it("falls back to a width of one when there are no values", () => {
    expect(rangeBinWidth(range(new Float64(), null, null), 20)).toBe(1);
  });
});
