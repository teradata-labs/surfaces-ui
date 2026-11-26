import { type Page, expect, test } from "@playwright/test";
import { open } from "./helpers.js";

/** The page's own studio, the side with Undo and the change log, and the components framed for arranging, in drawn order. */
const studio = (page: Page) => page.locator(".sf-studio-page");
const side = (page: Page) => page.getByRole("complementary", { name: "Change this page" });
const frames = (page: Page) => studio(page).locator(".sf-arrange-frame").evaluateAll((all) => all.map((f) => f.getAttribute("data-component")));

test.describe("Arranging a dashboard in the pages gallery", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "pages");
    await expect(studio(page)).toBeVisible();
    await side(page).getByRole("button", { name: "Arrange" }).click();
    await expect(studio(page).locator(".sf-arrange-frame").first()).toBeVisible();
  });

  test("a component moves by keyboard, is logged as the person's change, and Undo puts it back", async ({ page }) => {
    const before = await frames(page);
    // The first control that moves something later or down: a press by keyboard, as a person without a pointer would.
    const later = studio(page).locator('.sf-arrange-bar [data-control="later"]:not([aria-disabled]), .sf-arrange-bar [data-control="down"]:not([aria-disabled])').first();
    await later.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => frames(page)).not.toEqual(before);
    await expect(side(page).getByRole("list", { name: "Changes" })).toContainText("Arranged by");

    await side(page).getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => frames(page)).toEqual(before);
  });

  test("dragging a component by its bar to the side of another puts the two side by side", async ({ page }) => {
    const ids = (await frames(page)).filter((id): id is string => !!id && id !== "root");
    // A component in a stack that holds nothing framed, so its own edge is under the pointer, not a child's.
    const target = (await studio(page).locator(".sf-arrange-frame:not([data-across]):not(:has(.sf-arrange-frame))").first().getAttribute("data-component"))!;
    const moved = ids.filter((id) => id !== target).at(-1)!;
    const bar = studio(page).locator(`.sf-arrange-frame[data-component="${moved}"] > .sf-arrange-bar`);
    const onto = studio(page).locator(`.sf-arrange-frame[data-component="${target}"]`);
    await bar.scrollIntoViewIfNeeded();
    const from = (await bar.boundingBox())!;
    await page.mouse.move(from.x + 12, from.y + from.height / 2);
    await page.mouse.down();
    // Mid-window, clear of the edges where a held drag scrolls the page.
    await onto.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const box = (await onto.boundingBox())!;
    // Near its left edge (inside the page's own edge, which puts a column beside the whole page), halfway down:
    // passing along it is above or below; resting there is beside it.
    await page.mouse.move(box.x + 36, box.y + box.height / 2, { steps: 12 });
    await expect(onto.locator(':scope > .sf-arrange-insert[data-side="left"]')).toHaveCount(0);
    await expect(onto.locator(':scope > .sf-arrange-insert[data-side="left"]')).toHaveCount(1);
    await page.mouse.up();
    await expect(studio(page).locator('.sf-arrange-frame[data-component="side-by-side"]')).toBeVisible();
    expect(await frames(page)).toContain(moved);
  });
});

test.describe("Columns down the page", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "pages");
    await expect(studio(page)).toBeVisible();
    await side(page).getByRole("button", { name: "Arrange" }).click();
    await expect(studio(page).locator(".sf-arrange-frame").first()).toBeVisible();
  });

  test("dragging a component to the page's left or right edge and resting puts it in a column beside everything", async ({ page }) => {
    const root = studio(page).locator('.sf-arrange-root[data-component="root"]');
    const ids = (await frames(page)).filter((id): id is string => !!id && id !== "root");
    for (const [moved, side] of [[ids.at(-1)!, "left"], [ids[0]!, "right"]] as const) {
      const bar = studio(page).locator(`.sf-arrange-frame[data-component="${moved}"] > .sf-arrange-bar`);
      // Mid-window, clear of the sticky navigation bar a press at the very top would land on.
      await bar.evaluate((element) => element.scrollIntoView({ block: "center" }));
      const from = (await bar.boundingBox())!;
      await page.mouse.move(from.x + 12, from.y + from.height / 2);
      await page.mouse.down();
      // Mid-window, clear of the edges where a held drag scrolls the page.
      const box = (await root.boundingBox())!;
      const x = side === "left" ? box.x + 4 : box.x + box.width - 4;
      const y = Math.max(box.y + 20, Math.min(box.y + box.height - 20, page.viewportSize()!.height / 2));
      await page.mouse.move(x, y, { steps: 12 });
      await expect(root.locator(`:scope > .sf-arrange-insert[data-page][data-side="${side}"]`)).toHaveCount(1);
      await page.mouse.up();
      await expect(studio(page).locator(".sf-arrange-frame[data-component=page-content]")).toBeVisible();
    }
    // The first drop made the page a row; the second added a column to it.
    const order = await studio(page).locator('.sf-arrange-root[data-component="root"] > .sf-a2-row > * > .sf-arrange-frame').evaluateAll((all) => all.map((f) => f.getAttribute("data-component")));
    expect(order[0]).toBe(ids.at(-1));
    expect(order.at(-1)).toBe(ids[0]);
  });
});

test.describe("App components in the Components area", () => {
  test("AnalyticsChat draws its Conversations panel only when the part is switched on @phone", async ({ page }) => {
    await open(page, "catalog");
    await page.goto("/?source=retail&component=AnalyticsChat#catalog");
    const preview = page.getByRole("region", { name: "Preview" });
    await expect(preview.getByRole("textbox", { name: "Message" })).toBeVisible();
    const parts = page.getByRole("region", { name: "Parts" });
    const sessions = parts.getByRole("checkbox", { name: /Saved conversations/ });
    await expect(sessions).toBeChecked();
    await expect(preview.getByRole("button", { name: "Conversations" })).toBeVisible();

    await sessions.uncheck();
    await expect(preview.getByRole("button", { name: "Conversations" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Code" })).not.toContainText("sessions={sessions}");

    await sessions.check();
    await expect(preview.getByRole("button", { name: "Conversations" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Code" })).toContainText("sessions={sessions}");
  });
});
