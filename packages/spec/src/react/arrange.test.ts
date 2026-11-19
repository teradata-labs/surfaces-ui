// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { drawnHeight, landing, scrollFor } from "./arrange.js";

const html = (markup: string) => {
  const host = document.createElement("div");
  host.innerHTML = markup;
  return host.firstElementChild;
};

describe("drawnHeight", () => {
  it("reads the height a renderer gave the sized part, not the box with its toolbar around it", () => {
    expect(drawnHeight(html('<div><div class="toolbar"></div><div class="rows" style="height: 400px"></div></div>'))).toBe(400);
    expect(drawnHeight(html('<div style="height: 300px"><canvas></canvas></div>'))).toBe(300);
    // A workspace carries its height as a variable.
    expect(drawnHeight(html('<div style="--sf-workspace-height: 520px"></div>'))).toBe(520);
  });

  it("ignores heights that are not a size in pixels, and falls back when there is nothing to read", () => {
    expect(drawnHeight(html('<div><span style="height: 100%"></span><div style="height: 12px"></div><div style="height: 360px"></div></div>'))).toBe(360);
    expect(drawnHeight(html("<div><p>text</p></div>"))).toBe(320);
    expect(drawnHeight(undefined)).toBe(320);
  });
});

describe("landing", () => {
  const box = { left: 100, top: 100, width: 400, height: 200 };
  it("in a stack: above or below by the nearer half, and beside at either edge", () => {
    expect(landing(box, false, 300, 120)).toBe("before");
    expect(landing(box, false, 300, 280)).toBe("after");
    expect(landing(box, false, 110, 200)).toBe("left");
    expect(landing(box, false, 490, 200)).toBe("right");
  });
  it("side by side: before or after by the nearer half, whatever the height", () => {
    expect(landing(box, true, 110, 290)).toBe("before");
    expect(landing(box, true, 490, 110)).toBe("after");
  });
});

describe("scrollFor", () => {
  it("scrolls toward the edge a drag is held near, faster the nearer, and not in between", () => {
    expect(scrollFor(500, 100, 900)).toBe(0);
    expect(scrollFor(110, 100, 900)).toBeLessThan(0);
    expect(scrollFor(890, 100, 900)).toBeGreaterThan(0);
    expect(Math.abs(scrollFor(101, 100, 900))).toBeGreaterThan(Math.abs(scrollFor(150, 100, 900)));
    // Past the edge it is as fast as it gets, not faster.
    expect(scrollFor(40, 100, 900)).toBe(scrollFor(100, 100, 900));
  });
});
