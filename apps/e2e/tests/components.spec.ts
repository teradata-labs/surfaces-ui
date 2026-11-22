import { expect, test } from "@playwright/test";

// Every component at a glance: a card each, drawn from its example, opening its page.
test.describe("All components", () => {
  test("opens on every component, filters them, and opens one's page @phone", async ({ page }) => {
    await page.goto("/?source=retail#catalog");
    await expect(page.getByRole("heading", { name: "All components" })).toBeVisible();
    const views = page.getByRole("region", { name: "Data views" });
    await expect(views.getByRole("link", { name: /^Chart/ })).toBeVisible();
    await page.getByRole("searchbox", { name: "Filter all components" }).fill("pivot");
    await expect(page.getByRole("status").filter({ hasText: /match "pivot"/ })).toBeVisible();
    await expect(views.getByRole("link", { name: /^Chart/ })).toHaveCount(0);
    await views.getByRole("link", { name: /^PivotTable/ }).click();
    await expect(page).toHaveURL(/component=PivotTable/);
    await expect(page.locator(".catalog-name")).toHaveText("PivotTable");
  });
});

// A component's page: its code three ways, and the preview in a mode and theme of its own.
test.describe("Component page", () => {
  test("writes the preview as React, A2UI and json-render, and keeps the choice", async ({ page }) => {
    await page.goto("/?source=retail&component=Metric#catalog");
    const code = page.getByRole("region", { name: "Code" });
    await expect(code.locator("pre")).toContainText("<Ui.Metric");
    await code.getByRole("radio", { name: "A2UI" }).check();
    await expect(code.locator("pre")).toContainText('"updateComponents"');
    await code.getByRole("radio", { name: "json-render" }).check();
    await expect(code.locator("pre")).toContainText('"elements"');
    await page.reload();
    await expect(page.getByRole("region", { name: "Code" }).getByRole("radio", { name: "json-render" })).toBeChecked();
  });

  test("draws the preview light or dark in any theme without changing the page @phone", async ({ page }) => {
    await page.goto("/?source=retail&component=Metric#catalog");
    const preview = page.getByRole("region", { name: "Preview" });
    await expect(preview.locator(".sf-scope")).toHaveCount(0);
    const pageTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
    await preview.getByRole("radio", { name: "Light" }).check();
    await preview.getByRole("combobox", { name: "Theme" }).selectOption("Sand");
    const scope = preview.locator(".sf-scope");
    await expect(scope).toHaveAttribute("data-theme", "light");
    await preview.getByRole("radio", { name: "Dark" }).check();
    await expect(scope).toHaveAttribute("data-theme", "dark");
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe(pageTheme);
    await preview.getByRole("radio", { name: "As the page" }).check();
    await preview.getByRole("combobox", { name: "Theme" }).selectOption("page");
    await expect(preview.locator(".sf-scope")).toHaveCount(0);
  });

  test("slides the segment thumb onto the option chosen", async ({ page }) => {
    await page.goto("/?source=retail&component=Metric#catalog");
    const views = page.getByRole("radiogroup", { name: "Write it as" });
    await views.getByRole("radio", { name: "React" }).check();
    await views.getByRole("radio", { name: "json-render" }).check();
    await expect
      .poll(() =>
        views.evaluate((group) => {
          const checked = group.querySelector("[data-checked]")!.getBoundingClientRect();
          const box = group.getBoundingClientRect();
          const thumb = getComputedStyle(group, "::before");
          const left = 3 + (Number.parseFloat(thumb.translate) / 100) * Number.parseFloat(thumb.width);
          return Math.abs(box.left + left - checked.left) < 1.5 && Math.abs(Number.parseFloat(thumb.width) - checked.width) < 1.5;
        }),
      )
      .toBe(true);
  });
});

// The home page and the showcase draw the real components in their device frames, not pictures of them.
test.describe("Live device screens", () => {
  test("stops the home demo when a person reaches in, and sorts its grid", async ({ page }) => {
    await page.goto("/?source=retail#home");
    const desktop = page.getByRole("region", { name: /^Desktop:/ });
    const head = desktop.locator('.sf-grid-head:has-text("store_id")');
    await expect(head).toBeVisible({ timeout: 30_000 });
    await head.click();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(head).toHaveAttribute("aria-sort", "ascending");
  });

  test("draws the home page from the site catalog: its actions and role cards open their pages", async ({ page }) => {
    await page.goto("/?source=retail#home");
    await expect(page.getByRole("heading", { level: 1, name: "Surfaces UI" })).toBeVisible();
    const roles = page.getByRole("region", { name: "Showcase" });
    await roles.getByRole("button", { name: /Data steward/ }).click();
    await expect(page).toHaveURL(/#showcase\?persona=data-steward/);
    await page.goto("/?source=retail#home");
    await page.getByRole("button", { name: "Browse components" }).click();
    await expect(page).toHaveURL(/#catalog/);
  });

  test("lets a person change the analyst's Explorer on the showcase", async ({ page }) => {
    await page.goto("/?source=retail#showcase");
    const desktop = page.getByRole("region", { name: /^Desktop:/ });
    const line = desktop.getByRole("group", { name: "Draw as" }).getByRole("button", { name: "Line" });
    await line.click();
    await expect(line).toHaveAttribute("aria-pressed", "true");
  });
});
