import { describe, expect, it } from "vitest";
import {
  shapeText,
  A2UI_VERSION,
  type SurfaceMessage,
  analyticsCatalog,
  applyMessage,
  applyMessages,
  catalogDocs,
  catalogJson,
  catalogPrompt,
  fromJsonRender,
  getPath,
  resolve,
  safeUrl,
  setPath,
  standardFunctions,
} from "./index.js";

const v = A2UI_VERSION;
const functions = Object.fromEntries(Object.entries(standardFunctions).map(([name, fn]) => [name, fn.implementation]));

describe("catalog", () => {
  it("accepts every component's own example", () => {
    for (const [name, definition] of Object.entries(analyticsCatalog.components)) {
      expect(analyticsCatalog.validateComponent(definition.example), name).toEqual([]);
    }
  });

  it("rejects unknown components, unknown props and wrong values, with a path", () => {
    expect(analyticsCatalog.validateComponent({ id: "x", component: "Iframe", src: "http://x" })[0]!.message).toMatch(/Unknown component "Iframe"/);
    expect(analyticsCatalog.validateComponent({ id: "x", component: "Text", text: "a", onClick: "alert(1)" })[0]!.message).toMatch(/Unrecognized key/);
    expect(analyticsCatalog.validateComponent({ id: "c", component: "Chart", sourceId: "s", sql: "SELECT 1", type: "radar", x: "a", y: [{}] })[0]!.path).toBe("/type");
    expect(analyticsCatalog.validateComponent({ id: "", component: "Divider" })[0]!.path).toBe("/id");
  });

  it("validates whole messages", () => {
    expect(analyticsCatalog.validateMessage({ version: v, createSurface: { surfaceId: "s", catalogId: analyticsCatalog.id } })).toEqual([]);
    expect(analyticsCatalog.validateMessage({ version: v, createSurface: { surfaceId: "s", catalogId: "other" } })[0]!.path).toBe("/createSurface/catalogId");
    expect(analyticsCatalog.validateMessage({ version: "v0.1", deleteSurface: { surfaceId: "s" } }).length).toBeGreaterThan(0);
    const bad = analyticsCatalog.validateMessage({
      version: v,
      updateComponents: { surfaceId: "s", components: [{ id: "root", component: "Divider" }, { id: "t", component: "Text" }] },
    });
    expect(bad[0]!.path).toBe("/updateComponents/components/1/text");
  });
});

describe("data model", () => {
  it("reads and writes by pointer without changing the input", () => {
    const before = { a: { b: [1, 2] } };
    const after = setPath(before, "/a/b/1", 9) as typeof before;
    expect(after.a.b).toEqual([1, 9]);
    expect(before.a.b).toEqual([1, 2]);
    expect(getPath(setPath({}, "/x/y", "z"), "/x/y")).toBe("z");
    expect(setPath({ a: 1, b: 2 }, "/a", undefined)).toEqual({ b: 2 });
    expect(setPath({ a: 1 }, "/", { b: 2 })).toEqual({ b: 2 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    setPath({}, "/__proto__/polluted", true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("resolves bindings, relative paths and functions anywhere in props", () => {
    const data = { region: "Europe", rows: [{ name: "Ada", spend: 1234.5 }], when: "2026-03-05T00:00:00Z" };
    const context = { data, scope: "/rows/0", functions };
    expect(
      resolve(
        {
          title: { "@path": "/region" },
          who: { "@path": "name" },
          items: [{ label: "Spend", value: { "@call": "formatCurrency", args: { value: { "@path": "spend" }, currency: "USD" } } }],
          line: { "@call": "formatString", args: { value: "${name} in ${/region}" } },
          date: { "@call": "formatDate", args: { value: { "@path": "/when" } } },
          n: { "@call": "formatNumber", args: { value: 1234567.891, decimals: 1 } },
          missing: { "@call": "nope" },
          proto: { "@call": "constructor" },
          children: { componentId: "row", path: "/rows" },
        },
        context,
      ),
    ).toEqual({
      title: "Europe",
      who: "Ada",
      items: [{ label: "Spend", value: "$1,234.50" }],
      line: "Ada in Europe",
      date: "Mar 5, 2026",
      n: "1,234,567.9",
      missing: undefined,
      proto: undefined,
      children: { componentId: "row", path: "/rows" },
    });
  });

  it("fills a template's gaps with the words given for a value that is not there", () => {
    const context = { data: { store: { name: "support-articles", table: "" }, chunk: { size: 0 } }, scope: "/", functions };
    const format = (value: string) => resolve({ "@call": "formatString", args: { value } }, context);
    expect(format("Store ${/store/name|not named yet} from ${/store/table|a table not chosen yet}.")).toBe("Store support-articles from a table not chosen yet.");
    expect(format("Chunks of ${/chunk/tokens | a size not set yet} tokens, ${/chunk/size|none} overlap.")).toBe("Chunks of a size not set yet tokens, 0 overlap.");
    expect(format("[${/nothing}]")).toBe("[]");
  });

  it("reports a value that fits no form of a union as the form it came closest to", () => {
    const button = (action: unknown) => analyticsCatalog.validateComponent({ id: "b", component: "Button", child: "c", action });
    expect(button({ functionCall: { "@call": "openUrl", args: { url: "https://example.com" } } })).toEqual([]);
    // What a model wrote for a link: the call without its wrapper.
    const bare = button({ "@call": "openUrl", args: { url: "https://example.com" } });
    expect(bare).toHaveLength(1);
    expect(bare[0]!.path).toBe("/action");
    expect(bare[0]!.message).toContain('{ "functionCall": { "@call": "openUrl"');
    expect(button({ name: "go" })[0]!.message).toContain("sits inside `event`");
    expect(button({ event: { nme: "go" } }).map((issue) => issue.path).sort()).toEqual(["/action/event", "/action/event/name"]);
    const text = analyticsCatalog.validateComponent({ id: "t", component: "Text", text: 5 });
    expect(text).toEqual([{ path: "/text", message: expect.stringContaining("Expected text, a binding") }]);
    for (const issue of [...bare, ...text, ...button("go")]) expect(issue.message).not.toBe("Invalid input");
  });

  it("writes a prop's shape for a model, opening lists of objects and naming bindings", () => {
    expect(shapeText({ type: "array", items: { type: "object", properties: { column: { type: "string" }, desc: { type: "boolean" } }, required: ["column"] } })).toBe("array of { column: string, desc?: boolean }");
    expect(shapeText({ anyOf: [{ type: "string" }, { type: "object", properties: { "@path": { type: "string" } } }, { type: "object", properties: { "@call": { type: "string" } } }] })).toBe("string | binding | call");
    expect(shapeText({ type: "object", properties: { a: { type: "object", properties: { b: { type: "array", items: { type: "string" } } } } } }, 1)).toBe("{ a?: object }");
    const prompt = catalogPrompt(analyticsCatalog);
    expect(prompt).toContain("- `sorts` (optional): array of { column: string, desc?: boolean }");
    expect(prompt).toContain('{"functionCall":{"@call":"openUrl","args":{"url":"…"}}}');
    expect(prompt).not.toContain("value or binding");
    // No prop of any component is left as a bare word where its shape is known.
    expect(prompt.split("\n").filter((line) => /^- `\w+`( \(optional\))?: array( —|$)/.test(line))).toEqual([]);
  });

  it("only allows web links", () => {
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("data:text/html,x")).toBeUndefined();
    expect(safeUrl("not a url")).toBeUndefined();
  });
});

describe("surfaces", () => {
  const messages: SurfaceMessage[] = [
    { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } },
    { version: v, updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Text", text: { "@path": "/title" } }] } },
    { version: v, updateDataModel: { surfaceId: "main", path: "/title", value: "Hello" } },
  ];

  it("applies messages in order as a pure reducer", () => {
    const start = {};
    const state = applyMessages(start, messages);
    expect(start).toEqual({});
    expect(state.main).toMatchObject({ catalogId: analyticsCatalog.id, data: { title: "Hello" } });
    const updated = applyMessage(state, { version: v, updateComponents: { surfaceId: "main", components: [{ id: "root", component: "Divider" }] } });
    expect(updated.main!.components.root!.component).toBe("Divider");
    expect(state.main!.components.root!.component).toBe("Text");
    expect(applyMessage(updated, { version: v, deleteSurface: { surfaceId: "main" } })).toEqual({});
  });

  it("refuses updates to a surface that does not exist", () => {
    expect(() => applyMessage({}, messages[1]!)).toThrow(/createSurface first/);
    expect(() => applyMessage({}, { version: v, updateDataModel: { surfaceId: "constructor", value: 1 } })).toThrow(/No surface/);
  });
});

describe("generators", () => {
  it("emits an A2UI catalog document", () => {
    const json = catalogJson(analyticsCatalog) as {
      catalogId: string;
      components: Record<string, { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean }>;
      $defs: { anyComponent: { oneOf: unknown[] } };
      functions: Record<string, unknown>;
    };
    expect(json.catalogId).toBe("urn:surfaces:catalog:analytics:v1");
    expect(json.components.Chart!.required).toEqual(expect.arrayContaining(["id", "component", "sourceId", "sql", "type", "x", "y"]));
    expect(json.components.Chart!.additionalProperties).toBe(false);
    expect(json.components.Text!.properties.component).toEqual({ type: "string", const: "Text" });
    expect(json.$defs.anyComponent.oneOf).toHaveLength(Object.keys(analyticsCatalog.components).length);
    expect(Object.keys(json.functions)).toContain("formatCurrency");
    expect(() => JSON.stringify(json)).not.toThrow();
  });

  it("writes an agent prompt and docs that cover every component", () => {
    const prompt = catalogPrompt(analyticsCatalog);
    const docs = catalogDocs(analyticsCatalog);
    for (const name of Object.keys(analyticsCatalog.components)) {
      expect(prompt).toContain(`### ${name}`);
      expect(docs[name]).toContain(`# ${name}`);
    }
    expect(prompt).toContain('"version": "1.0"');
    expect(prompt).toContain("- `type`: \"bar\" | \"line\" | \"area\" | \"scatter\" | \"pie\"");
    expect(prompt).toContain("- `splitBy` (optional): string — Column whose values become separate series.");
    expect(docs.DataGrid).toContain('"sql": "SELECT * FROM orders"');
    // The example in the prompt is itself valid.
    const example = prompt.slice(prompt.indexOf("```json") + 7, prompt.lastIndexOf("```")).trim().split("\n").map((line) => JSON.parse(line) as SurfaceMessage);
    expect(example.flatMap((m) => analyticsCatalog.validateMessage(m))).toEqual([]);
    expect(applyMessages({}, example).main!.data).toEqual({ title: "Hello" });
  });
});

describe("json-render adapter", () => {
  it("converts a dashboard spec into valid A2UI messages", () => {
    const messages = fromJsonRender(
      {
        root: "page",
        elements: {
          page: { type: "Box", children: ["heading", "kpi", "chart"] },
          heading: { type: "Heading", props: { text: "Sales" } },
          kpi: { type: "StatCard", props: { title: "Revenue", value: { $state: "/revenue" } } },
          chart: { type: "Chart", props: { sourceId: "lake", sql: "SELECT * FROM orders", type: "bar", x: "region", y: [{ column: "amount", aggregate: "sum" }] } },
        },
        state: { revenue: 1200 },
      },
      analyticsCatalog,
    );
    expect(messages.flatMap((m) => analyticsCatalog.validateMessage(m))).toEqual([]);
    const surface = applyMessages({}, messages).main!;
    expect(surface.components.root).toEqual({ id: "root", component: "Column", children: ["heading", "kpi", "chart"] });
    expect(surface.components.heading).toMatchObject({ component: "Text", variant: "h2", text: "Sales" });
    expect(surface.components.kpi).toMatchObject({ component: "Stat", label: "Revenue", value: { "@path": "/revenue" } });
    expect(surface.data).toEqual({ revenue: 1200 });
  });
});

describe("pages", () => {
  const page = (): import("./index.js").PageDocument => ({
    id: "sales",
    title: "Sales",
    catalogId: analyticsCatalog.id,
    components: [
      { id: "root", component: "Column", children: ["tiles", "chart"] },
      { id: "tiles", component: "Grid", columns: 2, children: ["revenue"] },
      { id: "revenue", component: "Metric", sourceId: "lake", sql: "SELECT * FROM orders", column: "amount", aggregate: "sum", label: "Revenue" },
      { id: "chart", component: "Chart", sourceId: "lake", sql: "SELECT * FROM orders", type: "bar", x: "region", y: [{ column: "amount", aggregate: "sum" }] },
    ],
  });

  it("validates a page and turns it into a surface and messages", async () => {
    const { pageMessages, pageSurface, validatePage } = await import("./index.js");
    expect(validatePage(page(), analyticsCatalog)).toEqual([]);
    expect(Object.keys(pageSurface(page()).components)).toEqual(["root", "tiles", "revenue", "chart"]);
    expect(applyMessages({}, pageMessages(page())).sales!.components.chart).toMatchObject({ component: "Chart" });
    const broken = { ...page(), components: [...page().components.slice(1), { id: "x", component: "Row", children: ["ghost"] }] };
    expect(validatePage(broken, analyticsCatalog).map((i) => i.message)).toEqual(['A page needs a component with the ID "root".', 'Refers to "ghost", which is not on the page.']);
  });

  it("applies edits, and rejects any that the catalog does not allow", async () => {
    const { editPage } = await import("./index.js");
    const result = editPage(
      page(),
      [
        { op: "title", title: "Sales overview" },
        { op: "update", id: "chart", props: { type: "line", xGrain: "month", x: "ordered_at" } },
        { op: "set", parent: "tiles", component: { id: "orders", component: "Metric", sourceId: "lake", sql: "SELECT * FROM orders", aggregate: "count", label: "Orders" } },
        { op: "update", id: "chart", props: { type: "radar" } },
        { op: "set", parent: "root", component: { id: "evil", component: "Html", html: "<script>" } },
        { op: "remove", id: "revenue" },
        { op: "remove", id: "root" },
      ],
      analyticsCatalog,
    );
    expect(result.page.title).toBe("Sales overview");
    expect(result.page.components.find((c) => c.id === "chart")).toMatchObject({ type: "line", xGrain: "month" });
    expect(result.page.components.find((c) => c.id === "tiles")!.children).toEqual(["orders"]);
    expect(result.page.components.map((c) => c.id)).toEqual(["root", "tiles", "chart", "orders"]);
    expect(result.rejected.map((r) => r.reason)).toEqual([expect.stringContaining("/type"), expect.stringContaining("Unknown component"), "The top of the page cannot be removed."]);
  });

  it("reads an agent's A2UI reply as edits, including what it took away", async () => {
    const { editPage, editsFromMessages } = await import("./index.js");
    const edits = editsFromMessages(page(), [
      {
        version: A2UI_VERSION,
        updateComponents: {
          surfaceId: "sales",
          components: [
            { id: "root", component: "Column", children: ["tiles", "table"] },
            { id: "table", component: "DataGrid", sourceId: "lake", sql: "SELECT * FROM orders" },
          ],
        },
      },
    ]);
    expect(edits.map((e) => e.op)).toEqual(["remove", "set", "set"]);
    expect(editPage(page(), edits, analyticsCatalog).page.components.map((c) => c.id)).toEqual(["root", "tiles", "revenue", "table"]);
  });
});

describe("reply contracts", () => {
  it("publishes each event's payload as JSON Schema", () => {
    const json = catalogJson(analyticsCatalog).components as Record<string, { "x-events"?: Record<string, { context: { properties: Record<string, { type?: string }>; required?: string[] } }> }>;
    const plan = json.PlanReview!["x-events"]!.decide!.context;
    expect(plan.properties.approved!.type).toBe("boolean");
    expect(plan.properties.stepIds!.type).toBe("array");
    expect(plan.required).toEqual(["approved", "stepIds"]);
  });

  it("accepts a createSurface contract only when it is usable JSON Schema", () => {
    const ok = { version: A2UI_VERSION, createSurface: { surfaceId: "s", catalogId: analyticsCatalog.id, metadata: { extensions: { surfaces_expects: { approve: { type: "object", required: ["region"] } } } } } };
    expect(analyticsCatalog.validateMessage(ok)).toEqual([]);
    const bad = { version: A2UI_VERSION, createSurface: { surfaceId: "s", catalogId: analyticsCatalog.id, metadata: { extensions: { surfaces_expects: { approve: { type: "nonsense" } } } } } };
    expect(analyticsCatalog.validateMessage(bad)[0]?.path).toBe("/createSurface/metadata/extensions/surfaces_expects/approve");
    expect(applyMessage({}, ok as SurfaceMessage).s?.expects?.approve).toEqual({ type: "object", required: ["region"] });
  });
});
