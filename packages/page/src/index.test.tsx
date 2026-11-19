// @vitest-environment jsdom
import { analyticsCatalog } from "@surfaces-ui/spec";
import type { PageDocument } from "@surfaces-ui/spec";
import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mountPage } from "./index.js";

const page = (components: Record<string, unknown>[], data: unknown = {}): PageDocument => ({
  id: "bills",
  title: "Bills",
  catalogId: analyticsCatalog.id,
  components: components as PageDocument["components"],
  data,
});

let mounted: { unmount(): void } | undefined;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = undefined;
  document.body.innerHTML = "";
});

function host(): HTMLElement {
  const element = document.createElement("div");
  document.body.append(element);
  return element;
}

describe("mountPage", () => {
  it("draws a page, and a grid over the page's own rows", async () => {
    const bills = [
      { name: "Power", due: "2026-01-05", amount: 80 },
      { name: "Water", due: "2026-01-20", amount: 30 },
    ];
    act(() => {
      mounted = mountPage(
        host(),
        page(
          [
            { id: "root", component: "Column", children: ["title", "grid"] },
            { id: "title", component: "Text", text: { "@path": "/title" }, variant: "h1" },
            { id: "grid", component: "DataGrid", sourceId: "page", sql: "SELECT * FROM bills", height: 300 },
          ],
          { title: "Monthly bills", tables: { bills } },
        ),
        { theme: "Berry", mode: "light", labels: { "grid.rows": "{count} bills" } },
      );
    });
    expect(screen.getByText("Monthly bills")).toBeTruthy();
    expect(await screen.findByText("2 bills")).toBeTruthy();
  });

  it("redraws in place with update", () => {
    let page1!: ReturnType<typeof mountPage>;
    act(() => {
      page1 = mountPage(host(), page([{ id: "root", component: "Text", text: "Before" }]));
    });
    mounted = page1;
    act(() => page1.update(page([{ id: "root", component: "Text", text: "After" }])));
    expect(screen.queryByText("Before")).toBeNull();
    expect(screen.getByText("After")).toBeTruthy();
  });

  it("says when a theme name or a locale is wrong, before drawing", () => {
    expect(() => mountPage(host(), page([]), { theme: "Neon" })).toThrow('There is no theme called "Neon".');
    expect(() => mountPage(host(), page([]), { locale: "not a locale" })).toThrow('"not a locale" is not a locale');
  });

  it("takes a phone's locale, with an underscore", () => {
    act(() => {
      mounted = mountPage(host(), page([{ id: "root", component: "Text", text: "Hallo" }]), { locale: "de_DE" });
    });
    expect(screen.getByText("Hallo")).toBeTruthy();
  });
});
