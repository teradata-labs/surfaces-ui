import { App as McpApp } from "@modelcontextprotocol/ext-apps";
import {
  Chart,
  type ChartGrain,
  type ChartMeasure,
  type ChartType,
  type LegendPlacement,
  type PivotDimension,
  type PivotMeasure,
  PivotTable,
  type ContextNote,
  DataGrid,
  DataSourceProvider,
  DatasetReview,
  PipelineView,
  PipelinesProvider,
  QueryResult,
  SchemaExplorer,
  SqlEditor,
  type SqlEditorError,
  ThemeProvider,
  useSqlSchema,
  useTheme,
} from "@surfaces-ui/components";
import "@surfaces-ui/components/styles.css";
import { defaultTheme, themeFromHostStyles, themesEqual } from "@surfaces-ui/tokens";
import { type SurfaceAction, type SurfaceMessage, analyticsCatalog } from "@surfaces-ui/spec";
import { SurfaceView, analyticsRenderers, useSurfaces } from "@surfaces-ui/spec/react";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { type JsonObject, type JsonValue, fromJson } from "@bufbuild/protobuf";
import { PipelineDraftSchema } from "@surfaces-ui/proto";
import { turnText } from "@surfaces-ui/agent";
import { createRoot } from "react-dom/client";
import { type AppView, mcpDataSource, mcpPipelines } from "../protocol.js";
import "./app.css";

const app = new McpApp({ name: "Surfaces", version: "0.0.0" });
const dataSource = mcpDataSource((name, args) => app.callServerTool({ name, arguments: args }));
const pipelines = mcpPipelines((name, args) => app.callServerTool({ name, arguments: args }));

/**
 * What the person did here, kept as context for the model's next turn, not
 * sent as a request. The host keeps only the latest update, so it carries
 * every note so far, oldest first.
 */
const notes: string[] = [];
function note(entry: ContextNote) {
  notes.push(`- ${entry.summary}`);
  const text = ["What the person did in the Surfaces app (context, not a request):", ...notes.slice(-20)].join("\n");
  void app.updateModelContext({ content: [{ type: "text", text }] }).catch(() => {});
}

/** Tells the conversation what the person did, so the agent can respond. */
function tell(text: string) {
  void app.sendMessage({ role: "user", content: [{ type: "text", text }] }).catch(() => {});
}

type HostVariables = Record<string, string | undefined>;

/** Follows the host: its light or dark mode, and the colours it shares as style variables (the nearest preset, with its accent). */
function FollowHostTheme({ mode, variables }: { mode: "light" | "dark" | undefined; variables: HostVariables | undefined }) {
  const { setMode, setTheme, theme } = useTheme();
  useEffect(() => {
    if (mode) setMode(mode);
  }, [mode, setMode]);
  // Set only when it differs: a new theme object each time would redraw every chart, over and over.
  const wanted = useMemo(() => (variables ? themeFromHostStyles(variables, defaultTheme) : undefined), [variables]);
  useEffect(() => {
    if (wanted && !themesEqual(wanted, theme)) setTheme(wanted);
  }, [wanted, theme, setTheme]);
  return null;
}

function Editor({ sourceId, initial }: { sourceId: string; initial: string }) {
  const schema = useSqlSchema(sourceId);
  const [draft, setDraft] = useState(initial);
  const [sql, setSql] = useState(initial);
  const [error, setError] = useState<SqlEditorError | undefined>();
  const run = (text: string) => {
    setError(undefined);
    setSql(text);
  };
  return (
    <>
      <SqlEditor value={draft} onChange={setDraft} onRun={run} schema={schema} error={error} minHeight={100} placeholder="SELECT …" />
      <div className="app-actions">
        <button type="button" className="sf-button" data-variant="primary" onClick={() => run(draft)}>
          Run query
        </button>
        <button type="button" className="sf-button" disabled={draft.trim() === ""} onClick={() => tell(`I wrote this SQL in the editor:\n\n${draft}`)}>
          Send to chat
        </button>
      </div>
      {sql.trim() !== "" && <QueryResult sourceId={sourceId} sql={sql} height={360} onError={(m) => setError(m ? { message: m } : undefined)} />}
    </>
  );
}

/** A pipeline, and below it the rows of a dataset or the records that broke a check when the person asks. */
function Pipeline({ pipelineId, sourceId }: { pipelineId: string; sourceId: string }) {
  const [query, setQuery] = useState<{ sql: string; title: string } | undefined>();
  return (
    <>
      <PipelineView
        pipelineId={pipelineId}
        fullRefresh={false}
        onOpenTable={(table) => setQuery({ sql: `SELECT * FROM ${table}`, title: table })}
        onOpenSql={(sql) => setQuery({ sql, title: "Records that broke the check" })}
        onContext={note}
      />
      {query && (
        <section aria-label={query.title}>
          <h2 className="app-title">{query.title}</h2>
          <QueryResult key={query.sql} sourceId={sourceId} sql={query.sql} height={320} />
        </section>
      )}
    </>
  );
}

/** A proposal the server filled in. The person's decision goes back to the conversation as their message. */
function Review({ view }: { view: Extract<AppView, { view: "datasetReview" }> }) {
  const draft = useMemo(() => {
    try {
      return fromJson(PipelineDraftSchema, view.pipeline as JsonValue, { ignoreUnknownFields: false });
    } catch {
      return undefined;
    }
  }, [view.pipeline]);
  if (!draft) return <p className="app-note" role="alert">The proposal could not be read.</p>;
  return (
    <DatasetReview
      pipeline={draft}
      dataset={view.dataset}
      expectedVersion={view.expectedVersion}
      digest={view.digest}
      proposedBy={view.proposedBy}
      onContext={note}
      onDecide={(decision) =>
        tell(
          decision.approved
            ? `I approved ${view.dataset} in ${draft.name || draft.id}${decision.version ? `; it is saved as version ${decision.version}` : ""}. Nothing has been built yet.${decision.note ? ` Note: ${decision.note}` : ""}`
            : `I rejected the proposal for ${view.dataset}.${decision.note ? ` ${decision.note}` : ""}`,
        )
      }
    />
  );
}

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value ?? {}, (_, v) => (typeof v === "bigint" ? String(v) : v))) as JsonObject;

function Surfaces({ messages }: { messages: SurfaceMessage[] }) {
  const { surfaces, problems } = useSurfaces(analyticsCatalog, messages);
  // Where each surface stands and what went wrong, told to the model with the next event, as chat does.
  const states = useRef(new Map<string, { data?: unknown; controls: Record<string, unknown> }>());
  const pending = useRef<{ surfaceId: string; code: string; path: string; message: string }[]>([]);
  const stateOf = (id: string) => states.current.get(id) ?? (states.current.set(id, { controls: {} }), states.current.get(id)!);
  const onAction = (action: SurfaceAction) => {
    const text = turnText({
      input: { case: "action", value: { name: action.name, surfaceId: action.surfaceId, sourceComponentId: action.sourceComponentId, timestamp: action.timestamp, context: asJson(action.context), ...(action.dataModel !== undefined ? { dataModel: asJson(action.dataModel) } : {}) } },
      surfaces: Object.values(surfaces).map((surface) => ({
        surfaceId: surface.surfaceId,
        dataModel: asJson(states.current.get(surface.surfaceId)?.data ?? surface.data),
        controls: Object.fromEntries(Object.entries(states.current.get(surface.surfaceId)?.controls ?? {}).map(([id, c]) => [id, asJson(c)])),
        expects: Object.entries(surface.expects ?? {}).map(([event, schema]) => ({ event, schema: asJson(schema) })),
      })),
      surfaceErrors: pending.current.splice(0),
    });
    tell(text);
  };
  return (
    <>
      {Object.values(surfaces).map((surface) => (
        <SurfaceView
          key={surface.surfaceId}
          surface={surface}
          catalog={analyticsCatalog}
          renderers={analyticsRenderers}
          onAction={onAction}
          onDataChange={(data) => (stateOf(surface.surfaceId).data = data)}
          onControlsChange={(id, controls) => (stateOf(surface.surfaceId).controls[id] = controls)}
          onProblem={(p) => pending.current.push({ surfaceId: surface.surfaceId, code: p.code, path: p.path, message: p.message })}
        />
      ))}
      {problems.map((problem, index) => (
        <p key={index} className="app-note" role="alert">
          {problem.path} {problem.message}
        </p>
      ))}
    </>
  );
}

function View({ view }: { view: AppView }) {
  switch (view.view) {
    case "grid":
      return <DataGrid sourceId={view.sourceId} sql={view.sql} height={420} label={view.title} />;
    case "chart":
      return (
        <Chart
          sourceId={view.sourceId}
          sql={view.sql}
          type={view.type as ChartType}
          x={view.x}
          xGrain={view.xGrain as ChartGrain | undefined}
          xBins={view.xBins}
          y={view.y as ChartMeasure[]}
          splitBy={view.splitBy}
          stacked={view.stacked}
          legend={view.legend as LegendPlacement | undefined}
          height={340}
          label={view.title}
        />
      );
    case "pivot":
      return (
        <PivotTable
          sourceId={view.sourceId}
          sql={view.sql}
          rows={view.rows as PivotDimension[]}
          columns={(view.columns as PivotDimension[] | undefined) ?? []}
          measures={view.measures as PivotMeasure[]}
          height={420}
          label={view.title}
        />
      );
    case "result":
      return <QueryResult sourceId={view.sourceId} sql={view.sql} height={400} />;
    case "editor":
      return <Editor sourceId={view.sourceId} initial={view.sql} />;
    case "schema":
      return <SchemaExplorer sourceId={view.sourceId} height={440} onInsert={(name) => tell(`Tell me about ${name}.`)} />;
    case "surface":
      return <Surfaces messages={view.messages as SurfaceMessage[]} />;
    case "pipeline":
      return <Pipeline pipelineId={view.pipelineId} sourceId={view.sourceId} />;
    case "datasetReview":
      return <Review view={view} />;
  }
}

function Root() {
  const [view, setView] = useState<AppView | undefined>();
  const [failed, setFailed] = useState<string | undefined>();
  const [mode, setMode] = useState<"light" | "dark" | undefined>();
  const [variables, setVariables] = useState<HostVariables | undefined>();
  const key = useMemo(() => JSON.stringify(view), [view]);

  useEffect(() => {
    app.ontoolresult = (result) => {
      if (result.isError) {
        const first = (result.content?.[0] as { text?: string } | undefined)?.text;
        setFailed(first ?? "The tool reported an error.");
        return;
      }
      const next = result.structuredContent as AppView | undefined;
      if (next && typeof next.view === "string") {
        setFailed(undefined);
        setView(next);
      }
    };
    app.onhostcontextchanged = (context) => {
      if (context.theme) setMode(context.theme);
      if (context.styles?.variables) setVariables(context.styles.variables);
    };
    app
      .connect()
      .then(() => {
        setMode(app.getHostContext()?.theme);
        setVariables(app.getHostContext()?.styles?.variables);
      })
      .catch((error: unknown) => setFailed(error instanceof Error ? error.message : String(error)));
  }, []);

  return (
    <ThemeProvider storage={null}>
      <FollowHostTheme mode={mode} variables={variables} />
      <DataSourceProvider dataSource={dataSource}>
        <PipelinesProvider pipelines={pipelines}>
        <main className="app">
          {view && "title" in view && view.title && <h1 className="app-title">{view.title}</h1>}
          {failed ? (
            <p className="app-note" role="alert">
              {failed}
            </p>
          ) : view ? (
            <View key={key} view={view} />
          ) : (
            <p className="app-note">Waiting for data…</p>
          )}
        </main>
        </PipelinesProvider>
      </DataSourceProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
