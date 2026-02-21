import { describe, it, expect } from "vitest";
import { SURFACES_APPS, type AppId } from "./registry.js";

describe("SURFACES_APPS registry", () => {
  it("contains sql-editor-cdn entry", () => {
    expect(SURFACES_APPS["sql-editor-cdn"]).toBeDefined();
    expect(SURFACES_APPS["sql-editor-cdn"].name).toBe("SQL Editor");
    expect(SURFACES_APPS["sql-editor-cdn"].filename).toBe(
      "sql-editor-cdn.html",
    );
    expect(SURFACES_APPS["sql-editor-cdn"].mimeType).toBe(
      "text/html;profile=mcp-app",
    );
  });

  it("contains json-render-cdn entry", () => {
    expect(SURFACES_APPS["json-render-cdn"]).toBeDefined();
    expect(SURFACES_APPS["json-render-cdn"].name).toBe("NL UI Generator");
    expect(SURFACES_APPS["json-render-cdn"].filename).toBe(
      "json-render-cdn.html",
    );
  });

  it("has consistent mimeType across all apps", () => {
    for (const [, meta] of Object.entries(SURFACES_APPS)) {
      expect(meta.mimeType).toBe("text/html;profile=mcp-app");
    }
  });

  it("has unique filenames for each app", () => {
    const filenames = Object.values(SURFACES_APPS).map((m) => m.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  it("AppId type covers all keys", () => {
    const ids: AppId[] = ["sql-editor-cdn", "json-render-cdn"];
    expect(ids).toHaveLength(Object.keys(SURFACES_APPS).length);
  });
});
