import { describe, it, expect, vi } from "vitest";

// Mock the MCP SDK
const mockSetRequestHandler = vi.fn();
const mockConnect = vi.fn();

vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: vi.fn(() => ({
    setRequestHandler: mockSetRequestHandler,
    connect: mockConnect,
  })),
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn(),
}));

vi.mock("@modelcontextprotocol/sdk/types.js", () => ({
  ListResourcesRequestSchema: "ListResources",
  ReadResourceRequestSchema: "ReadResources",
}));

// Mock the adapter
const mockGetSurfacesResources = vi.fn(() => [
  {
    uri: "surfaces-ui://apps/sql-editor-cdn",
    name: "SQL Editor",
    description: "Interactive SQL editor",
    mimeType: "text/html;profile=mcp-app",
  },
]);

const mockReadSurfacesResource = vi.fn((uri: string) => ({
  uri,
  mimeType: "text/html;profile=mcp-app",
  text: "<!DOCTYPE html><html><body>test</body></html>",
}));

const mockIsSurfacesUri = vi.fn((uri: string) =>
  uri.startsWith("surfaces-ui://"),
);

const mockValidateBundles = vi.fn(() => []);

vi.mock("@surfacesui/mcp-adapter", () => ({
  getSurfacesResources: mockGetSurfacesResources,
  readSurfacesResource: mockReadSurfacesResource,
  isSurfacesUri: mockIsSurfacesUri,
  validateBundles: mockValidateBundles,
}));

// Import the server module once - this triggers all the top-level setup
await import("./index.js");

// Extract the registered handlers (set during module init)
type ListHandler = () => Promise<{ resources: unknown[] }>;
type ReadHandler = (req: {
  params: { uri: string };
}) => Promise<{ contents: unknown[] }>;

const listCall = mockSetRequestHandler.mock.calls.find(
  (c) => c[0] === "ListResources",
);
const readCall = mockSetRequestHandler.mock.calls.find(
  (c) => c[0] === "ReadResources",
);
const listHandler = listCall?.[1] as ListHandler | undefined;
const readHandler = readCall?.[1] as ReadHandler | undefined;

describe("surfaces-ui MCP Server", () => {
  it("registers two request handlers", () => {
    expect(mockSetRequestHandler).toHaveBeenCalledTimes(2);
  });

  it("connects via StdioServerTransport", () => {
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("validates bundles at startup", () => {
    expect(mockValidateBundles).toHaveBeenCalledTimes(1);
  });

  it("ListResources handler returns resources from adapter", async () => {
    expect(listHandler).toBeDefined();
    const result = await listHandler!();
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]).toEqual(
      expect.objectContaining({ uri: "surfaces-ui://apps/sql-editor-cdn" }),
    );
  });

  it("ReadResource handler returns content for valid surfaces-ui URI", async () => {
    expect(readHandler).toBeDefined();
    const result = await readHandler!({
      params: { uri: "surfaces-ui://apps/sql-editor-cdn" },
    });
    expect(result.contents).toHaveLength(1);
    expect(mockReadSurfacesResource).toHaveBeenCalledWith(
      "surfaces-ui://apps/sql-editor-cdn",
    );
  });

  it("ReadResource handler throws for non-surfaces URI", async () => {
    expect(readHandler).toBeDefined();
    await expect(
      readHandler!({ params: { uri: "file:///etc/passwd" } }),
    ).rejects.toThrow("Unsupported URI: file:///etc/passwd");
  });
});
