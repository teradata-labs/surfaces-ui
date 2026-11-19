import { ModelProvider } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { ModelChoiceError, memoryModelSettings, modelSettings } from "./models.js";

const claude = {
  id: "claude",
  label: "Claude",
  provider: ModelProvider.ANTHROPIC,
  model: "claude-opus-5-5",
  models: [{ id: "claude-opus-5-5" }, { id: "claude-sonnet-5-5" }],
  keyEnv: "ANTHROPIC_API_KEY",
  keySet: true,
  active: true,
};
const local = { id: "local", label: "Local", provider: ModelProvider.LOCAL, model: "gemma4:26b", anyModel: true };

describe("memoryModelSettings", () => {
  it("lists backends and changes a model from the offered list", async () => {
    const settings = memoryModelSettings([claude, local]);
    expect((await settings.listModelBackends({})).backends.map((b) => [b.id, b.model, b.active])).toEqual([
      ["claude", "claude-opus-5-5", true],
      ["local", "gemma4:26b", false],
    ]);
    const { backend } = await settings.setModel({ backendId: "claude", model: "claude-sonnet-5-5" });
    expect(backend?.model).toBe("claude-sonnet-5-5");
  });

  it("refuses an unknown backend and a model the backend does not offer", async () => {
    const settings = memoryModelSettings([claude]);
    await expect(settings.setModel({ backendId: "nope", model: "x" })).rejects.toThrow(ModelChoiceError);
    await expect(settings.setModel({ backendId: "claude", model: "gpt-5" })).rejects.toThrow(/does not offer/);
  });

  it("accepts any id where the backend allows it, and can make it the active one", async () => {
    const settings = memoryModelSettings([claude, local]);
    const { backend } = await settings.setModel({ backendId: "local", model: "qwen3:8b", makeActive: true });
    expect(backend).toMatchObject({ model: "qwen3:8b", active: true });
    expect((await settings.listModelBackends({})).backends.find((b) => b.id === "claude")?.active).toBe(false);
  });

  it("never reports a key, only its name and whether it is set", async () => {
    const json = JSON.stringify((await memoryModelSettings([claude]).listModelBackends({})).backends);
    expect(json).toContain("ANTHROPIC_API_KEY");
    expect(Object.keys((await memoryModelSettings([claude]).listModelBackends({})).backends[0]!)).not.toContain("key");
  });
});

describe("modelSettings", () => {
  it("runs the backend's own change and reads its live state afterwards", async () => {
    let model = "a";
    const settings = modelSettings({ backends: [{ describe: () => ({ id: "x", label: "X", model, models: [{ id: "a" }, { id: "b" }] }), setModel: async (m) => void (model = m) }] });
    expect((await settings.setModel({ backendId: "x", model: "b" })).backend?.model).toBe("b");
  });
});
