import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { mcpConnector } from "./connector.js";

function tickets() {
  const server = new McpServer({ name: "tickets", version: "0" });
  const made: string[] = [];
  server.registerTool("search", { description: "Find tickets", inputSchema: z.object({ words: z.string() }), annotations: { readOnlyHint: true } }, async ({ words }) => ({ content: [{ type: "text", text: `2 tickets about ${words}` }] }));
  server.registerTool("create", { description: "Open a ticket", inputSchema: z.object({ title: z.string() }), annotations: { destructiveHint: false } }, async ({ title }) => {
    made.push(title);
    return { content: [{ type: "text", text: `Opened ${title}` }] };
  });
  server.registerTool("page_only", { description: "For the app page", inputSchema: z.object({}), _meta: { ui: { visibility: ["app"] } } }, async () => ({ content: [] }));
  server.registerTool("broken", { description: "Fails", inputSchema: z.object({}) }, async () => ({ isError: true, content: [{ type: "text", text: "no such project" }] }));
  const [a, b] = InMemoryTransport.createLinkedPair();
  void server.connect(a);
  return { transport: () => b, made };
}

describe("mcpConnector", () => {
  it("brings a server's tools as one connector, asking first for any that is not read-only", async () => {
    const server = tickets();
    const { connector, tools, close } = await mcpConnector({ id: "tickets", name: "Tickets", transport: server.transport });
    expect(connector).toMatchObject({ id: "tickets", name: "Tickets", tools: ["tickets__search", "tickets__create", "tickets__broken"], requiresApproval: true });
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    expect(byName.tickets__search!.approval).toBeUndefined();
    expect(await byName.tickets__search!.run({ words: "refunds" })).toBe("2 tickets about refunds");

    // A tool that may change something runs only what the person allowed, not the model's input.
    const ask = await byName.tickets__create!.approval!({ title: "From the model" });
    expect(ask).toMatchObject({ title: "create in Tickets", subject: { tool: "create", arguments: { title: "From the model" } } });
    await byName.tickets__create!.run({ title: "From the model" }, undefined, { sql: "", subject: { tool: "create", arguments: { title: "Edited by a person" } }, approvals: [] } as never);
    expect(server.made).toEqual(["Edited by a person"]);
    await expect(byName.tickets__broken!.run({})).rejects.toThrow("no such project");
    await close();
  });

  it("reports a server it cannot reach as unavailable, with the reason, and no tools", async () => {
    const { connector, tools } = await mcpConnector({
      id: "gone",
      name: "Gone",
      transport: () => {
        throw new Error("command not found");
      },
    });
    expect(tools).toEqual([]);
    expect(connector).toMatchObject({ status: "unavailable", reason: "Could not reach Gone: command not found", tools: [] });
  });
});
