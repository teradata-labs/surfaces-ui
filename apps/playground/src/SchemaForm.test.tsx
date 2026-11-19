import { analyticsCatalog, catalogJson } from "@surfaces-ui/spec";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type JsonSchema, SchemaForm, defaultFor, fieldHint, fieldKind } from "./SchemaForm.js";

const components = catalogJson(analyticsCatalog).components as Record<string, JsonSchema>;
const prop = (component: string, name: string) => components[component]!.properties![name]!;

describe("fieldKind", () => {
  it("picks a control from each prop's schema", () => {
    expect(fieldKind("type", prop("Chart", "type"))).toBe("choice");
    expect(fieldKind("sql", prop("Chart", "sql"))).toBe("dynamic");
    expect(fieldKind("height", prop("Chart", "height"))).toBe("number");
    expect(fieldKind("stacked", prop("Chart", "stacked"))).toBe("boolean");
    expect(fieldKind("y", prop("Chart", "y"))).toBe("list");
    expect(fieldKind("value", prop("TextField", "value"))).toBe("binding");
    expect(fieldKind("columns", prop("DataGrid", "columns"))).toBe("object");
    expect(fieldKind("placeholder", prop("TextField", "placeholder"))).toBe("text");
  });

  it("can edit every prop of every component, by a control or as JSON", () => {
    for (const [name, schema] of Object.entries(components)) {
      for (const [key, s] of Object.entries(schema.properties ?? {})) {
        expect(fieldKind(key, s), `${name}.${key}`).toBeTruthy();
      }
    }
  });
});

describe("defaultFor", () => {
  it("starts a new value valid for its schema", () => {
    expect(defaultFor(prop("Chart", "type"))).toBe("bar");
    expect(defaultFor(prop("Chart", "height"))).toBe(160);
    expect(defaultFor(prop("Chart", "y"))).toEqual([{}].map(() => defaultFor(prop("Chart", "y").items!)));
    expect(defaultFor({ type: "object", properties: { path: { type: "string" } }, required: ["path"] })).toEqual({ path: "" });
  });
});

describe("fieldHint", () => {
  it("keeps the first sentence and does not stop at an abbreviation", () => {
    expect(fieldHint("For the percentile aggregate, e.g. 0.9 for p90. Ignored otherwise.")).toBe("For the percentile aggregate, e.g. 0.9 for p90.");
    expect(fieldHint("A single read-only `SELECT` statement.")).toBe("A single read-only SELECT statement.");
  });
});

describe("SchemaForm", () => {
  it("draws a labelled control for each prop and leaves out id and component", () => {
    const html = renderToStaticMarkup(
      <SchemaForm schema={components.Chart!} value={{ sourceId: "lake", sql: "SELECT 1", type: "line", x: "day", y: [{ column: "amount", aggregate: "sum" }] }} skip={["id", "component"]} onChange={() => {}} />,
    );
    expect(html).toContain("<code>type</code>");
    expect(html).toContain('value="&quot;line&quot;" selected=""');
    expect(html).toContain("SELECT 1</textarea>");
    expect(html).toContain('aria-label="Add to y"');
    expect(html).not.toContain("<code>component</code>");
  });
});
