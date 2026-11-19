import { CodeBlock, ControlIcon, DataSourceProvider, DiscoveryProvider, PipelinesProvider, SemanticsProvider, Workspace, type WorkspaceLayout, type WorkspacePanel } from "@surfaces-ui/components";
import type { DataSource, Discovery, Pipelines, Semantics } from "@surfaces-ui/data";
import { type Catalog, type FunctionImpl, type Surface, analyticsCatalog, resolve, surfaceOutline } from "@surfaces-ui/spec";
import { type ComponentRenderer, SurfaceView, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { type InspectTarget, type Json, type JsonChange, type JsonRecord, TRACE_KINDS, TRACE_STATUSES, type TraceEvent, type TraceFeed, type TraceKind, type TraceStatus, isStep, plain, traceSteps } from "@surfaces-ui/trace";
import { TraceProvider } from "@surfaces-ui/trace/react";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { componentFindings } from "./cause.js";
import { surfaceStepDiff, surfacesAt, withControls } from "./replay.js";
import { PANEL_CSS, addStyles } from "./styles.js";

/** The backends a recorded surface is drawn over when it is shown again. All optional: a component that needs one that is missing says so. */
export interface DevToolsServices {
  dataSource?: DataSource;
  discovery?: Discovery;
  pipelines?: Pipelines;
  semantics?: Semantics;
}

export interface DevToolsPanelProps {
  /**
   * The events to show: anything with `get` and `subscribe`. A recorder is
   * one; so is a log read from a file or sent from another window. The
   * panel reads nothing else about the page it is shown in.
   */
  feed: TraceFeed;
  /** Empties the feed. The Clear button shows only when this is given. */
  onClear?(): void;
  /** The catalog recorded surfaces are checked against and drawn with. Defaults to the analytics catalog. */
  catalog?: Catalog;
  renderers?: Record<string, ComponentRenderer>;
  /** What a surface shown again queries. Without a `dataSource`, its data components say they have none. */
  services?: DevToolsServices;
  /** Controls of whatever hosts the panel (dock side, pop out, close), put at the end of its bar. */
  actions?: ReactNode;
  /**
   * Told which drawn component a person picked in Components, and `undefined` when none is: a host that has the
   * page shows where it is. The panel itself knows nothing of the page.
   */
  onInspect?(target: InspectTarget | undefined): void;
  /** The component a host says is picked, for one picked outside the panel (on the page): the panel shows it and filters to it. */
  inspected?: InspectTarget;
  /** True in a narrow host, where only the timeline and the surface show to begin with. Measured when left out. */
  narrow?: boolean;
}

const KIND_NAME: Record<TraceKind, string> = { message: "Message", component: "Component", problem: "Problem", state: "State", event: "Event", agent: "Agent", service: "Service" };
const clock = (time: number) => {
  const d = new Date(time);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};
const took = (ms: number | undefined) => (ms === undefined ? "" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`);
const json = (value: unknown) => JSON.stringify(value ?? null, null, 2);
const short = (value: unknown, max = 90) => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};
const record = (value: Json | undefined): JsonRecord => (value !== null && typeof value === "object" && !Array.isArray(value) ? value : {});
const sqlOf = (event: TraceEvent): string => {
  const query = record(record(event.detail.request).query);
  return typeof query.baseSql === "string" ? query.baseSql : typeof record(event.detail.request).sql === "string" ? (record(event.detail.request).sql as string) : "";
};

/** A line about an event, for its row. */
function summary(event: TraceEvent): string {
  const d = event.detail;
  switch (event.kind) {
    case "service": {
      const response = record(d.response);
      const error = record(d.error);
      // A call its caller gave up on is not a failure: the component was redrawn, or asked for something else.
      if (d.cancelled === true) return ["given up before it answered", sqlOf(event).replace(/\s+/g, " ")].filter(Boolean).join(" · ");
      if (typeof error.message === "string") return error.message;
      const rows = typeof response.rows === "number" ? `${response.rows} rows` : "";
      return [rows, sqlOf(event).replace(/\s+/g, " ")].filter(Boolean).join(" · ");
    }
    case "message":
      return [event.surfaceId, Array.isArray(d.issues) && d.issues.length > 0 ? `${d.issues.length} issues` : "", typeof record(d.error).message === "string" ? (record(d.error).message as string) : ""].filter(Boolean).join(" · ");
    case "problem":
      return [typeof d.path === "string" ? d.path : "", typeof d.message === "string" ? d.message : ""].filter(Boolean).join(" ");
    case "event":
      return [event.componentId, d.contract === "failed" ? "not sent: contract failed" : typeof d.summary === "string" ? d.summary : short(d.context ?? "", 60)].filter(Boolean).join(" · ");
    case "agent": {
      const input = record(record(d.request).input);
      return typeof input.text === "string" ? input.text : typeof input.name === "string" ? `action ${input.name}` : "";
    }
    case "state":
      return [event.componentId, typeof d.path === "string" ? `${d.path} = ${short(d.value, 40)}` : ""].filter(Boolean).join(" · ");
    case "component":
      return event.surfaceId ?? "";
  }
}

interface WindowListProps<T> {
  label: string;
  items: readonly T[];
  idOf(item: T): string;
  selected: string | undefined;
  onSelect(id: string): void;
  row(item: T): ReactNode;
  rowClass: string;
  className: string;
  rowProps?(item: T): Record<string, string | undefined>;
  empty: string;
}

/**
 * A long list that draws only the rows in view. One tab stop: arrows, Home,
 * End, Page Up and Page Down move the selection, which is followed into view.
 */
function WindowList<T>({ label, items, idOf, selected, onSelect, row, rowClass, className, rowProps, empty }: WindowListProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const base = useId();
  const [top, setTop] = useState(0);
  const [view, setView] = useState({ height: 400, row: 28 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // A row is at least as tall as the smallest thing a person can press: 24px, 44px on a touch screen.
      const target = parseFloat(getComputedStyle(el).getPropertyValue("--sf-target-min")) || 0;
      setView((v) => {
        const next = { height: el.clientHeight || 400, row: Math.max(28, target) };
        return next.height === v.height && next.row === v.row ? v : next;
      });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const first = Math.max(0, Math.floor(top / view.row) - 4);
  const last = Math.min(items.length, Math.ceil((top + view.height) / view.row) + 4);
  const index = selected === undefined ? -1 : items.findIndex((item) => idOf(item) === selected);
  const dom = (id: string) => `${base}-${id}`;
  const go = (to: number) => {
    const next = Math.max(0, Math.min(items.length - 1, to));
    const item = items[next];
    if (!item) return;
    onSelect(idOf(item));
    const el = ref.current;
    if (!el) return;
    if (next * view.row < el.scrollTop) el.scrollTop = next * view.row;
    else if ((next + 1) * view.row > el.scrollTop + view.height) el.scrollTop = (next + 1) * view.row - view.height;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const page = Math.max(1, Math.floor(view.height / view.row) - 1);
    const to = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? Math.max(0, index - 1) : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "PageDown" ? index + page : event.key === "PageUp" ? index - page : undefined;
    if (to === undefined) return;
    event.preventDefault();
    go(to);
  };
  if (items.length === 0) return <p className="sf-devtools-empty">{empty}</p>;
  return (
    <div ref={ref} role="listbox" aria-label={label} tabIndex={0} aria-activedescendant={index >= 0 ? dom(idOf(items[index]!)) : undefined} className={className} onScroll={(event) => setTop(event.currentTarget.scrollTop)} onKeyDown={onKeyDown}>
      <div role="presentation" style={{ height: items.length * view.row }}>
        {items.slice(first, last).map((item, offset) => {
          const id = idOf(item);
          return (
            <div key={id} id={dom(id)} role="option" aria-selected={id === selected} className={rowClass} style={{ top: (first + offset) * view.row, height: view.row }} onClick={() => onSelect(id)} {...rowProps?.(item)}>
              {row(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventRows({ label, events, selected, onSelect, at, empty }: { label: string; events: readonly TraceEvent[]; selected: string | undefined; onSelect(id: string): void; at: number | undefined; empty: string }) {
  return (
    <WindowList
      label={label}
      items={events}
      idOf={(event) => event.id}
      selected={selected}
      onSelect={onSelect}
      className="sf-devtools-rows"
      rowClass="sf-devtools-row"
      empty={empty}
      rowProps={(event) => ({ "data-kind": event.kind, "data-later": at !== undefined && event.seq > at ? "" : undefined })}
      row={(event) => (
        <>
          <span className="sf-devtools-time">{clock(event.time)}</span>
          <span className="sf-devtools-kind">{KIND_NAME[event.kind]}</span>
          <span className="sf-devtools-name">
            {event.name} <small>{summary(event)}</small>
          </span>
          <span className="sf-devtools-status" data-status={event.detail.cancelled === true ? "cancelled" : event.status}>
            {event.detail.cancelled === true ? "cancelled" : event.status}
          </span>
          <span className="sf-devtools-ms">{took(event.durationMs)}</span>
        </>
      )}
    />
  );
}

function Facts({ event }: { event: TraceEvent }) {
  const facts: [string, string | undefined][] = [
    ["What", `${KIND_NAME[event.kind]}: ${event.name}`],
    ["Status", event.status],
    ["When", clock(event.time)],
    ["Took", took(event.durationMs) || undefined],
    ["Surface", event.surfaceId],
    ["Component", event.componentId],
    ["Trace", event.traceId],
    ["Span", event.spanId],
    ["Inside", event.parentId],
  ];
  return (
    <dl className="sf-devtools-facts">
      {facts.map(([name, value]) =>
        value ? (
          <div key={name} style={{ display: "contents" }}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

type SaidBlock = { kind: "text"; lines: string[] } | { kind: "list"; items: string[] } | { kind: "json"; code: string };

/** Text sent to an agent, read a line at a time: runs of "- " lines are a list, a line of JSON is data, the rest is prose. */
export function saidBlocks(text: string): SaidBlock[] {
  const blocks: SaidBlock[] = [];
  for (const line of text.split("\n")) {
    const last = blocks.at(-1);
    const trimmed = line.trim();
    if (/^[-*•] /.test(trimmed)) {
      if (last?.kind === "list") last.items.push(trimmed.slice(2));
      else blocks.push({ kind: "list", items: [trimmed.slice(2)] });
    } else if (trimmed.length > 40 && /^[[{]/.test(trimmed)) {
      let code = trimmed;
      try {
        code = JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        // Cut short when it was recorded, or not JSON after all: shown as it is.
      }
      blocks.push({ kind: "json", code });
    } else if (trimmed === "") {
      if (last?.kind === "text" && last.lines.length > 0) blocks.push({ kind: "text", lines: [] });
    } else if (last?.kind === "text") last.lines.push(line);
    else blocks.push({ kind: "text", lines: [line] });
  }
  return blocks.filter((block) => block.kind !== "text" || block.lines.length > 0);
}

const LABEL = /^([A-Z][A-Za-z ]{1,28}):(\s|$)/;
const LONG_LIST = 4;

/**
 * What was said to an agent, laid out to be read: prose as paragraphs with a leading "Label:" marked, a list as a
 * list, and data as highlighted JSON. A long list and data start folded, so the words a person wrote are not lost
 * among the context sent with them. Everything is text: nothing in it is run or drawn as markup.
 */
function Said({ text }: { text: string }) {
  const blocks = saidBlocks(text);
  if (blocks.length === 0) return <p className="sf-devtools-empty">Nothing was recorded of what was asked.</p>;
  return (
    <div className="sf-devtools-said">
      {blocks.map((block, i) => {
        if (block.kind === "text")
          return (
            <p key={i}>
              {block.lines.map((line, n) => {
                const label = LABEL.exec(line);
                return (
                  <span key={n}>
                    {label ? <strong>{label[1]}:</strong> : null}
                    {label ? line.slice(label[1]!.length + 1) : line}
                    {n < block.lines.length - 1 ? "\n" : null}
                  </span>
                );
              })}
            </p>
          );
        if (block.kind === "list") {
          const list = (
            <ul>
              {block.items.map((item, n) => (
                <li key={n}>{item}</li>
              ))}
            </ul>
          );
          return block.items.length > LONG_LIST ? (
            <details key={i}>
              <summary>{block.items.length} lines</summary>
              {list}
            </details>
          ) : (
            <div key={i}>{list}</div>
          );
        }
        return (
          <details key={i}>
            <summary>Data, {block.code.length.toLocaleString()} characters</summary>
            <CodeBlock code={block.code} language="json" label="Data sent with what was asked" />
          </details>
        );
      })}
    </div>
  );
}

/**
 * One turn with an agent, laid out as it went: what was asked, each step and tool call, each approval asked for,
 * the reply, the messages it sent for surfaces, usage, and who answered. A turn is one event; this is its parts.
 */
function Turn({ event }: { event: TraceEvent }) {
  const d = event.detail;
  const input = record(record(d.request).input);
  const asked = typeof input.text === "string" ? input.text : input.case === "action" ? json(input.action ?? input) : input.case === "approval" ? json(input.approval ?? input) : "";
  const steps = Array.isArray(d.steps) ? d.steps.map(record) : [];
  const approvals = Array.isArray(d.approvals) ? d.approvals.map(record) : [];
  const usage = Object.entries(record(d.usage)).filter(([, value]) => typeof value === "number" || typeof value === "string");
  const reply = typeof d.text === "string" ? d.text : "";
  const cut = typeof d.textLength === "number" && d.textLength > reply.length;
  return (
    <>
      <h4>Asked{typeof input.case === "string" && input.case !== "text" ? ` (${input.case})` : ""}</h4>
      {input.case === "text" || typeof input.text === "string" ? <Said text={asked} /> : asked ? <CodeBlock code={asked} language="json" label="What was sent" /> : <p className="sf-devtools-empty">Nothing was recorded of what was asked.</p>}
      <h4>Steps: {steps.length}</h4>
      {steps.length > 0 && (
        <ol className="sf-devtools-list">
          {steps.map((step, i) => (
            <li key={i}>
              {String(step.title || step.tool || step.id)}
              {step.tool && step.title ? <code> {String(step.tool)}</code> : null}
              <small className="sf-devtools-kind"> {[typeof step.status === "string" ? step.status : "", took(Number(step.durationMs) || undefined)].filter(Boolean).join(" · ")}</small>
              {typeof step.detail === "string" && step.detail && <p className="sf-devtools-said">{step.detail}</p>}
            </li>
          ))}
        </ol>
      )}
      {approvals.length > 0 && (
        <>
          <h4>Approvals asked for: {approvals.length}{d.waitingForApproval === true ? " (the turn is waiting on one)" : ""}</h4>
          <ul className="sf-devtools-list">
            {approvals.map((approval, i) => (
              <li key={i}>
                {String(approval.title || approval.id)} <small className="sf-devtools-kind">{[approval.risk, approval.editable === true ? "editable" : ""].filter(Boolean).join(" · ")}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      <h4>Reply{cut ? ` (the first ${reply.length} of ${String(d.textLength)} characters)` : ""}</h4>
      <p className="sf-devtools-said">{reply || (event.status === "running" ? "Nothing yet: the turn is still running." : "The turn ended with no text.")}</p>
      <dl className="sf-devtools-facts">
        <dt>Surface messages</dt>
        <dd>{String(d.surfaceMessages ?? 0)}{Number(d.surfaceMessages) > 0 ? " (in Messages, under this turn's trace)" : ""}</dd>
        {typeof d.generatedBy === "string" && d.generatedBy && (
          <>
            <dt>Answered by</dt>
            <dd>{d.generatedBy}</dd>
          </>
        )}
        {typeof d.sessionId === "string" && d.sessionId && (
          <>
            <dt>Session</dt>
            <dd>{d.sessionId}</dd>
          </>
        )}
        {typeof d.suggestions === "number" && (
          <>
            <dt>Suggestions</dt>
            <dd>{d.suggestions}</dd>
          </>
        )}
        {usage.map(([name, value]) => (
          <div key={name} style={{ display: "contents" }}>
            <dt>{name}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

/** Everything known about one event. */
function EventDetail({ pane, event, onGoTo }: { pane: string; event: TraceEvent | undefined; onGoTo?(seq: number): void }) {
  if (!event) return <p className="sf-devtools-empty">Pick a row to see it in full.</p>;
  const d = event.detail;
  const issues = Array.isArray(d.issues) ? (d.issues as { path: string; message: string }[]) : [];
  const error = record(d.error);
  const response = record(d.response);
  const sql = sqlOf(event);
  return (
    <section className="sf-devtools-detail" tabIndex={0} aria-label={`${pane}: ${KIND_NAME[event.kind]} ${event.name}, in full`}>
      <Facts event={event} />
      {d.cancelled === true && (
        <p className="sf-devtools-empty" role="note">
          Cancelled by its caller before it answered, which is usual when a component is redrawn or asks for something else. It is not a failure.
        </p>
      )}
      {typeof error.message === "string" && d.cancelled !== true && (
        <p className="sf-devtools-problem" role="note">
          {[error.code, error.message, typeof error.line === "number" ? `(line ${error.line}${typeof error.column === "number" ? `, column ${error.column}` : ""})` : ""].filter(Boolean).join(" ")}
        </p>
      )}
      {event.kind === "problem" && typeof d.message === "string" && (
        <p className="sf-devtools-problem" role="note">
          {String(d.path ?? "")} {d.message}
        </p>
      )}
      {event.kind === "message" && (
        <>
          {onGoTo && isStep(event) && (
            <div>
              <button type="button" className="sf-button" onClick={() => onGoTo(event.seq)}>
                Show the surface at this step
              </button>
            </div>
          )}
          {issues.length > 0 && (
            <>
              <h4>What the catalog said</h4>
              <ul className="sf-devtools-list">
                {issues.map((issue, i) => (
                  <li key={i} className="sf-devtools-problem">
                    <code>{issue.path}</code> {issue.message}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h4>As it arrived{typeof d.version === "string" ? ` (version ${d.version})` : ""}</h4>
          <CodeBlock code={json(d.raw)} language="json" label="The message as it arrived" />
          {d.message !== undefined && (
            <>
              <h4>As it was read (A2UI 1.0)</h4>
              <CodeBlock code={json(d.message)} language="json" label="The message as it was read" />
            </>
          )}
        </>
      )}
      {event.kind === "service" && (
        <>
          {sql && (
            <>
              <h4>SQL sent</h4>
              <CodeBlock code={sql} language="sql" label="SQL sent" />
            </>
          )}
          {typeof response.executedSql === "string" && response.executedSql !== sql && (
            <>
              <h4>SQL the engine ran</h4>
              <CodeBlock code={response.executedSql} language="sql" label="SQL the engine ran" />
            </>
          )}
        </>
      )}
      {event.kind === "agent" && <Turn event={event} />}
      {event.kind !== "message" && (
        <>
          <h4>Recorded</h4>
          <CodeBlock code={json(d)} language="json" label="What was recorded" />
        </>
      )}
    </section>
  );
}

function Changes({ changes }: { changes: JsonChange[] }) {
  if (changes.length === 0) return <p className="sf-devtools-empty">This step changed nothing a surface draws.</p>;
  return (
    <ul className="sf-devtools-list" aria-label="What this step changed">
      {changes.map((change) => (
        <li key={change.path}>
          <strong>{change.change}</strong> <code>{change.path}</code>
          {change.change !== "added" && <code> {short(change.before)}</code>}
          {change.change === "changed" && " → "}
          {change.change !== "removed" && <code> {short(change.after)}</code>}
        </li>
      ))}
    </ul>
  );
}

// One pane open in each column to begin with; the others are folded to their headings, a press away.
const WIDE: WorkspaceLayout = { columns: [["timeline", "services", "agent"], ["messages", "state", "events"], ["surface", "components"]], columnWidths: [0.36, 0.3, 0.34], rowHeights: [[0.98, 0.01, 0.01], [0.98, 0.01, 0.01], [0.99, 0.01]], collapsed: ["services", "agent", "state", "events", "components"] };
const NARROW: WorkspaceLayout = { columns: [["timeline", "surface"]], hidden: ["messages", "components", "state", "events", "services", "agent"] };

/**
 * The dev tools themselves: a timeline of everything recorded, the raw
 * messages, the component tree, state, events sent out, agent turns and
 * service calls, with a scrubber that shows any surface as it stood at an
 * earlier step. It is written against a feed of events and nothing else, so
 * it can be shown in the page, in a window of its own, or by another host.
 * It never calls a model.
 */
export function DevToolsPanel({ feed, onClear, catalog = analyticsCatalog, renderers = lazyAnalyticsRenderers, services = {}, actions, onInspect, inspected, narrow: givenNarrow }: DevToolsPanelProps) {
  const log = useSyncExternalStore(feed.subscribe, feed.get, feed.get);
  const { events } = log;
  const root = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<boolean | undefined>(givenNarrow);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    // Styles go to whichever document the panel is in: the page, or a window of its own.
    addStyles(el.ownerDocument, "sf-devtools-panel-css", PANEL_CSS);
    if (measured === undefined) setMeasured(el.clientWidth > 0 && el.clientWidth < 640);
  }, [measured]);
  const narrow = givenNarrow ?? measured;

  const steps = useMemo(() => traceSteps(events), [events]);
  // The step shown, by its event's number; undefined follows the page as it is now.
  const [at, setAt] = useState<number | undefined>();
  const [selected, setSelected] = useState<string | undefined>();
  const [chosenSurface, setChosenSurface] = useState<string | undefined>();
  const [chosenComponent, setChosenComponent] = useState<string | undefined>();
  const [kinds, setKinds] = useState<ReadonlySet<TraceKind>>(new Set(TRACE_KINDS));
  const [status, setStatus] = useState<TraceStatus | "all">("all");
  const [newest, setNewest] = useState(true);

  const index = at === undefined ? steps.length - 1 : steps.findLastIndex((step) => step.seq <= at);
  const step = index >= 0 ? steps[index] : undefined;
  const state = useMemo(() => surfacesAt(events, at), [events, at]);
  const keys = Object.keys(state.surfaces);
  const surfaceKey = chosenSurface !== undefined && keys.includes(chosenSurface) ? chosenSurface : step?.surfaceId !== undefined && keys.includes(step.surfaceId) ? step.surfaceId : keys.at(-1);
  const surface = surfaceKey === undefined ? undefined : state.surfaces[surfaceKey];
  const upTo = at ?? Number.POSITIVE_INFINITY;
  const byId = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const picked = selected === undefined ? undefined : byId.get(selected);

  const goTo = (to: number) => {
    const next = Math.max(0, Math.min(steps.length - 1, to));
    setAt(next >= steps.length - 1 ? undefined : steps[next]!.seq);
    if (steps[next]) setSelected(steps[next]!.id);
  };


  const surfacePick = (
    <label>
      Surface{" "}
      <select className="sf-input sf-devtools-select" value={surfaceKey ?? ""} onChange={(event) => setChosenSurface(event.target.value)} disabled={keys.length === 0}>
        {keys.length === 0 && <option value="">None yet</option>}
        {keys.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
    </label>
  );

  const outline = useMemo(() => surfaceOutline(surface), [surface]);
  const componentId = chosenComponent !== undefined && surface?.components[chosenComponent] ? chosenComponent : outline[0]?.id;
  const component = componentId === undefined ? undefined : surface?.components[componentId];
  // Only a component a person picked is pointed at, never the one shown to begin with.
  const pointedAt = chosenComponent !== undefined && chosenComponent === componentId ? chosenComponent : undefined;
  const inspect = useRef(onInspect);
  inspect.current = onInspect;
  useEffect(() => {
    inspect.current?.(pointedAt !== undefined && surfaceKey !== undefined ? { surfaceKey, componentId: pointedAt } : undefined);
  }, [pointedAt, surfaceKey]);
  useEffect(() => () => inspect.current?.(undefined), []);
  // One picked outside the panel is shown here, as the page stands now.
  const outsideKey = inspected?.surfaceKey;
  const outsideId = inspected?.componentId;
  useEffect(() => {
    if (outsideKey === undefined || outsideId === undefined) return;
    setAt(undefined);
    setChosenSurface(outsideKey);
    setChosenComponent(outsideId);
  }, [outsideKey, outsideId]);
  // A picked component narrows the lists of what happened to what it did: it was drawn, its problems, its state,
  // its events, its service calls. Messages and agent turns belong to a surface or a turn, so they are left whole.
  const about = useCallback((event: TraceEvent) => pointedAt === undefined || (event.surfaceId === surfaceKey && event.componentId === pointedAt), [pointedAt, surfaceKey]);
  // A message is about a component when it sent it: the messages that made the picked component what it is.
  const sends = useCallback((event: TraceEvent) => {
    if (pointedAt === undefined) return true;
    if (event.surfaceId !== surfaceKey) return false;
    const message = (event.detail.message ?? event.detail.raw) as Record<string, { components?: unknown } | undefined> | undefined;
    const list = message?.updateComponents?.components ?? message?.createSurface?.components;
    return Array.isArray(list) && list.some((item) => (item as { id?: unknown } | null)?.id === pointedAt);
  }, [pointedAt, surfaceKey]);
  const timeline = useMemo(() => {
    const shown = events.filter((event) => kinds.has(event.kind) && (status === "all" || event.status === status) && (event.kind === "message" ? sends(event) : about(event)));
    return newest ? [...shown].reverse() : shown;
  }, [events, kinds, status, newest, about, sends]);
  const of = (kind: TraceKind) => events.filter((event) => event.kind === kind && about(event));
  const messages = events.filter((event) => event.kind === "message" && sends(event));
  const turns = events.filter((event) => event.kind === "agent");
  const controlsHere: Record<string, unknown> = (surfaceKey !== undefined ? (state.controls[surfaceKey] as Record<string, unknown> | undefined) : undefined) ?? {};
  const onlyComponent =
    pointedAt !== undefined && component ? (
      <span className="sf-devtools-only">
        Only {String(component.component)} <code>{pointedAt}</code>
        <button type="button" className="sf-devtools-icon" aria-label={`Show every component again, not only ${String(component.component)} ${pointedAt}`} title="Show every component" onClick={() => setChosenComponent(undefined)}>
          <ControlIcon icon="close" />
        </button>
      </span>
    ) : null;
  const noneFor = pointedAt !== undefined && component ? `Nothing here for ${String(component.component)} "${pointedAt}".` : undefined;
  const resolved = useMemo(() => {
    if (!component || !surface) return undefined;
    const functions = Object.fromEntries(Object.entries(catalog.functions).map(([name, fn]) => [name, fn.implementation])) as Record<string, FunctionImpl>;
    const { id: _id, component: _name, action: _action, child: _child, children: _children, ...own } = component;
    try {
      return plain(resolve(Object.fromEntries(Object.entries(own).filter(([key]) => !key.startsWith("@"))), { data: surface.data, scope: "/", functions }));
    } catch (error) {
      return { "could not be resolved": error instanceof Error ? error.message : String(error) };
    }
  }, [component, surface, catalog]);
  const problemsOf = (id: string) => events.filter((event) => event.kind === "problem" && event.surfaceId === surfaceKey && event.componentId === id && event.seq <= upTo);
  const callsOf = (id: string) => events.filter((event) => event.kind === "service" && event.surfaceId === surfaceKey && event.componentId === id && event.seq <= upTo);

  const findings = useMemo(
    () => (surfaceKey !== undefined && componentId !== undefined ? componentFindings({ events, surfaceKey, surface, componentId, upTo }) : []),
    [events, surfaceKey, surface, componentId, upTo],
  );
  const show = (id: string) => {
    const event = byId.get(id);
    if (!event) return;
    // Its kind is switched back on if it was filtered out of the timeline.
    setKinds((held) => (held.has(event.kind) ? held : new Set([...held, event.kind])));
    setStatus("all");
    setSelected(id);
  };
  const causes = component && componentId !== undefined && (
    <div className="sf-devtools-causes" role="group" aria-label={`Likely cause for ${String(component.component)} ${componentId}`}>
      <h4>Likely cause</h4>
      {findings.length === 0 ? (
        <p className="sf-devtools-empty">Nothing recorded points at a problem with this component.</p>
      ) : (
        <ol className="sf-devtools-list">
          {findings.map((finding, i) => (
            <li key={i} className="sf-devtools-cause" data-severity={finding.severity}>
              <span className="sf-devtools-cause-mark">{finding.severity === "error" ? "Problem" : finding.severity === "warning" ? "Check" : "Note"}</span>
              <span>
                {finding.title}
                {finding.detail && <small> {finding.detail}</small>}
              </span>
              {finding.eventId !== undefined && (
                <button type="button" className="sf-button sf-devtools-cause-show" onClick={() => show(finding.eventId!)}>
                  Show<span className="sf-visually-hidden"> what was recorded for: {finding.title}</span>
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="sf-devtools-cause-by">Worked out from this recording by fixed rules, most likely first. Not a model, and nothing was queried.</p>
    </div>
  );

  const provide = (children: ReactNode): ReactNode => {
    let out = children;
    if (services.semantics) out = <SemanticsProvider semantics={services.semantics}>{out}</SemanticsProvider>;
    if (services.pipelines) out = <PipelinesProvider pipelines={services.pipelines}>{out}</PipelinesProvider>;
    if (services.discovery) out = <DiscoveryProvider discovery={services.discovery}>{out}</DiscoveryProvider>;
    if (services.dataSource) out = <DataSourceProvider dataSource={services.dataSource}>{out}</DataSourceProvider>;
    // What the tools draw is not recorded: looking at a trace must not add to it.
    return <TraceProvider recorder={undefined}>{out}</TraceProvider>;
  };

  const panels: WorkspacePanel[] = [
    {
      id: "timeline",
      title: "Timeline",
      icon: "history",
      content: (
        <div className="sf-devtools-pane">
          <div className="sf-devtools-filters" role="group" aria-label="Show in the timeline">
            {TRACE_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                className="sf-devtools-chip"
                aria-pressed={kinds.has(kind)}
                onClick={() =>
                  setKinds((held) => {
                    const next = new Set(held);
                    if (next.has(kind)) next.delete(kind);
                    else next.add(kind);
                    return next;
                  })
                }
              >
                {KIND_NAME[kind]}
              </button>
            ))}
            <label>
              Status{" "}
              <select className="sf-input" value={status} onChange={(event) => setStatus(event.target.value as TraceStatus | "all")}>
                <option value="all">Any</option>
                {TRACE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Order{" "}
              <select className="sf-input" value={newest ? "newest" : "oldest"} onChange={(event) => setNewest(event.target.value === "newest")}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
          {onlyComponent}
          {pointedAt !== undefined && causes}
          <EventRows label="Timeline" events={timeline} selected={selected} onSelect={setSelected} at={at} empty={events.length === 0 ? "Nothing recorded yet. Use the page and what it does shows here." : "Nothing matches these filters."} />
          <EventDetail pane="Timeline" event={picked && kinds.has(picked.kind) ? picked : undefined} onGoTo={(seq) => goTo(steps.findIndex((s) => s.seq === seq))} />
        </div>
      ),
    },
    {
      id: "messages",
      title: "Messages",
      icon: "code",
      content: (
        <div className="sf-devtools-pane">
          {onlyComponent}
          <EventRows label="Messages" events={messages} selected={selected} onSelect={setSelected} at={at} empty={pointedAt !== undefined && component ? `No message recorded here sent ${String(component.component)} "${pointedAt}".` : "No message has arrived yet."} />
          <EventDetail pane="Messages" event={picked?.kind === "message" ? picked : undefined} onGoTo={(seq) => goTo(steps.findIndex((s) => s.seq === seq))} />
        </div>
      ),
    },
    {
      id: "components",
      title: "Components",
      icon: "components",
      content: (
        <div className="sf-devtools-pane">
          <div className="sf-devtools-filters">{surfacePick}</div>
          <WindowList
            label="Components of the surface"
            items={outline}
            idOf={(item) => item.id}
            selected={componentId}
            onSelect={setChosenComponent}
            className="sf-devtools-tree"
            rowClass="sf-devtools-node sf-devtools-row-node"
            empty="No surface has been drawn at this step."
            row={(item) => {
              const problems = problemsOf(item.id).length;
              return (
                <span style={{ paddingInlineStart: `calc(${item.depth} * var(--sf-space-3))` }}>
                  {item.component} <small>{item.id}</small>
                  {problems > 0 && <span className="sf-devtools-problem"> · {problems} {problems === 1 ? "problem" : "problems"}</span>}
                </span>
              );
            }}
          />
          {component && componentId !== undefined && (
            <section className="sf-devtools-detail" tabIndex={0} aria-label={`${String(component.component)} ${componentId}, in full`}>
              {causes}
              <h4>As sent</h4>
              <CodeBlock code={json(component)} language="json" label="The component as sent" />
              <h4>Props after bindings and functions</h4>
              <CodeBlock code={json(resolved)} language="json" label="The component's props after bindings and functions" />
              <h4>Service calls: {callsOf(componentId).length}</h4>
            </section>
          )}
        </div>
      ),
    },
    {
      id: "state",
      title: "State",
      icon: "data",
      content: (
        <div className="sf-devtools-pane">
          <div className="sf-devtools-filters">{surfacePick}</div>
          <section className="sf-devtools-detail" tabIndex={0} aria-label="State of the surface">
            <h4>Changed by this step{step ? `: ${step.name}` : ""}</h4>
            {step ? <Changes changes={surfaceStepDiff(events, step.seq)} /> : <p className="sf-devtools-empty">No step yet.</p>}
            <h4>Data model</h4>
            <CodeBlock code={json(surface?.data ?? {})} language="json" label="The surface's data model" />
            <h4>Written by a person</h4>
            {surfaceKey !== undefined && state.writes[surfaceKey]?.length ? (
              <ul className="sf-devtools-list">
                {state.writes[surfaceKey]!.map(([path, value]) => (
                  <li key={path}>
                    <code>{path}</code> = <code>{short(value)}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sf-devtools-empty">Nothing.</p>
            )}
            <h4>Controls as a person left them{pointedAt !== undefined ? `: ${pointedAt} only` : ""}</h4>
            <CodeBlock code={json(pointedAt !== undefined ? (controlsHere[pointedAt] ?? {}) : controlsHere)} language="json" label={pointedAt !== undefined ? `The controls of ${pointedAt}` : "Each component's controls"} />
          </section>
        </div>
      ),
    },
    {
      id: "events",
      title: "Events",
      icon: "note",
      content: (
        <div className="sf-devtools-pane">
          {onlyComponent}
          <EventRows label="Events sent out" events={of("event")} selected={selected} onSelect={setSelected} at={at} empty={noneFor ?? "Nothing has been sent out yet: no action, no context note."} />
          <EventDetail pane="Events" event={picked?.kind === "event" ? picked : undefined} />
        </div>
      ),
    },
    {
      id: "services",
      title: "Services",
      icon: "table",
      content: (
        <div className="sf-devtools-pane">
          {onlyComponent}
          <EventRows label="Service calls" events={of("service")} selected={selected} onSelect={setSelected} at={at} empty={noneFor ?? "No backend has been called yet."} />
          <EventDetail pane="Services" event={picked?.kind === "service" ? picked : undefined} />
        </div>
      ),
    },
    {
      id: "agent",
      title: "Agent",
      icon: "agent",
      content: (
        <div className="sf-devtools-pane">
          <EventRows label="Agent turns" events={turns} selected={selected} onSelect={setSelected} at={at} empty="No turn with an agent yet." />
          <EventDetail pane="Agent" event={picked?.kind === "agent" ? picked : undefined} />
        </div>
      ),
    },
    {
      id: "surface",
      title: "Surface",
      icon: "surface",
      content: (
        <div className="sf-devtools-pane">
          <div className="sf-devtools-filters">{surfacePick}</div>
          <p className="sf-devtools-empty" role="note">
            {surface
              ? `Read-only${at === undefined ? ", as it stands now" : `, as it stood after step ${index + 1} of ${steps.length}`}. Its data is queried now, so the numbers are today's. Nothing pressed here is sent to the agent.`
              : "No surface has been drawn at this step."}
          </p>
          {surface && surfaceKey !== undefined && (
            <div className="sf-devtools-preview" role="region" aria-label="The surface, drawn again" tabIndex={0}>{provide(<SurfaceView key={`${surfaceKey}:${at ?? "live"}`} surface={withControls(surface, state.controls[surfaceKey])} catalog={catalog} renderers={renderers} />)}</div>
          )}
        </div>
      ),
    },
  ];

  const problems = events.filter((event) => event.status === "error").length;
  return (
    <div ref={root} className="sf-devtools" role="region" aria-label="Surfaces dev tools">
      <div className="sf-devtools-bar">
        <h2 className="sf-devtools-title">Dev tools</h2>
        <span className="sf-devtools-step">
          {events.length} recorded{problems > 0 ? `, ${problems} failed` : ""}
        </span>
        <div className="sf-devtools-scrub" role="group" aria-label="Time travel">
          <button type="button" className="sf-devtools-icon" aria-label="Step back" title="Step back" aria-disabled={index <= 0} onClick={() => index > 0 && goTo(index - 1)}>
            <ControlIcon icon="earlier" />
          </button>
          <input type="range" aria-label="Step" min={1} max={Math.max(1, steps.length)} value={Math.max(1, index + 1)} disabled={steps.length < 2} aria-valuetext={step ? `Step ${index + 1} of ${steps.length}: ${step.name}` : "No steps yet"} onChange={(event) => goTo(Number(event.target.value) - 1)} />
          <button type="button" className="sf-devtools-icon" aria-label="Step forward" title="Step forward" aria-disabled={at === undefined} onClick={() => at !== undefined && goTo(index + 1)}>
            <ControlIcon icon="later" />
          </button>
          <button type="button" className="sf-devtools-chip" aria-pressed={at === undefined} onClick={() => setAt(undefined)}>
            Live
          </button>
          <span className="sf-devtools-step" aria-hidden="true">
            {step ? `${index + 1} of ${steps.length} · ${step.name}` : "No steps yet"}
          </span>
        </div>
        <div className="sf-devtools-actions">
          {onClear && (
            <button
              type="button"
              className="sf-devtools-icon"
              aria-label="Clear what was recorded"
              title="Clear what was recorded"
              onClick={() => {
                setAt(undefined);
                setSelected(undefined);
                onClear();
              }}
            >
              <ControlIcon icon="remove" />
            </button>
          )}
          {actions}
        </div>
      </div>
      <p className="sf-devtools-note" role="status">
        {[
          at !== undefined && step ? `Showing step ${index + 1} of ${steps.length} (${step.name}). Surfaces are drawn as they stood then; their data is queried live.` : "",
          log.dropped > 0 ? `The oldest ${log.dropped} events were let go to stay within the limit, so time travel starts from what is left.` : "",
          state.skipped.length > 0 ? `${state.skipped.length} recorded ${state.skipped.length === 1 ? "message" : "messages"} could not be applied again.` : "",
        ]
          .filter(Boolean)
          .join(" ")}
      </p>
      <div className="sf-devtools-body">
        {narrow !== undefined && <Workspace key={narrow ? "narrow" : "wide"} label="Dev tools panels" className="sf-devtools-workspace" height="100%" panels={panels} defaultLayout={narrow ? NARROW : WIDE} />}
      </div>
    </div>
  );
}

export default DevToolsPanel;
