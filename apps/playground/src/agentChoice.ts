import { useEffect, useState, useSyncExternalStore } from "react";
import { type AgentOption, SCRIPTED, findAgents } from "./composerAgent.js";

/**
 * The agent the playground's Composer, Chat and Pages use, chosen on the
 * Models page or in any of their pickers. Kept in this browser only; nothing
 * about it is a secret.
 */
const KEY = "surfaces.playground.agent";
/** The dev server's model picked in a Model menu; empty means the one the server runs. */
const MODEL_KEY = "surfaces.playground.agent-model";
let pickedModel = (() => {
  try {
    return localStorage.getItem(MODEL_KEY) ?? "";
  } catch {
    return "";
  }
})();
let picked = (() => {
  try {
    return localStorage.getItem(KEY) ?? SCRIPTED.id;
  } catch {
    return SCRIPTED.id;
  }
})();
const listeners = new Set<() => void>();

export function pickAgent(id: string, model = ""): void {
  picked = id;
  pickedModel = model;
  try {
    localStorage.setItem(KEY, id);
    localStorage.setItem(MODEL_KEY, model);
  } catch {}
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Probed once per page load, and again when asked (`refresh`). */
let found: { serverUp: boolean; agents: Promise<AgentOption[]> } | undefined;
const foundListeners = new Set<() => void>();
function agentsWithin(serverUp: boolean, again = false): Promise<AgentOption[]> {
  if (again || !found || found.serverUp !== serverUp) {
    found = { serverUp, agents: findAgents({ serverUp }) };
    for (const listener of foundListeners) listener();
  }
  return found.agents;
}

/**
 * The agents within reach and the one picked. When the picked one is not
 * within reach (Loom stopped, a model removed), the scripted demo stands in
 * and `missing` says what was picked.
 */
export function useAgentChoice(serverUp: boolean) {
  const id = useSyncExternalStore(subscribe, () => picked);
  const model = useSyncExternalStore(subscribe, () => pickedModel);
  const [agents, setAgents] = useState<AgentOption[]>([SCRIPTED]);
  const [probing, setProbing] = useState(true);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const bump = () => setRound((r) => r + 1);
    foundListeners.add(bump);
    return () => {
      foundListeners.delete(bump);
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: round re-reads after a refresh elsewhere.
  useEffect(() => {
    let live = true;
    setProbing(true);
    void agentsWithin(serverUp).then((list) => {
      if (!live) return;
      setAgents(list);
      setProbing(false);
    });
    return () => {
      live = false;
    };
  }, [serverUp, round]);
  const option = agents.find((a) => a.id === id);
  return {
    agents,
    probing,
    picked: option ?? SCRIPTED,
    /** The dev server's model picked in a Model menu, when it is not the one the server runs. */
    model: option?.kind === "server" && model && model !== option.model ? model : undefined,
    missing: !option && !probing && id !== SCRIPTED.id ? id : undefined,
    pick: pickAgent,
    refresh: () => void agentsWithin(serverUp, true),
  };
}

export type AgentChoice = ReturnType<typeof useAgentChoice>;
