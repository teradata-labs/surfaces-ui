import { expect, test } from "@playwright/test";
import { open } from "./helpers.js";

// The same components are drawn in a page, a chat reply and a side panel, so none may push the page sideways.
for (const area of ["home", "showcase", "analysis", "workbench", "composer", "chat", "pages", "semantic", "discover", "pipelines", "patterns", "docs"]) {
  test(`${area} has no sideways scroll @phone @webkit`, async ({ page }) => {
    await open(page, area);
    await page.waitForLoadState("networkidle");
    const { scroll, view } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
    expect(scroll, `the page is ${scroll - view}px wider than the screen`).toBeLessThanOrEqual(view);
  });
}

// Stacked on a phone, a workspace's panels are as tall as their content and the page alone scrolls: a panel that scrolled
// inside the page caught the swipe, and a width handle past the edge of a stacked grid made it scroll sideways too.
test("the playground's panels on a phone scroll with the page, not inside it @phone", async ({ page, isMobile }) => {
  // Side by side on a wide screen, each panel scrolls inside itself, as it should.
  test.skip(!isMobile, "panels stack only on a phone");
  await open(page, "composer");
  await expect(page.locator(".sf-workspace-panel").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  const scrolling = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".sf-workspace-panel:not([data-fill]) .sf-workspace-panel-body")]
      .filter((body) => body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1)
      .filter((body) => /(auto|scroll)/.test(getComputedStyle(body).overflowY + getComputedStyle(body).overflowX))
      .map((body) => `${body.closest("section")?.getAttribute("aria-label")}: ${body.scrollWidth}×${body.scrollHeight} in ${body.clientWidth}×${body.clientHeight}`),
  );
  expect(scrolling).toEqual([]);
});

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
test("the home page's phone keeps its screen inside its bezel @phone @webkit", async ({ page }) => {
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

// On a phone the workspace stacks its panels. A conversation scrolls inside itself, so its panel keeps about a screenful,
// and nothing under the thread (suggestions, the composer) is drawn over it; the composer's tools stay on one row.
for (const area of ["chat", "composer"]) {
  test(`${area}: the conversation keeps its room on a phone @phone`, async ({ page }) => {
    test.skip(test.info().project.name === "desktop", "the stacked layout is a phone's");
    await open(page, area);
    const panel = page.locator(".sf-workspace-panel[data-fill]").first();
    await expect(panel).toBeVisible();
    const { panelHeight, window, overlap } = await panel.evaluate((el) => {
      const thread = el.querySelector(".sf-chat-list, .composer-transcript")!.getBoundingClientRect();
      const below = [...el.querySelectorAll(".sf-chat-suggestions, .sf-chat-composer, .composer-starters, .composer-ask")].map((e) => e.getBoundingClientRect());
      return { panelHeight: el.getBoundingClientRect().height, window: innerHeight, overlap: Math.max(0, ...below.map((b) => thread.bottom - b.top)) };
    });
    expect(panelHeight, "the panel is most of a screen").toBeGreaterThan(window * 0.6);
    expect(overlap, "nothing is drawn over the thread").toBeLessThanOrEqual(0);
  });
}

test("the chat composer's tools fit one row on a phone @phone", async ({ page }) => {
  test.skip(test.info().project.name === "desktop", "touch targets are a phone's");
  await open(page, "chat");
  const toolbar = page.locator(".sf-chat-toolbar").first();
  await expect(toolbar).toBeVisible();
  const { height, send } = await toolbar.evaluate((el) => ({ height: el.getBoundingClientRect().height, send: el.querySelector(".sf-chat-send")!.getBoundingClientRect().height }));
  expect(height).toBeLessThanOrEqual(send + 1);
});

// Every page has an address of its own, so search engines, link previews and bookmarks each name one page.
test.describe("Addresses", () => {
  test("open a page by its path, move without loading the page again, and go Back", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "the same on every screen");
    await page.goto("/catalog/Chart/?source=retail");
    await expect(page.locator(".catalog-name")).toHaveText("Chart");
    const marker = await page.evaluate(() => {
      (window as unknown as { stayed: boolean }).stayed = true;
      return true;
    });
    expect(marker).toBe(true);
    await page.locator('a[href^="/patterns/"]').first().click();
    await expect(page).toHaveURL(/\/patterns\/\?source=retail$/);
    await expect(page.getByRole("heading", { level: 1, name: "Patterns" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
    await page.goBack();
    await expect(page).toHaveURL(/\/catalog\/Chart\/\?source=retail$/);
    await expect(page.locator(".catalog-name")).toHaveText("Chart");
  });

  test("move an address from before paths to its path", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "the same on every screen");
    await page.goto("/?source=retail#docs?page=styling");
    await expect(page).toHaveURL(/\/docs\/styling\/\?source=retail$/);
    await expect(page.getByRole("heading", { level: 1, name: "Styling" })).toBeVisible();
  });
});
