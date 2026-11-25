// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { wheelScrollsThePage } from "./wheel.js";

function setup() {
  const outer = document.createElement("div");
  const inner = document.createElement("div");
  outer.append(inner);
  document.body.append(outer);
  const seen: WheelEvent[] = [];
  inner.addEventListener("wheel", (event) => seen.push(event));
  return { outer, inner, seen };
}

describe("wheelScrollsThePage", () => {
  it("keeps a plain wheel from the chart and leaves the page to scroll", () => {
    const { outer, inner, seen } = setup();
    wheelScrollsThePage(outer);
    const event = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true });
    inner.dispatchEvent(event);
    expect(seen).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it("lets Ctrl or ⌘ + wheel, and a pinch, reach the chart to zoom", () => {
    const { outer, inner, seen } = setup();
    wheelScrollsThePage(outer);
    inner.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, ctrlKey: true, bubbles: true }));
    inner.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, metaKey: true, bubbles: true }));
    expect(seen).toHaveLength(2);
  });

  it("takes the rule away when asked", () => {
    const { outer, inner, seen } = setup();
    wheelScrollsThePage(outer)();
    inner.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true }));
    expect(seen).toHaveLength(1);
  });
});
