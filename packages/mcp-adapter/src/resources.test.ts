import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SURFACES_APPS } from "./registry.js";

// Mock node:fs to avoid needing real HTML files during tests
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(
    () => "<!DOCTYPE html><html><body>test</body></html>",
  ),
}));

// Import after mock is set up
const { getSurfacesResources, readSurfacesResource, isSurfacesUri } =
  await import("./resources.js");

describe("getSurfacesResources", () => {
  it("returns one resource per registered app", () => {
    const resources = getSurfacesResources();
    expect(resources).toHaveLength(Object.keys(SURFACES_APPS).length);
  });

  it("uses the surfaces-ui:// URI scheme", () => {
    const resources = getSurfacesResources();
    for (const r of resources) {
      expect(r.uri).toMatch(/^surfaces-ui:\/\/apps\//);
    }
  });

  it("includes name, description, and mimeType for each resource", () => {
    const resources = getSurfacesResources();
    for (const r of resources) {
      expect(r.name).toBeTruthy();
      expect(r.description).toBeTruthy();
      expect(r.mimeType).toBe("text/html;profile=mcp-app");
    }
  });

  it("maps URIs to app IDs correctly", () => {
    const resources = getSurfacesResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain("surfaces-ui://apps/sql-editor-cdn");
    expect(uris).toContain("surfaces-ui://apps/json-render-cdn");
  });
});

describe("readSurfacesResource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns content for a valid URI", () => {
    const content = readSurfacesResource(
      "surfaces-ui://apps/sql-editor-cdn",
    );
    expect(content.uri).toBe("surfaces-ui://apps/sql-editor-cdn");
    expect(content.mimeType).toBe("text/html;profile=mcp-app");
    expect(content.text).toContain("<!DOCTYPE html>");
  });

  it("throws for an unknown app ID", () => {
    expect(() =>
      readSurfacesResource("surfaces-ui://apps/nonexistent"),
    ).toThrow('Unknown surfaces-ui app: "nonexistent"');
  });
});

describe("isSurfacesUri", () => {
  it("returns true for surfaces-ui:// URIs", () => {
    expect(isSurfacesUri("surfaces-ui://apps/sql-editor-cdn")).toBe(true);
    expect(isSurfacesUri("surfaces-ui://apps/json-render-cdn")).toBe(true);
  });

  it("returns false for non-surfaces URIs", () => {
    expect(isSurfacesUri("file:///tmp/test.html")).toBe(false);
    expect(isSurfacesUri("https://example.com")).toBe(false);
    expect(isSurfacesUri("ui://sql-editor")).toBe(false);
    expect(isSurfacesUri("")).toBe(false);
  });
});
