import { type Page, expect, test } from "@playwright/test";
import { presets } from "@surfaces-ui/tokens";
import { axeViolations, open } from "./helpers.js";

/** Opens the playground in a preset and mode, as if a person had chosen them before. */
async function inTheme(page: Page, name: string, mode: "light" | "dark") {
  const theme = presets.find((p) => p.name === name)!;
  await page.addInitScript((state) => localStorage.setItem("surfaces.theme", state), JSON.stringify({ theme, mode }));
}

// The other browser tests run in the demo theme, Aurora, dark. Here every area is checked in the library's default,
// Ink, light, and one area in every preset and mode, so a contrast fault in a light theme or a preset is caught too.
const AREAS: { area: string; ready: (page: Page) => ReturnType<Page["locator"]> }[] = [
  { area: "workbench", ready: (page) => page.getByText(/rows$/).first() },
  { area: "chat", ready: (page) => page.getByRole("textbox", { name: "Message" }) },
  { area: "pages", ready: (page) => page.getByRole("group", { name: "Example", exact: true }) },
  { area: "catalog", ready: (page) => page.locator("main h2").first() },
  { area: "patterns", ready: (page) => page.locator("main h2").first() },
  { area: "pipelines", ready: (page) => page.locator("main h2").first() },
];

for (const { area, ready } of AREAS) {
  test(`${area} passes axe in Ink, light`, async ({ page }) => {
    await inTheme(page, "Ink", "light");
    await open(page, area);
    await expect(ready(page)).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await axeViolations(page)).toEqual([]);
  });
}

for (const preset of presets) {
  for (const mode of ["light", "dark"] as const) {
    test(`pages passes axe in every preset: ${preset.name}, ${mode}`, async ({ page }) => {
      await inTheme(page, preset.name, mode);
      await open(page, "pages");
      await expect(page.getByRole("group", { name: "Example", exact: true })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
}

test.describe("Appearance menu in the top bar", () => {
  test("chooses a preset and a mode, and opens the theme editor @phone", async ({ page }) => {
    await open(page, "pages");
    const narrow = (page.viewportSize()?.width ?? 1280) < 768;
    if (narrow) await page.getByRole("button", { name: /Show .* navigation/ }).click();
    const button = page.getByRole("button", { name: /^(Ink|Aurora|Sand|Berry|Harbor|Moss|Mono|High contrast|Custom) (Light|Dark)$/ });
    await button.click();
    // The menu's own panel: the theme editor it opens has an "Appearance" control of its own.
    const panel = page.locator(".theme-menu").getByRole("group", { name: "Appearance" });
    await panel.getByRole("button", { name: "Mono" }).click();
    await panel.getByText("Light", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(button).toHaveText(/Mono\s*Light/);
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("surfaces.theme") ?? "{}"));
    expect(kept.theme.name).toBe("Mono");
    expect(kept.mode).toBe("light");
    await panel.getByRole("button", { name: "Theme editor" }).click();
    await expect(page).toHaveURL(/\/theme\/\?/);
    if (!narrow) {
      await button.click();
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(button).toBeFocused();
    }
  });
});
