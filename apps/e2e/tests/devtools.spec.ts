import { expect, test } from "@playwright/test";
import { axeViolations, open } from "./helpers.js";

// The dev tools: one component around the app records what the library does inside it, and a drawer shows it.
test.describe("Dev tools", () => {
  test("show a message, a service call and a problem, and step back to the surface as it stood @phone", async ({ page }) => {
    // The component's own page: a small surface built from messages, inside dev tools placed in the page.
    await page.goto("/?source=retail&component=SurfacesDevTools#catalog");
    await page.getByRole("button", { name: "Draw a surface" }).click();
    const tools = page.getByRole("region", { name: "Surfaces dev tools" });
    await expect(tools).toBeVisible();
    const timeline = tools.getByRole("listbox", { name: "Timeline" });
    const row = (text: string) => timeline.getByRole("option").filter({ hasText: text }).first();

    // A service call: the grid's query, with its SQL and never its rows.
    await expect(row("DataSource.execute")).toBeVisible();
    await row("DataSource.execute").click();
    await expect(tools.getByRole("region", { name: "Timeline: Service DataSource.execute, in full" })).toContainText("SQL sent");

    // A message: with the calls and the drawn components filtered out, the messages are what is left.
    const kinds = tools.getByRole("group", { name: "Show in the timeline" });
    await kinds.getByRole("button", { name: "Service", exact: true }).click();
    await kinds.getByRole("button", { name: "Component", exact: true }).click();
    await expect(row("updateComponents")).toBeVisible();
    await expect(row("createSurface")).toBeVisible();

    // A problem: a component the catalog refuses is recorded against the component, and the page shows the notice.
    await page.getByRole("button", { name: "Send a change" }).click();
    await page.getByRole("button", { name: "Send a component the catalog refuses" }).click();
    await expect(row("VALIDATION_FAILED")).toBeVisible();
    await expect(page.getByRole("button", { name: /Open dev tools/ })).toHaveCount(1); // the page's own, still closed

    // Time travel: one step back is the surface before the refused component, drawn read-only over live data.
    const preview = tools.locator(".sf-devtools-preview");
    await expect(preview.getByRole("note").first()).toContainText('Stat "title"');
    await tools.getByRole("button", { name: "Step back" }).click();
    await expect(tools.locator(".sf-devtools-note")).toContainText(/Showing step 3 of 4 \(updateComponents\).*queried live/);
    await expect(preview).toContainText("sent again at");
    await expect(preview.getByRole("note")).toHaveCount(0);
    await tools.getByRole("button", { name: "Step back" }).click();
    await expect(preview).not.toContainText("sent again at");
    await expect(preview).toContainText("Rows of");
    // The page itself has not moved: it still shows the notice.
    await expect(page.locator(".app-demo-stack > .sf-surface").getByRole("note")).toContainText('Stat "title"');
    await tools.getByRole("button", { name: "Live" }).click();
    await expect(preview.getByRole("note").first()).toContainText('Stat "title"');
  });

  test("open over any page from the button and the keyboard, record a chat turn with no wiring, and pass axe @phone", async ({ page, isMobile }) => {
    await open(page, "chat");
    await page.getByRole("group", { name: "Suggestions" }).getByRole("button", { name: "Chart revenue by month" }).click();
    await expect(page.getByText(/^Answered by scripted demo/)).toBeVisible();

    await page.getByRole("button", { name: /Open dev tools/ }).click();
    const tools = page.getByRole("region", { name: "Surfaces dev tools" });
    await expect(tools).toBeVisible();
    const timeline = tools.getByRole("listbox", { name: "Timeline" });
    await expect(timeline).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await axeViolations(page)).toEqual([]);
    // The page keeps no sideways scroll with the drawer open.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    // The turn is there with what was asked, and the messages it sent, though the chat was given no recorder.
    const kinds = tools.getByRole("group", { name: "Show in the timeline" });
    for (const kind of ["Component", "Service", "State", "Event", "Problem"]) await kinds.getByRole("button", { name: kind, exact: true }).click();
    await expect(timeline.getByRole("option").filter({ hasText: "turn: text" })).toContainText("Chart revenue by month");
    await expect(timeline.getByRole("option").filter({ hasText: "updateComponents" }).first()).toBeVisible();

    await tools.getByRole("button", { name: "Close dev tools" }).click();
    await expect(tools).toHaveCount(0);
    if (!isMobile) {
      await page.keyboard.press("Control+Shift+D");
      await expect(tools).toBeVisible();

      // A component picked in Components is outlined on the page, clear of the drawer, and no longer once another pane's choice ends it.
      await tools.getByRole("button", { name: "Open Components" }).click();
      await tools.getByRole("listbox", { name: "Components of the surface" }).getByRole("option").filter({ hasText: "Chart" }).click();
      const outline = page.locator(".sf-devtools-inspect");
      await expect(outline).toBeVisible();
      const [box, dockTop] = await page.evaluate(() => {
        const mark = document.querySelector("template[data-sf-inspect]")!;
        const of = (el: Element) => el.getBoundingClientRect();
        const drawn = of(mark.nextElementSibling!);
        const shown = of(document.querySelector(".sf-devtools-inspect")!);
        return [{ dx: Math.abs(drawn.left - shown.left), dy: Math.abs(drawn.top - shown.top), dw: Math.abs(drawn.width - shown.width), bottom: shown.bottom }, of(document.querySelector(".sf-devtools-dock")!).top] as const;
      });
      expect(box.dx + box.dy + box.dw).toBeLessThan(3);
      expect(box.bottom).toBeLessThanOrEqual(dockTop + 1);

      // What the recording says about it is listed, and says it is rules, not a model.
      await expect(tools.getByRole("group", { name: "Likely cause for Chart chart" }).first()).toContainText("Not a model");

      // The lists are narrowed to that component; clearing shows everything, and a press on the page picks one too.
      const timelineRows = tools.getByRole("listbox", { name: "Timeline" }).getByRole("option");
      await expect(timelineRows.filter({ hasText: 'Chart "chart"' })).toHaveCount(1);
      await expect(timelineRows.filter({ hasText: 'Metric "' })).toHaveCount(0);
      await tools.getByRole("button", { name: /Show every component again/ }).first().click();
      await expect(outline).toHaveCount(0);
      await expect(tools.getByRole("button", { name: /Show every component again/ })).toHaveCount(0);
      await tools.getByRole("button", { name: "Pick a component on the page" }).click();
      await page.locator(".sf-metric").first().click();
      await expect(outline).toBeVisible();
      await expect(tools.getByRole("button", { name: /Show every component again, not only Metric/ }).first()).toBeVisible();
      await expect(timelineRows.filter({ hasText: 'Chart "chart"' })).toHaveCount(0);
      await tools.getByRole("button", { name: /Show every component again/ }).first().click();

      // A window of its own: the same panel on the same recording, themed as the page is, and back again.
      const [other] = await Promise.all([page.waitForEvent("popup"), tools.getByRole("button", { name: "Open in a window of its own" }).click()]);
      const moved = other.getByRole("region", { name: "Surfaces dev tools" });
      await expect(moved.getByRole("listbox", { name: "Timeline" }).getByRole("option").first()).toBeVisible();
      await expect(tools).toHaveCount(0);
      expect(await other.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sf-color-bg").trim())).not.toBe("");
      await moved.getByRole("button", { name: "Step back" }).click();
      await expect(moved.locator(".sf-devtools-note")).toContainText("queried live");
      await moved.getByRole("button", { name: "Put back in the page" }).click();
      await expect(tools).toBeVisible();
      await page.keyboard.press("Control+Shift+D");
      await expect(tools).toHaveCount(0);
    }
  });
});
