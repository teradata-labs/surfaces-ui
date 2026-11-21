// @vitest-environment jsdom
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { A2UI_VERSION, conditionHolds } from "../dynamic.js";
import { type SurfaceAction, type SurfaceComponent, type SurfaceMessage, applyMessages } from "../surface.js";
import { SurfaceView, analyticsRenderers } from "./index.js";

afterEach(cleanup);

const v = A2UI_VERSION;
const surfaceOf = (components: SurfaceComponent[], data?: unknown, sendDataModel = false) => {
  const messages: SurfaceMessage[] = [
    { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id, ...(sendDataModel ? { sendDataModel } : {}) } },
    { version: v, updateComponents: { surfaceId: "main", components } },
  ];
  if (data !== undefined) messages.push({ version: v, updateDataModel: { surfaceId: "main", path: "/", value: data } });
  return applyMessages({}, messages).main!;
};

const posts = [
  { post_id: 1, author: "Ada", handle: "@ada", body: "First", likes: 3 },
  { post_id: 2, author: "Grace", handle: "@grace", body: "Second", likes: 9 },
  { post_id: 3, author: "Edsger", handle: "@ewd", body: "Third", likes: 1 },
];
const dataSource = memoryDataSource({ tables: { posts } });

describe("RowList", () => {
  const feed: SurfaceComponent[] = [
    { id: "root", component: "Column", children: ["feed"] },
    { id: "feed", component: "RowList", sourceId: "memory", sql: "SELECT * FROM posts", child: "post", label: "Posts", sorts: [{ column: "likes", desc: true }], rowKey: "post_id" },
    { id: "post", component: "Card", child: "post-body" },
    { id: "post-body", component: "Column", children: ["who", "body", "viewer", "like"] },
    { id: "who", component: "Text", text: { "@call": "formatString", args: { value: "${author} ${handle}" } } },
    { id: "body", component: "Text", text: { "@path": "body" } },
    { id: "viewer", component: "Text", text: { "@call": "formatString", args: { value: "seen by ${/viewer}" } } },
    { id: "like", component: "Button", child: "like-label", action: { event: { name: "like", context: { post_id: { "@path": "post_id" }, viewer: { "@path": "/viewer" } } } } },
    { id: "like-label", component: "Text", text: { "@call": "formatString", args: { value: "Like (${likes})" } } },
  ];

  it("is in the catalog with a valid example, and a template is its child", () => {
    expect(analyticsCatalog.validateComponent(analyticsCatalog.components.RowList!.example)).toEqual([]);
    for (const component of feed) expect(analyticsCatalog.validateComponent(component), component.id).toEqual([]);
  });

  it("draws its child once per row, each reading its own row, with a button that says which row it is", async () => {
    const onAction = vi.fn<(a: SurfaceAction) => void>();
    const onDataChange = vi.fn();
    const onProblem = vi.fn();
    render(
      <DataSourceProvider dataSource={dataSource}>
        <SurfaceView surface={surfaceOf(feed, { viewer: "Lin" }, true)} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} onDataChange={onDataChange} onProblem={onProblem} />
      </DataSourceProvider>,
    );
    const list = await screen.findByRole("list", { name: "Posts" });
    const items = await waitFor(() => {
      const found = within(list).getAllByRole("listitem");
      expect(found).toHaveLength(3);
      return found;
    });
    // The engine's order: most liked first. A relative path reads the row, an absolute one the surface.
    expect(items.map((item) => item.textContent)).toEqual(["Grace @graceSecondseen by LinLike (9)", "Ada @adaFirstseen by LinLike (3)", "Edsger @ewdThirdseen by LinLike (1)"]);
    fireEvent.click(within(items[2]!).getByRole("button", { name: "Like (1)" }));
    expect(onAction.mock.calls[0]![0]).toMatchObject({ name: "like", sourceComponentId: "like", context: { post_id: 3, viewer: "Lin" } });
    // The rows were never put in the surface's data model: the agent is sent the surface's data and the declared context only.
    expect(onAction.mock.calls[0]![0].dataModel).toEqual({ viewer: "Lin" });
    expect(onDataChange).not.toHaveBeenCalled();
    expect(onProblem).not.toHaveBeenCalled();
  });
});

describe("visibleWhen", () => {
  it("holds on a value, one of several, or anything being there", () => {
    const data = { source: { kind: "Table", name: "" }, ok: false, rows: [{ kind: "a" }] };
    expect(conditionHolds({ path: "/source/kind", equals: "Table" }, data)).toBe(true);
    expect(conditionHolds({ path: "/source/kind", equals: "Website" }, data)).toBe(false);
    expect(conditionHolds({ path: "/source/kind", in: ["Website", "Table"] }, data)).toBe(true);
    expect(conditionHolds({ path: "/source/name" }, data)).toBe(false);
    expect(conditionHolds({ path: "/ok" }, data)).toBe(false);
    expect(conditionHolds({ path: "/source/kind" }, data)).toBe(true);
    expect(conditionHolds({ path: "kind", equals: "a" }, data, "/rows/0")).toBe(true);
    expect(analyticsCatalog.validateComponent({ id: "t", component: "Text", text: "x", visibleWhen: { path: "/a", equals: 1, in: [1] } })).not.toEqual([]);
    expect(analyticsCatalog.validateComponent({ id: "t", component: "Text", text: "x", visibleWhen: { path: "/a", is: 1 } })).not.toEqual([]);
  });

  it("shows a field only once the choice that calls for it is made, and marks a required one left empty", () => {
    const surface = surfaceOf(
      [
        { id: "root", component: "Column", children: ["kind", "table", "url", "size"] },
        { id: "kind", component: "ChoicePicker", label: "Source", value: { "@path": "/kind" }, options: ["Table", "Website"] },
        { id: "table", component: "TextField", label: "Table name", value: { "@path": "/table" }, required: true, help: "As database.table", visibleWhen: { path: "/kind", equals: "Table" } },
        { id: "url", component: "TextField", label: "URL to crawl", value: { "@path": "/url" }, pattern: "https?://.+", visibleWhen: { path: "/kind", equals: "Website" } },
        { id: "size", component: "NumberField", label: "Chunk size", value: { "@path": "/size" }, min: 200, max: 2000, required: true },
      ],
      {},
    );
    render(<SurfaceView surface={surface} catalog={analyticsCatalog} renderers={analyticsRenderers} />);
    expect(screen.queryByLabelText(/Table name/)).toBeNull();
    expect(screen.queryByLabelText(/URL to crawl/)).toBeNull();
    fireEvent.click(screen.getByLabelText("Table"));
    const table = screen.getByLabelText(/Table name/) as HTMLInputElement;
    expect(screen.queryByLabelText(/URL to crawl/)).toBeNull();
    // Required is drawn and announced, the hint is tied to the field, and nothing is said until the person leaves it.
    expect(table.required).toBe(true);
    expect(table.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("As database.table")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(table);
    expect(screen.getByRole("alert").textContent).toBe("Table name is required.");
    expect(table.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(table, { target: { value: "docs.articles" } });
    expect(screen.queryByRole("alert")).toBeNull();

    const size = screen.getByLabelText(/Chunk size/);
    fireEvent.change(size, { target: { value: "50" } });
    fireEvent.blur(size);
    expect(screen.getByRole("alert").textContent).toMatch(/200/);
    fireEvent.change(size, { target: { value: "500" } });
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.click(screen.getByLabelText("Website"));
    expect(screen.queryByLabelText(/Table name/)).toBeNull();
    const url = screen.getByLabelText(/URL to crawl/);
    fireEvent.change(url, { target: { value: "not a link" } });
    fireEvent.blur(url);
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

describe("Message", () => {
  it("writes who spoke and when, sets the person's turns apart, and draws the text as Markdown", () => {
    const surface = surfaceOf([
      { id: "root", component: "Column", children: ["a", "b"] },
      { id: "a", component: "Message", speaker: "Assistant", text: "Which **table** holds the articles?", time: "10:42" },
      { id: "b", component: "Message", speaker: "You", text: "docs.articles", side: "end" },
    ]);
    const { container } = render(<SurfaceView surface={surface} catalog={analyticsCatalog} renderers={analyticsRenderers} />);
    const [first, second] = [...container.querySelectorAll(".sf-a2-message")];
    expect(first!.getAttribute("data-side")).toBe("start");
    expect(first!.textContent).toContain("Assistant");
    expect(first!.textContent).toContain("10:42");
    expect(first!.querySelector("strong")!.textContent).toBe("table");
    expect(second!.getAttribute("data-side")).toBe("end");
    expect(second!.textContent).toContain("You");
    expect(analyticsCatalog.validateComponent(analyticsCatalog.components.Message!.example)).toEqual([]);
  });
});
