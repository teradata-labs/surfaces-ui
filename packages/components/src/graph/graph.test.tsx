// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NodeGraph } from "./NodeGraph.js";
import { type GraphLink, type GraphNode, buildGraphOption, graphGroups, graphNeighbours, graphWindow, linkCounts } from "./model.js";

afterEach(cleanup);

const nodes: GraphNode[] = [
  { id: "order", label: "Order", group: "Fact", level: "half", description: "One purchase." },
  { id: "line", label: "Order line", group: "Fact", level: "full" },
  { id: "customer", label: "Customer", group: "Dimension", level: "outline" },
  { id: "product", label: "Product", group: "Dimension", level: "full" },
  { id: "store", label: "Store", group: "Dimension" },
];
const links: GraphLink[] = [
  { source: "line", target: "order", label: "belongs to" },
  { source: "line", target: "product", label: "is of" },
  { source: "order", target: "customer" },
  { source: "order", target: "store" },
  { source: "order", target: "nowhere" },
];

describe("graph functions", () => {
  it("counts links and finds neighbours", () => {
    expect(linkCounts(links).get("order")).toBe(4);
    expect(graphNeighbours("line", links)).toEqual([{ id: "order", label: "belongs to" }, { id: "product", label: "is of" }]);
  });

  it("draws everything when it fits, leaving out links to nodes that are not there", () => {
    expect(graphWindow(nodes, links, undefined)).toMatchObject({ hidden: 0, nodes: { length: 5 }, links: { length: 4 } });
  });

  it("past the limit keeps what is around the open node, or the most linked one, and counts the rest", () => {
    const around = graphWindow(nodes, links, "product", 3);
    expect(around.nodes.map((n) => n.id).sort()).toEqual(["line", "order", "product"]);
    expect(around.hidden).toBe(2);
    expect(around.links.every((l) => around.nodes.some((n) => n.id === l.source) && around.nodes.some((n) => n.id === l.target))).toBe(true);
    expect(graphWindow(nodes, links, undefined, 2).nodes.map((n) => n.id)).toContain("order");
  });

  it("gives a group its colour, a level its fill, and marks the open node", () => {
    expect(graphGroups(nodes, ["Dimension"])).toEqual(["Dimension", "Fact"]);
    const option = buildGraphOption({ nodes, links: links.slice(0, 4), selected: "order", groups: ["Fact", "Dimension"], colors: ["#111111", "#222222"], animate: false }) as {
      animation: boolean;
      legend: { data: string[] }[];
      series: { force: { layoutAnimation: boolean }; categories: { name: string; itemStyle: { color: string } }[]; data: { id: string; category?: number; symbolSize: number; itemStyle: Record<string, unknown>; label?: unknown }[] }[];
    };
    const series = option.series[0]!;
    const drawn = (id: string) => series.data.find((n) => n.id === id)!;
    expect(option.legend[0]!.data).toEqual(["Fact", "Dimension"]);
    expect(series.categories.map((c) => c.itemStyle.color)).toEqual(["#111111", "#222222"]);
    expect(drawn("line").itemStyle).toEqual({ color: "#111111" });
    expect(drawn("order").itemStyle).toMatchObject({ color: "#111111", opacity: 0.5, borderWidth: 4 });
    expect(drawn("customer").itemStyle).toEqual({ color: "rgba(0, 0, 0, 0)", borderColor: "#222222", borderWidth: 2 });
    expect(drawn("order").label).toEqual({ opacity: 1, show: true, fontWeight: "bold" });
    expect(drawn("line").label).toBeUndefined();
    expect(drawn("order").symbolSize).toBeGreaterThan(drawn("store").symbolSize);
    // Asked for no motion: nothing animates, the layout included.
    expect(option.animation).toBe(false);
    expect(series.force.layoutAnimation).toBe(false);
  });

  it("has no legend for one group, and shares the last colour when groups outnumber colours", () => {
    const one = buildGraphOption({ nodes: nodes.map((n) => ({ ...n, group: "Term" })), links: [], colors: ["#111111"], animate: true }) as { legend?: unknown };
    expect(one.legend).toBeUndefined();
    const many = buildGraphOption({ nodes, links: [], groups: ["Fact", "Dimension"], colors: ["#111111"], animate: true }) as { series: { categories: { itemStyle: { color: string } }[] }[] };
    expect(many.series[0]!.categories.map((c) => c.itemStyle.color)).toEqual(["#111111", "#111111"]);
  });
});

describe("NodeGraph", () => {
  it("lists every node beside the canvas, and the list opens a node and walks to its neighbours", () => {
    const opened: string[] = [];
    const notes: string[] = [];
    const view = render(<NodeGraph label="Terms" noun="term" nodes={nodes} links={links.slice(0, 4)} levels={{ full: "Certified", half: "Partly certified", outline: "Not certified" }} onSelect={(id) => opened.push(id)} onContext={(note) => notes.push(note.kind)} />);
    expect(screen.getByRole("status").textContent).toContain("5 terms, 4 links, also listed here.");
    fireEvent.click(screen.getByRole("button", { name: /^Order line/ }));
    expect(opened).toEqual(["line"]);
    expect(notes).toEqual(["node.opened"]);
    expect(screen.getByRole("button", { name: /^Customer/ }).textContent).toContain("Not certified");

    view.rerender(<NodeGraph label="Terms" noun="term" nodes={nodes} links={links.slice(0, 4)} selected="line" onSelect={(id) => opened.push(id)} />);
    expect(screen.getByRole("button", { name: /^Order line/ }).getAttribute("aria-current")).toBe("true");
    const around = screen.getByText("is linked to:", { exact: false }).closest("div")!;
    expect(within(around).getByText("belongs to")).toBeTruthy();
    fireEvent.click(within(around).getByRole("button", { name: "Product" }));
    expect(opened).toEqual(["line", "product"]);
  });

  it("says how many nodes it left out of a large graph", () => {
    render(<NodeGraph label="Terms" nodes={nodes} links={links.slice(0, 4)} selected="product" limit={3} />);
    expect(screen.getByRole("status").textContent).toContain("2 more are not drawn");
  });
});
