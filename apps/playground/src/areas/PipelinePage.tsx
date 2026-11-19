import { create } from "@bufbuild/protobuf";
import {
  type DatasetDecision,
  DatasetReview,
  ExpectationsPanel,
  type IngestDraft,
  IngestWizard,
  type PipelineEdge,
  PipelineGraph,
  type PipelineNode,
  PipelineView,
  PipelinesProvider,
  QueryResult,
  RunHistory,
  SchemaDiff,
  StreamMetrics,
  emptyIngestDraft,
} from "@surfaces-ui/components";
import { type Pipelines, memoryPipelines, pipelineDigest } from "@surfaces-ui/data";
import { CheckKind, CheckSeverity, DatasetKind, PipelineDraftSchema } from "@surfaces-ui/proto";
import { useEffect, useMemo, useState } from "react";
import type { ActiveSource } from "../source.js";

/** The sample pipeline, run for real by the dev server, and a wizard for bringing in new files. */
function LivePipeline({ source, pipelines }: { source: ActiveSource; pipelines: Pipelines }) {
  const [query, setQuery] = useState<{ sql: string; ranAt: string; title: string } | undefined>();
  const [draft, setDraft] = useState<IngestDraft>(emptyIngestDraft);
  const open = (sql: string, title: string) => setQuery({ sql, title, ranAt: new Date().toISOString() });
  // The picked dataset's own pipelines come first; any other pipeline can still be chosen.
  const [list, setList] = useState<{ id: string; name: string; sourceId: string }[] | undefined>();
  const [chosen, setChosen] = useState("");
  useEffect(() => {
    let live = true;
    pipelines
      .listPipelines({})
      .then(({ pipelines: all }) => {
        if (!live) return;
        const sorted = [...all.filter((p) => p.sourceId === source.sourceId), ...all.filter((p) => p.sourceId !== source.sourceId)];
        setList(sorted.map((p) => ({ id: p.id, name: p.name, sourceId: p.sourceId })));
        setChosen(sorted[0]?.id ?? "");
        setQuery(undefined);
      })
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [pipelines, source.sourceId]);
  const current = list?.find((p) => p.id === chosen);
  return (
    <PipelinesProvider pipelines={pipelines}>
      <section className="card">
        <div className="card-head">
          <h2>Pipeline</h2>
          {list && list.length > 1 && (
            <label className="inline">
              <span>Pipeline</span>
              <select
                value={chosen}
                onChange={(e) => {
                  setChosen(e.target.value);
                  setQuery(undefined);
                }}
              >
                {list.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sourceId})
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="badge">DuckDB</span>
        </div>
        {list === undefined ? (
          <p className="hint">Loading pipelines…</p>
        ) : !current ? (
          <p className="hint">The server defines no pipelines.</p>
        ) : (
          <PipelineView
            key={current.id}
            pipelineId={current.id}
            onOpenTable={(table) => open(`SELECT * FROM ${table}`, table)}
            onOpenSql={(sql) => open(sql, "Records that broke the rule")}
          />
        )}
        <p className="hint">
          A pipeline defined in <code>surfaces.config.ts</code> is run by the dev server: each run rebuilds the tables in DuckDB, where they can be
          queried like any other. There is no schedule, and nothing is streamed or processed incrementally. A dbt project is read from its artifacts:
          dbt builds it, here or wherever it runs, and its runs and tests are reported here.
        </p>
      </section>
      {query && (
        <section className="card">
          <div className="card-head">
            <h2>{query.title}</h2>
          </div>
          <QueryResult sourceId={current?.sourceId ?? source.sourceId} sql={query.sql} notBefore={query.ranAt} height={300} />
        </section>
      )}
      <section className="card">
        <div className="card-head">
          <h2>Bring in new files</h2>
        </div>
        <IngestWizard sourceId={current?.sourceId ?? source.sourceId} value={draft} onChange={setDraft} />
      </section>
    </PipelinesProvider>
  );
}

/** A pipeline kept in this page, and an agent's proposal to add a dataset to it, for a person to review and approve. */
const reviewPipeline = () =>
  memoryPipelines([
    {
      summary: { id: "sales", name: "Sales", sourceId: "lake" },
      version: 3,
      datasets: [
        { name: "orders", kind: DatasetKind.SOURCE },
        { name: "orders_clean", sql: "SELECT * FROM orders WHERE status IS NOT NULL", inputs: ["orders"], inputsDeclared: true, grain: "one row per order", primaryKey: ["order_id"] },
      ],
    },
  ]);
const proposal = create(PipelineDraftSchema, {
  id: "sales",
  name: "Sales",
  sourceId: "lake",
  datasets: [
    { name: "orders_clean", sql: "SELECT * FROM orders WHERE status IS NOT NULL", inputs: ["orders"], inputsDeclared: true, grain: "one row per order", primaryKey: ["order_id"] },
    {
      name: "region_revenue",
      description: "Revenue and orders by region, from cleaned orders.",
      sql: "SELECT region, SUM(amount) AS revenue, COUNT(*) AS orders FROM orders_clean GROUP BY region",
      inputs: ["orders_clean"],
      inputsDeclared: true,
      grain: "one row per region",
      primaryKey: ["region"],
      columns: [
        { name: "region", type: "VARCHAR", description: "Where the order was placed." },
        { name: "revenue", type: "DOUBLE", description: "Sum of order amounts." },
        { name: "orders", type: "BIGINT", description: "Number of orders." },
      ],
      checks: [
        { name: "accepted_values_region", kind: CheckKind.ACCEPTED_VALUES, columns: ["region"], values: ["EU", "NA", "APAC"], severity: CheckSeverity.FAIL },
        { name: "row_count", kind: CheckKind.ROW_COUNT, minRows: 1n, severity: CheckSeverity.WARN },
      ],
    },
  ],
});

function ProposalReview() {
  const [round, setRound] = useState(0);
  const pipelines = useMemo(reviewPipeline, [round]);
  const [digest, setDigest] = useState<string | undefined>();
  const [decision, setDecision] = useState<DatasetDecision | undefined>();
  useEffect(() => {
    pipelineDigest(proposal).then(setDigest);
  }, []);
  return (
    <section className="card">
      <div className="card-head">
        <h2>Review a proposed dataset</h2>
        <span className="badge warn">Kept in this page</span>
      </div>
      <PipelinesProvider pipelines={pipelines}>
        <DatasetReview key={round} pipeline={proposal} dataset="region_revenue" expectedVersion={3} digest={digest} proposedBy="the demo agent" onDecide={setDecision} />
        {decision?.approved && <PipelineView pipelineId="sales" />}
      </PipelinesProvider>
      <p className="hint">
        What an agent's <code>propose_dataset</code> returns, drawn for a person. Change the grain, a description or a check, name yourself and approve: the pipeline is saved
        as a new version with who approved it, and nothing is built until someone runs it. The pipeline here lives in this page, so a save goes nowhere else.
      </p>
      {decision && (
        <button type="button" onClick={() => { setDecision(undefined); setRound((r) => r + 1); }}>
          Start again
        </button>
      )}
    </section>
  );
}

const nodes: PipelineNode[] = [
  { id: "files", name: "s3://acme-lake/landing", kind: "source" },
  { id: "crm", name: "crm.customers", kind: "source" },
  { id: "orders_raw", name: "orders_raw", kind: "streamingTable", layer: "bronze", status: "completed", rowsWritten: 128_400 },
  { id: "orders_clean", name: "orders_clean", kind: "streamingTable", layer: "silver", status: "completed", rowsWritten: 127_950, expectationsFailed: 450 },
  { id: "customers", name: "customers", kind: "materializedView", layer: "silver", status: "completed", rowsWritten: 8_210 },
  { id: "daily_revenue", name: "daily_revenue", kind: "materializedView", layer: "gold", status: "running" },
  { id: "top_customers", name: "top_customers", kind: "materializedView", layer: "gold", status: "idle" },
  { id: "kafka", name: "alerts topic", kind: "sink", status: "idle" },
];
const edges: PipelineEdge[] = [
  { from: "files", to: "orders_raw", mode: "streaming" },
  { from: "orders_raw", to: "orders_clean", mode: "streaming" },
  { from: "crm", to: "customers" },
  { from: "orders_clean", to: "daily_revenue" },
  { from: "orders_clean", to: "top_customers" },
  { from: "customers", to: "top_customers" },
  { from: "daily_revenue", to: "kafka", mode: "streaming" },
];
const start = Date.UTC(2026, 10, 12, 10);
const progress = Array.from({ length: 24 }, (_, i) => ({
  timestamp: new Date(start + i * 10_000).toISOString(),
  numInputRows: 800 + ((i * 137) % 400),
  inputRowsPerSecond: 80 + ((i * 13) % 40),
  processedRowsPerSecond: 110 - ((i * 7) % 35),
  batchDurationMs: 700 + ((i * 91) % 600),
  stateRows: 52_000 + i * 310,
}));

/** A live pipeline when the dev server is running, then the display components drawn from sample values. */
export function PipelinePage({ source }: { source: ActiveSource }) {
  const [selected, setSelected] = useState<string | undefined>("orders_clean");
  const [run, setRun] = useState("update-0042");
  return (
    <div className="stage">
      {source.pipelines && <LivePipeline source={source} pipelines={source.pipelines} />}
      <ProposalReview />
      <section className="card">
        <div className="card-head">
          <h2>Streaming pipeline (display components)</h2>
          <span className="badge warn">Sample values</span>
        </div>
        <PipelineGraph nodes={nodes} edges={edges} selected={selected} onSelect={(node) => setSelected(node.id)} height={340} />
        <p className="hint">
          These components show what a streaming pipeline engine such as Spark reports. None is connected, so the values are made up. Select a dataset to highlight what
          feeds it and what it feeds; dashed lines are streaming flows.
        </p>
      </section>
      <section className="card">
        <div className="card-head">
          <h2>Runs</h2>
        </div>
        <RunHistory
          selected={run}
          onSelect={(next) => setRun(next.id)}
          runs={[
            { id: "update-0042", state: "running", startTime: "2026-11-12T10:00:00Z", trigger: "schedule" },
            { id: "update-0041", state: "completed", startTime: "2026-11-12T04:00:00Z", endTime: "2026-11-12T04:03:12Z", trigger: "schedule" },
            { id: "update-0040", state: "failed", startTime: "2026-11-11T22:00:00Z", endTime: "2026-11-11T22:00:41Z", trigger: "manual", refreshKind: "fullRefresh", datasets: ["orders_clean"], errorMessage: "Expectation valid_amount failed the run" },
            { id: "update-0039", state: "completed", startTime: "2026-11-11T16:00:00Z", endTime: "2026-11-11T16:02:40Z", trigger: "schedule", refreshKind: "refresh", datasets: ["daily_revenue", "top_customers"] },
          ]}
        />
      </section>
      <section className="card">
        <div className="card-head">
          <h2>Streaming progress: orders_clean</h2>
        </div>
        <StreamMetrics progress={progress} />
      </section>
      <section className="card">
        <div className="card-head">
          <h2>Data quality</h2>
        </div>
        <ExpectationsPanel
          expectations={[
            { name: "valid_amount", dataset: "orders_clean", constraint: "amount >= 0", action: "drop", passedRecords: 127_950, failedRecords: 450 },
            { name: "has_customer", dataset: "orders_clean", constraint: "customer_id IS NOT NULL", action: "warn", passedRecords: 128_388, failedRecords: 12 },
            { name: "known_region", dataset: "customers", constraint: "region IN ('NA','EU','APAC','LATAM')", action: "fail", passedRecords: 8_210, failedRecords: 0 },
          ]}
        />
      </section>
      <section className="card">
        <div className="card-head">
          <h2>Schema changes in the latest files</h2>
        </div>
        <SchemaDiff
          mode="rescue"
          rescuedCount={37}
          changes={[
            { column: "coupon_code", change: "added", after: "string" },
            { column: "amount", change: "typeChanged", before: "int", after: "double" },
            { column: "legacy_flag", change: "removed", before: "boolean" },
          ]}
        />
      </section>
    </div>
  );
}
