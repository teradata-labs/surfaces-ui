import { EngineError } from "@surfaces-ui/engine";
import { describe, expect, it } from "vitest";
import { createDataFusionEngine, dataFusionError, inlineParams, literal } from "./index.js";

describe("values in statements", () => {
  it("writes numbers and booleans plainly and text as hexadecimal the engine decodes", () => {
    expect(literal(42n)).toBe("42");
    expect(literal(1.5)).toBe("1.5");
    expect(literal(true)).toBe("TRUE");
    expect(literal("Europe")).toBe("CAST(decode('4575726f7065', 'hex') AS VARCHAR)");
    expect(() => literal(Number.NaN)).toThrow(/finite/);
  });

  it("gives text no way to end its own literal", () => {
    for (const hostile of ["' OR 1=1 --", "\\' OR 1=1 --", "x'; DROP TABLE orders; --", "a\nb", "$1", "’ʼ＇"]) {
      const written = literal(hostile);
      // Only hexadecimal digits sit between the quotes, whatever the value was.
      expect(written).toMatch(/^CAST\(decode\('[0-9a-f]*', 'hex'\) AS VARCHAR\)$/);
    }
  });

  it("fills numbered placeholders, leaving look-alikes inside text and comments alone", () => {
    expect(inlineParams("SELECT '$1' AS a, $2 AS b -- $3\nFROM t WHERE c = $1", ["x", 7n])).toBe(
      "SELECT '$1' AS a, 7 AS b -- $3\nFROM t WHERE c = CAST(decode('78', 'hex') AS VARCHAR)",
    );
    expect(inlineParams("SELECT 1", [])).toBe("SELECT 1");
    expect(() => inlineParams("SELECT $2", ["a"])).toThrow(/parameter 2/);
  });
});

describe("errors", () => {
  it("gives the server's errors codes and drops its wrapping", () => {
    const of = (message: string) => dataFusionError(400, JSON.stringify({ code: 400, error: "plan_sql", message }));
    expect(of("Failed to plan execution from SQL query: Schema error: No field named nope. Valid fields are orders.order_id.")).toMatchObject({
      code: "UNKNOWN_COLUMN",
      message: "No field named nope. Valid fields are orders.order_id.",
    });
    expect(of('Failed to plan execution from SQL query: SQL error: ParserError("Expected end of statement, found: FROMM")')).toMatchObject({
      code: "SYNTAX",
      message: "Expected end of statement, found: FROMM",
    });
    expect(of("Failed to execute query: This feature is not implemented: Unsupported logical plan: DropTable").code).toBe("UNSUPPORTED");
    expect(of("Failed to plan execution from SQL query: Error during planning: table 'datafusion.public.nope' not found").code).toBe("UNKNOWN_TABLE");
    expect(dataFusionError(502, "Bad gateway")).toMatchObject({ code: "ENGINE", message: "Bad gateway" });
  });

  it("says when the server cannot be reached", async () => {
    const engine = await createDataFusionEngine({
      baseUrl: "http://datafusion.test",
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    });
    await expect(engine.execute("SELECT 1", [])).rejects.toThrow(/could not be reached/);
    await expect(engine.execute("SELECT 1", [])).rejects.toBeInstanceOf(EngineError);
  });
});
