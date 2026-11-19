import { type Page, expect, test } from "@playwright/test";
import { open } from "./helpers.js";

const editor = (page: Page) => page.getByRole("textbox", { name: "SQL editor" });
const grid = (page: Page) => page.getByRole("grid", { name: "Query result" });

async function write(page: Page, sql: string) {
  await editor(page).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(sql);
}

test.describe("SQL workbench", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "workbench");
    await expect(grid(page)).toBeVisible();
  });

  test("runs a query from the keyboard and the engine summarises it", async ({ page }) => {
    await write(page, "SELECT store_id, COUNT(*) AS orders FROM orders GROUP BY store_id ORDER BY store_id");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(grid(page).getByRole("columnheader", { name: /^orders/ })).toBeVisible();
    await expect(grid(page).getByRole("columnheader", { name: /^store_id/ })).toBeVisible();
    await expect(page.getByText(/^\d+ rows?$/)).toBeVisible();
  });

  test("an error says where it is and the editor marks it", async ({ page }) => {
    await write(page, "SELECT no_such_column FROM orders");
    await page.getByRole("button", { name: "Run query" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /no_such_column/ }).first()).toBeVisible();
    await expect(page.locator(".cm-lintRange-error")).toBeVisible();
  });

  test("a large result is windowed: scrolling fetches rows far down without drawing them all", async ({ page }) => {
    await expect(page.getByText(/^[\d,]+ rows$/)).toBeVisible();
    const total = Number((await grid(page).getAttribute("aria-rowcount")) ?? "0");
    expect(total).toBeGreaterThan(1000);
    // Only the rows in view are in the page.
    expect(await grid(page).getByRole("row").count()).toBeLessThan(200);
    const scroller = grid(page);
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(grid(page).locator(`[aria-rowindex="${total}"]`)).toBeVisible();
  });

  test("a header sorts in the engine, cycling ascending, descending, none", async ({ page }) => {
    const header = grid(page).getByRole("columnheader").first();
    const sort = header.getByRole("button").first();
    await sort.click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await sort.click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
    await sort.click();
    await expect(header).toHaveAttribute("aria-sort", "none");
  });
});
