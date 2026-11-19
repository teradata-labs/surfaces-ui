import { Decimal, Float64, Int64 } from "apache-arrow";
import { describe, expect, it } from "vitest";
import { chartValue, numericValue } from "./format.js";

describe("numericValue", () => {
  it("reads a DECIMAL with its scale, not as the unscaled integer", () => {
    // Arrow hands a DECIMAL(18,2) of 7905583.12 over as 790558312.
    expect(numericValue(790558312n, new Decimal(2, 18, 64))).toBe(7905583.12);
    expect(numericValue(-5n, new Decimal(2, 18, 64))).toBe(-0.05);
    expect(chartValue(790558312n, new Decimal(2, 18, 64))).toBe(7905583.12);
  });

  it("passes other numbers through and keeps null", () => {
    expect(numericValue(42n, new Int64())).toBe(42);
    expect(numericValue(1.5, new Float64())).toBe(1.5);
    expect(numericValue(null, new Float64())).toBeNull();
  });
});
