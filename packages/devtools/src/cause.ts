import { type Surface, getPath, surfaceOutline } from "@surfaces-ui/spec";
import type { JsonRecord, TraceEvent } from "@surfaces-ui/trace";

/** One thing the recording says about why a component is the way it is. */
export interface Finding {
  /** Which rule found it. */
  rule: "refused" | "invalid" | "unreachable" | "container" | "binding" | "query-failed" | "render-failed" | "contract" | "no-rows" | "cancelled" | "slow";
  /** "error" explains something broken, "warning" something that may be wrong, "info" something worth knowing. */
  severity: "error" | "warning" | "info";
  /** One sentence: what happened. */
  title: string;
  /** What the recording holds about it: a message, a path, a code. Never a row value. */
  detail?: string;
  /** The recorded event it was read from, to open. */
  eventId?: string;
}

export interface CauseInput {
  events: readonly TraceEvent[];
  /** The key the surface is held under, and the surface as it stands at the step looked at. */
  surfaceKey: string;
  surface: Surface | undefined;
  componentId: string;
  /** Only events up to this number count. Left out, every event. */
  upTo?: number;
  /** A service call slower than this is mentioned. */
  slowMs?: number;
}

const record = (value: unknown): JsonRecord => (value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {});
const text = (value: unknown) => (typeof value === "string" ? value : "");
const ORDER: Finding["rule"][] = ["refused", "invalid", "unreachable", "container", "binding", "query-failed", "render-failed", "contract", "no-rows", "cancelled", "slow"];

/** The components a message sent, by id. */
function sent(event: TraceEvent): string[] {
  const message = record(event.detail.message ?? event.detail.raw);
  const list = record(message.updateComponents).components ?? record(message.createSurface).components;
  return Array.isArray(list) ? list.map((item) => text(record(item).id)).filter(Boolean) : [];
}

/** Every `{ "@path": … }` in a component's own props, with where it was found. */
function bindings(value: unknown, at = "", out: { at: string; path: string }[] = []): { at: string; path: string }[] {
  if (Array.isArray(value)) value.forEach((item, i) => bindings(item, `${at}/${i}`, out));
  else if (value && typeof value === "object") {
    const path = (value as Record<string, unknown>)["@path"];
    if (typeof path === "string") out.push({ at, path });
    else for (const [key, item] of Object.entries(value)) if (!key.startsWith("@")) bindings(item, `${at}/${key}`, out);
  }
  return out;
}

/**
 * Why a component is the way it is, worked out from what was recorded by
 * fixed rules, most likely cause first. It reads the trace and the surface
 * and nothing else: it calls no model and runs no query, so it can only say
 * what the recording shows. An empty list means nothing recorded points at a
 * problem, not that there is none.
 *
 * The order follows the chain a component depends on: the message that sent
 * it, the catalog's check, whether anything draws it, what it is bound to,
 * its queries, and only then how it drew.
 */
export function componentFindings({ events, surfaceKey, surface, componentId, upTo = Number.POSITIVE_INFINITY, slowMs = 3000 }: CauseInput): Finding[] {
  const here = events.filter((event) => event.surfaceId === surfaceKey && event.seq <= upTo);
  const mine = here.filter((event) => event.componentId === componentId);
  const out: Finding[] = [];
  const name = (id: string) => `${String(surface?.components[id]?.component ?? "Component")} "${id}"`;

  // The messages that sent it: one refused, or one the catalog had something to say about.
  const sends = here.filter((event) => event.kind === "message" && sent(event).includes(componentId));
  const last = sends.at(-1);
  if (last && (last.detail.applied === false || last.status === "error")) {
    out.push({ rule: "refused", severity: "error", title: `The last message that sent it was refused, so the page still shows what came before.`, detail: text(record(last.detail.error).message) || undefined, eventId: last.id });
  }
  for (const event of sends) {
    const issues = Array.isArray(event.detail.issues) ? (event.detail.issues as { path?: unknown; message?: unknown }[]) : [];
    const index = sent(event).indexOf(componentId);
    for (const issue of issues) {
      const path = text(issue.path);
      if (!(path === `/${componentId}` || path.startsWith(`/${componentId}/`) || path.includes(`/components/${index}/`) || path.endsWith(`/components/${index}`))) continue;
      out.push({ rule: "invalid", severity: "error", title: "The catalog did not accept it as it was sent.", detail: `${path} ${text(issue.message)}`.trim(), eventId: event.id });
    }
  }
  // What the surface reported about it when drawing: a failed check, a component that threw, an event refused.
  for (const event of here.filter((e) => e.kind === "problem")) {
    const path = text(event.detail.path);
    if (!(event.componentId === componentId || path === `/${componentId}` || path.startsWith(`/${componentId}/`))) continue;
    const code = text(event.detail.code) || event.name;
    const detail = text(event.detail.message) || undefined;
    if (code === "RENDER_FAILED") out.push({ rule: "render-failed", severity: "error", title: "It threw while drawing, and a notice is shown in its place.", detail, eventId: event.id });
    else if (code === "CONTRACT_FAILED") out.push({ rule: "contract", severity: "error", title: "An event it sent did not match what the agent said it expects, so it was not sent.", detail, eventId: event.id });
    else if (!out.some((f) => f.rule === "invalid" && f.detail?.includes(detail ?? "\u0000"))) out.push({ rule: "invalid", severity: "error", title: `The surface reported ${code} for it.`, detail, eventId: event.id });
  }

  if (surface) {
    const component = surface.components[componentId];
    const outline = surfaceOutline(surface);
    if (component && !outline.some((item) => item.id === componentId)) {
      out.push({ rule: "unreachable", severity: "error", title: "Nothing draws it: no component reachable from the root lists it as a child.", detail: sends.length > 0 ? undefined : "No message recorded here sent it either." });
    }
    // A container above it that failed takes it down too.
    const holds = (c: Record<string, unknown>, id: string) =>
      c.child === id || (Array.isArray(c.children) && c.children.includes(id)) || (Array.isArray(c.tabs) && c.tabs.some((tab) => record(tab).child === id));
    const parentOf = (id: string) => Object.entries(surface.components).find(([, c]) => holds(c as Record<string, unknown>, id))?.[0];
    const seen = new Set([componentId]);
    for (let up = parentOf(componentId); up !== undefined && !seen.has(up); up = parentOf(up)) {
      seen.add(up);
      const failed = here.find((event) => event.kind === "problem" && (event.componentId === up || text(event.detail.path) === `/${up}`));
      if (failed) out.push({ rule: "container", severity: "error", title: `Its container ${name(up)} has a problem, so what is inside may not be drawn.`, detail: text(failed.detail.message) || undefined, eventId: failed.id });
    }
    // Bound to a place in the data model that holds nothing.
    if (component) {
      const { id: _id, component: _kind, ...own } = component;
      for (const { at, path } of bindings(own)) {
        // A path with no leading slash is relative to a repeated item, which the outline cannot place.
        if (!path.startsWith("/")) continue;
        if (getPath(surface.data, path) === undefined) out.push({ rule: "binding", severity: "warning", title: `Its ${at.slice(1).split("/")[0]} is bound to ${path}, and the data model holds nothing there.`, detail: "A later updateDataModel may set it; until then the prop is empty." });
      }
    }
  }

  // Its calls to a backend. One that failed, came back empty or was cancelled no longer counts once the same
  // method was asked again after it ended and answered: the component moved on. Calls made side by side all count.
  const calls = mine.filter((event) => event.kind === "service" && event.status !== "running");
  const ended = (call: TraceEvent) => call.time + (call.durationMs ?? 0);
  const answered = (call: TraceEvent) => call.status === "ok" && call.detail.cancelled !== true;
  const standing = calls.filter((call) => !calls.some((later) => later.name === call.name && later.seq > call.seq && later.time >= ended(call) && answered(later) && !(answered(call) && Number(record(call.detail.response).rows) > 0)));
  for (const call of standing) {
    const error = record(call.detail.error);
    const response = record(call.detail.response);
    if (call.status === "error") {
      const where = typeof error.line === "number" ? ` (line ${error.line}${typeof error.column === "number" ? `, column ${error.column}` : ""})` : "";
      out.push({ rule: "query-failed", severity: "error", title: `${call.name} failed.`, detail: `${[error.code, error.message].filter(Boolean).join(" ")}${where}`, eventId: call.id });
    } else if (call.detail.cancelled === true) {
      out.push({ rule: "cancelled", severity: "info", title: `${call.name} was cancelled and not asked again.`, detail: "Usual when a component is redrawn before its answer arrives; a problem only if it shows no data.", eventId: call.id });
    } else if (typeof response.rows === "number" && response.rows === 0 && Array.isArray(response.columns)) {
      const notices = Array.isArray(response.notices) && response.notices.length > 0 ? ` Notices: ${JSON.stringify(response.notices)}` : "";
      out.push({ rule: "no-rows", severity: "warning", title: `${call.name} came back with no rows.`, detail: `The query ran; check its filters and the SQL the engine ran.${notices}`, eventId: call.id });
    }
    if (call.status !== "error" && typeof call.durationMs === "number" && call.durationMs >= slowMs) {
      out.push({ rule: "slow", severity: "info", title: `${call.name} took ${(call.durationMs / 1000).toFixed(1)} s.`, eventId: call.id });
    }
  }

  return out.map((finding, index) => ({ finding, index })).sort((a, b) => ORDER.indexOf(a.finding.rule) - ORDER.indexOf(b.finding.rule) || a.index - b.index).map(({ finding }) => finding);
}
