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
    const [target, moved] = [ids[0]!, ids.at(-1)!];
    const bar = studio(page).locator(`.sf-arrange-frame[data-component="${moved}"] > .sf-arrange-bar`);
    const onto = studio(page).locator(`.sf-arrange-frame[data-component="${target}"]`);
    await bar.scrollIntoViewIfNeeded();
    const from = (await bar.boundingBox())!;
    await page.mouse.move(from.x + 12, from.y + from.height / 2);
    await page.mouse.down();
    await onto.scrollIntoViewIfNeeded();
    const box = (await onto.boundingBox())!;
    // Near the left edge, halfway down: passing along it is above or below; resting there is beside it.
    await page.mouse.move(box.x + 8, box.y + box.height / 2, { steps: 12 });
    await expect(onto.locator(':scope > .sf-arrange-insert[data-side="left"]')).toHaveCount(0);
    await expect(onto.locator(':scope > .sf-arrange-insert[data-side="left"]')).toHaveCount(1);
    await page.mouse.up();
    await expect(studio(page).locator('.sf-arrange-frame[data-component="side-by-side"]')).toBeVisible();
    expect(await frames(page)).toContain(moved);
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
