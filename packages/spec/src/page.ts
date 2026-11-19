import type { Catalog, ValidationIssue } from "./catalog.js";
import { A2UI_VERSION } from "./dynamic.js";
import { upgradeComponent, upgradeMessage } from "./upgrade.js";
import { type ThemeRequest, applyThemeRequest, defaultTheme } from "@surfaces-ui/tokens";
import { type Surface, type SurfaceComponent, type SurfaceMessage, metadataTheme, surfaceMetadata } from "./surface.js";

/**
 * A page, view or dashboard as a document: a title and a flat list of
 * catalog components, the first of which has the ID "root". It is plain
 * JSON, so it can be saved, versioned, reviewed, sent to an agent and
 * edited by one.
 */
export interface PageDocument {
  id: string;
  title: string;
  description?: string;
  /** The catalog its components come from. */
  catalogId: string;
  /**
   * The A2UI version its components are written in. Every page this library writes says so; one without it was
   * saved before the move to v1.0 and is read as v0.9 (`upgradePage`).
   */
  a2ui?: string;
  components: SurfaceComponent[];
  /** Values the components bind to with `{ "@path": … }`. */
  data?: unknown;
  /** How the page looks, as a theme request: a preset, mode, accent, radius, font, density, chart colours. */
  theme?: ThemeRequest;
}

/** One change to a page. An agent configuring a page answers with a list of these. */
export type PageEdit =
  /** Adds a component, or replaces the one with the same ID. `parent` appends it to that container's children. */
  | { op: "set"; component: SurfaceComponent; parent?: string; index?: number }
  /** Changes some props of an existing component. A prop set to null is removed. */
  | { op: "update"; id: string; props: Record<string, unknown> }
  /** Removes a component and takes it out of every container. */
  | { op: "remove"; id: string }
  | { op: "title"; title: string }
  /** Moves a component to a place in a container: the page's layout, changed without touching the component. */
  | { op: "move"; id: string; parent: string; index?: number }
  /** Changes how the page looks. Parts left out stay as they are; `null` goes back to the host's theme. */
  | { op: "theme"; theme: ThemeRequest | null };

/**
 * A page in the current A2UI version. One that says it is current comes back as it is, so this is safe on every
 * page taken from storage; every function here that reads a page calls it first.
 */
export function upgradePage(page: PageDocument): PageDocument {
  if (page.a2ui === A2UI_VERSION) return page;
  return { ...page, a2ui: A2UI_VERSION, components: page.components.map(upgradeComponent) };
}

/** The page as a surface, ready for `SurfaceView`. */
export function pageSurface(given: PageDocument): Surface {
  const page = upgradePage(given);
  return {
    surfaceId: page.id,
    catalogId: page.catalogId,
    a2ui: A2UI_VERSION,
    components: Object.fromEntries(page.components.map((component) => [component.id, component])),
    data: page.data ?? {},
    ...(page.theme ? { theme: { ...page.theme } } : {}),
  };
}

/** The page as A2UI messages, for sending to any A2UI renderer. */
export function pageMessages(given: PageDocument): SurfaceMessage[] {
  const page = upgradePage(given);
  const metadata = surfaceMetadata({ theme: page.theme ? { ...page.theme } : undefined });
  return [
    { version: A2UI_VERSION, createSurface: { surfaceId: page.id, catalogId: page.catalogId, ...(metadata ? { metadata } : {}) } },
    { version: A2UI_VERSION, updateComponents: { surfaceId: page.id, components: page.components } },
    ...(page.data === undefined ? [] : [{ version: A2UI_VERSION, updateDataModel: { surfaceId: page.id, path: "/", value: page.data } }]),
  ];
}

/** True when `inner` is `outer` or sits somewhere beneath it. */
function containsId(components: SurfaceComponent[], outer: string, inner: string, seen = new Set<string>()): boolean {
  if (outer === inner) return true;
  if (seen.has(outer)) return false;
  seen.add(outer);
  const node = components.find((c) => c.id === outer);
  return (Array.isArray(node?.children) ? (node.children as string[]) : []).some((child) => containsId(components, child, inner, seen));
}

const childrenOf = (component: SurfaceComponent): string[] | undefined => (Array.isArray(component.children) ? (component.children as string[]) : undefined);

/** Every problem the catalog finds in a page, with the component it is in. */
export function validatePage(given: PageDocument, catalog: Catalog): ValidationIssue[] {
  const page = upgradePage(given);
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const component of page.components) {
    if (ids.has(component.id)) issues.push({ path: `/${component.id}`, message: "Two components have this ID." });
    ids.add(component.id);
    for (const issue of catalog.validateComponent(component)) issues.push({ path: `/${component.id}${issue.path}`, message: issue.message });
  }
  if (!ids.has("root")) issues.push({ path: "/root", message: 'A page needs a component with the ID "root".' });
  for (const component of page.components) {
    const referenced = [...(childrenOf(component) ?? []), ...(typeof component.child === "string" ? [component.child] : [])];
    for (const id of referenced) if (!ids.has(id)) issues.push({ path: `/${component.id}`, message: `Refers to "${id}", which is not on the page.` });
  }
  return issues;
}

export interface EditResult {
  page: PageDocument;
  /** Edits that were not applied, and why. The page is unchanged by them. */
  rejected: { edit: PageEdit; reason: string }[];
}

/**
 * Applies edits to a page. Each edit is checked against the catalog before
 * it takes effect; one that would make a component invalid is rejected and
 * reported, so an agent's mistake cannot break a page.
 */
export function editPage(given: PageDocument, edits: PageEdit[], catalog: Catalog): EditResult {
  const page = upgradePage(given);
  let components = page.components;
  let title = page.title;
  let theme = page.theme;
  const rejected: EditResult["rejected"] = [];
  const check = (component: SurfaceComponent) => catalog.validateComponent(component)[0];
  for (const edit of edits) {
    if (edit.op === "title") {
      title = edit.title;
      continue;
    }
    if (edit.op === "theme") {
      if (edit.theme === null) {
        theme = undefined;
        continue;
      }
      // Tried against the default theme: what matters is whether the request itself makes sense.
      const problems = applyThemeRequest(edit.theme, defaultTheme).problems;
      if (problems.length > 0) rejected.push({ edit, reason: problems.join(" ") });
      else theme = { ...theme, ...edit.theme };
      continue;
    }
    if (edit.op === "move") {
      const target = components.find((c) => c.id === edit.parent);
      const reason = !components.some((c) => c.id === edit.id)
        ? `There is no component "${edit.id}".`
        : edit.id === "root"
          ? "The top of the page cannot be moved."
          : !target || !childrenOf(target)
            ? `"${edit.parent}" is not a container on this page.`
            : containsId(components, edit.id, edit.parent)
              ? "A container cannot be moved inside itself."
              : undefined;
      if (reason) {
        rejected.push({ edit, reason });
        continue;
      }
      components = components.map((c) => (childrenOf(c)?.includes(edit.id) ? { ...c, children: childrenOf(c)!.filter((id) => id !== edit.id) } : c));
      components = components.map((c) => {
        if (c.id !== edit.parent) return c;
        const list = [...childrenOf(c)!];
        list.splice(edit.index === undefined ? list.length : Math.max(0, Math.min(list.length, edit.index)), 0, edit.id);
        return { ...c, children: list };
      });
      continue;
    }
    if (edit.op === "remove") {
      if (edit.id === "root") {
        rejected.push({ edit, reason: "The top of the page cannot be removed." });
        continue;
      }
      components = components
        .filter((c) => c.id !== edit.id)
        .map((c) => (childrenOf(c)?.includes(edit.id) ? { ...c, children: childrenOf(c)!.filter((id) => id !== edit.id) } : c));
      continue;
    }
    if (edit.op === "update") {
      const existing = components.find((c) => c.id === edit.id);
      if (!existing) {
        rejected.push({ edit, reason: `There is no component "${edit.id}".` });
        continue;
      }
      const next = Object.fromEntries(Object.entries({ ...existing, ...edit.props, id: existing.id, component: existing.component }).filter(([, value]) => value !== null)) as SurfaceComponent;
      const problem = check(next);
      if (problem) {
        rejected.push({ edit, reason: `${problem.path} ${problem.message}` });
        continue;
      }
      components = components.map((c) => (c.id === edit.id ? next : c));
      continue;
    }
    const problem = check(edit.component);
    if (problem) {
      rejected.push({ edit, reason: `${problem.path} ${problem.message}` });
      continue;
    }
    const parent = edit.parent === undefined ? undefined : components.find((c) => c.id === edit.parent);
    if (edit.parent !== undefined && !childrenOf(parent ?? ({} as SurfaceComponent))) {
      rejected.push({ edit, reason: `"${edit.parent}" is not a container on this page.` });
      continue;
    }
    const exists = components.some((c) => c.id === edit.component.id);
    components = exists ? components.map((c) => (c.id === edit.component.id ? edit.component : c)) : [...components, edit.component];
    if (parent && !childrenOf(parent)!.includes(edit.component.id)) {
      const list = [...childrenOf(parent)!];
      list.splice(edit.index === undefined ? list.length : Math.max(0, Math.min(list.length, edit.index)), 0, edit.component.id);
      components = components.map((c) => (c.id === parent.id ? { ...c, children: list } : c));
    }
  }
  const { theme: _, ...rest } = page;
  return { page: { ...rest, title, components, ...(theme ? { theme } : {}) }, rejected };
}

/**
 * Turns the A2UI messages an agent sent for a page into edits: components it
 * sent are set, and components it dropped from a container's children are
 * removed. This lets any agent that speaks A2UI configure a page.
 */
export function editsFromMessages(given: PageDocument, incoming: SurfaceMessage[]): PageEdit[] {
  const page = upgradePage(given);
  const messages = incoming.map(upgradeMessage);
  const edits: PageEdit[] = [];
  const known = new Map(page.components.map((c) => [c.id, c]));
  for (const message of messages) {
    // An agent restyles a page by sending its theme when it (re)creates the surface.
    const restyle = "createSurface" in message && message.createSurface.surfaceId === page.id ? metadataTheme(message.createSurface.metadata) : undefined;
    if (restyle) edits.push({ op: "theme", theme: restyle as ThemeRequest });
    // Components may come with the surface or in an update of their own.
    const sent = "updateComponents" in message ? message.updateComponents : "createSurface" in message && message.createSurface.components ? { surfaceId: message.createSurface.surfaceId, components: message.createSurface.components } : undefined;
    if (!sent || sent.surfaceId !== page.id) continue;
    // The page as this whole message leaves it: a child moved from one container to another arrives as two
    // components, and whichever comes first, the child is still held by the other.
    const after = new Map(known);
    for (const component of sent.components) after.set(component.id, component);
    for (const component of sent.components) {
      const before = known.get(component.id);
      const kept = new Set(childrenOf(component) ?? []);
      for (const id of childrenOf(before ?? ({} as SurfaceComponent)) ?? []) {
        // A child left out of its only container is no longer on the page.
        if (!kept.has(id) && ![...after.values()].some((c) => c.id !== component.id && childrenOf(c)?.includes(id))) edits.push({ op: "remove", id });
      }
      edits.push({ op: "set", component });
      known.set(component.id, component);
    }
  }
  return edits;
}

/** What a saved surface is for. Matches `SurfaceKind` in `view.proto`. */
/** A conversation is never guessed from a page: it is a `ConversationDocument`, saved as one. */
export type SurfaceKindName = "chart" | "dashboard" | "form" | "dag" | "data-explorer" | "metadata-explorer" | "conversation" | "other";

const DATA_VIEWS = new Set(["Chart", "Metric", "Stat", "Sparkline", "BulletGraph", "DataGrid", "PivotTable", "QueryResult", "Table"]);
const ROWS = new Set(["Explorer", "DataGrid", "QueryResult", "SqlEditor", "SqlProposal", "PivotTable", "QueryPlan"]);
const METADATA = new Set(["ObjectBrowser", "FileBrowser", "ObjectDetail", "DataSearch", "RelationshipGraph", "ModelDiagram", "ContextBuilder", "AskData", "SourceList", "SemanticModelEditor"]);
const GRAPHS = new Set(["PipelineGraph", "PipelineView"]);
const INPUTS = new Set(["Form", "TextField", "NumberField", "ChoicePicker", "CheckBox", "DateTimeInput", "Slider"]);

/**
 * A guess at what a page is for, from what is on it. A person can always
 * choose otherwise; this only picks the starting value.
 */
export function surfaceKind(page: Pick<PageDocument, "components">): SurfaceKindName {
  const names = page.components.map((c) => c.component);
  const count = (set: Set<string>) => names.filter((n) => set.has(n)).length;
  // A report is a dashboard whatever else is on the page.
  if (names.includes("ReportBuilder")) return "dashboard";
  if (count(GRAPHS) > 0) return "dag";
  if (names.includes("Form") || (count(INPUTS) > 0 && count(DATA_VIEWS) === 0)) return "form";
  if (count(METADATA) > 0 && count(DATA_VIEWS) <= 1) return "metadata-explorer";
  if (count(DATA_VIEWS) >= 3) return "dashboard";
  if (count(ROWS) > 0) return "data-explorer";
  if (names.filter((n) => n === "Chart").length === 1 && count(DATA_VIEWS) <= 2) return "chart";
  if (count(DATA_VIEWS) >= 2) return "dashboard";
  return "other";
}
