import { expect, test } from "@playwright/test";
import { axeViolations } from "./helpers.js";

// The components for rows an app holds, on their own pages in the catalog: keyboard paths in a real browser, axe, and
// no sideways scroll at phone width.
const page = (name: string) => `/?source=retail&component=${name}#catalog`;

test.describe("DataTable", () => {
  test("asks to sort from the keyboard and ticks rows and the page @phone", async ({ page: p }) => {
    await p.goto(page("DataTable"));
    const table = p.getByRole("table", { name: "People" });
    await expect(table.getByRole("rowheader", { name: "Ana Admin" })).toBeVisible();
    const owns = table.getByRole("columnheader", { name: /Owns/ });
    // A phone hides the "wide" columns; sort by name there instead.
    const sortable = (await owns.isVisible()) ? owns : table.getByRole("columnheader", { name: /Name/ });
    await sortable.getByRole("button").focus();
    await p.keyboard.press("Enter");
    await expect(sortable).toHaveAttribute("aria-sort", /ascending|descending/);

    await table.getByRole("checkbox", { name: "Select Ben Brook" }).check();
    const all = table.getByRole("checkbox", { name: "Select every row on this page" });
    expect(await all.evaluate((box) => (box as HTMLInputElement).indeterminate)).toBe(true);
    await all.check();
    await expect(table.getByRole("checkbox", { name: "Select Cleo Chen" })).toBeChecked();
    expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(await axeViolations(p)).toEqual([]);
  });

  test("keeps a row's controls on one line", async ({ page: p }) => {
    await p.goto(page("DataTable"));
    const controls = p.getByRole("toolbar", { name: "Cleo Chen actions" });
    const buttons = controls.getByRole("button");
    await expect(buttons).toHaveCount(3);
    const tops = await buttons.evaluateAll((all) => all.map((b) => Math.round(b.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });
});

test.describe("ConfirmDialog", () => {
  test("traps focus, cancels on Escape, and gives focus back @phone", async ({ page: p }) => {
    await p.goto(page("ConfirmDialog"));
    const opener = p.getByRole("button", { name: "Turn off…" });
    await opener.click();
    const dialog = p.getByRole("dialog", { name: "Turn off 5 accounts?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    expect(await axeViolations(p)).toEqual([]);
    await p.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Turn off" })).toBeFocused();
    await p.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});

test.describe("Combobox", () => {
  test("suggests as a person types and chooses with the keys @phone", async ({ page: p }) => {
    await p.goto(page("Combobox"));
    const box = p.getByRole("combobox", { name: "Hand their work to" });
    await box.fill("cleo");
    await expect(p.getByRole("listbox", { name: "Hand their work to" }).getByRole("option")).toHaveCount(1);
    await box.press("ArrowDown");
    await expect(p.getByRole("option", { name: /Cleo Chen/ })).toHaveAttribute("aria-selected", "true");
    expect(await axeViolations(p)).toEqual([]);
    await box.press("Enter");
    await expect(box).toHaveValue("cleo@example.com");
    await expect(box).toHaveAttribute("aria-expanded", "false");
    await box.press("Escape");
    await expect(box).toHaveValue("");
  });
});

test.describe("SelectionBar and Pagination", () => {
  test("offers every row that matches, and moves a page at a time @phone", async ({ page: p }) => {
    await p.goto(page("SelectionBar"));
    const bar = p.getByRole("group", { name: "With the selected rows" });
    await bar.getByRole("button", { name: "Select all 126 that match" }).click();
    await expect(bar.getByText("126 selected")).toBeVisible();
    await expect(bar.getByRole("button", { name: "Only this page" })).toBeVisible();
    expect(await axeViolations(p)).toEqual([]);

    await p.goto(page("Pagination"));
    const pages = p.getByRole("navigation", { name: "Pages" });
    await expect(pages.getByText("51–100 of 126")).toBeVisible();
    await pages.getByRole("button", { name: "Next" }).click();
    await expect(pages.getByText("101–126 of 126")).toBeVisible();
    await expect(pages.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
