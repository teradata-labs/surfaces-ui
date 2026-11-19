import { expect, test } from "@playwright/test";
import { axeViolations, open } from "./helpers.js";

// Each area once its data has loaded; what axe can check of WCAG 2.2 AA must pass. The rest is in docs/accessibility.md.
const AREAS: { area: string; ready: (page: import("@playwright/test").Page) => import("@playwright/test").Locator }[] = [
  { area: "workbench", ready: (page) => page.getByText(/rows$/).first() },
  { area: "chat", ready: (page) => page.getByRole("textbox", { name: "Message" }) },
  { area: "pages", ready: (page) => page.getByRole("group", { name: "Example", exact: true }) },
  { area: "semantic", ready: (page) => page.locator("main h2").first() },
  { area: "discover", ready: (page) => page.locator("main h2").first() },
  { area: "catalog", ready: (page) => page.locator("main h2").first() },
  { area: "patterns", ready: (page) => page.locator("main h2").first() },
  { area: "pipelines", ready: (page) => page.locator("main h2").first() },
  { area: "docs", ready: (page) => page.getByRole("heading", { level: 1, name: "Getting started" }) },
];

for (const { area, ready } of AREAS) {
  test(`${area} passes axe @phone`, async ({ page }) => {
    await open(page, area);
    await expect(ready(page)).toBeVisible();
    // Let queries that started with the page finish drawing.
    await page.waitForLoadState("networkidle");
    expect(await axeViolations(page)).toEqual([]);
  });
}
