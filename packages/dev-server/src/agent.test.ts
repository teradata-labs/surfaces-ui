import { createConnectTransport } from "@connectrpc/connect-node";
import { agentEvent, agentRouter, scriptedAgent, toolCallingAgent } from "@surfaces-ui/agent";
import { connectAgent } from "@surfaces-ui/client-connect";
import { ApprovalKind } from "@surfaces-ui/proto";
import { afterAll, describe, expect, it } from "vitest";
import { type SurfacesServer, createSurfacesServer } from "./server.js";

let server: SurfacesServer | undefined;
afterAll(async () => server?.close());

describe("AgentService over Connect", () => {
  it("streams a turn from a server-side agent, and carries the person's approval back", async () => {
    const seen: unknown[] = [];
    const agent = scriptedAgent((request, turn) => {
      seen.push(request.input);
      return turn === 0
        ? [agentEvent.text("Run it?"), agentEvent.approval({ id: "a1", kind: ApprovalKind.PERMISSION, title: "Run?", digest: "sha256:ab" }), agentEvent.done("s1", "scripted")]
        : [agentEvent.text("Ran."), agentEvent.done("s1", "scripted")];
    });
    server = await createSurfacesServer({ sources: [], discovery: false, agent });
    const { url } = await server.listen(0);
    const remote = connectAgent({ transport: createConnectTransport({ baseUrl: url, httpVersion: "1.1" }) });

    const first = [];
    for await (const e of remote.send({ input: { case: "text", value: "Count orders" } })) first.push(e.event);
    expect(first.map((e) => e.case)).toEqual(["text", "approval", "done"]);
    expect(first[1]?.value).toMatchObject({ id: "a1", digest: "sha256:ab" });

    const second = [];
    for await (const e of remote.send({ sessionId: "s1", input: { case: "approval", value: { id: "a1", allow: true, digest: "sha256:ab", decidedBy: { id: "u1", name: "Ada" }, reason: "ok" } } })) second.push(e.event);
    expect(second.map((e) => e.case)).toEqual(["text", "done"]);
    expect(seen[1]).toMatchObject({ case: "approval", value: { allow: true, decidedBy: { name: "Ada" }, reason: "ok" } });
  });

  it("describes the agents a chat may choose, and runs a turn with the person's choices", async () => {
    const models: string[] = [];
    const analyst = toolCallingAgent({
      system: "s",
      tools: [],
      offer: { models: [{ id: "small" }, { id: "large" }], defaultModel: "small", skills: [{ id: "charts", name: "Charts", text: "Bars start at zero." }] },
      complete: async function* ({ model }) {
        models.push(model ?? "");
        yield { type: "text", delta: "Hi." };
        yield { type: "done", model: model ?? "" };
      },
    });
    const local = await createSurfacesServer({ sources: [], discovery: false, agent: agentRouter([{ info: { id: "analyst", name: "Analyst" }, backend: analyst }, { info: { id: "demo", name: "Demo" }, backend: scriptedAgent(() => [agentEvent.done("", "scripted")]) }]) });
    try {
      const { url } = await local.listen(0);
      const remote = connectAgent({ transport: createConnectTransport({ baseUrl: url, httpVersion: "1.1" }) });
      const { agents } = await remote.describeAgents();
      expect(agents.map((a) => [a.id, a.isDefault, a.models.map((m) => m.id), a.skills.map((s) => s.id)])).toEqual([
        ["analyst", true, ["small", "large"], ["charts"]],
        ["demo", false, [], []],
      ]);
      const events = [];
      for await (const e of remote.send({ agentId: "analyst", model: "large", input: { case: "text", value: "Hi" } })) events.push(e.event.case);
      expect(events).toContain("done");
      expect(models).toEqual(["large"]);
      const refused = [];
      for await (const e of remote.send({ agentId: "analyst", model: "huge", input: { case: "text", value: "Hi" } })) refused.push(e.event);
      expect(refused[0]).toMatchObject({ case: "error" });
    } finally {
      await local.close();
    }
  });
});
