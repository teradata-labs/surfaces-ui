import { type Page, expect, test } from "@playwright/test";
import { open } from "./helpers.js";

const studio = (page: Page) => page.locator(".sf-studio-page");
const side = (page: Page) => page.getByRole("complementary", { name: "Change this page" });
/** The first line between two columns of a grid on the page, while nobody is arranging. */
const firstLine = (page: Page) => studio(page).locator('.sf-arrange-view > [role="separator"][data-edge="right"]').first();
const valueOf = async (page: Page) => Number(await firstLine(page).getAttribute("aria-valuenow"));

test.describe("Resizing a dashboard while viewing it in the pages gallery", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "pages");
    await expect(studio(page)).toBeVisible();
    await expect(firstLine(page)).toBeAttached();
  });

  test("a column widens by keyboard without Arrange, is logged as the person's change, and Undo puts it back", async ({ page }) => {
    // Not arranging: no frames, no bars, nothing to move or remove.
    await expect(studio(page).locator(".sf-arrange-frame")).toHaveCount(0);
    const before = await valueOf(page);
    await firstLine(page).focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => valueOf(page)).toBeCloseTo(before + 4, 0);
    await expect(firstLine(page)).toBeFocused();
    await expect(side(page).getByRole("list", { name: "Changes" })).toContainText("Arranged by");

    await side(page).getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => valueOf(page)).toBeCloseTo(before, 0);
  });

  test("dragging the line between two columns with a pointer changes their widths", async ({ page }) => {
    const line = firstLine(page);
    await line.scrollIntoViewIfNeeded();
    const before = await valueOf(page);
    const box = (await line.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => valueOf(page)).toBeGreaterThan(before + 1);
    await expect(side(page).getByRole("list", { name: "Changes" })).toContainText("Arranged by");
  });

  test("Arrange replaces the viewing handles with its own frames, one layer at a time", async ({ page }) => {
    await side(page).getByRole("button", { name: "Arrange" }).click();
    await expect(studio(page).locator(".sf-arrange-frame").first()).toBeVisible();
    await expect(studio(page).locator(".sf-arrange-view")).toHaveCount(0);
    await expect(studio(page).locator('.sf-arrange-frame > [role="separator"]').first()).toBeAttached();
  });
});

test.describe("ResizeHandle in the Components area", () => {
  test("drags and keys move the share, Enter puts it back, and each end is logged @phone", async ({ page }) => {
    await open(page, "catalog");
    await page.goto("/?source=retail&component=ResizeHandle#catalog");
    const preview = page.getByRole("region", { name: "Preview" });
    const handle = preview.getByRole("separator", { name: "Resize the map and the list" });
    await expect(handle).toHaveAttribute("aria-valuenow", "0.5");
    await handle.focus();
    await page.keyboard.press("End");
    await expect(handle).toHaveAttribute("aria-valuenow", "0.75");
    await page.keyboard.press("Enter");
    await expect(handle).toHaveAttribute("aria-valuenow", "0.5");

    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => Number(await handle.getAttribute("aria-valuenow"))).toBeLessThan(0.5);
    await expect(page.locator("main")).toContainText("onChangeEnd");
  });
});
