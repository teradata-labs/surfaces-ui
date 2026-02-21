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
      expect(typeof r.name).toBe("string");
      expect(r.name.length).toBeGreaterThan(0);
      expect(typeof r.description).toBe("string");
      expect(r.description.length).toBeGreaterThan(0);
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

  it("throws for path traversal attempts", () => {
    expect(() =>
      readSurfacesResource("surfaces-ui://apps/../../etc/passwd"),
    ).toThrow('Unknown surfaces-ui app: "../../etc/passwd"');
  });

  it("throws for prototype pollution keys", () => {
    expect(() =>
      readSurfacesResource("surfaces-ui://apps/__proto__"),
    ).toThrow('Unknown surfaces-ui app: "__proto__"');

    expect(() =>
      readSurfacesResource("surfaces-ui://apps/constructor"),
    ).toThrow('Unknown surfaces-ui app: "constructor"');
  });

  it("throws a helpful error when HTML bundle is missing", () => {
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    expect(() =>
      readSurfacesResource("surfaces-ui://apps/sql-editor-cdn"),
    ).toThrow('HTML bundle for "sql-editor-cdn" not found');
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

  it("returns app IDs for missing bundles", async () => {
    const { existsSync } = await import("node:fs");
    vi.mocked(existsSync).mockReturnValue(false);

    const missing = validateBundles();
    expect(missing).toContain("sql-editor-cdn");
    expect(missing).toContain("json-render-cdn");
    expect(missing).toHaveLength(Object.keys(SURFACES_APPS).length);
  });
});
