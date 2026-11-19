import type { Catalog, ValidationIssue } from "./catalog.js";
import { type PageDocument, validatePage } from "./page.js";
import type { SurfaceComponent } from "./surface.js";

/** A surface an agent draws in one reply of a written conversation. */
export interface ScriptSurface {
  /** The agent's own surface ID, unique within the reply. */
  id: string;
  /** Catalog components; one has the ID "root". */
  components: SurfaceComponent[];
  /** Values the components bind to with `{ path }`. */
  data?: unknown;
}

/** One piece of a written reply, in the order it appears. */
export type ScriptPart =
  | { text: string }
  /** Work the agent is shown doing: reading the catalog, running a query. */
  | { steps: { title: string; detail?: string; tool?: string }[] }
  | { surface: ScriptSurface };

export interface ScriptTurn {
  /** What the person says. */
  say: string;
  reply: ScriptPart[];
  /** Offered after the reply. */
  suggestions?: string[];
}

/**
 * What the agent answers when a control in a drawn component sends an event:
 * a node chosen in a graph, a model's joins used as a query. Text in the
 * reply may hold `{{key}}`, filled from the event's context (`{{sql}}`,
 * `{{name}}`), so a reply can show what the person did.
 */
export interface ScriptEvent {
  /** The event's name, as the component's `action` gives it. */
  name: string;
  /** Answer only when the event's context has these values. */
  where?: Record<string, string>;
  reply: ScriptPart[];
}

/**
 * A conversation written out as plain data: what a person says and what the
 * agent answers with, turn by turn (text, steps and drawn components). It is
 * for samples, demos and tests, and for showing consumers what a thread of
 * mixed content looks like. `@surfaces-ui/chat` turns it into a thread
 * (`scriptThread`) or an agent that answers from it (`scriptAgent`).
 */
export interface ConversationScript {
  id: string;
  title: string;
  description: string;
  /** Who is shown as having answered. A script must say that it is one. */
  answeredBy: string;
  turns: ScriptTurn[];
  /** Answers to events from controls in the drawn components; the first that matches is used. */
  events?: ScriptEvent[];
}

/** A drawn surface of a script as a page, so the page tools (`validatePage`, `pageSurface`, saving) work on it. */
export function scriptSurfacePage(surface: ScriptSurface, catalog: Catalog, title = surface.id): PageDocument {
  return { id: surface.id, title, catalogId: catalog.id, components: surface.components, ...(surface.data === undefined ? {} : { data: surface.data }) };
}

/** Every surface a script draws, with the turn it is in (-1 for an answer to an event). */
export function scriptSurfaces(script: ConversationScript): { turn: number; surface: ScriptSurface }[] {
  const of = (reply: ScriptPart[], turn: number) => reply.flatMap((part) => ("surface" in part ? [{ turn, surface: part.surface }] : []));
  return [...script.turns.flatMap((turn, index) => of(turn.reply, index)), ...(script.events ?? []).flatMap((event) => of(event.reply, -1))];
}

/** The reply with every `{{key}}` in its text filled from an event's context. A key the context does not hold is left empty. */
export function fillScriptReply(reply: ScriptPart[], context: Record<string, unknown>): ScriptPart[] {
  const fill = (value: unknown): unknown => {
    if (typeof value === "string") return value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => (context[key] === undefined || context[key] === null ? "" : typeof context[key] === "object" ? JSON.stringify(context[key]) : String(context[key])));
    if (Array.isArray(value)) return value.map(fill);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)]));
    return value;
  };
  return fill(reply) as ScriptPart[];
}

/** The script's answer to an event, filled from its context, or undefined when it has none. */
export function scriptEventReply(script: ConversationScript, name: string, context: Record<string, unknown>): ScriptPart[] | undefined {
  const found = (script.events ?? []).find((event) => event.name === name && Object.entries(event.where ?? {}).every(([key, value]) => String(context[key]) === value));
  return found ? fillScriptReply(found.reply, context) : undefined;
}

/** Every problem the catalog finds in a script's surfaces, and anything else that would stop it playing. */
export function validateConversationScript(script: ConversationScript, catalog: Catalog): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!script.answeredBy.trim()) issues.push({ path: "/answeredBy", message: "A script must say who is shown as answering." });
  const check = (reply: ScriptPart[], at: string) => {
    const seen = new Set<string>();
    for (const part of reply) {
      if (!("surface" in part)) continue;
      const { surface } = part;
      if (seen.has(surface.id)) issues.push({ path: `${at}/${surface.id}`, message: "Two surfaces in one reply have this ID." });
      seen.add(surface.id);
      for (const issue of validatePage(scriptSurfacePage(surface, catalog), catalog)) issues.push({ path: `${at}/${surface.id}${issue.path}`, message: issue.message });
    }
  };
  script.turns.forEach((turn, index) => {
    if (!turn.say.trim()) issues.push({ path: `/turns/${index}/say`, message: "A turn needs what the person says." });
    check(turn.reply, `/turns/${index}`);
  });
  (script.events ?? []).forEach((event, index) => check(event.reply, `/events/${index}`));
  return issues;
}
