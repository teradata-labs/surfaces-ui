import { type KeyboardEvent, useId, useMemo } from "react";
import { FIT_PADDING, PanZoomControls, fitView, usePanZoom } from "../panzoom/usePanZoom.js";
import { numberFormat } from "../locale/locale.js";

export type PipelineNodeKind = "source" | "table" | "view" | "streamingTable" | "materializedView" | "temporaryView" | "sink";
export type PipelineStatus = "idle" | "starting" | "running" | "completed" | "failed" | "cancelled" | "skipped";

/** A dataset, source or sink in a pipeline. */
export interface PipelineNode {
  id: string;
  name: string;
  kind: PipelineNodeKind;
  status?: PipelineStatus;
  /** Medallion layer, when the pipeline uses one. */
  layer?: "bronze" | "silver" | "gold";
  rowsWritten?: number;
  /** Records that failed a data quality expectation in the latest run. */
  expectationsFailed?: number;
  /** Checks over the whole dataset (unique, not empty, found in, one of, row count) that failed in the latest run. */
  checksFailed?: number;
  /** Checks of severity warn that found rows. */
  checksWarned?: number;
}

/** A flow: data moving from one node to another. */
export interface PipelineEdge {
  from: string;
  to: string;
  flowName?: string;
  mode?: "streaming" | "batch";
}

const KIND_LABEL: Record<PipelineNodeKind, string> = {
  source: "Source",
  table: "Table",
  view: "View",
  streamingTable: "Streaming table",
  materializedView: "Materialized view",
  temporaryView: "Temporary view",
  sink: "Sink",
};
const STATUS_MARK: Record<PipelineStatus, string> = { idle: "○", starting: "…", running: "…", completed: "✓", failed: "!", cancelled: "×", skipped: "–" };
const NODE_WIDTH = 200;
const NODE_HEIGHT = 64;
const GAP_X = 72;
const GAP_Y = 20;
const count = { format: (n: number) => numberFormat({ notation: "compact", maximumFractionDigits: 1 }).format(n) };

export interface PipelineLayout {
  positions: Record<string, { x: number; y: number; column: number }>;
  width: number;
  height: number;
}

/**
 * Places nodes in columns from left to right: a node sits one column after
 * the furthest thing that feeds it. The graph itself comes from the engine;
 * this only decides where to draw it. A cycle (which a valid pipeline cannot
 * have) does not hang it.
 */
export function layoutPipeline(nodes: PipelineNode[], edges: PipelineEdge[]): PipelineLayout {
  const ids = new Set(nodes.map((n) => n.id));
  const inputs = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const edge of edges) if (ids.has(edge.from) && ids.has(edge.to)) inputs.get(edge.to)!.push(edge.from);
  const column = new Map<string, number>();
  const visit = (id: string, trail: Set<string>): number => {
    const known = column.get(id);
    if (known !== undefined) return known;
    if (trail.has(id)) return 0;
    trail.add(id);
    const depth = Math.max(-1, ...inputs.get(id)!.map((from) => visit(from, trail))) + 1;
    trail.delete(id);
    column.set(id, depth);
    return depth;
  };
  for (const node of nodes) visit(node.id, new Set());
  const rows = new Map<number, number>();
  const positions: PipelineLayout["positions"] = {};
  for (const node of nodes) {
    const c = column.get(node.id)!;
    const row = rows.get(c) ?? 0;
    rows.set(c, row + 1);
    positions[node.id] = { x: 16 + c * (NODE_WIDTH + GAP_X), y: 16 + row * (NODE_HEIGHT + GAP_Y), column: c };
  }
  const columns = Math.max(0, ...column.values()) + 1;
  const tallest = Math.max(1, ...rows.values());
  return { positions, width: 32 + columns * NODE_WIDTH + (columns - 1) * GAP_X, height: 32 + tallest * NODE_HEIGHT + (tallest - 1) * GAP_Y };
}

/** Everything upstream and downstream of a node, including the node. */
export function lineageOf(id: string, edges: PipelineEdge[]): Set<string> {
  const found = new Set([id]);
  const walk = (start: string, next: (edge: PipelineEdge) => [string, string]) => {
    const queue = [start];
    while (queue.length > 0) {
      const at = queue.pop()!;
      for (const edge of edges) {
        const [here, there] = next(edge);
        if (here === at && !found.has(there)) {
          found.add(there);
          queue.push(there);
        }
      }
    }
  };
  walk(id, (e) => [e.from, e.to]);
  walk(id, (e) => [e.to, e.from]);
  return found;
}

export interface PipelineGraphProps {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  /** The selected node. Its upstream and downstream are highlighted. */
  selected?: string;
  onSelect?(node: PipelineNode): void;
  /** Largest height of the canvas in px; a smaller pipeline takes less. Defaults to 360. */
  height?: number;
  /** Accessible name. Defaults to "Pipeline". */
  label?: string;
  className?: string;
}

/**
 * A pipeline as a graph: sources, tables, views and sinks from left to
 * right, joined by the flows between them, each with its latest status.
 * Selecting a node highlights what feeds it and what it feeds. Dashed lines
 * are streaming flows.
 */
export function PipelineGraph(props: PipelineGraphProps) {
  const { nodes, edges, selected, height = 360 } = props;
  const layout = useMemo(() => layoutPipeline(nodes, edges), [nodes, edges]);
  const lineage = useMemo(() => (selected ? lineageOf(selected, edges) : undefined), [selected, edges]);
  const id = useId();
  const panZoom = usePanZoom({ content: { width: layout.width, height: layout.height } });
  // The box is no taller than the whole pipeline needs once fitted to its width, so a wide graph leaves no empty band.
  const fitted = panZoom.viewport.width > 0 ? fitView(layout, { width: panZoom.viewport.width, height }).k : 1;
  const boxHeight = Math.min(height, Math.max(Math.ceil(layout.height * fitted) + FIT_PADDING * 2, Math.min(height, 160)));
  const order = useMemo(() => [...nodes].sort((a, b) => layout.positions[a.id]!.x - layout.positions[b.id]!.x || layout.positions[a.id]!.y - layout.positions[b.id]!.y), [nodes, layout]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button.sf-pipeline-node");
    buttons?.[Math.max(0, Math.min(order.length - 1, index + step))]?.focus();
  };

  if (nodes.length === 0) return <p className="sf-object-muted">This pipeline has no datasets.</p>;
  return (
    <div className={["sf-pipeline-graph", props.className].filter(Boolean).join(" ")}>
      <PanZoomControls panZoom={panZoom} label={`Zoom the ${(props.label ?? "pipeline").toLowerCase()}`} />
      <div
        ref={panZoom.viewportRef}
        className="sf-pipeline sf-panzoom"
        style={{ height: boxHeight }}
        role="group"
        aria-label={props.label ?? "Pipeline"}
        aria-describedby={`${id}-keys`}
        {...panZoom.viewportProps}
      >
      <span id={`${id}-keys`} className="sf-a2-visually-hidden">
        Drag the background or scroll to move around. Plus and minus zoom, 0 fits the pipeline to view, arrow keys move it.
      </span>
      <div className="sf-pipeline-plane sf-panzoom-plane" style={{ width: layout.width, height: layout.height, ...panZoom.planeStyle }} data-animate={panZoom.animate || undefined}>
        <svg width={layout.width} height={layout.height} aria-hidden="true">
          {edges.map((edge) => {
            const from = layout.positions[edge.from];
            const to = layout.positions[edge.to];
            if (!from || !to) return null;
            const [x1, y1, x2, y2] = [from.x + NODE_WIDTH, from.y + NODE_HEIGHT / 2, to.x, to.y + NODE_HEIGHT / 2];
            const bend = Math.max(24, (x2 - x1) / 2);
            const lit = !lineage || (lineage.has(edge.from) && lineage.has(edge.to));
            return <path key={`${edge.from}>${edge.to}`} d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`} data-mode={edge.mode ?? "batch"} data-dim={lit ? undefined : ""} />;
          })}
        </svg>
        {order.map((node, index) => {
          const at = layout.positions[node.id]!;
          const status = node.status ?? "idle";
          const feeds = edges.filter((e) => e.from === node.id).map((e) => nodes.find((n) => n.id === e.to)?.name).filter(Boolean);
          return (
            <button
              key={node.id}
              type="button"
              className="sf-pipeline-node"
              style={{ left: at.x, top: at.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
              data-status={status}
              data-kind={node.kind}
              data-dim={lineage && !lineage.has(node.id) ? "" : undefined}
              aria-pressed={selected === node.id}
              onClick={() => props.onSelect?.(node)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="sf-pipeline-name">
                <span className="sf-pipeline-mark" aria-hidden="true">
                  {STATUS_MARK[status]}
                </span>
                {node.name}
                {/* The name read out begins with the visible name, as WCAG 2.5.3 asks; the lines below say the same for the eye. */}
                {" "}
                <span className="sf-visually-hidden">{`(${KIND_LABEL[node.kind]}, ${status}${feeds.length > 0 ? `, feeds ${feeds.join(", ")}` : ""})`}</span>
              </span>
              <span className="sf-pipeline-meta" aria-hidden="true">
                {KIND_LABEL[node.kind]}
                {node.layer ? ` · ${node.layer}` : ""}
              </span>
              <span className="sf-pipeline-meta" aria-hidden="true">
                {node.rowsWritten !== undefined ? `${count.format(node.rowsWritten)} rows` : status}
                {node.expectationsFailed ? ` · ${count.format(node.expectationsFailed)} records broke rules` : ""}
                {node.checksFailed ? ` · ${node.checksFailed} ${node.checksFailed === 1 ? "check" : "checks"} failed` : ""}
                {node.checksWarned ? ` · ${node.checksWarned} ${node.checksWarned === 1 ? "warning" : "warnings"}` : ""}
              </span>
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}

/** One run (update) of a pipeline. */
export interface PipelineRun {
  id: string;
  state: PipelineStatus;
  /** ISO 8601. */
  startTime: string;
  endTime?: string;
  /** What started it, e.g. "schedule" or "manual". */
  trigger?: string;
  /** "default" processes new data; "refresh" recomputes; "fullRefresh" clears data and checkpoints first. */
  refreshKind?: "default" | "refresh" | "fullRefresh";
  datasets?: string[];
  errorMessage?: string;
}

const REFRESH_LABEL = { default: "New data", refresh: "Refresh", fullRefresh: "Full refresh" } as const;

/** A duration in words, e.g. "1 min 5 s". */
export function durationText(ms: number): string {
  if (!(ms >= 0)) return "–";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export interface RunHistoryProps {
  runs: PipelineRun[];
  selected?: string;
  onSelect?(run: PipelineRun): void;
  className?: string;
}

/** The runs of a pipeline, newest first: how each ended, how long it took, what it refreshed and why it failed. */
export function RunHistory({ runs, selected, onSelect, className }: RunHistoryProps) {
  if (runs.length === 0) return <p className="sf-object-muted">This pipeline has not run yet.</p>;
  const sorted = [...runs].sort((a, b) => b.startTime.localeCompare(a.startTime));
  const longest = Math.max(1, ...sorted.map((r) => (r.endTime ? Date.parse(r.endTime) - Date.parse(r.startTime) : 0)));
  return (
    <div className={["sf-object-table sf-runs", className].filter(Boolean).join(" ")} tabIndex={0} role="region" aria-label="Runs">
      <table>
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">Result</th>
            <th scope="col">Started</th>
            <th scope="col">Took</th>
            <th scope="col">Kind</th>
            <th scope="col">Started by</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((run) => {
            const took = run.endTime ? Date.parse(run.endTime) - Date.parse(run.startTime) : Number.NaN;
            return (
              <tr key={run.id} data-status={run.state} aria-selected={selected === run.id}>
                <th scope="row">
                  {onSelect ? (
                    <button type="button" className="sf-runs-open" onClick={() => onSelect(run)}>
                      {run.id}
                    </button>
                  ) : (
                    run.id
                  )}
                </th>
                <td>
                  <span className="sf-pipeline-mark" aria-hidden="true">
                    {STATUS_MARK[run.state]}
                  </span>{" "}
                  {run.state}
                  {run.errorMessage && <span className="sf-object-column-note">{run.errorMessage}</span>}
                </td>
                <td>{run.startTime.replace("T", " ").slice(0, 19)}</td>
                <td>
                  <span className="sf-runs-bar" style={{ inlineSize: `${Number.isNaN(took) ? 0 : Math.max(2, (took / longest) * 100)}%` }} aria-hidden="true" />
                  {Number.isNaN(took) ? "In progress" : durationText(took)}
                </td>
                <td>
                  {REFRESH_LABEL[run.refreshKind ?? "default"]}
                  {run.datasets && run.datasets.length > 0 ? ` · ${run.datasets.length} ${run.datasets.length === 1 ? "dataset" : "datasets"}` : ""}
                </td>
                <td>{run.trigger ?? "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One data quality rule and how the latest run did against it. */
export interface Expectation {
  name: string;
  dataset: string;
  /** The rule, e.g. `amount >= 0`. */
  constraint: string;
  /** What happens to a failing record: kept with a warning, dropped, or the run fails. */
  action: "warn" | "drop" | "fail";
  passedRecords: number;
  failedRecords: number;
}

const ACTION_LABEL = { warn: "Kept, with a warning", drop: "Dropped", fail: "Fails the run" } as const;
const full = { format: (n: number) => numberFormat().format(n) };

export interface ExpectationsPanelProps {
  expectations: Expectation[];
  /** Called to look at the records that failed a rule, typically by opening a query. */
  onOpenFailing?(expectation: Expectation): void;
  className?: string;
}

/** Data quality rules for a pipeline, worst first, with how many records passed and failed. The engine does the checking. */
export function ExpectationsPanel({ expectations, onOpenFailing, className }: ExpectationsPanelProps) {
  if (expectations.length === 0) return <p className="sf-object-muted">No data quality rules are defined.</p>;
  const rate = (e: Expectation) => (e.passedRecords + e.failedRecords === 0 ? 0 : e.failedRecords / (e.passedRecords + e.failedRecords));
  const sorted = [...expectations].sort((a, b) => rate(b) - rate(a) || a.name.localeCompare(b.name));
  return (
    <div className={["sf-object-table sf-expectations", className].filter(Boolean).join(" ")} tabIndex={0} role="region" aria-label="Data quality rules">
      <table>
        <thead>
          <tr>
            <th scope="col">Rule</th>
            <th scope="col">Dataset</th>
            <th scope="col">A failing record is</th>
            <th scope="col" className="sf-object-number">
              Failed
            </th>
            <th scope="col">Share failing</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={`${item.dataset}.${item.name}`} data-failing={item.failedRecords > 0 || undefined}>
              <th scope="row">
                {item.name}
                <span className="sf-object-column-note sf-object-type">{item.constraint}</span>
              </th>
              <td>{item.dataset}</td>
              <td>{ACTION_LABEL[item.action]}</td>
              <td className="sf-object-number">
                {full.format(item.failedRecords)} of {full.format(item.passedRecords + item.failedRecords)}
              </td>
              <td>
                <span className="sf-meter" role="img" aria-label={`${(rate(item) * 100).toFixed(1)}% failing`}>
                  <span style={{ inlineSize: `${Math.min(100, rate(item) * 100)}%` }} data-bad="" />
                </span>{" "}
                {(rate(item) * 100).toFixed(1)}%
                {onOpenFailing && item.failedRecords > 0 && (
                  <button type="button" className="sf-button sf-expectations-open" onClick={() => onOpenFailing(item)}>
                    See failing rows
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One check over a built dataset and how the latest run did against it. */
export interface CheckOutcome {
  name: string;
  /** The check in words: "order_id never repeats". */
  description: string;
  /** Whether a failure stops what reads the dataset, or only warns. */
  severity: "fail" | "warn";
  /** Rows that break it (for a row count, 1 when it is out of bounds). Absent when the dataset has not been built since the check was added. */
  failedRecords?: number;
  /** What the engine reported, in a sentence. */
  summary?: string;
  /** Whether it was added for the dataset's key. */
  fromKey?: boolean;
  /** False when there is no query for the rows that break it, so none is offered. */
  canOpenFailing?: boolean;
}

export interface ChecksPanelProps {
  checks: CheckOutcome[];
  /** Called to look at what breaks a check. Nothing runs unless the host runs it. */
  onOpenFailing?(check: CheckOutcome): void;
  className?: string;
}

/** A dataset's checks, failures first, with what the engine counted. Counts only: no row is read here. */
export function ChecksPanel({ checks, onOpenFailing, className }: ChecksPanelProps) {
  if (checks.length === 0) return <p className="sf-object-muted">No checks on this dataset.</p>;
  const order = (c: CheckOutcome) => (c.failedRecords === undefined ? 1 : c.failedRecords > 0 ? (c.severity === "fail" ? 0 : 0.5) : 2);
  const sorted = [...checks].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
  return (
    <div className={["sf-object-table sf-checks", className].filter(Boolean).join(" ")} tabIndex={0} role="region" aria-label="Checks">
      <table>
        <thead>
          <tr>
            <th scope="col">Check</th>
            <th scope="col">Result</th>
            <th scope="col">On failure</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((check) => {
            const failed = (check.failedRecords ?? 0) > 0;
            return (
              <tr key={check.name} data-failing={failed || undefined}>
                <th scope="row">
                  {check.name}
                  <span className="sf-object-column-note sf-object-type">
                    {check.description}
                    {check.fromKey ? " (from the key)" : ""}
                  </span>
                </th>
                <td>
                  <span className="sf-check-mark" data-state={check.failedRecords === undefined ? "unknown" : failed ? check.severity : "pass"}>
                    {check.failedRecords === undefined ? "Not run yet" : failed ? (check.severity === "fail" ? "! Failed" : "! Warning") : "✓ Passed"}
                  </span>
                  {check.summary && check.summary !== "Passed." && <span className="sf-object-column-note">{check.summary}</span>}
                  {onOpenFailing && failed && check.canOpenFailing !== false && (
                    <button type="button" className="sf-button sf-expectations-open" onClick={() => onOpenFailing(check)}>
                      See what breaks it
                    </button>
                  )}
                </td>
                <td>{check.severity === "fail" ? "Stops what reads it" : "Warns"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One difference between the schema that arrived and the one expected. */
export interface SchemaChange {
  column: string;
  change: "added" | "removed" | "typeChanged";
  before?: string;
  after?: string;
}

const CHANGE_LABEL = { added: "New column", removed: "Missing column", typeChanged: "Type changed" } as const;
const CHANGE_MARK = { added: "+", removed: "−", typeChanged: "~" } as const;

export interface SchemaDiffProps {
  changes: SchemaChange[];
  /** Records whose unexpected fields were set aside instead of being loaded. */
  rescuedCount?: number;
  /** How the pipeline treats new columns, e.g. "addNewColumns", "rescue", "failOnNewColumns". */
  mode?: string;
  className?: string;
}

/** How incoming data differs from the table it is loaded into: new, missing and retyped columns. */
export function SchemaDiff({ changes, rescuedCount, mode, className }: SchemaDiffProps) {
  return (
    <div className={["sf-schema-diff", className].filter(Boolean).join(" ")}>
      {(mode || rescuedCount !== undefined) && (
        <p className="sf-object-facts">{[mode ? `New columns: ${mode}` : undefined, rescuedCount !== undefined ? `${full.format(rescuedCount)} records had fields set aside` : undefined].filter(Boolean).join(" · ")}</p>
      )}
      {changes.length === 0 ? (
        <p className="sf-object-muted">The incoming data matches the table.</p>
      ) : (
        <ul>
          {changes.map((item) => (
            <li key={`${item.change}:${item.column}`} data-change={item.change}>
              <span className="sf-schema-diff-mark" aria-hidden="true">
                {CHANGE_MARK[item.change]}
              </span>
              <strong>{item.column}</strong>
              <span>{CHANGE_LABEL[item.change]}</span>
              <span className="sf-object-type">{item.change === "typeChanged" ? `${item.before ?? "?"} → ${item.after ?? "?"}` : (item.after ?? item.before ?? "")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One progress report from a streaming query. Field names follow Spark's StreamingQueryProgress. */
export interface StreamProgress {
  /** ISO 8601. */
  timestamp: string;
  numInputRows: number;
  inputRowsPerSecond: number;
  processedRowsPerSecond: number;
  /** Time the whole micro-batch took (durationMs.triggerExecution). */
  batchDurationMs: number;
  /** Rows held in state (stateOperators.numRowsTotal), when the query keeps state. */
  stateRows?: number;
}

const METRICS: { key: keyof Omit<StreamProgress, "timestamp">; label: string; unit: string }[] = [
  { key: "inputRowsPerSecond", label: "Input rate", unit: "rows/s" },
  { key: "processedRowsPerSecond", label: "Processing rate", unit: "rows/s" },
  { key: "numInputRows", label: "Rows per batch", unit: "rows" },
  { key: "batchDurationMs", label: "Batch duration", unit: "ms" },
  { key: "stateRows", label: "Rows in state", unit: "rows" },
];

/** Points for a sparkline over a 100 by 28 box. */
export function sparkline(values: number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  return values.map((v, i) => `${values.length === 1 ? 50 : (i / (values.length - 1)) * 100},${26 - ((v - min) / span) * 24}`).join(" ");
}

export interface StreamMetricsProps {
  /** Progress reports, oldest first. The numbers are plotted as reported; nothing is derived here. */
  progress: StreamProgress[];
  className?: string;
}

/**
 * How a streaming query is keeping up: input and processing rates, batch
 * size and duration, and state size, each with its latest value and recent
 * trend. A processing rate below the input rate means it is falling behind.
 */
export function StreamMetrics({ progress, className }: StreamMetricsProps) {
  if (progress.length === 0) return <p className="sf-object-muted">No progress has been reported yet.</p>;
  const latest = progress.at(-1)!;
  const behind = latest.processedRowsPerSecond < latest.inputRowsPerSecond;
  return (
    <div className={["sf-stream", className].filter(Boolean).join(" ")}>
      <p className="sf-stream-status" data-behind={behind || undefined}>
        <span aria-hidden="true">{behind ? "!" : "✓"}</span> {behind ? "Falling behind: rows arrive faster than they are processed." : "Keeping up with its input."} Last report{" "}
        {latest.timestamp.replace("T", " ").slice(0, 19)}.
      </p>
      <dl className="sf-stream-grid">
        {METRICS.filter((m) => progress.some((p) => p[m.key] !== undefined)).map((metric) => {
          const values = progress.map((p) => p[metric.key]).filter((v): v is number => v !== undefined);
          return (
            <div key={metric.key} className="sf-stream-tile">
              <dt>{metric.label}</dt>
              <dd>
                {count.format(values.at(-1)!)} <span>{metric.unit}</span>
                <svg viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label={`${metric.label} over the last ${values.length} reports, from ${count.format(Math.min(...values))} to ${count.format(Math.max(...values))}`}>
                  <polyline points={sparkline(values)} />
                </svg>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
