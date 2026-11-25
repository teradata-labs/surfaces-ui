import { expect, test } from "@playwright/test";

// A graph drawn with ECharts zooms on its own wheel events; a plain wheel over it must scroll the page instead.
test.describe("Wheel over a graph", () => {
  test("a plain wheel scrolls the page on past it, Ctrl + wheel zooms it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto("/?source=retail&component=NodeGraph#catalog");
    const canvas = page.locator(".catalog-preview canvas, [data-surface] canvas, canvas").first();
    await expect(canvas).toBeVisible();
    // The box that scrolls is whichever ancestor of the graph can.
    const scrolled = () =>
      canvas.evaluate((element) => {
        for (let at: Element | null = element; at; at = at.parentElement) {
          if (at.scrollHeight > at.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(at).overflowY)) return at.scrollTop;
        }
        return document.scrollingElement?.scrollTop ?? 0;
      });
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 100));

    const before = await scrolled();
    await page.mouse.wheel(0, 200);
    await expect.poll(scrolled).toBeGreaterThan(before);

    const still = await scrolled();
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -200);
    await page.keyboard.up("Control");
    await page.waitForTimeout(300);
    expect(await scrolled()).toBe(still);
  });
});
