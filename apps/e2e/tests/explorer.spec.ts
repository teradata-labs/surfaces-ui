import { type Page, expect, test } from "@playwright/test";
import { open } from "./helpers.js";

const shelf = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const pill = (page: Page, name: string) => page.getByRole("complementary", { name: "Fields" }).getByRole("button", { name: new RegExp(`^${name} \\(`) });
const chart = (page: Page) => page.getByRole("img", { name: /^This is a chart/ });

test.describe("Explorer with pills", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "pages");
    await page.getByRole("button", { name: "Retail sales: explore with pills" }).click();
    await expect(chart(page)).toBeVisible();
  });

  test("pills are named as they are seen, then what kind they are", async ({ page }) => {
    await expect(pill(page, "Region")).toHaveAccessibleName("Region (attribute)");
    await expect(pill(page, "Line amount")).toHaveAccessibleName("Line amount (metric, in use)");
  });

  test("keys put a pill on a shelf, split by it and take it off, and the chart follows", async ({ page }) => {
    await pill(page, "Region").focus();
    await page.keyboard.press("Enter");
    await expect(shelf(page, "Break down by").getByRole("button", { name: /^Region \(/ })).toBeVisible();
    // Region joins Channel on the shelf, so the bars are now split by region.
    await expect(chart(page)).toHaveAccessibleName(/South/);

    await pill(page, "Status").focus();
    await page.keyboard.press("s");
    await expect(shelf(page, "Split by").getByRole("button", { name: /^Status \(/ })).toBeVisible();

    await shelf(page, "Split by").getByRole("button", { name: /^Status \(/ }).focus();
    await page.keyboard.press("Delete");
    await expect(shelf(page, "Split by").getByRole("button", { name: /^Status \(/ })).toHaveCount(0);
  });

  test("a pill dragged with the pointer lands on the shelf it is dropped on", async ({ page }) => {
    // Fonts differ between systems, so the shelf may start below the fold; a person would scroll to it first.
    await shelf(page, "Measure").scrollIntoViewIfNeeded();
    const from = await pill(page, "Quantity").boundingBox();
    const to = await shelf(page, "Measure").boundingBox();
    const height = page.viewportSize()!.height;
    expect(from && to).toBeTruthy();
    expect(from!.y >= 0 && to!.y + to!.height <= height, "the pill and the shelf are both on screen").toBe(true);
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    // Past the few pixels that make a press a drag, then across in steps as a hand would.
    await page.mouse.move(from!.x + from!.width / 2 + 12, from!.y + from!.height / 2 + 12, { steps: 3 });
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(shelf(page, "Measure").getByRole("button", { name: /^Quantity \(/ })).toBeVisible();
  });

  test("the numbers behind the chart are a table", async ({ page }) => {
    // Table is a choice under Draw as, beside the chart types, reached by the keyboard like them.
    await page.getByRole("group", { name: "Draw as" }).getByRole("button", { name: "Table" }).focus();
    await page.keyboard.press("Enter");
    const table = page.getByRole("region", { name: "The numbers behind the view" });
    await expect(table.getByRole("table")).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(4);
  });

  test("a measure dragged along its shelf changes the order of the series", async ({ page }) => {
    await pill(page, "Quantity").focus();
    await page.keyboard.press("Enter");
    const measure = shelf(page, "Measure");
    const onShelf = (name: string) => measure.getByRole("button", { name: new RegExp(`^${name} \\(`) });
    await expect(onShelf("Quantity")).toBeVisible();
    await measure.scrollIntoViewIfNeeded();
    const from = (await onShelf("Quantity").boundingBox())!;
    const to = (await onShelf("Line amount").boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 - 12, from.y + from.height / 2, { steps: 3 });
    // Just inside the left half of the first pill: in front of it.
    await page.mouse.move(to.x + 4, to.y + to.height / 2, { steps: 10 });
    await page.mouse.up();
    const order = async () => (await measure.locator(".sf-pill-label").allTextContents()).map((t) => t.replace(/\s*\(.*$/, "").trim());
    await expect.poll(order).toEqual(["Quantity", "Line amount"]);
    await expect(page.getByText("Quantity moved to place 1 of 2 on “Measure”.")).toBeVisible();
  });

  test("a finger held on a measure drags it along its shelf, and taps set the chart @phone", async ({ page, hasTouch }) => {
    test.skip(!hasTouch, "taps and touches need a touch screen: the phone project has one");
    await page.getByRole("button", { name: "Swap axes" }).tap();
    await expect(page.getByRole("button", { name: "Swap axes" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("group", { name: "Draw as" }).getByRole("button", { name: "Line" }).tap();
    await expect(page.getByRole("button", { name: "Swap axes" })).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("group", { name: "Draw as" }).getByRole("button", { name: "Bars" }).tap();

    await pill(page, "Quantity").focus();
    await page.keyboard.press("Enter");
    const measure = shelf(page, "Measure");
    const onShelf = (name: string) => measure.getByRole("button", { name: new RegExp(`^${name} \\(`) });
    await expect(onShelf("Quantity")).toBeVisible();
    await measure.scrollIntoViewIfNeeded();
    const from = (await onShelf("Quantity").boundingBox())!;
    const to = (await onShelf("Line amount").boundingBox())!;

    // A real touch, as Chrome would get it from a screen: press, hold still past TOUCH_HOLD_MS, slide, lift.
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x?: number, y?: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: x === undefined ? [] : [{ x, y: y!, id: 1 }] });
    const [x0, y0] = [from.x + from.width / 2, from.y + from.height / 2];
    const [x1, y1] = [to.x + 4, to.y + to.height / 2];
    await touch("touchStart", x0, y0);
    await page.waitForTimeout(450);
    for (let step = 1; step <= 12; step++) await touch("touchMove", x0 + ((x1 - x0) * step) / 12, y0 + ((y1 - y0) * step) / 12);
    await touch("touchEnd");

    const order = async () => (await measure.locator(".sf-pill-label").allTextContents()).map((t) => t.replace(/\s*\(.*$/, "").trim());
    await expect.poll(order).toEqual(["Quantity", "Line amount"]);
    // The chart draws the series in the shelf's new order.
    await expect(chart(page)).toHaveAccessibleName(/representing Quantity[\s\S]*representing Line amount/);
  });

  test("axes swap, and a second measure goes on its own scale as a line", async ({ page }) => {
    await expect(shelf(page, "Break down by").getByText("X axis")).toBeVisible();
    await page.getByRole("button", { name: "Swap axes" }).click();
    await expect(page.getByRole("button", { name: "Swap axes" })).toHaveAttribute("aria-pressed", "true");
    await expect(shelf(page, "Break down by").getByText("Y axis")).toBeVisible();
    await expect(shelf(page, "Measure").getByText("X axis")).toBeVisible();

    await pill(page, "Quantity").focus();
    await page.keyboard.press("Enter");
    await page.getByLabel("Draw Quantity as").selectOption("line");
    await page.getByLabel("Scale for Quantity").selectOption("right");
    // A line on a second scale cannot lie on its side, so the bars stand up again and the button says why.
    await expect(page.getByRole("button", { name: "Swap axes" })).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("Only bars on one scale can be turned on their side.")).toBeVisible();
    await expect(chart(page)).toHaveAccessibleName(/Line amount[\s\S]*Quantity/);
    // Each measure says which side's scale it is read against.
    await expect(shelf(page, "Measure").getByText("Y axes")).toBeVisible();
    await expect(shelf(page, "Measure").getByRole("button", { name: /^Quantity \(metric, right scale\)/ })).toBeVisible();
    await expect(shelf(page, "Measure").getByRole("button", { name: /^Line amount \(metric, left scale\)/ })).toBeVisible();
  });
});
