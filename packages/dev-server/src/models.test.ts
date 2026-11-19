import { createConnectTransport } from "@connectrpc/connect-node";
import { connectModelSettings } from "@surfaces-ui/client-connect";
import { ModelChoiceError, memoryModelSettings } from "@surfaces-ui/data";
import { ModelProvider } from "@surfaces-ui/proto";
import { afterAll, describe, expect, it } from "vitest";
import { type SurfacesServer, createSurfacesServer } from "./server.js";

let server: SurfacesServer | undefined;
afterAll(async () => server?.close());

describe("ModelService over Connect", () => {
  it("lists backends, changes a model and refuses one that is not offered", async () => {
    const models = memoryModelSettings([
      { id: "claude", label: "Claude", provider: ModelProvider.ANTHROPIC, model: "claude-opus-5-5", models: [{ id: "claude-opus-5-5" }, { id: "claude-sonnet-5-5" }], keyEnv: "ANTHROPIC_API_KEY", keySet: false, active: true },
    ]);
    server = await createSurfacesServer({ sources: [], discovery: false, models });
    const { url } = await server.listen(0);
    const remote = connectModelSettings({ transport: createConnectTransport({ baseUrl: url, httpVersion: "1.1" }) });

    const { backends } = await remote.listModelBackends({});
    expect(backends[0]).toMatchObject({ id: "claude", model: "claude-opus-5-5", keyEnv: "ANTHROPIC_API_KEY", keySet: false, active: true });
    expect((await remote.setModel({ backendId: "claude", model: "claude-sonnet-5-5" })).backend?.model).toBe("claude-sonnet-5-5");
    await expect(remote.setModel({ backendId: "claude", model: "gpt-5" })).rejects.toBeInstanceOf(ModelChoiceError);
  });
});
