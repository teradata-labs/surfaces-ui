import { FilesPanel } from "../FilesPanel.js";
import { type DataRef, ObjectBrowser, PipelinesProvider, Workspace, type WorkspaceLayout, type WorkspacePanel, addDataRefs } from "@surfaces-ui/components";
import { type SurfaceLibrary, StaleSurfaceError, surfaceKindLabel, surfaceKindOf, surfaceKindWord, surfaceKinds } from "@surfaces-ui/data";
import {
  A2UI_VERSION,
  type JsonRenderSpec,
  type PageDocument,
  type Surface,
  type SurfaceAction,
  type SurfaceComponent,
  type SurfaceMessage,
  type Surfaces,
  SurfaceError,
  analyticsCatalog,
  applyMessage,
  isComponentIssue,
  pageMessages,
  catalogJson,
  surfaceKind,
} from "@surfaces-ui/spec";
import { ArrangeGhost, type SurfaceProblem, SurfaceView, lazyAnalyticsRenderers, useArrange } from "@surfaces-ui/spec/react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComposerPanel, useComposerMessages } from "./ComposerPanel.js";
import { pretty } from "../composerText.js";
import { type ComposerEdit, type ComposerTab, useComposerHost } from "../composerSync.js";
import { GROUPS, exampleProps } from "../catalogExamples.js";
import { addComponentMessages, placeOfComponent, removeComponentMessages, setComponentMessages, surfaceOutline } from "../composerAdd.js";
import { demoPageStarters } from "../demoPageAgent.js";
import { type DataFocus, focusFor } from "../focus.js";
import { onboarding, tableProps, tableSqlName, tablesOutline, useWorkingTables } from "../tables.js";
import { type JsonSchema, SchemaForm } from "../SchemaForm.js";
import { type ActiveSource, engineLabel, firstTable, isRealSource } from "../source.js";
import { type ComposerState, useComposerAgent } from "../useComposerAgent.js";
import { type HistoryEntry, composerPanels } from "./ComposerSide.js";

type SavedDocument = NonNullable<NonNullable<Parameters<SurfaceLibrary["saveSurface"]>[0]["surface"]>["document"]>;

/** A problem with the messages, at a path that starts with the message's place in the list. */
interface MessageProblem {
  path: string;
  message: string;
}

/** The starting messages: a headline number beside its trend, a sorted breakdown, and a note box that writes to the data model. */
export function exampleMessages(focus: DataFocus): SurfaceMessage[] {
  const { sourceId, measure, trend, breakdown } = focus;
  const surfaceId = "main";
  const views: SurfaceComponent[] = [
    { id: "root", component: "Column", children: ["title", "numbers", "breakdown"] },
    { id: "title", component: "Text", variant: "h2", text: focus.title },
    { id: "numbers", component: "Grid", columns: 2, children: ["headline", "trend"] },
    { id: "headline", component: "Metric", sourceId, sql: measure.sql, ...(measure.column ? { column: measure.column } : {}), aggregate: measure.aggregate, label: measure.label, ...(measure.format ? { format: measure.format } : {}) },
    // A headline number is read against something: its trend.
    { id: "trend", component: "Sparkline", sourceId, sql: trend.sql, x: trend.x, grain: "month", ...(trend.column ? { column: trend.column } : {}), aggregate: trend.aggregate, label: trend.label, ...(trend.format ? { format: trend.format } : {}) },
    // Bars over categories start at zero and are sorted largest first by the chart itself.
    { id: "breakdown", component: "Chart", sourceId, sql: breakdown.sql, type: "bar", x: breakdown.x, y: breakdown.y, ...(breakdown.yTitle ? { yTitle: breakdown.yTitle } : {}), height: 280 },
  ];
  const inputs: SurfaceComponent[] = [
    { id: "root", component: "Column", children: ["title", "numbers", "breakdown", "note", "send"] },
    { id: "note", component: "TextField", label: "Note for the agent", value: { "@path": "/note" }, multiline: true },
    { id: "send", component: "Button", child: "send-label", variant: "primary", action: { event: { name: "send_note", context: { note: { "@path": "/note" } } } } },
    { id: "send-label", component: "Text", text: "Send note" },
  ];
  return [
    { version: A2UI_VERSION, createSurface: { surfaceId, catalogId: analyticsCatalog.id } },
    { version: A2UI_VERSION, updateComponents: { surfaceId, components: views } },
    { version: A2UI_VERSION, updateComponents: { surfaceId, components: inputs } },
    { version: A2UI_VERSION, updateDataModel: { surfaceId, path: "/", value: { note: "" } } },
  ];
}

export function exampleSpec(focus: DataFocus): JsonRenderSpec {
  const { measure } = focus;
  return {
    root: "page",
    elements: {
      page: { type: "Stack", children: ["heading", "headline", "rows"] },
      heading: { type: "Heading", props: { text: focus.title } },
      headline: { type: "Metric", props: { sourceId: focus.sourceId, sql: measure.sql, ...(measure.column ? { column: measure.column } : {}), aggregate: measure.aggregate, label: measure.label } },
      rows: { type: "Table", props: { sourceId: focus.sourceId, sql: focus.rowsSql, height: 280 } },
    },
  };
}

/**
 * Applies the first `count` messages, checking each against the catalog the
 * way `useSurfaces` does: a malformed envelope is reported and skipped; a
 * malformed component is applied and reported (it is drawn as a notice).
 */
function applyFirst(messages: SurfaceMessage[], count: number): { surfaces: Surfaces; problems: MessageProblem[] } {
  let surfaces: Surfaces = {};
  const problems: MessageProblem[] = [];
  messages.slice(0, count).forEach((message, index) => {
    const issues = analyticsCatalog.validateMessage(message);
    for (const issue of issues) problems.push({ path: `/${index}${issue.path === "/" ? "" : issue.path}`, message: issue.message });
    if (issues.some((issue) => !isComponentIssue(issue))) return;
    try {
      surfaces = applyMessage(surfaces, message);
    } catch (error) {
      problems.push({ path: `/${index}`, message: error instanceof SurfaceError || error instanceof Error ? error.message : String(error) });
    }
  });
  return { surfaces, problems };
}

/**
 * The surface as a page document, root first, when it has a root. What a
 * person changed on the drawn surface goes in too: `controls` (filters, sorts,
 * columns, in each component's own prop form) over the components' props, and
 * `data` (what was typed) over the data model, so a save keeps what is on screen.
 */
export function toPage(surface: Surface, title: string, controls: Record<string, Record<string, unknown>> = {}, typed?: unknown): PageDocument | undefined {
  // Only what the root reaches is kept: a component taken off the surface stays in its store (A2UI has no delete) but is not saved.
  const drawn = new Set(surfaceOutline(surface).map((item) => item.id));
  const components = Object.values(surface.components)
    .filter((c) => drawn.has(c.id))
    .map((c) => (controls[c.id] ? { ...c, ...controls[c.id] } : c));
  const root = components.find((c) => c.id === "root");
  if (!root) return undefined;
  const model = typed ?? surface.data;
  const data = model && typeof model === "object" && Object.keys(model).length > 0 ? model : undefined;
  return {
    id: surface.surfaceId,
    title,
    catalogId: surface.catalogId,
    components: [root, ...components.filter((c) => c !== root)],
    ...(data !== undefined ? { data } : {}),
    ...(surface.theme ? { theme: surface.theme as PageDocument["theme"] } : {}),
  };
}

/** `#composer?surface=<id>` names a saved surface to open. */
const surfaceFromHash = () => new URLSearchParams(location.hash.split("?")[1] ?? "").get("surface") ?? "";

/** Pipeline components need a pipeline backend; only the dev server has one. */
function MaybePipelines({ source, children }: { source: ActiveSource; children: ReactNode }) {
  return source.pipelines ? <PipelinesProvider pipelines={source.pipelines}>{children}</PipelinesProvider> : children;
}

/**
 * Write A2UI messages (or a json-render spec, converted) and watch them draw:
 * step through the messages one at a time, read the data model as a person
 * types into the surface, see every problem the catalog finds with its path,
 * the events the surface sends, and save the result to the library.
 */
/** Where the composer starts on a real source: an empty surface, since nothing is known about its tables. */
export function blankMessages(title: string): SurfaceMessage[] {
  const surfaceId = "main";
  return [
    { version: A2UI_VERSION, createSurface: { surfaceId, catalogId: analyticsCatalog.id } },
    { version: A2UI_VERSION, updateComponents: { surfaceId, components: [{ id: "root", component: "Column", children: ["title"] }, { id: "title", component: "Text", variant: "h2", text: title }] } },
  ];
}

/** Each component's props as JSON Schema, for the form that edits one component. */
const PROPS_SCHEMA = catalogJson(analyticsCatalog).components as Record<string, JsonSchema>;

const REAL_STARTERS = ["Show each table in use as a grid a person can explore", "Add a headline number and a chart for the first table", "Chart the rows of the first table by a category column", "How do the tables in use join? Draw the model"];

const PANELS_KEY = "surfaces.playground.panels.v1";
const RAIL_KEY = "surfaces.playground.rail-names";
/** Where the playground's panels start: the surface beside the agent, and everything else on the rail. */
const START_PANELS: WorkspaceLayout = { columns: [["surface"], ["agent"]], columnWidths: [0.66, 0.34], hidden: ["components", "tables", "files", "json", "data", "history", "save"] };
function loadPanelLayout(): WorkspaceLayout {
  try {
    const kept = JSON.parse(localStorage.getItem(PANELS_KEY) ?? "null") as WorkspaceLayout | null;
    // Whatever was kept is checked against the panels that exist when it is drawn.
    if (kept && Array.isArray(kept.columns)) return kept;
  } catch {
    // Nothing kept, or storage is off.
  }
  return START_PANELS;
}
function savePanelLayout(layout: WorkspaceLayout): void {
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(layout));
  } catch {
    // Storage is off: the arrangement lasts for this page only.
  }
}

export function ComposerPage({ source }: { source: ActiveSource }) {
  const [panelLayout, setPanelLayout] = useState<WorkspaceLayout>(loadPanelLayout);
  // Tables and columns the person attached to the instruction they are writing.
  const [attached, setAttached] = useState<DataRef[]>([]);
  // Names under the rail's icons, or icons only: what the person last chose.
  const [railNames, setRailNames] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) === "true";
    } catch {
      return false;
    }
  });
  const table = firstTable(source);
  // A real source (a warehouse, a person's database) has no sample model: the composer starts empty and works from the tables a person picks.
  const real = isRealSource(source);
  const working = useWorkingTables(source.dataSource, source.sourceId);
  const [inHand, setInHand] = useState("");
  const handTable = working.tables.find((t) => tableSqlName(t) === inHand) ?? working.tables.at(-1);
  const sourceLabel = source.sources.find((s) => s.id === source.sourceId)?.label ?? source.sourceId;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the focus depends only on the source id and table.
  const focus = useMemo(() => focusFor(source.sourceId, table), [source.sourceId, table]);
  const [tab, setTab] = useState<ComposerTab>("a2ui");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const nextEntry = useRef(1);
  const remember = useCallback((entry: Omit<HistoryEntry, "id" | "at">) => {
    const id = nextEntry.current++;
    setHistory((list) => [{ ...entry, id, at: new Date().toISOString() }, ...list].slice(0, 100));
  }, []);
  const startMessages = useCallback(() => (real ? blankMessages(`${sourceLabel}: new surface`) : exampleMessages(focus)), [real, sourceLabel, focus]);
  const startSpec = useCallback((): JsonRenderSpec => (real ? { root: "heading", elements: { heading: { type: "Heading", props: { text: `${sourceLabel}: new surface` } } } } : exampleSpec(focus)), [real, sourceLabel, focus]);
  const [a2uiText, setA2uiText] = useState(() => pretty(startMessages()));
  const [specText, setSpecText] = useState(() => pretty(startSpec()));
  // The examples last written for a dataset: replaced when another dataset is picked, unless a person edited them.
  const examples = useRef({ a2ui: a2uiText, spec: specText });
  useEffect(() => {
    const a2ui = pretty(startMessages());
    const spec = pretty(startSpec());
    setA2uiText((text) => (text === examples.current.a2ui ? a2ui : text));
    setSpecText((text) => (text === examples.current.spec ? spec : text));
    examples.current = { a2ui, spec };
  }, [startMessages, startSpec]);

  const { messages, parseError } = useComposerMessages(tab, a2uiText, specText);
  const total = messages.length;
  const messagesKey = JSON.stringify(messages);

  // How many messages are applied. Editing the messages shows them all again.
  const [step, setStep] = useState(total);
  // biome-ignore lint/correctness/useExhaustiveDependencies: messagesKey stands for messages.
  useEffect(() => setStep(total), [messagesKey, total]);
  const applied = Math.min(step, total);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messagesKey stands for messages.
  const { surfaces, problems } = useMemo(() => applyFirst(messages, applied), [messagesKey, applied]);
  const ids = Object.keys(surfaces);
  const [picked, setPicked] = useState("");
  const surfaceId = ids.includes(picked) ? picked : (ids[ids.length - 1] ?? "");
  const surface = surfaceId ? surfaces[surfaceId] : undefined;

  const [drawProblems, setDrawProblems] = useState<SurfaceProblem[]>([]);
  const [typed, setTyped] = useState<unknown>(undefined);
  const [controls, setControls] = useState<Record<string, Record<string, unknown>>>({});
  // What a person does in the surface (a view added, a field changed, a filter set), kept for the agent's next turn.
  const activity = useRef<NonNullable<ComposerState["activity"]>>([]);
  const dataKey = JSON.stringify(surface?.data ?? null);
  // A new data model from the messages starts the inputs again, so what is shown is what the surface holds.
  const viewKey = `${surfaceId}:${applied}:${dataKey}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the drawn surface changes.
  useEffect(() => {
    setDrawProblems([]);
    setTyped(undefined);
  }, [viewKey, surface]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a different surface has different controls.
  useEffect(() => {
    setControls({});
  }, [surfaceId]);
  const dataShown = typed ?? surface?.data ?? {};

  // Opening a saved surface: `#composer?surface=<id>`.
  const [loaded, setLoaded] = useState<{ id: string; version: number; title: string; kind: number } | undefined>();
  const [loadStatus, setLoadStatus] = useState("");
  const [title, setTitle] = useState(real ? `${sourceLabel} surface` : focus.title);
  const [kindWord, setKindWord] = useState<string>("");
  const open = useCallback(
    async (id: string) => {
      if (!id) return;
      setLoadStatus(`Opening "${id}"…`);
      try {
        const { surface: saved } = await source.library.getSurface({ id });
        if (!saved) throw new Error(`No saved surface "${id}".`);
        const doc = (saved.document ?? {}) as Record<string, unknown>;
        const next = Array.isArray(doc.components)
          ? pageMessages({ id: typeof doc.id === "string" && doc.id ? doc.id : "main", title: saved.title, catalogId: typeof doc.catalogId === "string" ? doc.catalogId : analyticsCatalog.id, components: doc.components as SurfaceComponent[], data: doc.data, theme: doc.theme as PageDocument["theme"] })
          : Array.isArray(doc.messages)
            ? (doc.messages as SurfaceMessage[])
            : undefined;
        if (!next) throw new Error("The saved document is neither a page nor a list of messages.");
        setTab("a2ui");
        setA2uiText(pretty(next));
        setTitle(saved.title);
        setKindWord(surfaceKindWord(saved.kind));
        setLoaded({ id: saved.id, version: saved.version, title: saved.title, kind: saved.kind });
        lastSaved.current = "";
        setLoadStatus(`Opened "${saved.title}", version ${saved.version}.`);
        remember({ kind: "load", title: `Opened "${saved.title}"`, detail: `Version ${saved.version}, ${next.length} messages.` });
      } catch (error) {
        setLoadStatus(`Could not open "${id}": ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [source.library, remember],
  );
  useEffect(() => {
    void open(surfaceFromHash());
    const onHash = () => void open(surfaceFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [open]);

  // Saving uses every message, not only the ones stepped to.
  // biome-ignore lint/correctness/useExhaustiveDependencies: messagesKey stands for messages.
  const final = useMemo(() => applyFirst(messages, total), [messagesKey, total]);
  const finalSurface = final.surfaces[surfaceId] ?? Object.values(final.surfaces).pop();
  // What a person did on the surface counts only when the surface drawn is the final one.
  const allApplied = applied === total && (!finalSurface || finalSurface.surfaceId === surfaceId);
  const page = finalSurface ? toPage(finalSurface, title.trim() || "Untitled", allApplied ? controls : {}, allApplied ? typed : undefined) : undefined;
  const changedOnScreen = allApplied && (Object.keys(controls).length > 0 || typed !== undefined);
  // The document last saved, so pressing Save again with nothing changed makes no new version.
  const lastSaved = useRef("");
  const guessed = page ? surfaceKind(page) : "other";
  const kind = kindWord || guessed;
  const [saveStatus, setSaveStatus] = useState<{ text: string; link?: string; error?: boolean }>({ text: "" });
  const save = async () => {
    const name = title.trim();
    if (!name) return setSaveStatus({ text: "Give the surface a title first.", error: true });
    const document = (page ? { ...page, title: name } : { catalogId: analyticsCatalog.id, messages }) as unknown as SavedDocument;
    const key = JSON.stringify({ document, kind, id: loaded?.id ?? "" });
    if (loaded && key === lastSaved.current) {
      return setSaveStatus({ text: `No changes since version ${loaded.version}, so nothing was saved.`, link: `#library?surface=${encodeURIComponent(loaded.id)}` });
    }
    try {
      const { surface: saved } = await source.library.saveSurface({
        surface: { id: loaded?.id ?? "", kind: surfaceKindOf(kind), title: name, document, savedBy: "playground", tags: ["composer"] },
        expectedVersion: loaded?.version ?? 0,
        note: page ? "Saved from the playground" : "Saved from the playground as messages (no root component)",
      });
      if (!saved) throw new Error("The library did not return the saved surface.");
      setLoaded({ id: saved.id, version: saved.version, title: saved.title, kind: saved.kind });
      lastSaved.current = JSON.stringify({ document, kind, id: saved.id });
      // The address names the surface, so a reload or another dataset goes on saving versions of it, not a copy.
      window.history.replaceState(null, "", `${location.pathname}${location.search}#composer?surface=${encodeURIComponent(saved.id)}`);
      remember({ kind: "save", title: `Saved "${saved.title}"`, detail: `${surfaceKindLabel(saved.kind)}, version ${saved.version}.` });
      setSaveStatus({
        text: `Saved "${saved.title}" as a ${surfaceKindLabel(saved.kind).toLowerCase()}, version ${saved.version}${page ? "" : ", as messages"}${changedOnScreen ? ", with what you changed on the surface" : ""}.`,
        link: `#library?surface=${encodeURIComponent(saved.id)}`,
      });
    } catch (error) {
      setSaveStatus({ text: error instanceof StaleSurfaceError ? error.message : `Not saved: ${error instanceof Error ? error.message : String(error)}`, error: true });
    }
  };

  // What the agent sees and how its messages come back. The refs hold the latest values for a turn that started earlier.
  const current = useRef({ tab, a2uiText, messages, final, surfaceId, dataShown, controls });
  current.current = { tab, a2uiText, messages, final, surfaceId, dataShown, controls };
  const workingRef = useRef(working.tables);
  workingRef.current = working.tables;
  const agent = useComposerAgent({
    source,
    focus,
    ...(real ? { outline: () => tablesOutline(source.sourceId, engineLabel(source), workingRef.current) } : {}),
    state: () => {
      const c = current.current;
      const shown = c.final.surfaces[c.surfaceId] ?? Object.values(c.final.surfaces).pop();
      // What the person did since the last turn goes with this one, and is not told again.
      const done = activity.current;
      activity.current = [];
      return { surfaceId: shown?.surfaceId ?? "main", components: shown ? Object.values(shown.components) : [], existing: new Set(Object.keys(c.final.surfaces)), dataModel: c.dataShown, controls: c.controls, activity: done };
    },
    append: (added) => {
      const c = current.current;
      // A json-render spec cannot hold A2UI updates, so the spec is converted and the composer moves to messages.
      const before = c.tab === "a2ui" ? c.a2uiText : pretty(c.messages);
      setA2uiText(pretty([...c.messages, ...added]));
      setTab("a2ui");
      return before;
    },
    onTurn: (turn) =>
      remember({
        kind: "agent",
        title: turn.label,
        detail: [turn.added ? `Added ${turn.added} message${turn.added === 1 ? "" : "s"}.` : "No change to the surface.", turn.generatedBy && `By ${turn.generatedBy}.`, turn.error].filter(Boolean).join(" "),
        ...(turn.before !== undefined ? { before: turn.before } : {}),
      }),
  });
  const starters = useMemo(() => (real ? REAL_STARTERS : demoPageStarters(focus)), [real, focus]);

  // Adding a catalog component by hand: its example, rewritten for the picked dataset, goes on the end of the root.
  const [addName, setAddName] = useState("Chart");
  const [addStatus, setAddStatus] = useState<{ text: string; error?: boolean }>({ text: "" });
  const addComponent = () => {
    const c = current.current;
    const shown = c.final.surfaces[c.surfaceId] ?? Object.values(c.final.surfaces).pop();
    // On a real source a data component is drawn from the table in hand, or not at all: nothing is guessed about the data.
    const fromTable = real ? tableProps(addName, source.sourceId, handTable, working.tables) : undefined;
    if (fromTable && "missing" in fromTable) return setAddStatus({ text: fromTable.missing, error: true });
    const result = addComponentMessages(shown, shown?.surfaceId ?? "main", addName, fromTable ? fromTable.props : exampleProps(addName, source));
    if ("error" in result) return setAddStatus({ text: result.error, error: true });
    const before = c.tab === "a2ui" ? c.a2uiText : pretty(c.messages);
    setA2uiText(pretty([...c.messages, ...result.messages]));
    setTab("a2ui");
    setAddStatus({ text: `Added ${addName} as "${result.id}" at the end of the surface. Change it under Components, or ask the agent.` });
    remember({ kind: "edit", title: `Added ${addName}`, detail: `As "${result.id}".`, before });
  };
  /** Adds messages that change the surface by hand, as one step that History can take back. */
  const applyEdit = (added: SurfaceMessage[], title: string, detail?: string) => {
    const c = current.current;
    const before = c.tab === "a2ui" ? c.a2uiText : pretty(c.messages);
    setA2uiText(pretty([...c.messages, ...added]));
    setTab("a2ui");
    remember({ kind: "edit", title, ...(detail ? { detail } : {}), before });
  };

  // Starting over: an empty surface, a new conversation, and nothing saved yet. History can bring the old messages back.
  const newSurface = () => {
    const c = current.current;
    const before = c.tab === "a2ui" ? c.a2uiText : pretty(c.messages);
    const name = real ? `${sourceLabel}: new surface` : "New surface";
    setA2uiText(pretty(blankMessages(name)));
    setSpecText(pretty({ root: "heading", elements: { heading: { type: "Heading", props: { text: name } } } }));
    setTab("a2ui");
    setLoaded(undefined);
    lastSaved.current = "";
    setLoadStatus("");
    setSaveStatus({ text: "" });
    setTitle(real ? `${sourceLabel} surface` : "New surface");
    setAddStatus({ text: "" });
    setOpenComponent("");
    agent.newConversation();
    window.history.replaceState(null, "", `${location.pathname}${location.search}#composer`);
    remember({ kind: "edit", title: "Started a new surface", detail: "The surface before it can be restored from here.", before });
  };

  // One component at a time: edit its props, point it at the table in hand, or take it off the surface.
  const [openComponent, setOpenComponent] = useState("");
  const [draftProps, setDraftProps] = useState<Record<string, unknown>>({});
  const [componentStatus, setComponentStatus] = useState<{ text: string; error?: boolean }>({ text: "" });
  const outline = useMemo(() => surfaceOutline(finalSurface), [finalSurface]);
  const propsOf = (id: string) => {
    const { id: _id, component: _component, ...props } = finalSurface?.components[id] ?? { id, component: "" };
    return props as Record<string, unknown>;
  };
  const toggleComponent = (id: string) => {
    setComponentStatus({ text: "" });
    setOpenComponent((open) => (open === id ? "" : id));
    setDraftProps(propsOf(id));
  };
  const setComponent = (id: string, props: Record<string, unknown>, title: string) => {
    const result = setComponentMessages(finalSurface, id, props);
    if ("error" in result) return setComponentStatus({ text: result.error, error: true });
    applyEdit(result.messages, title);
    setDraftProps(props);
    setComponentStatus({ text: `${title}.` });
  };
  const removeComponent = (id: string) => {
    const result = removeComponentMessages(finalSurface, id);
    if ("error" in result) return setComponentStatus({ text: result.error, error: true });
    applyEdit(result.messages, `Removed "${id}"`);
    if (openComponent === id) setOpenComponent("");
    setComponentStatus({ text: `Removed "${id}". History can bring it back.` });
  };
  // Arranging the surface by hand: move, put side by side, and resize, by pointer (touch included) or keyboard.
  const arrange = useArrange({
    surface: finalSurface,
    apply: (added, title) => applyEdit(added, title),
    say: setComponentStatus,
    remove: (id) => removeComponent(id),
    resizeWhileViewing: true,
  });
  const stepComponent = arrange.step;

  const useTable = (id: string, kind: string) => {
    const made = tableProps(kind, source.sourceId, handTable, working.tables);
    if (!made) return;
    if ("missing" in made) return setComponentStatus({ text: made.missing, error: true });
    const height = finalSurface?.components[id]?.height;
    setComponent(id, { ...made.props, ...(height !== undefined ? { height } : {}) }, `Pointed "${id}" at ${handTable ? tableSqlName(handTable) : "the table"}`);
  };
  const componentsCard = (
    <section className="card" aria-label="Components">
      <p className="hint">
        Everything drawn on the surface, from the top. Change or remove one without touching the rest; each change is one step in History.
        {real && (handTable ? ` "Use table" points a data component at ${tableSqlName(handTable)}, the table in hand.` : " Pick a table under Tables to point a data component at it.")}
      </p>
      {componentStatus.text && (
        <p className={componentStatus.error ? "catalog-error" : "hint"} role={componentStatus.error ? "alert" : "status"}>
          {componentStatus.text}
        </p>
      )}
      {outline.length === 0 ? (
        <p className="hint">Nothing is drawn yet.</p>
      ) : (
        <ul className="composer-components">
          {outline.map((item) => {
            const open = openComponent === item.id;
            const usesTable = real && tableProps(item.component, source.sourceId, handTable, working.tables) !== undefined;
            return (
              <li key={item.id} className="composer-component" data-open={open || undefined} style={{ marginInlineStart: `calc(${Math.min(item.depth, 4)} * var(--sf-space-3))` }}>
                <div className="composer-component-head">
                  <span className="composer-component-name">
                    <strong>{item.component}</strong>
                    <code>{item.id}</code>
                  </span>
                  <span className="composer-component-actions">
                    <button type="button" className="btn" aria-expanded={open} aria-label={`Edit ${item.component} ${item.id}`} onClick={() => toggleComponent(item.id)}>
                      {open ? "Close" : "Edit"}
                    </button>
                    {usesTable && (
                      <button type="button" className="btn" aria-label={`Use the table in hand for ${item.component} ${item.id}`} onClick={() => useTable(item.id, item.component)}>
                        Use table
                      </button>
                    )}
                    {(() => {
                      // Earlier and later among the container's components: the same move as dragging it on the surface.
                      const place = placeOfComponent(finalSurface, item.id);
                      return place ? (
                        <>
                          <button type="button" className="btn" disabled={place.index === 0} aria-label={`Move ${item.component} ${item.id} earlier`} onClick={() => stepComponent(item.id, -1)}>
                            Up
                          </button>
                          <button type="button" className="btn" disabled={place.index >= place.count - 1} aria-label={`Move ${item.component} ${item.id} later`} onClick={() => stepComponent(item.id, 1)}>
                            Down
                          </button>
                        </>
                      ) : null;
                    })()}
                    {item.id !== "root" && (
                      <button type="button" className="btn" aria-label={`Remove ${item.component} ${item.id}`} onClick={() => removeComponent(item.id)}>
                        Remove
                      </button>
                    )}
                  </span>
                </div>
                {open && (
                  <form
                    aria-label={`Props of ${item.id}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      setComponent(item.id, draftProps, `Changed "${item.id}"`);
                    }}
                  >
                    <SchemaForm schema={PROPS_SCHEMA[item.component] ?? {}} value={draftProps} skip={["id", "component"]} onChange={setDraftProps} />
                    <div className="actions">
                      <button type="submit" className="btn primary">
                        Apply changes
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const onAction = (action: SurfaceAction) => {
    const sent = agent.sendEvent(action);
    remember({ kind: "event", title: `Event "${action.name}" from ${action.sourceComponentId}`, detail: `${JSON.stringify(action.context ?? {})}${sent === "sent" ? " Sent to the agent." : ""}` });
  };

  const allProblems = [...problems, ...drawProblems.map((p) => ({ path: `surface ${p.surfaceId}${p.path}`, message: p.message }))];

  // The JSON panel, here and in a popped-out window: one state, edited from either.
  const panelState = useMemo(() => ({ tab, a2uiText, specText, step: applied, loadStatus }), [tab, a2uiText, specText, applied, loadStatus]);
  const editPanel = useCallback((change: ComposerEdit) => {
    if (change.tab !== undefined) setTab(change.tab);
    if (change.a2uiText !== undefined) setA2uiText(change.a2uiText);
    if (change.specText !== undefined) setSpecText(change.specText);
    if (change.step !== undefined) setStep(change.step);
  }, []);
  const host = useComposerHost(panelState, editPanel);
  const resetExample = () => (tab === "a2ui" ? setA2uiText(pretty(startMessages())) : setSpecText(pretty(startSpec())));

  const tablesCard = real ? (
    <section className="card composer-tables" aria-label="Tables in use">
      <div className="card-head">
        <h2>Tables in use</h2>
        <span className="badge">{engineLabel(source)}</span>
      </div>
      <p className="hint">Pick the tables to build with. The agent is told their columns and types (never values), and Add draws from the one in hand. Drag a table or column onto the agent's instruction box to say what an instruction is about.</p>
      <ObjectBrowser sourceId={source.sourceId} discovery={source.discovery} height={240} attachLabel="Add to the instruction" onAttach={(refs) => setAttached((now) => addDataRefs(now, refs))} onSelect={(item) => item.kind === "table" && item.table && void working.add({ catalog: item.catalog, schema: item.schema, table: item.table })} />
      {working.status.text && (
        <p className={working.status.error ? "catalog-error" : "hint"} role={working.status.error ? "alert" : "status"}>
          {working.status.text}
        </p>
      )}
      {working.tables.length === 0 ? (
        <p className="hint">None yet. Open a database above and pick a table.</p>
      ) : (
        <ul className="composer-tables-list">
          {working.tables.map((t) => {
            const name = tableSqlName(t);
            return (
              <li key={name}>
                <label className="inline">
                  <input type="radio" name="table-in-hand" checked={handTable === t} onChange={() => setInHand(name)} />
                  <span className="composer-tables-name">{name}</span>
                </label>
                <span className="hint">{t.columns.length} columns</span>
                <button type="button" className="btn" aria-label={`Stop using ${name}`} onClick={() => working.remove(t)}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  ) : undefined;

  const saveCard = (
      <section className="card composer-save-card" aria-label="Save">
        <div className="card-head">
          <h2>Save to the library</h2>
          {loaded && <span className="hint">Editing "{loaded.title}", version {loaded.version}</span>}
        </div>
        <form
          className="composer-save"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            <span>Title</span>
            <input type="text" value={title} required onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <span>Kind</span>
            <select value={kind} onChange={(e) => setKindWord(e.target.value)}>
              {surfaceKinds.map((k) => (
                <option key={k.word} value={k.word}>
                  {k.label}
                  {k.word === guessed ? " (guessed)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn primary">
            {loaded ? "Save a new version" : "Save"}
          </button>
          {loaded && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setLoaded(undefined);
                setSaveStatus({ text: "The next save makes a new surface." });
              }}
            >
              Save as new instead
            </button>
          )}
        </form>
        <p className="hint">
          {page
            ? `Saved as a page document of ${page.components.length} components from surface "${page.id}" (all ${total} messages applied${changedOnScreen ? ", and what you changed on the surface" : ""}).`
            : "The messages make no surface with a root component, so they are saved as messages."}
        </p>
        {saveStatus.text && (
          <p className={saveStatus.error ? "catalog-error" : "hint"} role={saveStatus.error ? "alert" : "status"}>
            {saveStatus.text} {saveStatus.link && <a href={saveStatus.link}>Open in saved surfaces</a>}
          </p>
        )}
      </section>
  );

  const surfaceCard = (
      <section className="card" aria-label="Surface">
        <div className="card-head">
          <button type="button" className="btn" onClick={newSurface} title="An empty surface and a new conversation. History can bring this one back.">
            New surface
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={arrange.arranging}
            onClick={arrange.toggle}
            title="Drag components to rearrange them, or use the arrows on each"
          >
            {arrange.arranging ? "Done arranging" : "Arrange"}
          </button>
          <form
            className="composer-add"
            aria-label="Add a component"
            onSubmit={(event) => {
              event.preventDefault();
              addComponent();
            }}
          >
            <label className="inline">
              <span>Component</span>
              <select value={addName} onChange={(e) => setAddName(e.target.value)}>
                {GROUPS.map(([group, names]) => (
                  <optgroup key={group} label={group}>
                    {names
                      .filter((n) => analyticsCatalog.components[n] && n !== "ThemeSwitch")
                      .map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button type="submit" className="btn primary">
              Add
            </button>
          </form>
          {ids.length > 1 && (
            <label className="inline">
              <span>Show</span>
              <select value={surfaceId} onChange={(e) => setPicked(e.target.value)}>
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {addStatus.text && (
          <p className={addStatus.error ? "catalog-error" : "hint"} role={addStatus.error ? "alert" : "status"}>
            {addStatus.text}
          </p>
        )}
        {arrange.arranging && (
          <p className="hint" role="status">
            Arranging: drag a component by its bar and drop it above or below another, at either side to put the two side by side, or at the end of a container. The arrows move it one
            place; ✕ removes it. Drag the handle under a component to change its height, and the handle at its right edge in a row or grid to change the widths. Each change is one step in
            History.
            {componentStatus.text ? ` ${componentStatus.text}` : ""}
          </p>
        )}
        <div {...arrange.region} className={`catalog-preview sf-container ${arrange.region.className}`}>
          {surface ? (
            <MaybePipelines source={source}>
              <SurfaceView
                key={viewKey}
                surface={arrange.shown(surface)}
                catalog={analyticsCatalog}
                renderers={lazyAnalyticsRenderers}
                onAction={onAction}
                onProblem={(problem) => setDrawProblems((list) => [...list, problem])}
                onDataChange={setTyped}
                onControlsChange={(componentId, state) => setControls((all) => ({ ...all, [componentId]: state }))}
                onContext={(componentId, note) => {
                  activity.current = [...activity.current, { componentId, ...note, at: new Date().toISOString() }].slice(-40);
                }}
                {...(arrange.surfaceFrame ? { frame: arrange.surfaceFrame } : {})}
              />
            </MaybePipelines>
          ) : (
            <p className="hint">Nothing to draw yet: no surface has been created by the messages applied so far.</p>
          )}
        </div>
        <ArrangeGhost arrange={arrange} />
        <h3 className="catalog-sub">Problems</h3>
        {allProblems.length === 0 ? (
          <p className="hint" role="status">
            None: every message applied so far passes the catalog.
          </p>
        ) : (
          <ul className="catalog-problems" role="alert">
            {allProblems.map((p, i) => (
              <li key={i}>
                <code>{p.path}</code>: {p.message}
              </li>
            ))}
          </ul>
        )}
      </section>
  );

  const panels: WorkspacePanel[] = [
    { id: "surface", title: "Surface", icon: "surface", content: surfaceCard },
    ...composerPanels({
      save: saveCard,
      tables: tablesCard,
      files: (
        <div className="composer-panel-body">
          <FilesPanel source={source} height={360} attachLabel="Add to the instruction" onAttach={(refs) => setAttached((now) => addDataRefs(now, refs))} />
        </div>
      ),
      json: <ComposerPanel state={panelState} edit={editPanel} onReset={resetExample} onPopOut={host.popOut} poppedOut={host.poppedOut} />,
      components: componentsCard,
      ...(real
        ? {
            opening: {
              text: `You are on **${sourceLabel}**. I can look at what is there and set up a first surface with you: nothing is drawn from this source until we know its tables. Where do you want to start?`,
              choices: onboarding(sourceLabel, source.sourceId, working.tables),
              ...(agent.picked.kind === "scripted" ? { blocked: "The scripted demo agent only knows the sample data. Pick a model above first." } : {}),
            },
          }
        : {}),
      agent,
      attached,
      onAttachedChange: setAttached,
      starters,
      dataModel: dataShown,
      dataNote: typed === undefined ? "As the messages set it." : "Including what was typed into the surface.",
      controls,
      history,
      onRestore: (entry) => {
        if (entry.before === undefined) return;
        setTab("a2ui");
        setA2uiText(entry.before);
        remember({ kind: "restore", title: `Restored the messages from before "${entry.title}"` });
      },
      onClearHistory: () => setHistory([]),
    }),
  ];

  // The surface and the agent show to begin with; the rail brings in the rest. A person's arrangement is kept in this browser.
  return (
    <Workspace
      className="composer-workspace"
      label="Playground panels"
      panels={panels}
      layout={panelLayout}
      onLayoutChange={(next) => {
        setPanelLayout(next);
        savePanelLayout(next);
      }}
      railLabels={railNames}
      onRailLabelsChange={(names) => {
        setRailNames(names);
        try {
          localStorage.setItem(RAIL_KEY, String(names));
        } catch {
          // Storage is off: the choice lasts for this page only.
        }
      }}
      height="max(30rem, calc(100dvh - 7.5rem - var(--shell-bar, 0px)))"
    />
  );
}
