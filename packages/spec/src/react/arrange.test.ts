// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PAGE_EDGE, drawnAcross, drawnHeight, landing, pageEdge, receiverOf, scrollFor } from "./arrange.js";
import { pageSurface } from "../page.js";

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
  it("keeps beside to a narrow edge, so a drag straight up or down by a bar's left end does not put things side by side", () => {
    // A full-width element: 40 pixels in from its left edge is above or below, no longer beside.
    const wide = { left: 0, top: 0, width: 1200, height: 100 };
    expect(landing(wide, false, 50, 20)).toBe("before");
    expect(landing(wide, false, 30, 20)).toBe("left");
    expect(landing(wide, false, 1170, 80)).toBe("right");
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

describe("drawnAcross", () => {
  const box = { top: 100, bottom: 200 };
  it("is across for a row drawn as a row, and not for one that has stacked", () => {
    expect(drawnAcross(true, box, [{ top: 100, bottom: 180 }])).toBe(true);
    // A phone-width row: the next child is drawn wholly below.
    expect(drawnAcross(true, box, [{ top: 216, bottom: 300 }])).toBe(false);
    expect(drawnAcross(true, box, [{ top: 0, bottom: 84 }, { top: 216, bottom: 300 }])).toBe(false);
  });
  it("goes by the container's kind when nothing is drawn to compare with", () => {
    expect(drawnAcross(true, box, [])).toBe(true);
    expect(drawnAcross(true, { top: 0, bottom: 0 }, [{ top: 0, bottom: 0 }])).toBe(true);
    expect(drawnAcross(false, box, [{ top: 100, bottom: 180 }])).toBe(false);
  });
});

describe("receiverOf", () => {
  const surface = pageSurface({
    id: "p",
    title: "P",
    catalogId: "c",
    components: [
      { id: "root", component: "Column", children: ["card", "plain"] },
      { id: "card", component: "Card", child: "inner" },
      { id: "inner", component: "Column", children: [] },
      { id: "plain", component: "Card", child: "words" },
      { id: "words", component: "Text", text: "Hi" },
    ],
  });
  it("takes a drop into a list, or into the list a card holds, and nowhere else", () => {
    expect(receiverOf(surface, "root")).toBe("root");
    expect(receiverOf(surface, "card")).toBe("inner");
    expect(receiverOf(surface, "plain")).toBe("");
    expect(receiverOf(surface, "words")).toBe("");
  });
});

describe("pageEdge", () => {
  it("is the outer strip of the whole surface on either side, and nothing in between", () => {
    const page = { left: 100, width: 1000 };
    expect(pageEdge(page, 100 + PAGE_EDGE - 4)).toBe("left");
    expect(pageEdge(page, 1100 - PAGE_EDGE + 4)).toBe("right");
    expect(pageEdge(page, 100 + PAGE_EDGE + 4)).toBeUndefined();
    // A narrow surface keeps most of its width for dropping above, below and beside.
    expect(pageEdge({ left: 0, width: 100 }, 12)).toBeUndefined();
  });
});
