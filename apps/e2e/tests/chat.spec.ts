import { type Page, expect, test } from "@playwright/test";
import { open } from "./helpers.js";

const log = (page: Page) => page.getByRole("log", { name: "Conversation" });
const panels = (page: Page) => page.getByRole("group", { name: "Chat panels" });
const rail = (page: Page) => page.getByRole("toolbar", { name: "Chat panels: show or hide panels" });

test.describe("Analytics chat", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "chat");
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  });

  test("a suggestion draws a live chart in the reply and says who answered @phone", async ({ page }) => {
    await page.getByRole("group", { name: "Suggestions" }).getByRole("button", { name: "Chart revenue by month" }).click();
    await expect(log(page).getByRole("article").filter({ hasText: "You said:" })).toContainText("Chart revenue by month");
    const reply = log(page).getByRole("article").filter({ hasText: "The agent replied:" });
    await expect(reply.getByRole("img", { name: /^This is a chart/ })).toBeVisible();
    await expect(reply.getByText(/^Answered by scripted demo/)).toBeVisible();
  });

  test("Enter sends what was typed, and Send waits for words", async ({ page }) => {
    const send = page.getByRole("button", { name: "Send" });
    await expect(send).toBeDisabled();
    await page.getByRole("textbox", { name: "Message" }).fill("Show the data model");
    await expect(send).toBeEnabled();
    await page.keyboard.press("Enter");
    await expect(log(page).getByRole("article").filter({ hasText: "You said:" })).toContainText("Show the data model");
    await expect(log(page).getByRole("group", { name: "Data model" }).first()).toBeVisible();
  });

  test("panels open from the rail, move from their menu, and stay where they were put after a reload", async ({ page }) => {
    await rail(page).getByRole("button", { name: "Data" }).click();
    const data = panels(page).getByRole("region", { name: "Data", exact: true });
    await expect(data).toBeVisible();

    await panels(page).getByRole("button", { name: "Move Data" }).click();
    await page.getByRole("menuitem", { name: "To a new column on the left" }).click();
    await expect(panels(page).getByRole("status").last()).toHaveText(/Data is now in column 1 of 2/);

    // The panels' headings in the order they are drawn, left to right.
    const order = async () => (await panels(page).getByRole("heading", { level: 3 }).allTextContents()).filter((t) => t === "Chat" || t === "Data");
    const before = await order();
    expect(before.indexOf("Data")).toBeLessThan(before.indexOf("Chat"));

    await page.reload();
    await expect(panels(page).getByRole("region", { name: "Data", exact: true })).toBeVisible();
    expect(await order()).toEqual(before);
  });
});
