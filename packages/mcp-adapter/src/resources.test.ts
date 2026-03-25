import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { SURFACES_APPS } from "./registry.js";

// Mock node:fs to avoid needing real HTML files during tests
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(
    () => "<!DOCTYPE html><html><body>test</body></html>",
  ),
  existsSync: vi.fn(() => true),
}));

// Import after mock is set up
const {
  getSurfacesResources,
  readSurfacesResource,
  isSurfacesUri,
  validateBundles,
} = await import("./resources.js");

describe("getSurfacesResources", () => {
  it("returns resources for apps, stylesheets, and docs", () => {
    const resources = getSurfacesResources();
    // Should have apps + stylesheets + docs
    const expectedCount =
      Object.keys(SURFACES_APPS).length +
      2 + // SURFACES_STYLESHEETS (tokens, components)
      1;  // SURFACES_DOCS (react-components)
    expect(resources).toHaveLength(expectedCount);
  });

  it("uses the ui:// URI scheme format", () => {
    const resources = getSurfacesResources();
    for (const r of resources) {
      expect(r.uri).toMatch(/^ui:\/\//);
    }
  });

  it("includes name, description, and mimeType for each resource", () => {
    const resources = getSurfacesResources();
    for (const r of resources) {
      expect(typeof r.name).toBe("string");
      expect(r.name.length).toBeGreaterThan(0);
      expect(typeof r.description).toBe("string");
      expect(r.description.length).toBeGreaterThan(0);
      // MimeType can be HTML, CSS, or Markdown
      expect(["text/html;profile=mcp-app", "text/css", "text/markdown"]).toContain(r.mimeType);
    }
  });

  it("maps URIs to app IDs correctly", () => {
    const resources = getSurfacesResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain("ui://sql-editor-cdn");
    expect(uris).toContain("ui://json-render-cdn");
    expect(uris).toContain("ui://dashboard-viewer");
    expect(uris).toContain("ui://test-tiny");
  });
});

describe("readSurfacesResource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns content for a valid URI", () => {
    const content = readSurfacesResource(
      "ui://sql-editor-cdn",
    );
    expect(content.uri).toBe("ui://sql-editor-cdn");
    expect(content.mimeType).toBe("text/html;profile=mcp-app");
    expect(content.text).toContain("<!DOCTYPE html>");
  });

  it("throws for an unknown resource ID", () => {
    expect(() =>
      readSurfacesResource("ui://nonexistent"),
    ).toThrow('Unknown surfaces-ui resource: "nonexistent"');
  });

  it("throws for path traversal attempts", () => {
    expect(() =>
      readSurfacesResource("ui://../../etc/passwd"),
    ).toThrow('Unknown surfaces-ui resource: "../../etc/passwd"');
  });

  it("throws for prototype pollution keys", () => {
    expect(() =>
      readSurfacesResource("ui://__proto__"),
    ).toThrow('Unknown surfaces-ui resource: "__proto__"');

    expect(() =>
      readSurfacesResource("ui://constructor"),
    ).toThrow('Unknown surfaces-ui resource: "constructor"');
  });

  it("throws a helpful error when resource file is missing", () => {
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    expect(() =>
      readSurfacesResource("ui://sql-editor-cdn"),
    ).toThrow('Resource file "sql-editor-cdn.html" for "sql-editor-cdn" not found');
  });
});

describe("isSurfacesUri", () => {
  it("returns true for ui:// scheme URIs", () => {
    expect(isSurfacesUri("ui://sql-editor-cdn")).toBe(true);
    expect(isSurfacesUri("ui://json-render-cdn")).toBe(true);
    expect(isSurfacesUri("ui://dashboard-viewer")).toBe(true);
  });

  it("returns false for non-surfaces URIs", () => {
    expect(isSurfacesUri("file:///tmp/test.html")).toBe(false);
    expect(isSurfacesUri("https://example.com")).toBe(false);
    expect(isSurfacesUri("surfaces-ui://apps/old-format")).toBe(false);
    expect(isSurfacesUri("surfaces-ui/apps/sql-editor")).toBe(false);
    expect(isSurfacesUri("")).toBe(false);
  });
});

describe("validateBundles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when all bundles exist", async () => {
    const { existsSync } = await import("node:fs");
    vi.mocked(existsSync).mockReturnValue(true);

    const missing = validateBundles();
    expect(missing).toEqual([]);
  });

  it("returns resource IDs for missing files", async () => {
    const { existsSync } = await import("node:fs");
    vi.mocked(existsSync).mockReturnValue(false);

    const missing = validateBundles();
    // Should include missing apps, stylesheets, and docs
    expect(missing).toContain("sql-editor-cdn");
    expect(missing).toContain("json-render-cdn");
    expect(missing).toContain("styles/tokens");
    expect(missing).toContain("styles/components");
    expect(missing).toContain("docs/react-components");
    // Total count: apps + stylesheets + docs
    const expectedCount =
      Object.keys(SURFACES_APPS).length +
      2 + // SURFACES_STYLESHEETS
      1;  // SURFACES_DOCS
    expect(missing).toHaveLength(expectedCount);
  });
});
