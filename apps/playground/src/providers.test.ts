import { describe, expect, it } from "vitest";
import type { AgentOption } from "./composerAgent.js";
import { SCRIPTED } from "./composerAgent.js";
import { optionOf, providersOf } from "./providers.js";

const options: AgentOption[] = [
  SCRIPTED,
  { id: "server", kind: "server", label: "Dev server: Claude Sonnet 5.5", detail: "", model: "claude-sonnet-5-5", provider: "Claude", models: [{ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" }, { id: "claude-opus-5-5", label: "Claude Opus 5.5" }] },
  { id: "local:http://127.0.0.1:11434:qwen3:8b", kind: "local", label: "qwen3:8b (local)", detail: "", baseUrl: "http://127.0.0.1:11434", model: "qwen3:8b" },
  { id: "local:http://127.0.0.1:11434:gemma4:26b", kind: "local", label: "gemma4:26b (local)", detail: "", baseUrl: "http://127.0.0.1:11434", model: "gemma4:26b" },
  { id: "loom:analyst", kind: "loom", label: "Loom: analyst", detail: "", agentId: "analyst" },
];

describe("providers", () => {
  it("groups the playground's options by where the model runs", () => {
    const providers = providersOf(options);
    expect(providers.map((p) => [p.label, p.models.map((m) => m.id)])).toEqual([
      ["Scripted demo", ["scripted"]],
      ["Claude on the dev server", ["claude-sonnet-5-5", "claude-opus-5-5"]],
      ["Ollama on this machine", ["qwen3:8b", "gemma4:26b"]],
      ["Test Loom", ["analyst"]],
    ]);
  });

  it("turns a pick back into the option, sending a server model only when it is not the server's own", () => {
    expect(optionOf(options, "server", "claude-sonnet-5-5")).toEqual({ id: "server" });
    expect(optionOf(options, "server", "claude-opus-5-5")).toEqual({ id: "server", model: "claude-opus-5-5" });
    expect(optionOf(options, "local:http://127.0.0.1:11434", "gemma4:26b")?.id).toBe("local:http://127.0.0.1:11434:gemma4:26b");
    expect(optionOf(options, "loom", "analyst")?.id).toBe("loom:analyst");
    expect(optionOf(options, "local:http://127.0.0.1:9", "gone")).toBeUndefined();
  });
});
