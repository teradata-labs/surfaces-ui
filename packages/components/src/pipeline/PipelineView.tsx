import type { Pipelines } from "@surfaces-ui/data";
import { CheckSeverity, type Dataset, DatasetKind, ExpectationAction, type Pipeline, RefreshKind, type Run, RunState } from "@surfaces-ui/proto";
import { useProvided, useTraced } from "@surfaces-ui/trace/react";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ContextNote } from "../controls/context.js";
import { messageOf } from "../data/useRowWindow.js";
import { CodeBlock } from "../text/Markdown.js";
import { checkText } from "./DatasetReview.js";
import { type CheckOutcome, ChecksPanel, type Expectation, ExpectationsPanel, type PipelineEdge, PipelineGraph, type PipelineNode, type PipelineRun, type PipelineStatus, RunHistory } from "./Pipeline.js";

const PipelinesContext = createContext<Pipelines | undefined>(undefined);

/** Makes a Pipelines backend available to the pipeline and ingest components below it. */
export function PipelinesProvider({ pipelines, children }: { pipelines: Pipelines; children: ReactNode }) {
  useProvided("pipelines", pipelines);
  return <PipelinesContext.Provider value={pipelines}>{children}</PipelinesContext.Provider>;
}

/** The Pipelines backend if one is available, for places that must work without it. */
export function useOptionalPipelines(override?: Pipelines): Pipelines | undefined {
  const fromContext = useContext(PipelinesContext);
  return useTraced("Pipelines", override ?? fromContext);
}

export function usePipelines(override?: Pipelines): Pipelines {
  const fromContext = useContext(PipelinesContext);
  const pipelines = useTraced("Pipelines", override ?? fromContext);
  if (!pipelines) throw new Error("No Pipelines backend: wrap the component in <PipelinesProvider> or pass pipelines.");
  return pipelines;
}

const STATUS: Record<RunState, PipelineStatus> = {
  [RunState.UNSPECIFIED]: "idle",
  [RunState.QUEUED]: "starting",
  [RunState.RUNNING]: "running",
  [RunState.COMPLETED]: "completed",
  [RunState.FAILED]: "failed",
  [RunState.CANCELLED]: "cancelled",
  [RunState.SKIPPED]: "skipped",
};
const KIND: Partial<Record<DatasetKind, PipelineNode["kind"]>> = {
  [DatasetKind.SOURCE]: "source",
  [DatasetKind.TABLE]: "table",
  [DatasetKind.VIEW]: "view",
  [DatasetKind.STREAMING_TABLE]: "streamingTable",
  [DatasetKind.SINK]: "sink",
};
const ACTION = { [ExpectationAction.DROP]: "drop", [ExpectationAction.FAIL]: "fail" } as Partial<Record<ExpectationAction, Expectation["action"]>>;
const REFRESH = { [RefreshKind.REFRESH]: "refresh", [RefreshKind.FULL_REFRESH]: "fullRefresh" } as Partial<Record<RefreshKind, PipelineRun["refreshKind"]>>;

/** The graph a pipeline draws as, with each dataset's state taken from a run when one is given. */
export function pipelineGraph(pipeline: Pipeline, run?: Run): { nodes: PipelineNode[]; edges: PipelineEdge[] } {
  const inRun = new Map(run?.datasetRuns.map((d) => [d.name, d]));
  const nodes = pipeline.datasets.map((dataset): PipelineNode => {
    const result = inRun.get(dataset.name);
    // A tool that builds elsewhere (dbt) does not always say how many rows it wrote; nothing there is not the same as none.
    const rowsKnown = !pipeline.externalRuns || (result ? result.rowsWritten > 0n : !!dataset.rowsWritten);
    return {
      id: dataset.name,
      name: dataset.name,
      kind: KIND[dataset.kind] ?? "table",
      layer: (dataset.layer || undefined) as PipelineNode["layer"],
      status: dataset.kind === DatasetKind.SOURCE ? undefined : STATUS[result?.state ?? dataset.state],
      rowsWritten: rowsKnown ? (result ? (result.state === RunState.COMPLETED && dataset.kind !== DatasetKind.VIEW ? Number(result.rowsWritten) : undefined) : dataset.rowsWritten === undefined || dataset.kind === DatasetKind.VIEW ? undefined : Number(dataset.rowsWritten)) : undefined,
      expectationsFailed: result?.expectations.reduce((sum, e) => sum + Number(e.failedRecords), 0) || undefined,
      checksFailed: result?.checks.filter((c) => c.failedRecords > 0n && c.severity !== CheckSeverity.WARN).length || undefined,
      checksWarned: result?.checks.filter((c) => c.failedRecords > 0n && c.severity === CheckSeverity.WARN).length || undefined,
    };
  });
  const edges = pipeline.datasets.flatMap((dataset) => dataset.inputs.map((from) => ({ from, to: dataset.name })));
  return { nodes, edges };
}

/** A run in the shape RunHistory draws. */
export function runRow(run: Run): PipelineRun {
  return {
    id: run.id,
    state: STATUS[run.state],
    startTime: run.startTime,
    endTime: run.endTime || undefined,
    trigger: run.dryRun ? "check only" : run.trigger || undefined,
    refreshKind: REFRESH[run.refreshKind] ?? "default",
    datasets: run.datasets,
    errorMessage: run.errorMessage || undefined,
  };
}

/** A dataset's checks with how a run did against each, for `ChecksPanel`. */
export function checkOutcomes(dataset: Dataset, run?: Run): CheckOutcome[] {
  const results = new Map(run?.datasetRuns.find((d) => d.name === dataset.name)?.checks.map((c) => [c.name, c]));
  return dataset.checks.map((check) => {
    const result = results.get(check.name);
    return {
      name: check.name,
      description: checkText(check),
      severity: check.severity === CheckSeverity.WARN ? "warn" : "fail",
      ...(result ? { failedRecords: Number(result.failedRecords), summary: result.summary, canOpenFailing: !!result.failingRowsSql } : {}),
      ...(check.implied ? { fromKey: true } : {}),
    };
  });
}

/** What happened to a run a person started here, for the host or the agent. */
export interface PipelineRunEvent {
  kind: "started" | "finished";
  runId: string;
  state: "running" | "completed" | "failed" | "cancelled";
  /** Datasets built, failed and skipped, when it has finished. */
  built?: number;
  failed?: string[];
  /** Checks that failed, as dataset.check. */
  failedChecks?: string[];
  dryRun?: boolean;
}

const RUN_WORD: Partial<Record<RunState, PipelineRunEvent["state"]>> = { [RunState.RUNNING]: "running", [RunState.COMPLETED]: "completed", [RunState.FAILED]: "failed", [RunState.CANCELLED]: "cancelled" };

/** A run as the `finished` event and note describe it. */
export function runEvent(run: Run, kind: PipelineRunEvent["kind"]): PipelineRunEvent {
  return {
    kind,
    runId: run.id,
    state: RUN_WORD[run.state] ?? "running",
    ...(run.dryRun ? { dryRun: true } : {}),
    ...(kind === "finished"
      ? {
          built: run.datasetRuns.filter((d) => d.state === RunState.COMPLETED).length,
          failed: run.datasetRuns.filter((d) => d.state === RunState.FAILED).map((d) => d.name),
          failedChecks: run.datasetRuns.flatMap((d) => d.checks.filter((c) => c.failedRecords > 0n && c.severity !== CheckSeverity.WARN).map((c) => `${d.name}.${c.name}`)),
        }
      : {}),
  };
}

/** SQL for the records of a dataset that break one rule, to look at them in a grid. */
export function failingRowsSql(dataset: Dataset, constraint: string): string {
  return `SELECT * FROM (${dataset.sql}) AS d WHERE NOT COALESCE((${constraint}), FALSE)`;
}

export interface PipelineViewProps {
  pipelineId: string;
  /** Called to look at a dataset's rows, typically by opening a query. */
  onOpenTable?(table: string, sourceId: string): void;
  /** Called with SQL for the records that broke a rule. Nothing runs unless the host runs it. */
  onOpenSql?(sql: string, sourceId: string): void;
  /** How often to ask for progress while a run is going, in ms. Defaults to 1000. */
  pollMs?: number;
  /** Called when a run started here begins and when it ends. */
  onRun?(event: PipelineRunEvent): void;
  /** What a person did here (started, checked, selected a dataset), for the agent's next turn. */
  onContext?(note: ContextNote): void;
  /** Offer a full refresh. Defaults to true; a host whose backend refuses one (an MCP app) passes false. */
  fullRefresh?: boolean;
  pipelines?: Pipelines;
  className?: string;
}

/**
 * A pipeline, live: its datasets and how they feed one another, its runs,
 * and for the selected dataset its query and data quality results. A person
 * can start a run, check the pipeline without building anything, rebuild
 * one dataset and what depends on it, or cancel. A full refresh, which
 * clears tables first, asks for confirmation.
 */
export function PipelineView(props: PipelineViewProps) {
  const { pipelineId, pollMs = 1000 } = props;
  const pipelines = usePipelines(props.pipelines);
  const [pipeline, setPipeline] = useState<Pipeline | undefined>();
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | undefined>();
  const [runId, setRunId] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const [found, listed] = await Promise.all([pipelines.getPipeline({ id: pipelineId }), pipelines.listRuns({ pipelineId, pageSize: 20 })]);
      if (!alive.current) return;
      setPipeline(found.pipeline);
      setRuns(listed.runs);
      setError(undefined);
    } catch (e) {
      if (alive.current) setError(messageOf(e));
    }
  }, [pipelines, pipelineId]);

  useEffect(() => {
    alive.current = true;
    setPipeline(undefined);
    setRuns([]);
    setSelected(undefined);
    setRunId(undefined);
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const running = runs.find((r) => r.state === RunState.RUNNING);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void load(), pollMs);
    return () => clearInterval(timer);
  }, [running?.id, load, pollMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // A run started here that has not yet been reported as finished.
  const watching = useRef<string | undefined>(undefined);
  const { onRun, onContext } = props;
  useEffect(() => {
    const run = runs.find((r) => r.id === watching.current);
    if (!run || run.state === RunState.RUNNING) return;
    watching.current = undefined;
    const event = runEvent(run, "finished");
    onRun?.(event);
    const checks = event.failedChecks?.length ? `; failed checks: ${event.failedChecks.join(", ")}` : "";
    onContext?.({ kind: "run.finished", summary: `${run.id} ${event.state}: ${event.built} built${event.failed?.length ? `, ${event.failed.join(", ")} failed` : ""}${checks}.`, subject: { pipeline: pipelineId, ...event } });
  }, [runs, onRun, onContext, pipelineId]);

  const start = async (options: { refreshKind?: RefreshKind; datasets?: string[]; dryRun?: boolean; confirmFullRefresh?: boolean }) => {
    setConfirming(false);
    try {
      const { run } = await pipelines.startRun({ pipelineId, trigger: "manual", ...options });
      if (run) {
        setRunId(run.id);
        setMessage(options.dryRun ? (run.state === RunState.FAILED ? `The check found problems: ${run.errorMessage}` : "The check found no problems. Nothing was built.") : `Started ${run.id}.`);
        const what = options.dryRun ? "Checked" : options.refreshKind === RefreshKind.FULL_REFRESH ? "Started a full refresh of" : options.datasets ? `Started rebuilding ${options.datasets.join(", ")} and what uses it in` : "Started a run of";
        if (!options.dryRun) {
          watching.current = run.id;
          onRun?.(runEvent(run, "started"));
        }
        onContext?.({ kind: options.dryRun ? "pipeline.checked" : "run.started", summary: `${what} the pipeline ${pipelineId}${options.dryRun ? (run.state === RunState.FAILED ? ": problems found" : ": no problems") : ""}.`, subject: { pipeline: pipelineId, runId: run.id, ...(options.datasets ? { datasets: options.datasets } : {}) } });
      }
      await load();
    } catch (e) {
      setMessage(messageOf(e));
    }
  };

  if (error) {
    return (
      <p className="sf-search-error" role="alert">
        {error}
      </p>
    );
  }
  if (!pipeline?.summary) return <p className="sf-object-muted">Loading…</p>;

  const shown = runs.find((r) => r.id === runId) ?? runs.find((r) => !r.dryRun);
  const { nodes, edges } = pipelineGraph(pipeline, shown);
  const dataset = pipeline.datasets.find((d) => d.name === selected);
  const built = dataset && dataset.kind !== DatasetKind.SOURCE;
  const result = shown?.datasetRuns.find((d) => d.name === selected);
  const expectations: Expectation[] = (result?.expectations ?? []).map((e) => ({
    name: e.name,
    dataset: selected ?? "",
    constraint: e.constraint,
    action: ACTION[e.action] ?? "warn",
    passedRecords: Number(e.passedRecords),
    failedRecords: Number(e.failedRecords),
  }));
  const sourceId = pipeline.summary.sourceId;

  // A pipeline another tool builds is built from here only when the backend can start that tool; any other backend builds its own.
  const buildable = pipeline.canBuild || !pipeline.externalRuns;
  return (
    <div className={["sf-pipeline-view", props.className].filter(Boolean).join(" ")}>
      <header className="sf-source-head">
        <div>
          <h3 className="sf-object-title">{pipeline.summary.name}</h3>
          <p className="sf-object-facts">
            {[pipeline.summary.description, `${pipeline.summary.datasetCount} datasets`, `Source ${sourceId}`, pipeline.recomputeOnly ? "Each run rebuilds whole tables" : undefined].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="sf-object-buttons">
          {!buildable ? (
            <p className="sf-object-facts">Built by another tool; its runs are reported here.</p>
          ) : running ? (
            <button type="button" className="sf-button" onClick={() => void pipelines.cancelRun({ pipelineId, runId: running.id }).then(() => setMessage("Stopping after the table being built."))}>
              Cancel run
            </button>
          ) : (
            <>
              <button type="button" className="sf-button" data-variant="primary" onClick={() => void start({})}>
                Run
              </button>
              <button type="button" className="sf-button" onClick={() => void start({ dryRun: true })}>
                Check only
              </button>
              {props.fullRefresh !== false && (
                <button type="button" className="sf-button" onClick={() => setConfirming(true)}>
                  Full refresh…
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {confirming && (
        <div className="sf-pipeline-confirm" role="alertdialog" aria-label="Confirm full refresh">
          <p>A full refresh deletes every table this pipeline built and builds them again. Queries against them will fail until it finishes.</p>
          <div className="sf-object-buttons">
            <button type="button" className="sf-button" data-variant="primary" onClick={() => void start({ refreshKind: RefreshKind.FULL_REFRESH, confirmFullRefresh: true })}>
              Delete and rebuild
            </button>
            <button type="button" className="sf-button" onClick={() => setConfirming(false)}>
              Keep the tables
            </button>
          </div>
        </div>
      )}
      <p className="sf-model-status" role="status">
        {message}
      </p>

      <PipelineGraph
        nodes={nodes}
        edges={edges}
        selected={selected}
        onSelect={(node) => {
          setSelected(node.id);
          onContext?.({ kind: "dataset.selected", summary: `Looked at ${node.name} in ${pipeline.summary?.name}.`, subject: { pipeline: pipelineId, dataset: node.name } });
        }}
        label={`${pipeline.summary.name} pipeline`}
      />

      {dataset && (
        <section className="sf-pipeline-detail" aria-label={`Dataset ${dataset.name}`}>
          <header className="sf-source-head">
            <div>
              <h4 className="sf-object-title">{dataset.name}</h4>
              <p className="sf-object-facts">
                {[
                  dataset.description,
                  dataset.inputs.length > 0 ? `Reads ${dataset.inputs.join(", ")}${dataset.inputsDeclared ? "" : " (worked out from the query)"}` : undefined,
                  dataset.owner ? `Owner ${dataset.owner}` : undefined,
                  dataset.tags.length > 0 ? dataset.tags.join(", ") : undefined,
                  dataset.builtAt ? `Built ${new Date(dataset.builtAt).toLocaleString()}` : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ") || "A table this pipeline reads."}
              </p>
              {built && (dataset.grain || dataset.primaryKey.length > 0) && (
                <p className="sf-object-facts">
                  {[dataset.grain ? `One row: ${dataset.grain}` : undefined, dataset.primaryKey.length > 0 ? `Key ${dataset.primaryKey.join(", ")}` : undefined].filter(Boolean).join(" · ")}
                </p>
              )}
              {result?.errorMessage && (
                <p className="sf-search-error" role="note">
                  {result.errorMessage}
                </p>
              )}
            </div>
            <div className="sf-object-buttons">
              {props.onOpenTable && (
                <button type="button" className="sf-button" onClick={() => props.onOpenTable?.(dataset.name, sourceId)}>
                  Open table
                </button>
              )}
              {built && !running && buildable && (
                <button type="button" className="sf-button" onClick={() => void start({ refreshKind: RefreshKind.REFRESH, datasets: [dataset.name] })}>
                  Rebuild this and what uses it
                </button>
              )}
            </div>
          </header>
          {built && pipeline.externalRuns && dataset.sql && (
            <p className="sf-explore-hint">The query as the other tool compiled it, shown read-only. That tool builds the dataset from its own definition, never from this text.</p>
          )}
          {built && dataset.sql && <CodeBlock code={dataset.sql} language="sql" label={pipeline.externalRuns ? "Compiled query (read-only preview)" : undefined} />}
          {built && dataset.columns.length > 0 && (
            <div className="sf-object-table" tabIndex={0} role="region" aria-label={`Columns of ${dataset.name}`}>
              <table>
                <caption className="sf-a2-visually-hidden">Columns of {dataset.name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Column</th>
                    <th scope="col">Type</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.columns.map((column) => (
                    <tr key={column.name}>
                      <th scope="row">{column.name}</th>
                      <td className="sf-object-type">{column.type}</td>
                      <td>{column.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {built && dataset.checks.length > 0 && (
            <ChecksPanel
              checks={checkOutcomes(dataset, shown)}
              onOpenFailing={
                props.onOpenSql
                  ? (check) => {
                      const sql = shown?.datasetRuns.find((d) => d.name === dataset.name)?.checks.find((c) => c.name === check.name)?.failingRowsSql;
                      if (sql) props.onOpenSql?.(sql, sourceId);
                    }
                  : undefined
              }
            />
          )}
          {built &&
            (expectations.length > 0 ? (
              <ExpectationsPanel
                expectations={expectations}
                onOpenFailing={props.onOpenSql ? (expectation) => props.onOpenSql?.(failingRowsSql(dataset, expectation.constraint), sourceId) : undefined}
              />
            ) : dataset.expectations.length > 0 ? (
              <p className="sf-object-muted">
                {dataset.expectations.length} data quality {dataset.expectations.length === 1 ? "rule" : "rules"}: {dataset.expectations.map((e) => e.name).join(", ")}. Run the pipeline to see results.
              </p>
            ) : (
              <p className="sf-object-muted">No data quality rules on this dataset.</p>
            ))}
        </section>
      )}

      <RunHistory runs={runs.map(runRow)} selected={shown?.id} onSelect={(run) => setRunId(run.id)} />
    </div>
  );
}
