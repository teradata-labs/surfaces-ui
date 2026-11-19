// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SurfacesPanel } from "./SurfacesPanel.js";

afterEach(cleanup);

const orders = [
  { order_id: 1, region: "Europe", amount: 40 },
  { order_id: 2, region: "Americas", amount: 15 },
];

describe("SurfacesPanel", () => {
  it("draws the rows of a query in its own themed region", async () => {
    const { container } = render(<SurfacesPanel sourceId="shop" sql="SELECT * FROM orders" dataSource={memoryDataSource({ sourceId: "shop", tables: { orders } })} />);
    await waitFor(() => expect(document.querySelectorAll(".sf-grid-row")).toHaveLength(2));
    const rows = [...document.querySelectorAll(".sf-grid-row")].map((r) => r.textContent);
    expect(rows[0]).toContain("Europe");
    expect(rows[1]).toContain("Americas");
    expect(screen.getByRole("tab", { name: "Table" })).toBeTruthy();
    // Scoped: the theme's variables apply to the panel's own region, not to :root.
    const region = container.querySelector<HTMLElement>("[data-sf-scope]")!;
    expect(region.contains(document.querySelector(".sf-grid-row"))).toBe(true);
    const css = container.querySelector("style")!.textContent!;
    expect(css).toContain(`[data-sf-scope="${region.dataset.sfScope}"]`);
    expect(css).not.toContain(":root");
  });
});
