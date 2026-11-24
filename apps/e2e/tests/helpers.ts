import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";

/** Opens a playground area on a sample model, run by DuckDB in the page. */
export async function open(page: Page, area: string, source = "retail") {
  // Playwright's pointer starts at the top left corner, over the folded navigation's menu button. A person's pointer
  // would be on the page, so put it there first.
  const size = page.viewportSize();
  if (size) await page.mouse.move(size.width - 2, size.height - 2);
  // An area with its own parameters (`docs?page=styling`) keeps them in the query beside the data picked.
  const [name = "home", query] = area.split("?");
  await page.goto(`/${name === "home" ? "" : `${name}/`}?${query ? `${query}&` : ""}source=${source}`);
  // The backend badge says which backend answers once the sample is loaded.
  await expect(page.locator("main")).toBeVisible();
}

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const lines = (violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) =>
  violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} — ${(n.any[0]?.message ?? n.all[0]?.message ?? v.help).slice(0, 160)}`));

/**
 * WCAG 2.2 A and AA rules that axe can check; returns the violations as short lines for a readable failure.
 * Target size is not checked inside a pan and zoom canvas: a diagram fitted to a phone draws its cards small until the person
 * zooms in, and every card there can also be reached from the keyboard and, in a model diagram, from the list beneath it.
 */
export async function axeViolations(page: Page) {
  const all = await new AxeBuilder({ page }).withTags(TAGS).disableRules(["target-size"]).analyze();
  const size = await new AxeBuilder({ page }).withRules(["target-size"]).exclude(".sf-panzoom-plane").analyze();
  return [...lines(all.violations), ...lines(size.violations)];
}
