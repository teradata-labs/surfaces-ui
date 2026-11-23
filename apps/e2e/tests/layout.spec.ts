import { expect, test } from "@playwright/test";
import { open } from "./helpers.js";

// The same components are drawn in a page, a chat reply and a side panel, so none may push the page sideways.
for (const area of ["home", "showcase", "analysis", "workbench", "chat", "pages", "semantic", "discover", "pipelines", "patterns", "docs"]) {
  test(`${area} has no sideways scroll @phone`, async ({ page }) => {
    await open(page, area);
    await page.waitForLoadState("networkidle");
    const { scroll, view } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
    expect(scroll, `the page is ${scroll - view}px wider than the screen`).toBeLessThanOrEqual(view);
  });
}

// Panels that stick as the page scrolls (a list beside a detail, a settings column, an instruction box) must stay below
// the sticky bars and end inside the window, so the top and the end of each can be reached.
for (const area of ["library", "workbench", "theme", "pages", "catalog"]) {
  test(`${area} keeps its sticky panels below the bar and inside the window`, async ({ page }) => {
    await open(page, area);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bad = await page.evaluate(() => {
      const bar = document.querySelector(".shell-bar")!.getBoundingClientRect().bottom;
      return [...document.querySelectorAll<HTMLElement>("main *")]
        .filter((el) => getComputedStyle(el).position === "sticky" && !el.className.toString().includes("cm-") && el.offsetHeight >= 40)
        .map((el) => ({ name: el.className.toString(), box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.top < bar - 1 || box.bottom > innerHeight + 1)
        .map(({ name, box }) => `${name}: ${Math.round(box.top)} to ${Math.round(box.bottom)}, bar ends at ${Math.round(bar)}, window ${innerHeight}`);
    });
    expect(bad).toEqual([]);
  });
}

// The data picker sits on the pages that read the picked data, never in the top bar; a page that ignores it has none.
test.describe("Data picker", () => {
  test("is in the heading of a page that reads it, and absent where it does nothing @phone", async ({ page }) => {
    await open(page, "workbench");
    await expect(page.locator(".shell-bar").getByRole("combobox", { name: "Data" })).toHaveCount(0);
    const picker = page.locator(".shell-head").getByRole("combobox", { name: "Data" });
    await expect(picker).toBeVisible();
    await picker.selectOption("healthcare");
    await expect(page).toHaveURL(/source=healthcare/);

    await open(page, "library");
    await expect(page.getByRole("combobox", { name: "Data" })).toHaveCount(0);
  });

  test("is beside the live screens on the home page", async ({ page }) => {
    await open(page, "home");
    await expect(page.locator(".home").getByRole("combobox", { name: "Data" })).toBeVisible();
  });
});

// The home page's phone keeps its screen inside the bezel on every side: in WebKit a percentage height inside the
// frame (sized by aspect-ratio) once ran the screen past the bottom bezel and over the rounded corners (#205).
test("the home page's phone keeps its screen inside its bezel @phone", async ({ page }) => {
  await open(page, "home");
  const phone = page.locator(".sf-site-phone:visible").first();
  await phone.scrollIntoViewIfNeeded();
  const gaps = await phone.evaluate((root) => {
    const frame = root.querySelector(".sf-site-phone-frame")!.getBoundingClientRect();
    const body = root.querySelector(".sf-site-phone-body")!.getBoundingClientRect();
    return { top: body.top - frame.top, right: frame.right - body.right, bottom: frame.bottom - body.bottom, left: body.left - frame.left };
  });
  for (const [side, gap] of Object.entries(gaps)) expect(gap, `the bezel on the ${side} is ${gap}px`).toBeGreaterThan(2);
  expect(Math.abs(gaps.bottom - gaps.top), "the bezel is as thick at the bottom as at the top").toBeLessThan(1);
});
