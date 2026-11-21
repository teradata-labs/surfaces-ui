import { Component, type ReactNode, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { INSPECT_COMPONENT, INSPECT_MARK, INSPECT_POINTED, type Recorder, type TraceScope, diffJson, newHolder, newSpanId, newTraceId, plain, recordMessage } from "@surfaces-ui/trace";
import { TraceScopeProvider, useRecorder } from "@surfaces-ui/trace/react";
import { ThemeProvider, useOptionalTheme } from "@surfaces-ui/components";
import { type ThemeRequest, applyThemeRequest, defaultTheme } from "@surfaces-ui/tokens";
import { type Catalog, type ValidationIssue, contractSchema, eventContextSchema, isComponentIssue } from "../catalog.js";
import { A2UI_VERSION, type Action, type ChildList, type FunctionImpl, absolutePath, getPath, resolve, setPath } from "../dynamic.js";
import { type Surface, type SurfaceAction, type SurfaceComponent, SurfaceError, type SurfaceMessage, type Surfaces, applyMessage, upgradeSurface } from "../surface.js";
import { upgradeMessage } from "../upgrade.js";

/** What a component renderer receives. */
export interface RenderProps {
  /** The component's props with bindings and function calls replaced by values. */
  props: Record<string, unknown>;
  /** The component exactly as the agent sent it. */
  component: SurfaceComponent;
  /** Renders one child by ID. */
  child(id: unknown): ReactNode;
  /** Renders a child list, including a template repeated over a data list. */
  children(list: unknown): ReactNode[];
  /**
   * Runs an action declared on this component. `extra` adds what the person
   * did (the option chosen, the SQL run) to the event's context.
   */
  dispatch(action: unknown, extra?: Record<string, unknown>): void;
  /**
   * Writes a value into this surface's data model, as an input does while a
   * person types. `target` is a binding (`{ path }`) or a path; relative
   * paths resolve against the current item. The write stays in this view
   * (reported through `onDataChange`); nothing is sent to the agent until a
   * control sends an event.
   */
  setData(target: unknown, value: unknown): void;
  /**
   * Reports how a person left this component's controls (sorts, filters,
   * columns, view), in the shape of its catalog props, so the host can keep
   * it and give it to the agent. An agent sets the same props to change them.
   */
  reportControls(state: Record<string, unknown>): void;
  /**
   * Tells the host something a person did in this component (added a view,
   * changed a field, clicked a bar), for the agent's context on its next
   * turn. Unlike `dispatch`, it starts no turn and needs no `action`.
   */
  reportContext(note: SurfaceNote): void;
}

/** Something a person did in a component, for an agent's context. */
export interface SurfaceNote {
  /** A dotted word: "view.added", "filter.changed". */
  kind: string;
  /** The same in a sentence. */
  summary: string;
  /** What it was about, as plain data. */
  subject?: Record<string, unknown>;
}

export type ComponentRenderer = (props: RenderProps) => ReactNode;

export interface SurfaceProblem {
  /**
   * CONTRACT_FAILED: an event did not match what the agent said it expects; it was not sent.
   * RENDER_FAILED: a component threw while it was being drawn; a notice is shown in its place.
   */
  code: "VALIDATION_FAILED" | "UNKNOWN_SURFACE" | "INVALID_MESSAGE" | "SURFACE_EXISTS" | "UNDECLARED_EVENT" | "CONTRACT_FAILED" | "RENDER_FAILED";
  surfaceId: string;
  path: string;
  message: string;
}

export interface SurfaceViewProps {
  surface: Surface;
  catalog: Catalog;
  /** React implementation for each catalog component. */
  renderers: Record<string, ComponentRenderer>;
  /** Called when a person uses a control that sends an event to the agent. */
  onAction?(action: SurfaceAction): void;
  /** Called when the agent sent something the catalog does not allow. */
  onProblem?(problem: SurfaceProblem): void;
  /** Called with the whole data model after a person changes it through an input. */
  onDataChange?(data: unknown): void;
  /** Called when a person changes a component's controls, with its id and the control props now in force. */
  onControlsChange?(componentId: string, state: Record<string, unknown>): void;
  /**
   * Told what a person does in the surface as they do it: a note per
   * action, with the component it happened in. Keep them and send them with
   * the agent's next turn (`SurfaceState.activity`); `useChat` does. Nothing
   * is sent to the agent by this alone.
   */
  onContext?(componentId: string, note: SurfaceNote): void;
  /**
   * For an editor: wraps each drawn component in the editor's own frame (a
   * handle to drag it by, an outline). It is given the component as the agent
   * sent it and what was drawn, and returns what to put in its place. It
   * changes nothing about the surface: the checks, the data and the events
   * are the same with or without it.
   */
  frame?(component: SurfaceComponent, drawn: ReactNode): ReactNode;
  className?: string;
}

const Depth = createContext(0);

/** Runs one renderer as a component of its own, so renderers may use hooks. */
function Rendered({ render, args }: { render: ComponentRenderer; args: RenderProps }) {
  return render(args);
}
const MAX_DEPTH = 48;

/**
 * A whole surface as the one `createSurface` message that would draw it. For dev tools: a surface that was not
 * built from recorded messages (a saved page, a restored conversation) is recorded this way, so it can be drawn again.
 */
export function surfaceSnapshot(surface: Surface): SurfaceMessage {
  const { surfaceId, catalogId, sendDataModel, metadata } = surface;
  return { version: A2UI_VERSION, createSurface: { surfaceId, catalogId, ...(sendDataModel ? { sendDataModel } : {}), components: Object.values(surface.components), dataModel: surface.data, ...(metadata ? { metadata } : {}) } };
}

/**
 * Keeps one component that throws while it is drawn from taking the rest of
 * the surface, or the page, with it: the usual notice is shown in its place
 * and the failure is reported. A component sent again is tried again.
 */
class ComponentBoundary extends Component<{ label: string; component: SurfaceComponent; onError(error: Error): void; children: ReactNode }, { failed?: string; of?: SurfaceComponent }> {
  override state: { failed?: string; of?: SurfaceComponent } = {};
  static getDerivedStateFromError(error: unknown) {
    return { failed: error instanceof Error ? error.message : String(error) };
  }
  static getDerivedStateFromProps(props: { component: SurfaceComponent }, state: { failed?: string; of?: SurfaceComponent }) {
    // The agent sent the component again: forget the failure and draw it.
    if (state.of === props.component) return null;
    return { of: props.component, ...(state.of ? { failed: undefined } : {}) };
  }
  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  override render() {
    return this.state.failed !== undefined ? <Notice text={`${this.props.label} could not be drawn: ${this.state.failed}`} /> : this.props.children;
  }
}

/** With a recorder above: records that a component was drawn, once, and makes what it does (its service calls) children of it. */
function Drawn({ recorder, scope, held, surfaceKey, kind, children }: { recorder: Recorder; scope: TraceScope; held: HeldScopes; surfaceKey: string; kind: string; children: ReactNode }) {
  return (
    <TraceScopeProvider scope={scope}>
      <DrawnMark recorder={recorder} scope={scope} held={held} surfaceKey={surfaceKey} kind={kind} />
      <InspectMark recorder={recorder} surfaceKey={surfaceKey} componentId={scope.componentId} />
      {children}
    </TraceScopeProvider>
  );
}

/** Draws nothing. It sits before the component so that its effect, which records the component, runs before the component's own. */
function DrawnMark({ recorder, scope, held, surfaceKey, kind }: { recorder: Recorder; scope: TraceScope; held: HeldScopes; surfaceKey: string; kind: string }) {
  useEffect(() => {
    // A scope's span is the id of its one event, so whether it was recorded is kept with the scope and not with this
    // mark: a component that is mounted again under the same scope (a frame put around it, an effect run twice) is
    // not recorded twice, which would put two events with one id in the log.
    const place = held.places.get(scope);
    if (place !== undefined) held.scopes.set(place, scope);
    if (!held.recorded.has(scope)) {
      held.recorded.add(scope);
      recorder.record({ kind: "component", name: `${kind} "${scope.componentId}"`, spanId: scope.spanId, detail: { component: kind } }, { traceId: scope.traceId, spanId: recorder.surfaceScope(surfaceKey)?.spanId, surfaceId: scope.surfaceId, componentId: scope.componentId });
    }
    // Once the component is gone its scope is let go, so one drawn there later is a new span and is recorded again.
    return () => {
      if (place !== undefined && held.scopes.get(place) === scope) held.scopes.delete(place);
    };
  }, [recorder, scope, held, surfaceKey, kind]);
  return null;
}

/** The scopes a view holds for what it draws: by place, the place of each, and which have been recorded as drawn. */
interface HeldScopes {
  scopes: Map<string, TraceScope>;
  places: WeakMap<TraceScope, string>;
  recorded: WeakSet<TraceScope>;
}

/**
 * Draws nothing until a tool points at this component, or a person is picking one on the page. Then it puts one
 * hidden, empty `template` before it, so the tool can find the component's element (the next element) without the
 * component being wrapped. A `template` is allowed wherever an element is, takes no room and is not a flex or grid item.
 */
function InspectMark({ recorder, surfaceKey, componentId }: { recorder: Recorder; surfaceKey: string; componentId: string | undefined }) {
  const standing = () => {
    const target = recorder.inspected();
    if (target !== undefined && target.surfaceKey === surfaceKey && target.componentId === componentId) return 2;
    return recorder.picking() ? 1 : 0;
  };
  const state = useSyncExternalStore(recorder.onInspect, standing, () => 0);
  if (state === 0 || componentId === undefined) return null;
  return <template {...{ [INSPECT_MARK]: surfaceKey, [INSPECT_COMPONENT]: componentId, ...(state === 2 ? { [INSPECT_POINTED]: "" } : {}) }} />;
}

/**
 * Draws one A2UI surface with a catalog's components. Every component is
 * checked against the catalog before it is drawn; anything unknown or
 * malformed is shown as a small notice instead of being rendered, so agent
 * output can never introduce markup or behaviour the catalog does not define.
 */
export function SurfaceView({ surface: given, catalog, renderers, onAction, onProblem, onDataChange, onControlsChange, onContext, frame, className }: SurfaceViewProps) {
  // A surface kept before the move to A2UI v1.0 is read in its current form; a current one is used as it is.
  const surface = useMemo(() => upgradeSurface(given), [given]);
  // Dev tools: with a recorder above, what this view does is recorded. Without one, none of this runs.
  const recorder = useRecorder();
  const viewId = useRef<string | undefined>(undefined);
  const viewTrace = useRef<string | undefined>(undefined);
  // A surface built from messages is known to the recorder by its host's key; one handed over whole is recorded here.
  const tagged = recorder?.keyOf(given);
  const traceKey = recorder ? (tagged ?? `${(viewId.current ??= newHolder("v"))}:${surface.surfaceId}`) : undefined;
  const snapshot = useRef("");
  useLayoutEffect(() => {
    if (!recorder || tagged !== undefined || traceKey === undefined) return;
    const raw = surfaceSnapshot(surface);
    const text = JSON.stringify(plain(raw));
    if (text === snapshot.current) return;
    snapshot.current = text;
    recordMessage(recorder, { format: "surface", key: traceKey, raw, snapshot: true, name: "surface" }, { traceId: (viewTrace.current ??= newTraceId()) });
  }, [recorder, tagged, traceKey, surface]);
  const held = useRef<HeldScopes>({ scopes: new Map(), places: new WeakMap(), recorded: new WeakSet() });
  // One scope for each component drawn: its place, its id and its kind, so another kind under the same id is another span.
  const scopeOf = (id: string, place: string, kind: string): TraceScope | undefined => {
    if (!recorder || traceKey === undefined) return undefined;
    const key = `${traceKey}|${place}|${id}|${kind}`;
    let scope = held.current.scopes.get(key);
    if (!scope) {
      const built = tagged !== undefined;
      let trace: string | undefined;
      scope = {
        spanId: newSpanId(),
        surfaceId: traceKey,
        componentId: id,
        // Found when first needed, which is after the messages that built the surface have been recorded: the trace that drew it.
        get traceId() {
          return (trace ??= (built ? recorder.surfaceScope(traceKey)?.traceId : undefined) ?? (viewTrace.current ??= newTraceId()));
        },
      };
      held.current.scopes.set(key, scope);
      held.current.places.set(scope, key);
    }
    return scope;
  };
  const lastControls = useRef(new Map<string, string>());
  // Problems found while drawing are recorded once drawing is done.
  const found = useRef<{ problem: SurfaceProblem; scope?: TraceScope }[]>([]);
  const recordProblem = (problem: SurfaceProblem, scope?: TraceScope) =>
    recorder?.record({ kind: "problem", name: problem.code, status: "error", surfaceId: traceKey, detail: { code: problem.code, path: problem.path, message: problem.message } }, scope ?? (traceKey !== undefined ? recorder.surfaceScope(traceKey) : undefined));
  useEffect(() => {
    for (const { problem, scope } of found.current.splice(0)) recordProblem(problem, scope);
  });
  const report = (problem: SurfaceProblem, scope?: TraceScope, drawing = false) => {
    if (recorder && drawing) found.current.push({ problem, scope });
    else recordProblem(problem, scope);
    onProblem?.(problem);
  };
  const controlsReported = useRef(onControlsChange);
  controlsReported.current = onControlsChange;
  const contextReported = useRef(onContext);
  contextReported.current = onContext;
  // The agent's contract, compiled once per surface.
  const contracts = useMemo(() => {
    const out = new Map<string, ReturnType<typeof contractSchema>>();
    for (const [event, schema] of Object.entries(surface.expects ?? {})) out.set(event, contractSchema(schema));
    return out;
  }, [surface.expects]);
  // What a person typed, kept as writes over the agent's data model so a
  // later updateDataModel from the agent does not wipe a half-filled form.
  const [writes, setWrites] = useState<{ surfaceId: string; values: [string, unknown][] }>({ surfaceId: surface.surfaceId, values: [] });
  const local = writes.surfaceId === surface.surfaceId ? writes.values : [];
  const data = useMemo(() => local.reduce<unknown>((model, [path, value]) => setPath(model, path, value), surface.data), [surface.data, local]);
  const reported = useRef(onDataChange);
  reported.current = onDataChange;
  const changed = useRef(false);
  useEffect(() => {
    if (changed.current) reported.current?.(data);
    changed.current = false;
  }, [data]);
  const write = useCallback(
    (path: string, value: unknown, scope?: TraceScope) => {
      recorder?.record({ kind: "state", name: "data.write", surfaceId: traceKey, detail: { path, value } }, scope);
      changed.current = true;
      setWrites((previous) => {
        const values = previous.surfaceId === surface.surfaceId ? previous.values.filter(([p]) => p !== path && !p.startsWith(`${path}/`)) : [];
        return { surfaceId: surface.surfaceId, values: [...values, [path, value]] };
      });
    },
    [surface.surfaceId, recorder, traceKey],
  );
  const functions = useMemo(
    () => Object.fromEntries(Object.entries(catalog.functions).map(([name, fn]) => [name, fn.implementation])) as Record<string, FunctionImpl>,
    [catalog],
  );
  const checked = useMemo(() => new Map<SurfaceComponent, ValidationIssue[]>(), [catalog]);

  const node = (id: unknown, scope: string, trail: string[]): ReactNode => {
    if (typeof id !== "string") return null;
    const component = Object.hasOwn(surface.components, id) ? surface.components[id] : undefined;
    // A child that has not arrived yet is normal while a surface streams in.
    if (!component) return null;
    if (trail.includes(id) || trail.length > MAX_DEPTH) return <Notice key={id} text={`"${id}" contains itself.`} />;
    const traced = scopeOf(id, scope, component.component);

    let issues = checked.get(component);
    if (!issues) {
      issues = catalog.validateComponent(component);
      checked.set(component, issues);
      for (const issue of issues) report({ code: "VALIDATION_FAILED", surfaceId: surface.surfaceId, path: `/${id}${issue.path}`, message: issue.message }, traced, true);
    }
    const render = Object.hasOwn(renderers, component.component) ? renderers[component.component] : undefined;
    if (issues.length > 0 || !render) {
      return <Notice key={id} text={issues[0] ? `${component.component} "${id}": ${issues[0].path} ${issues[0].message}` : `No renderer for ${component.component}.`} />;
    }

    const context = { data, scope, functions };
    // The envelope keys (`@catalogId`, `@accessibility`, `@metadata`) are not props: a renderer never receives them and nothing in them is resolved.
    const { id: _id, component: _name, action: _action, child: _child, children: _children, ...own } = component;
    const rest = Object.fromEntries(Object.entries(own).filter(([key]) => !key.startsWith("@")));
    const next = [...trail, id];
    const dispatch = (declared: unknown, extra?: Record<string, unknown>) => {
      const action = declared as Action | undefined;
      if (!action) return;
      if ("functionCall" in action) {
        const fn = Object.hasOwn(catalog.functions, action.functionCall["@call"]) ? catalog.functions[action.functionCall["@call"]] : undefined;
        // Only functions marked as actions may run from a control.
        if (fn?.action) resolve(action.functionCall, context);
        return;
      }
      const declared_ = catalog.components[component.component]?.events;
      if (declared_ && extra) {
        const allowed = new Set(Object.values(declared_).flatMap((event) => Object.keys(event.context ?? {})));
        for (const key of Object.keys(extra)) {
          if (!allowed.has(key)) report({ code: "UNDECLARED_EVENT", surfaceId: surface.surfaceId, path: `/${id}`, message: `${component.component} sent "${key}", which its catalog entry does not declare.` }, traced);
        }
        // What the component adds must have the types its catalog entry publishes.
        const fits = Object.values(declared_).some((event) => eventContextSchema(event).safeParse(extra).success);
        if (!fits) report({ code: "UNDECLARED_EVENT", surfaceId: surface.surfaceId, path: `/${id}`, message: `${component.component} sent values that do not match its catalog entry's event types.` }, traced);
      }
      const name = action.event.name;
      const userMessage = action.event.userMessage === undefined ? undefined : resolve(action.event.userMessage, context);
      const full = { ...((resolve(action.event.context ?? {}, context) ?? {}) as Record<string, unknown>), ...extra };
      // The agent's own contract for this event: an event that does not match is not sent, and the agent is told why.
      const contract = contracts.get(name);
      if (contract) {
        const result = "error" in contract ? undefined : contract.schema.safeParse(full);
        if (!result || !result.success) {
          const detail = !result ? "error" in contract ? contract.error : "" : result.error.issues.map((i) => `${i.path.join("/") || "context"}: ${i.message}`).join("; ");
          recorder?.record({ kind: "event", name, status: "error", detail: { type: "action", context: full, contract: "failed", reason: detail, sent: false } }, traced);
          report({ code: "CONTRACT_FAILED", surfaceId: surface.surfaceId, path: `/${id}`, message: `"${name}" was not sent: it does not match what the agent expects. ${detail}` }, traced);
          return;
        }
      }
      recorder?.record({ kind: "event", name, status: onAction ? "ok" : "warning", detail: { type: "action", context: full, contract: contract ? "passed" : "none", sent: !!onAction, ...(typeof userMessage === "string" && userMessage ? { userMessage } : {}) } }, traced);
      onAction?.({
        name,
        surfaceId: surface.surfaceId,
        sourceComponentId: id,
        timestamp: new Date().toISOString(),
        context: full,
        ...(typeof userMessage === "string" && userMessage ? { userMessage } : {}),
        ...(surface.sendDataModel ? { dataModel: data } : {}),
      });
    };
    const setData = (target: unknown, value: unknown) => {
      const path = typeof target === "string" ? target : target && typeof target === "object" && typeof (target as { "@path"?: unknown })["@path"] === "string" ? (target as { "@path": string })["@path"] : undefined;
      if (path === undefined) return;
      write(absolutePath(path, scope), value, traced);
    };
    const children = (list: unknown): ReactNode[] => {
      const value = list as ChildList | undefined;
      if (Array.isArray(value)) return value.map((childId) => <Slot key={childId}>{node(childId, scope, next)}</Slot>);
      if (value && typeof value === "object" && typeof value.componentId === "string") {
        const base = absolutePath(value.path, scope);
        const items = getPath(data, base);
        if (!Array.isArray(items)) return [];
        // Templates are not added to the trail check per item; depth still bounds them.
        return items.map((_, index) => <Slot key={index}>{node(value.componentId, `${base === "/" ? "" : base}/${index}`, next)}</Slot>);
      }
      return [];
    };
    // Its own element, keyed by kind, so a renderer's hooks belong to this component and a swap starts fresh.
    const rendered = (
      <Rendered
          render={render}
          args={{
            props: resolve(rest, context) as Record<string, unknown>,
            component,
            child: (childId) => node(childId, scope, next),
            children,
            dispatch,
            setData,
            reportControls: (state) => {
              if (recorder && traced) {
                // Recorded when it differs from what was last reported, with what changed.
                const key = `${scope}|${id}`;
                const before = lastControls.current.get(key);
                const now = JSON.stringify(plain(state));
                if (before !== now) {
                  lastControls.current.set(key, now);
                  recorder.record({ kind: "state", name: "controls", detail: { controls: state, changed: diffJson(before === undefined ? {} : JSON.parse(before), JSON.parse(now)) } }, traced);
                }
              }
              controlsReported.current?.(id, state);
            },
            // A note is kept short whatever sent it: it is context for a model, not a payload.
            reportContext: (given) => {
              const note = { kind: String(given.kind).slice(0, 60), summary: String(given.summary).slice(0, 400), ...(given.subject && typeof given.subject === "object" ? { subject: given.subject } : {}) };
              recorder?.record({ kind: "event", name: `note: ${note.kind}`, detail: { type: "note", ...note, kept: !!contextReported.current } }, traced);
              contextReported.current?.(id, note);
            },
          }}
        />
    );
    const label = `${component.component} "${id}"`;
    const guarded = (
      <ComponentBoundary
        key={recorder && traced ? undefined : `${id}:${component.component}`}
        label={label}
        component={component}
        onError={(error) => report({ code: "RENDER_FAILED", surfaceId: surface.surfaceId, path: `/${id}`, message: `${label} could not be drawn: ${error.message}` }, traced)}
      >
        {rendered}
      </ComponentBoundary>
    );
    const drawn =
      recorder && traced && traceKey !== undefined ? (
        <Drawn key={`${id}:${component.component}`} recorder={recorder} scope={traced} held={held.current} surfaceKey={traceKey} kind={component.component}>
          {guarded}
        </Drawn>
      ) : (
        guarded
      );
    // Room the agent or a person gave this component's box, whatever kind it is.
    const least = typeof component.minHeight === "number" && component.minHeight > 0 ? component.minHeight : undefined;
    const boxed = least ? (
      <div className="sf-surface-sized" style={{ minHeight: least }}>
        {drawn}
      </div>
    ) : (
      drawn
    );
    return (
      <Slot key={id}>
        {frame ? frame(component, boxed) : boxed}
      </Slot>
    );
  };

  const body = (
    <div className={["sf-surface", "sf-container", className].filter(Boolean).join(" ")} data-surface={surface.surfaceId}>
      {Object.hasOwn(surface.components, "root") ? node("root", "/", []) : null}
    </div>
  );
  return surface.theme ? <SurfaceTheme request={surface.theme as ThemeRequest}>{body}</SurfaceTheme> : body;
}

/**
 * Draws a surface in the look its agent asked for, inside the surface only:
 * the page around it keeps its own theme. A request that cannot be honoured
 * is reported above the surface, and the readable parts still apply.
 */
function SurfaceTheme({ request, children }: { request: ThemeRequest; children: ReactNode }) {
  const host = useOptionalTheme();
  const base = host?.theme ?? defaultTheme;
  const key = JSON.stringify(request);
  const result = useMemo(() => applyThemeRequest(request, base), [key, base]); // eslint-disable-line react-hooks/exhaustive-deps
  const mode = result.mode ?? host?.mode ?? "system";
  return (
    <ThemeProvider key={`${key}:${JSON.stringify(base)}:${mode}`} scope="scoped" storage={null} initialTheme={result.theme} initialMode={mode}>
      {result.problems.map((problem) => (
        <p key={problem} className="sf-surface-notice" role="note">
          {problem}
        </p>
      ))}
      {children}
    </ThemeProvider>
  );
}

function Slot({ children }: { children: ReactNode }) {
  const depth = useContext(Depth);
  return <Depth.Provider value={depth + 1}>{children}</Depth.Provider>;
}

function Notice({ text }: { text: string }) {
  return (
    <p className="sf-surface-notice" role="note">
      {text}
    </p>
  );
}

export interface UseSurfaces {
  surfaces: Surfaces;
  /** Applies one or more messages. Invalid messages are reported, not applied. */
  apply(messages: SurfaceMessage | SurfaceMessage[]): void;
  reset(): void;
  problems: SurfaceProblem[];
}

/**
 * Holds the surfaces built up from a stream of A2UI messages. Each message
 * is validated against the catalog before it is applied.
 */
export function useSurfaces(catalog: Catalog, initial: SurfaceMessage[] = []): UseSurfaces {
  // Dev tools: with a recorder above, every message is recorded as it is applied.
  const recorder = useRecorder();
  const holder = useRef<string | undefined>(undefined);
  const reduce = useCallback(
    (state: { surfaces: Surfaces; problems: SurfaceProblem[] }, messages: SurfaceMessage[], note?: (message: SurfaceMessage, surfaceId: string, issues: ValidationIssue[], error?: { code: string; message: string }) => void) => {
      let { surfaces } = state;
      const problems = [...state.problems];
      for (const message of messages) {
        const body = Object.values(message).find((v) => v !== null && typeof v === "object") as { surfaceId?: string } | undefined;
        const surfaceId = body?.surfaceId ?? "";
        // A malformed envelope stops here; a malformed component is applied and reported where it is drawn.
        const issues = catalog.validateMessage(message);
        const fatal = issues.filter((issue) => !isComponentIssue(issue));
        if (fatal.length > 0) {
          problems.push(...fatal.map((issue) => ({ code: "VALIDATION_FAILED" as const, surfaceId, path: issue.path, message: issue.message })));
          note?.(message, surfaceId, issues, { code: "VALIDATION_FAILED", message: `${fatal[0]!.path} ${fatal[0]!.message}` });
          continue;
        }
        try {
          surfaces = applyMessage(surfaces, message);
          note?.(message, surfaceId, issues);
        } catch (error) {
          const code = error instanceof SurfaceError ? error.code : "INVALID_MESSAGE";
          problems.push({ code, surfaceId, path: "/", message: error instanceof Error ? error.message : String(error) });
          note?.(message, surfaceId, issues, { code, message: error instanceof Error ? error.message : String(error) });
        }
      }
      return { surfaces, problems };
    },
    [catalog],
  );
  const noted = useCallback(
    (message: SurfaceMessage, surfaceId: string, issues: ValidationIssue[], error?: { code: string; message: string }) => {
      if (!recorder) return;
      const key = `${(holder.current ??= newHolder("s"))}:${surfaceId}`;
      const event = recordMessage(recorder, { format: "a2ui", key, raw: message, message: upgradeMessage(message), issues, applied: !error, ...(error ? { error } : {}) });
      if (error) recorder.record({ kind: "problem", name: error.code, status: "error", surfaceId: key, detail: { code: error.code, path: "/", message: error.message } }, { traceId: event.traceId, spanId: event.spanId });
    },
    [recorder],
  );
  const [state, setState] = useState(() => reduce({ surfaces: {}, problems: [] }, initial));
  // What has been applied so far, read when the next message arrives, so each message is reduced (and recorded) once.
  const held = useRef(state);
  const first = useRef(initial);
  useLayoutEffect(() => {
    // The messages it opened with were applied before anything could record them.
    if (!recorder || first.current.length === 0) return;
    reduce({ surfaces: {}, problems: [] }, first.current, noted);
    first.current = [];
  }, [recorder, reduce, noted]);
  const apply = useCallback(
    (messages: SurfaceMessage | SurfaceMessage[]) => {
      held.current = reduce(held.current, Array.isArray(messages) ? messages : [messages], noted);
      setState(held.current);
    },
    [reduce, noted],
  );
  const reset = useCallback(() => {
    if (recorder && holder.current) recorder.record({ kind: "state", name: "reset", detail: { prefix: `${holder.current}:` } });
    held.current = { surfaces: {}, problems: [] };
    setState(held.current);
  }, [recorder]);
  // The recorder learns which surface object is which, so what is recorded where one is drawn joins its messages.
  if (recorder) for (const [id, surface] of Object.entries(state.surfaces)) recorder.tag(surface, `${(holder.current ??= newHolder("s"))}:${id}`);
  return { surfaces: state.surfaces, apply, reset, problems: state.problems };
}
