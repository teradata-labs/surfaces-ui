import { describe, expect, it } from "vitest";
import { placePanel } from "./placement.js";

const box = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height });
const DESK = { width: 1200, height: 800 };
const PHONE = { width: 375, height: 667 };

describe("where a panel opened from a button goes", () => {
  it("sits below the button, lined up with its start edge", () => {
    expect(placePanel({ trigger: box(100, 20, 80, 32), panel: { width: 260, height: 200 }, viewport: DESK, gap: 4, align: "start" })).toEqual({
      left: 100,
      top: 56,
      maxHeight: 800 - 52 - 8,
      side: "below",
    });
  });

  it("lines up with the end edge when asked, and the other way round right to left", () => {
    const trigger = box(600, 20, 80, 32);
    const panel = { width: 260, height: 200 };
    expect(placePanel({ trigger, panel, viewport: DESK, gap: 4, align: "end" }).left).toBe(680 - 260);
    expect(placePanel({ trigger, panel, viewport: DESK, gap: 4, align: "start", rtl: true }).left).toBe(680 - 260);
    expect(placePanel({ trigger, panel, viewport: DESK, gap: 4, align: "end", rtl: true }).left).toBe(600);
  });

  it("moves along to stay inside the window on a phone", () => {
    // Start-aligned to a button near the right edge: pushed back left.
    expect(placePanel({ trigger: box(300, 10, 60, 32), panel: { width: 280, height: 200 }, viewport: PHONE, gap: 8, align: "start" }).left).toBe(375 - 8 - 280);
    // End-aligned to a button near the left edge: pushed right.
    expect(placePanel({ trigger: box(10, 10, 60, 32), panel: { width: 280, height: 200 }, viewport: PHONE, gap: 8, align: "end" }).left).toBe(8);
    // Wider than the window allows: kept to the gap at the start.
    expect(placePanel({ trigger: box(10, 10, 60, 32), panel: { width: 400, height: 200 }, viewport: PHONE, gap: 8, align: "start" }).left).toBe(8);
  });

  it("flips above the button only when it does not fit below and there is more room above", () => {
    const low = box(100, 600, 80, 32);
    const above = placePanel({ trigger: low, panel: { width: 260, height: 300 }, viewport: DESK, gap: 4, align: "start" });
    expect(above).toEqual({ left: 100, top: 600 - 4 - 300, maxHeight: 600 - 8, side: "above" });
    // Fits below: stays below even with more room above.
    expect(placePanel({ trigger: low, panel: { width: 260, height: 100 }, viewport: DESK, gap: 4, align: "start" }).side).toBe("below");
  });

  it("takes height away and scrolls when there is not room either way", () => {
    const at = placePanel({ trigger: box(10, 400, 60, 32), panel: { width: 200, height: 900 }, viewport: PHONE, gap: 8, align: "start" });
    expect(at.side).toBe("above");
    expect(at.maxHeight).toBe(400 - 16);
    expect(at.top).toBe(8);
  });
});
