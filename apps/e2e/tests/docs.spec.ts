import { expect, test } from "@playwright/test";
import { open } from "./helpers.js";

// The repository's guides on the site: a link between guides opens the guide in place, and Back returns to the last one.
test("a guide links to another in place, and Back returns", async ({ page }) => {
  await open(page, "docs?page=getting-started");
  const article = page.locator(".docs-article");
  await expect(article.getByRole("heading", { level: 1, name: "Getting started" })).toBeVisible();
  // Mark the document: a link that reloaded the page would lose it.
  await page.evaluate(() => Object.assign(window, { stayed: true }));
  await article.getByRole("link", { name: "accessibility.md" }).first().click();
  await expect(article.getByRole("heading", { level: 1, name: "Accessibility and responsive design" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
  await page.goBack();
  await expect(article.getByRole("heading", { level: 1, name: "Getting started" })).toBeVisible();
});

test("the guide list is beside the guide, and folds above it on a phone @phone", async ({ page }) => {
  await open(page, "docs?page=getting-started");
  const narrow = (page.viewportSize()?.width ?? 1280) < 600;
  const fold = page.locator(".docs-fold");
  if (narrow) {
    await fold.locator("summary").click();
    await fold.getByRole("link", { name: "A chat for analytics users" }).click();
  } else {
    await expect(fold).toBeHidden();
    await page.locator(".docs-side").getByRole("link", { name: "A chat for analytics users" }).click();
  }
  await expect(page.locator(".docs-article").getByRole("heading", { level: 1, name: "A chat for analytics users" })).toBeVisible();
  // A note left in the file for its editors is not shown.
  await expect(page.locator(".docs-article")).not.toContainText("<!--");
});
