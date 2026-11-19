import type { ChatProvider, ChatSettings } from "@surfaces-ui/chat";
import { useMemo } from "react";
import type { AgentChoice } from "./agentChoice.js";
import type { AgentOption } from "./composerAgent.js";

/**
 * The playground's options as providers for a Model menu: where a model runs
 * (the scripted demo, the dev server's backend, a model server on this
 * machine, the test Loom) and the models each offers. No key is in any of it.
 */
export function providersOf(options: AgentOption[]): ChatProvider[] {
  const providers: ChatProvider[] = [];
  const local = new Map<string, ChatProvider>();
  const localUrls = new Set(options.filter((o) => o.kind === "local").map((o) => o.baseUrl));
  for (const option of options) {
    if (option.kind === "scripted") providers.push({ id: "scripted", label: "Scripted demo", detail: "A fixed script in this page. Not a model.", models: [{ id: "scripted", label: "Scripted demo", detail: "Not a model" }] });
    else if (option.kind === "server")
      providers.push({
        id: "server",
        label: option.provider ? `${option.provider} on the dev server` : "Dev server",
        detail: "Runs on the dev server; its key stays there.",
        models: option.models ?? [{ id: option.model ?? "server", label: option.model ? option.model : "The server's agent" }],
      });
    else if (option.kind === "local" && option.baseUrl && option.model) {
      const id = `local:${option.baseUrl}`;
      let provider = local.get(id);
      if (!provider) {
        const port = new URL(option.baseUrl).port;
        provider = { id, label: localUrls.size > 1 ? `Ollama on this machine (port ${port})` : "Ollama on this machine", detail: `Called from this page at ${option.baseUrl}.`, models: [] };
        local.set(id, provider);
        providers.push(provider);
      }
      provider.models.push({ id: option.model });
    } else if (option.kind === "loom" && option.agentId) {
      let loom = providers.find((p) => p.id === "loom");
      if (!loom) {
        loom = { id: "loom", label: "Test Loom", detail: "Agents on the local test Loom; each runs the model shown.", models: [] };
        providers.push(loom);
      }
      loom.models.push({ id: option.agentId, label: option.agentId, ...(option.model ? { detail: option.model } : {}) });
    }
  }
  return providers;
}

/** The option a provider and model stand for, and the server model to send when it is not the server's own. */
export function optionOf(options: AgentOption[], provider: string, model: string): { id: string; model?: string } | undefined {
  if (provider === "scripted") return { id: "scripted" };
  if (provider === "server") {
    const server = options.find((o) => o.kind === "server");
    return server ? { id: server.id, ...(model && model !== server.model ? { model } : {}) } : undefined;
  }
  if (provider === "loom") return options.find((o) => o.kind === "loom" && o.agentId === model);
  if (provider.startsWith("local:")) return options.find((o) => o.kind === "local" && `local:${o.baseUrl}` === provider && o.model === model);
  return undefined;
}

/** Where the shared choice stands, as Model menu settings. */
export function providerSettings(choice: AgentChoice): Pick<ChatSettings, "provider" | "model"> {
  const { picked } = choice;
  switch (picked.kind) {
    case "scripted":
      return { provider: "scripted", model: "scripted" };
    case "server":
      return { provider: "server", model: choice.model ?? picked.model ?? "server" };
    case "local":
      return { provider: `local:${picked.baseUrl}`, model: picked.model ?? "" };
    case "loom":
      return { provider: "loom", model: picked.agentId ?? "" };
  }
}

/** A Model menu's change, applied to the shared choice. True when the provider or model changed. */
export function pickProvider(choice: AgentChoice, settings: ChatSettings): boolean {
  const now = providerSettings(choice);
  if (!settings.provider || (settings.provider === now.provider && settings.model === now.model)) return false;
  const option = optionOf(choice.agents, settings.provider, settings.model ?? "");
  if (!option) return false;
  choice.pick(option.id, option.model);
  return true;
}

/** A Model menu over the shared choice, for any composer in the playground. */
export function useProviderMenu(choice: AgentChoice) {
  const providers = useMemo(() => providersOf(choice.agents), [choice.agents]);
  return {
    providers,
    settings: providerSettings(choice),
    onSettingsChange: (next: ChatSettings) => void pickProvider(choice, next),
    onManageProviders: () => {
      location.hash = "#models";
    },
  };
}
