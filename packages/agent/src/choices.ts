import { type MessageInitShape, create } from "@bufbuild/protobuf";
import { type AgentInfo, AgentInfoSchema, ConnectorStatus, type DescribeAgentsResponse, DescribeAgentsResponseSchema } from "@surfaces-ui/proto";
import type { AgentBackend, AgentCallOptions, AgentEvent, SendInit } from "./backend.js";
import { agentEvent } from "./backend.js";

/** A named set of instructions added to the system prompt while it is on, such as chart standards or a team's naming rules. */
export interface AgentSkill {
  id: string;
  name: string;
  description?: string;
  /** What the model is told while the skill is on. */
  text: string;
  /** On unless the person turns it off. Default true. */
  defaultOn?: boolean;
}

/**
 * A set of tools the model may call only while it is on, such as an MCP
 * server's tools. It names tools; it never holds a credential. Tools that no
 * connector names are always available.
 */
export interface AgentConnector {
  id: string;
  name: string;
  description?: string;
  /** The names of the tools it brings. */
  tools: string[];
  /** Whether it can be used now. Default connected. A connector that is not connected cannot be turned on. */
  status?: "connected" | "needs-sign-in" | "unavailable";
  reason?: string;
  /** Where a person signs in, for `needs-sign-in`. */
  signInUrl?: string;
  /** Its tools ask a person before they act. */
  requiresApproval?: boolean;
  /** Default true. */
  defaultOn?: boolean;
}

/** What one agent offers a chat: its models, skills and connectors. */
export interface AgentOffer {
  id?: string;
  name?: string;
  description?: string;
  /** Model ids a turn may name, with how a person reads each. Empty: only the default. */
  models?: { id: string; label?: string; description?: string }[];
  defaultModel?: string;
  skills?: AgentSkill[];
  connectors?: AgentConnector[];
}

export interface TurnChoices {
  /** The model for this turn; empty is the agent's default. */
  model: string;
  skills: AgentSkill[];
  /** Connectors on for this turn. */
  connectors: AgentConnector[];
}

const STATUS = { connected: ConnectorStatus.CONNECTED, "needs-sign-in": ConnectorStatus.NEEDS_SIGN_IN, unavailable: ConnectorStatus.UNAVAILABLE } as const;

/** What `DescribeAgents` reports for an offer. */
export function agentInfo(offer: AgentOffer, isDefault = true): AgentInfo {
  return create(AgentInfoSchema, {
    id: offer.id ?? "default",
    name: offer.name ?? offer.id ?? "Agent",
    description: offer.description ?? "",
    isDefault,
    defaultModel: offer.defaultModel ?? "",
    models: offer.models ?? [],
    skills: (offer.skills ?? []).map((s) => ({ id: s.id, name: s.name, description: s.description ?? "", defaultOn: s.defaultOn !== false })),
    connectors: (offer.connectors ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? "",
      status: STATUS[c.status ?? "connected"],
      reason: c.reason ?? "",
      signInUrl: c.signInUrl ?? "",
      requiresApproval: !!c.requiresApproval,
      defaultOn: c.defaultOn !== false,
    })),
  });
}

/**
 * The model, skills and connectors a turn asked for, checked against what the
 * agent offers. Anything it does not offer, or a connector that is not
 * connected, is refused with a sentence saying why: the client is never
 * trusted to turn on what the backend did not list.
 */
export function resolveChoices(request: SendInit, offer: AgentOffer): TurnChoices | { refused: string } {
  const skills = offer.skills ?? [];
  const connectors = offer.connectors ?? [];
  const model = request.model ?? "";
  if (model && model !== offer.defaultModel && !(offer.models ?? []).some((m) => m.id === model)) return { refused: `This agent does not offer the model ${model}.` };
  if (!request.choicesSet) {
    return { model, skills: skills.filter((s) => s.defaultOn !== false), connectors: connectors.filter((c) => c.defaultOn !== false && (c.status ?? "connected") === "connected") };
  }
  const unknownSkill = (request.skillIds ?? []).find((id) => !skills.some((s) => s.id === id));
  if (unknownSkill) return { refused: `This agent has no skill ${unknownSkill}.` };
  const chosen: AgentConnector[] = [];
  for (const id of request.connectorIds ?? []) {
    const connector = connectors.find((c) => c.id === id);
    if (!connector) return { refused: `This agent has no connector ${id}.` };
    if ((connector.status ?? "connected") !== "connected") return { refused: `${connector.name} is not connected${connector.reason ? `: ${connector.reason}` : ""}.` };
    chosen.push(connector);
  }
  return { model, skills: skills.filter((s) => request.skillIds?.includes(s.id)), connectors: chosen };
}

/** The tools on for a turn: every tool no connector names, and the tools of the connectors that are on. */
export function toolsFor<T extends { name: string }>(tools: T[], offer: AgentOffer, on: AgentConnector[]): T[] {
  const gated = new Set((offer.connectors ?? []).flatMap((c) => c.tools));
  const allowed = new Set(on.flatMap((c) => c.tools));
  return tools.filter((tool) => !gated.has(tool.name) || allowed.has(tool.name));
}

/** The system prompt with the skills that are on. */
export function systemWith(system: string, skills: AgentSkill[]): string {
  if (skills.length === 0) return system;
  return [system, ...skills.map((skill) => `## Skill: ${skill.name}\n\n${skill.text.trim()}`)].join("\n\n");
}

/** An agent that can say what it offers. `Chat`'s selectors read it; a backend without it offers nothing to choose. */
export interface DescribesAgents {
  describeAgents(): Promise<DescribeAgentsResponse>;
}

export const describesAgents = (backend: unknown): backend is DescribesAgents => typeof (backend as Partial<DescribesAgents> | undefined)?.describeAgents === "function";

/**
 * Several agents behind one backend: a turn goes to the agent its `agentId`
 * names, or the first. Each agent's own offer is reported by `describeAgents`.
 */
export function agentRouter(agents: { info: { id: string; name: string; description?: string }; backend: AgentBackend }[]): AgentBackend & DescribesAgents {
  if (agents.length === 0) throw new Error("agentRouter needs at least one agent.");
  return {
    async describeAgents() {
      const infos = await Promise.all(
        agents.map(async ({ info, backend }, index) => {
          const own = describesAgents(backend) ? (await backend.describeAgents()).agents[0] : undefined;
          // Its own models, skills and connectors; this router's id, name and order.
          return create(AgentInfoSchema, { ...((own ?? {}) as MessageInitShape<typeof AgentInfoSchema>), id: info.id, name: info.name, description: info.description ?? own?.description ?? "", isDefault: index === 0 });
        }),
      );
      return create(DescribeAgentsResponseSchema, { agents: infos });
    },
    async *send(request: SendInit, options?: AgentCallOptions): AsyncIterable<AgentEvent> {
      const target = request.agentId ? agents.find((a) => a.info.id === request.agentId) : agents[0];
      if (!target) {
        yield agentEvent.error("FAILED", `There is no agent ${request.agentId}.`);
        yield agentEvent.done(request.sessionId ?? "", "");
        return;
      }
      yield* target.backend.send(request, options);
    },
  };
}
