import {
  AskData,
  CodeBlock,
  ContextBuilder,
  type ContextDraft,
  DataSearch,
  type Expectation,
  ExpectationsPanel,
  type IngestDraft,
  IngestWizard,
  Markdown,
  Metric,
  RowList,
  type SortSpec,
  type MetricProps,
  type ExploreState,
  Explorer,
  FileBrowser,
  type FilterSpec,
  type Pill,
  ReportBuilder,
  type ReportState,
  type ReportTile,
  ModelDiagram,
  type ModelJoin,
  ObjectBrowser,
  ObjectDetail,
  type PipelineEdge,
  DatasetReview,
  PipelineGraph,
  type PipelineNode,
  PipelineView,
  QueryFilters,
  QueryPlan,
  type PipelineRun,
  QueryResult,
  NodeGraph,
  RelationshipGraph,
  SideNav,
  Workspace,
  type WorkspaceIconName,
  type WorkspaceLayout,
  RunHistory,
  type SchemaChange,
  SchemaDiff,
  SourceList,
  SqlEditor,
  type SqlEditorDialect,
  StreamMetrics,
  type StreamProgress,
  BulletGraph,
  type FlowStep,
  PiiReview,
  type PiiColumn,
  PlanReview,
  type PlanStep,
  Sparkline,
  type SparklineProps,
  StepFlow,
  ActionReceipt,
  type ActionReceiptProps,
  addToContext,
  emptyContextDraft,
  tableRef,
  emptyIngestDraft,
  useOptionalDiscovery,
  useOptionalPipelines,
  useOptionalTheme,
  SemanticModelEditor,
  type SemanticModelState,
  type SemanticProposal,
  applyProposal,
  emptyModel,
  modelChanges,
  proposalFrom,
  useSemanticModel,
} from "@surfaces-ui/components";
import { fromJson } from "@bufbuild/protobuf";
import { type PipelineDraft, PipelineDraftSchema, type SemanticModel, SortDirection } from "@surfaces-ui/proto";
import { type Mode, type Theme, type ThemeRequest, applyThemeRequest } from "@surfaces-ui/tokens";
import { type CSSProperties, Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { safeUrl } from "../functions.js";
import type { ComponentRenderer, RenderProps } from "./Surface.js";
import { withFilters } from "./renderers.js";
import { ConversationView } from "./conversation.js";
import { spaceAttributes } from "./layout.js";

const text = (value: unknown): string => (value == null ? "" : typeof value === "object" ? "" : String(value));
/** Sorts as an agent writes them, as a query takes them. */
const sortInits = (sorts: SortSpec[]) => sorts.map((sort) => ({ column: sort.column, direction: sort.desc === true ? SortDirection.DESC : SortDirection.ASC }));

/**
 * Draws `draw` with the semantic model named in `name` once it is loaded,
 * and with nothing when there is no name. Saving goes through the page's
 * `SemanticsProvider`; a page without one says so in place of the component.
 */
function WithModel({ name, draw }: { name: unknown; draw(model: SemanticModelState | undefined): ReactNode }) {
  const wanted = typeof name === "string" && name ? name : undefined;
  const state = useSemanticModel(wanted);
  if (!wanted) return <>{draw(undefined)}</>;
  if (!state.model)
    return (
      <p className="sf-surface-notice" role="note">
        {state.problem ?? `Loading the semantic model “${wanted}”…`}
      </p>
    );
  return <>{draw(state)}</>;
}

function SemanticModelView({ props, component, dispatch, reportControls, reportContext }: RenderProps) {
  const proposal = props.proposed && typeof props.proposed === "object" ? (props.proposed as SemanticProposal) : undefined;
  const making = props.create && typeof props.create === "object" ? (props.create as { label?: string; description?: string; sourceId?: string }) : undefined;
  const by = text(props.proposedBy) || "the agent";
  const name = typeof props.model === "string" ? props.model : "";
  const state = useSemanticModel(name || undefined);
  const key = JSON.stringify([proposal ?? null, making ?? null]);
  const shared = { proposal, by, component, dispatch, reportControls, reportContext };
  if (state.model) return <SemanticModelProposal key={`${key}:${state.model.version}`} state={state} model={state.model} {...shared} />;
  if (making && state.missing) {
    const start = emptyModel({ name, label: making.label ?? "", description: making.description ?? "", sourceId: making.sourceId ?? "" });
    return <SemanticModelProposal key={key} state={state} model={start} {...shared} />;
  }
  return (
    <p className="sf-surface-notice" role="note">
      {state.problem ?? `Loading the semantic model “${name}”…`}
    </p>
  );
}

/** The editor over a model, saved or new, starting from the agent's proposal as a draft. */
function SemanticModelProposal({
  state,
  model,
  proposal,
  by,
  component,
  dispatch,
  reportControls,
  reportContext,
}: { state: SemanticModelState; model: SemanticModel; proposal: SemanticProposal | undefined; by: string } & Pick<RenderProps, "component" | "dispatch" | "reportControls" | "reportContext">) {
  const isNew = model.version === 0;
  const [draft, setDraft] = useState(() => {
    if (!proposal) return isNew ? model : undefined;
    const next = applyProposal(model, proposal, by);
    return isNew || modelChanges(model, next).size > 0 ? next : undefined;
  });
  // What the person leaves in the draft goes back in the form the agent wrote it in.
  const report = (next: typeof draft) => reportControls({ proposed: next ? proposalFrom(model, next) : null });
  const ask = component.action != null ? (words: string) => dispatch(component.action, { text: words }) : undefined;
  return (
    <SemanticModelEditor
      model={model}
      draft={draft}
      proposedBy={draft && proposal ? by : undefined}
      problem={state.problem && !state.missing ? state.problem : undefined}
      building={isNew && !proposal?.rows}
      onDraftChange={(next) => {
        setDraft(next);
        report(next);
      }}
      onAsk={ask}
      onSave={async (next, note) => {
        const changes = Object.fromEntries(modelChanges(model, next));
        const saved = await state.save(next, note);
        if (saved && component.action != null) dispatch(component.action, { model: saved.name, version: saved.version, changes });
        return saved;
      }}
      onContext={reportContext}
    />
  );
}

/**
 * Opening a table from a catalog component: its name goes to the surface's
 * own data when the component has `opened`, so a detail bound to that path
 * follows with no agent, and the declared event is sent as well.
 */
function opener({ component, dispatch, setData }: Pick<RenderProps, "component" | "dispatch" | "setData">) {
  return (table: string, extra: Record<string, unknown> = {}) => {
    if (!table) return;
    if (component.opened != null) setData(component.opened, table);
    dispatch(component.action, { table, ...extra });
  };
}

/**
 * A workspace keeps its layout while a person arranges it, takes a new one
 * whenever the agent sends one, and reports how the person left it in the
 * shape of its `layout` prop, so the agent sees it on its next turn.
 */
/** A report from an agent's props, and a person's changes reported back in the same form. */
function ReportView({ props, component, dispatch, reportControls, reportContext }: RenderProps) {
  const given: ReportState = {
    ...(typeof props.title === "string" && props.title ? { title: props.title } : {}),
    fields: Array.isArray(props.fields) ? (props.fields as Pill[]).map((pill) => (pill.by ? pill : { ...pill, by: "the agent" })) : [],
    filters: Array.isArray(props.filters) ? (props.filters as FilterSpec[]) : [],
    tiles: Array.isArray(props.tiles) ? (props.tiles as ReportTile[]) : [],
    ...(props.draft && typeof props.draft === "object" ? { draft: props.draft as ReportState["draft"] } : {}),
  };
  const key = JSON.stringify(given);
  const [report, setReport] = useState(given);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `given`.
  useEffect(() => setReport(given), [key]);
  return (
    <WithModel
      name={props.model}
      draw={(semantic) => (
    <ReportBuilder
      sourceId={text(props.sourceId) || undefined}
      sql={text(props.sql) || undefined}
      model={semantic?.model}
      onPromote={semantic?.promote}
      value={report}
      mode={props.mode === "build" || props.mode === "view" ? props.mode : undefined}
      onContext={reportContext}
      onChange={(next) => {
        setReport(next);
        reportControls({ title: next.title ?? null, fields: next.fields, filters: next.filters, tiles: next.tiles, ...(next.draft ? { draft: next.draft } : {}) });
      }}
      onAsk={component.action != null ? (words) => dispatch(component.action, { text: words }) : undefined}
    />
      )}
    />
  );
}

/** The explorer's state from an agent's props: whatever is given, and nothing for what is not. */
function ExplorerView({ props, component, dispatch, reportControls, reportContext }: RenderProps) {
  const given: ExploreState = {
    // A pill that came with the surface and does not say who made it was written by whoever sent the surface.
    fields: Array.isArray(props.fields) ? (props.fields as Pill[]).map((pill) => (pill.by ? pill : { ...pill, by: "the agent" })) : [],
    rows: Array.isArray(props.rows) ? (props.rows as string[]) : [],
    ...(typeof props.split === "string" && props.split ? { split: props.split } : {}),
    values: Array.isArray(props.values) ? (props.values as string[]) : [],
    filters: Array.isArray(props.filters) ? (props.filters as FilterSpec[]) : [],
    ...(props.view === "chart" || props.view === "table" ? { view: props.view } : {}),
    ...(props.chart && typeof props.chart === "object" ? { chart: props.chart as ExploreState["chart"] } : {}),
  };
  // What an agent sends starts the state again; a person then changes it, and each change is reported in the props' own form.
  const key = JSON.stringify(given);
  const [state, setState] = useState(given);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `given`.
  useEffect(() => setState(given), [key]);
  return (
    <WithModel
      name={props.model}
      draw={(semantic) => (
        <Explorer
          sourceId={text(props.sourceId) || undefined}
          sql={text(props.sql) || undefined}
          model={semantic?.model}
          onPromote={semantic?.promote}
          value={state}
          onChange={(next) => {
            setState(next);
            reportControls({ fields: next.fields, rows: next.rows, split: next.split ?? null, values: next.values, filters: next.filters, ...(next.view ? { view: next.view } : {}), chart: next.chart ?? null });
          }}
          onContext={reportContext}
          onAsk={component.action != null ? (words) => dispatch(component.action, { text: words }) : undefined}
        />
      )}
    />
  );
}

function WorkspaceView({ props, child, reportControls }: RenderProps) {
  const panels = ((props.panels as { id: string; title: string; short?: string; icon?: WorkspaceIconName; child: unknown }[]) ?? []).map((panel) => ({
    id: panel.id,
    title: text(panel.title) || panel.id,
    ...(panel.short ? { shortTitle: text(panel.short) } : {}),
    ...(panel.icon ? { icon: panel.icon } : {}),
    content: child(panel.child),
  }));
  const sent = JSON.stringify(props.layout ?? null);
  const [layout, setLayout] = useState<WorkspaceLayout | undefined>(props.layout as WorkspaceLayout | undefined);
  const last = useRef(sent);
  useEffect(() => {
    if (last.current === sent) return;
    last.current = sent;
    setLayout(props.layout as WorkspaceLayout | undefined);
  }, [sent, props.layout]);
  return (
    <Workspace
      label={text(props.label) || "Panels"}
      panels={panels}
      layout={layout}
      rail={props.rail === "none" ? false : props.rail === "left" ? "left" : "right"}
      defaultRailLabels={props.railLabels === true}
      height={typeof props.height === "number" ? props.height : 520}
      onLayoutChange={(next) => {
        setLayout(next);
        reportControls({ layout: next });
      }}
    />
  );
}

/** Discovery components need a backend; without one they say so instead of failing. */
function WithDiscovery({ children }: { children: ReactNode }) {
  return useOptionalDiscovery() ? (
    <>{children}</>
  ) : (
    <p className="sf-surface-notice" role="note">
      This needs a discovery backend: wrap the page in DiscoveryProvider.
    </p>
  );
}

function DecisionCardView({ props, component, dispatch }: RenderProps) {
  const options = (props.options as { id: string; label: string; description?: string; recommended?: boolean }[]) ?? [];
  const [chosen, setChosen] = useState<string | undefined>();
  return (
    <section className="sf-a2-decision" aria-label={text(props.title)}>
      <p className="sf-a2-decision-title">{text(props.title)}</p>
      {props.detail != null && <p className="sf-a2-decision-detail">{text(props.detail)}</p>}
      <div className="sf-a2-decision-options">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="sf-a2-decision-option"
            aria-pressed={chosen === option.id}
            disabled={chosen !== undefined}
            onClick={() => {
              setChosen(option.id);
              dispatch(component.action, { choice: option.id, label: option.label });
            }}
          >
            <span className="sf-a2-decision-label">
              {option.label}
              {option.recommended && <span className="sf-schema-tag">Recommended</span>}
            </span>
            {option.description && <span className="sf-a2-decision-description">{option.description}</span>}
          </button>
        ))}
      </div>
      {chosen !== undefined && (
        <p className="sf-a2-decision-detail" role="status">
          You chose {options.find((o) => o.id === chosen)?.label}.
        </p>
      )}
    </section>
  );
}

function SqlProposalView({ props, component, dispatch }: RenderProps) {
  const sql = text(props.sql);
  // The SQL runs only after a person presses Run, and then through the read-only DataSource.
  const [ran, setRan] = useState<string | undefined>();
  return (
    <section className="sf-a2-proposal" aria-label={text(props.title) || "Proposed SQL"}>
      {props.title != null && <p className="sf-a2-decision-title">{text(props.title)}</p>}
      <CodeBlock
        code={sql}
        language="sql"
        onRun={(code) => {
          setRan(new Date().toISOString());
          dispatch(component.action, { sql: code });
        }}
      />
      {ran ? <QueryResult sourceId={text(props.sourceId)} sql={sql} notBefore={ran} height={320} /> : <p className="sf-a2-decision-detail">Proposed by the agent. It has not been run.</p>}
    </section>
  );
}

function SqlEditorView({ props, component, dispatch }: RenderProps) {
  const [value, setValue] = useState(text(props.sql));
  const run = (sql: string) => dispatch(component.action, { sql });
  return (
    <div className="sf-a2-editor">
      <SqlEditor value={value} onChange={setValue} onRun={run} dialect={(text(props.dialect) || "standard") as SqlEditorDialect} minHeight={100} />
      {component.action != null && (
        <button type="button" className="sf-button" data-variant="primary" onClick={() => run(value)}>
          Run
        </button>
      )}
    </div>
  );
}

function ContextBuilderView({ props }: RenderProps) {
  const [draft, setDraft] = useState<ContextDraft>(() =>
    ((props.tables as { sourceId: string; table: string }[]) ?? []).reduce((current, item) => addToContext(current, item.sourceId, item.table), {
      ...emptyContextDraft,
      name: text(props.name),
    }),
  );
  return <ContextBuilder value={draft} onChange={setDraft} />;
}

/** Pipeline components need a backend; without one they say so instead of failing. */
function WithPipelines({ children }: { children: ReactNode }) {
  return useOptionalPipelines() ? (
    <>{children}</>
  ) : (
    <p className="sf-surface-notice" role="note">
      This needs a pipeline backend: wrap the page in PipelinesProvider.
    </p>
  );
}

function IngestWizardView({ props }: { props: Record<string, unknown> }) {
  const [draft, setDraft] = useState<IngestDraft>({ ...emptyIngestDraft, location: text(props.location), format: (text(props.format) || "parquet") as IngestDraft["format"] });
  return <IngestWizard sourceId={text(props.sourceId)} value={draft} onChange={setDraft} />;
}

/** A proposal as the agent sent it, in the contract's JSON form, checked before it is drawn. */
function DatasetReviewView({ props, component, dispatch, reportContext }: RenderProps) {
  const raw = JSON.stringify(props.pipeline ?? null);
  const [parsed, setParsed] = useState<{ draft?: PipelineDraft; problem?: string }>({});
  useEffect(() => {
    try {
      setParsed({ draft: fromJson(PipelineDraftSchema, JSON.parse(raw), { ignoreUnknownFields: false }) });
    } catch (error) {
      setParsed({ problem: `The proposed pipeline could not be read: ${error instanceof Error ? error.message : String(error)}` });
    }
  }, [raw]);
  if (parsed.problem)
    return (
      <p className="sf-surface-notice" role="note">
        {parsed.problem}
      </p>
    );
  if (!parsed.draft) return null;
  return (
    <DatasetReview
      pipeline={parsed.draft}
      dataset={text(props.dataset)}
      expectedVersion={typeof props.expectedVersion === "number" ? props.expectedVersion : 0}
      digest={text(props.digest) || undefined}
      proposedBy={text(props.proposedBy) || undefined}
      onDecide={(decision) => dispatch(component.action, { ...decision })}
      onContext={reportContext}
    />
  );
}

function PipelineGraphView({ props, action, dispatch }: { props: Record<string, unknown>; action: unknown; dispatch: RenderProps["dispatch"] }) {
  const [selected, setSelected] = useState<string | undefined>();
  return (
    <PipelineGraph
      nodes={(props.nodes as PipelineNode[]) ?? []}
      edges={(props.edges as PipelineEdge[]) ?? []}
      height={typeof props.height === "number" ? props.height : 320}
      selected={selected}
      onSelect={(node) => {
        setSelected(node.id);
        dispatch(action, { id: node.id, name: node.name });
      }}
    />
  );
}

/**
 * Applies a theme request to the page it is on, once, and says what it did.
 * The change is the agent's, so it is visible and a person can undo it.
 */
function ThemeSwitchView({ props }: { props: Record<string, unknown> }) {
  const host = useOptionalTheme();
  const key = JSON.stringify(props);
  const [before, setBefore] = useState<{ theme: Theme; mode: Mode } | undefined>();
  const [outcome, setOutcome] = useState<{ text: string; problems: string[] } | undefined>();
  const apply = useRef(host);
  apply.current = host;
  useEffect(() => {
    const current = apply.current;
    if (!current) return;
    const { id: _, component: __, ...request } = props;
    const result = applyThemeRequest(request as ThemeRequest, current.theme, { themes: current.themes });
    setBefore({ theme: current.theme, mode: current.mode });
    current.setTheme(result.theme);
    if (result.mode) current.setMode(result.mode);
    setOutcome({ text: `The page now uses ${result.theme.name}${result.mode ? `, ${result.mode}` : ""}.`, problems: result.problems });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!host) {
    return (
      <p className="sf-surface-notice" role="note">
        The theme cannot be changed here: this page has no ThemeProvider.
      </p>
    );
  }
  return (
    <div className="sf-a2-theme-switch" role="status">
      <span>{outcome?.text ?? "Changing the theme…"}</span>
      {outcome?.problems.map((problem) => (
        <span key={problem} className="sf-object-muted">
          {problem}
        </span>
      ))}
      {before && (
        <button
          type="button"
          className="sf-button"
          onClick={() => {
            host.setTheme(before.theme);
            host.setMode(before.mode);
            setBefore(undefined);
            setOutcome({ text: "Theme change undone.", problems: [] });
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}

/** Where a Grid's children sit in the height of their row; the values are CSS `align-items` values as they are. */
const GRID_ALIGN = new Set(["start", "center", "end", "stretch"]);

/** Renderers for the conversation, discovery and modelling components of the analytics catalog. */
export const moreRenderers: Record<string, ComponentRenderer> = {
  Grid: ({ props, component, children }) => {
    const columns = typeof props.columns === "number" ? props.columns : 2;
    // A share per column, when there is exactly one for each; anything else leaves the columns equal.
    const widths = Array.isArray(props.widths) && props.widths.length === columns && props.widths.every((w) => typeof w === "number" && w > 0) ? (props.widths as number[]) : undefined;
    const align = typeof props.align === "string" && GRID_ALIGN.has(props.align) ? props.align : undefined;
    return (
      <div
        className="sf-a2-grid"
        data-align={align}
        data-arrange-container
        data-widths={widths ? true : undefined}
        {...spaceAttributes(props, { gap: true })}
        style={{ "--sf-grid-columns": columns, ...(align ? { alignItems: align } : {}), ...(widths ? { "--sf-grid-template": widths.map((w) => `minmax(0, ${w}fr)`).join(" ") } : {}) } as CSSProperties}
      >
        {children(component.children)}
      </div>
    );
  },
  Metric: ({ props }) => withFilters(props.filters, (filters) => (
    <Metric
      filters={filters}
      sourceId={text(props.sourceId)}
      sql={text(props.sql)}
      column={text(props.column) || undefined}
      aggregate={props.aggregate as MetricProps["aggregate"]}
      percentile={typeof props.percentile === "number" ? props.percentile : undefined}
      label={text(props.label)}
      format={(text(props.format) || undefined) as MetricProps["format"]}
      currency={text(props.currency) || undefined}
      emptyMessage={text(props.emptyMessage) || undefined}
      errorMessage={text(props.errorMessage) || undefined}
    />
  )),
  Message: ({ props }) => (
    <div className="sf-a2-message" data-side={props.side === "end" ? "end" : "start"}>
      <p className="sf-a2-message-who">
        <b>{text(props.speaker)}</b>
        {props.time != null && text(props.time) !== "" && <span>{text(props.time)}</span>}
      </p>
      <div className="sf-a2-message-body">
        <Markdown text={text(props.text)} />
      </div>
    </div>
  ),
  Conversation: (renderProps) => <ConversationView {...renderProps} />,
  RowList: ({ props, component, rows, reportContext }) =>
    withFilters(props.filters, (filters) => (
      <RowList
        sourceId={text(props.sourceId)}
        sql={text(props.sql)}
        label={text(props.label) || "Rows"}
        filters={filters}
        sorts={Array.isArray(props.sorts) ? sortInits(props.sorts as SortSpec[]) : undefined}
        pageSize={typeof props.pageSize === "number" ? props.pageSize : undefined}
        rowKey={text(props.rowKey) || undefined}
        layout={props.layout === "grid" ? "grid" : "list"}
        onContext={reportContext}
        // Each row is drawn by the surface itself, so the template is checked, traced and framed like any component.
        renderRow={(row, index) => rows(component.child, [row]).map((drawn) => <Fragment key={index}>{drawn}</Fragment>)}
        emptyMessage={text(props.emptyMessage) || undefined}
        errorMessage={text(props.errorMessage) || undefined}
      />
    )),
  Markdown: ({ props }) => <Markdown text={text(props.text)} />,
  CodeBlock: ({ props }) => <CodeBlock code={text(props.code)} language={text(props.language) || undefined} />,
  Table: ({ props }) => {
    const columns = (props.columns as string[]) ?? [];
    const rows = (props.rows as unknown[][]) ?? [];
    return (
      <div className="sf-markdown-table sf-a2-table">
        <table>
          {props.caption != null && <caption>{text(props.caption)}</caption>}
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={index} scope="col">
                  {text(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {columns.map((_, c) => (
                  <td key={c} data-numeric={typeof row[c] === "number" || undefined}>
                    {text(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
  Link: ({ props }) => {
    const href = safeUrl(props.url);
    return href ? (
      <a className="sf-a2-link" href={href} target="_blank" rel="noreferrer noopener">
        {text(props.text)}
      </a>
    ) : (
      <span>{text(props.text)}</span>
    );
  },
  Checklist: ({ props }) => (
    <ul className="sf-a2-checklist">
      {((props.items as { label: unknown; done?: boolean }[]) ?? []).map((item, index) => (
        <li key={index} data-done={item.done || undefined}>
          <span aria-hidden="true">{item.done ? "✓" : "○"}</span>
          <span>
            {text(item.label)}
            <span className="sf-a2-visually-hidden">{item.done ? " (done)" : " (to do)"}</span>
          </span>
        </li>
      ))}
    </ul>
  ),
  Chips: ({ props, component, dispatch, setData }) => {
    const items = ((props.items as (string | { label: string; value: string })[]) ?? []).map((item) => (typeof item === "string" ? { label: item, value: item } : item));
    // With `selected`, a press writes the value into the surface's own data, so whatever is bound to that path follows with no agent.
    const bound = component.selected != null;
    return (
      <div className="sf-a2-chips" role={bound ? "group" : undefined}>
        {items.map((item) => (
          <button
            key={`${item.label}\u0000${item.value}`}
            type="button"
            className="sf-button"
            aria-pressed={bound ? props.selected === item.value : undefined}
            onClick={() => {
              if (bound) setData(component.selected, item.value);
              dispatch(component.action, { value: item.value });
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  },
  Workspace: (renderProps) => <WorkspaceView {...renderProps} />,
  SideNav: ({ props, component, dispatch }) => {
    const groups = ((props.groups as { label?: string; items: { id: string; label: string; href?: string }[] }[]) ?? []).map((group) => ({
      ...(group.label ? { label: group.label } : {}),
      // A link an agent wrote goes through the same check as any other: http and https only.
      items: (group.items ?? []).map((item) => ({ id: item.id, label: item.label, ...(item.href && safeUrl(item.href) ? { href: safeUrl(item.href)! } : {}) })),
    }));
    return (
      <SideNav
        className="sf-a2-sidenav"
        label={text(props.label) || "Sections"}
        groups={groups}
        current={text(props.current) || undefined}
        defaultPinned={props.pinned !== false}
        onSelect={(id) => {
          // A link navigates by itself; only an item without one is an event.
          if (!groups.some((group) => group.items.some((item) => item.id === id && item.href))) dispatch(component.action, { id });
        }}
      />
    );
  },
  DecisionCard: (renderProps) => <DecisionCardView {...renderProps} />,
  SqlProposal: (renderProps) => <SqlProposalView {...renderProps} />,
  SqlEditor: (renderProps) => <SqlEditorView {...renderProps} />,
  ObjectBrowser: (args) => {
    const open = opener(args);
    return (
      <ObjectBrowser
        sourceId={text(args.props.sourceId)}
        height={typeof args.props.height === "number" ? args.props.height : 360}
        onSelect={(item) => (item.kind === "table" || item.kind === "column" || item.kind === "join") && open(item.table ?? "", { column: item.column ?? "" })}
      />
    );
  },
  Explorer: (args) => <ExplorerView {...args} />,
  SemanticModelEditor: (args) => <SemanticModelView {...args} />,
  ReportBuilder: (args) => <ReportView {...args} />,
  FilterBar: ({ props, component, setData, dispatch, reportControls, reportContext }) => (
    <QueryFilters
      sourceId={text(props.sourceId)}
      sql={text(props.sql)}
      // The binding is resolved to the list as it stands; anything else there is treated as no filters.
      filters={Array.isArray(props.filters) ? (props.filters as FilterSpec[]) : []}
      columns={Array.isArray(props.columns) ? (props.columns as string[]) : undefined}
      onContext={reportContext}
      onChange={(next) => {
        setData(component.filters, next);
        reportControls({ filters: next });
        if (component.action != null) dispatch(component.action, { filters: next });
      }}
    />
  ),
  FileBrowser: ({ props, component, dispatch, reportContext }) => (
    <FileBrowser
      sourceId={text(props.sourceId) || undefined}
      local={props.local === true}
      onContext={reportContext}
      height={typeof props.height === "number" ? props.height : 360}
      onOpen={component.action != null ? (item, place) => dispatch(component.action, { path: item.path, name: item.name, place: place.id, format: item.format ?? "" }) : undefined}
    />
  ),
  ModelDiagram: ({ props, component, dispatch }) => (
    <ModelDiagram
      sourceId={text(props.sourceId)}
      tables={(props.tables as string[]) ?? []}
      joins={(props.joins as ModelJoin[]) ?? []}
      rowsFrom={props.rowsFrom === true}
      suggestJoins={props.suggest !== false}
      height={typeof props.height === "number" ? props.height : 360}
      onUseSql={component.action != null ? (sql, model) => dispatch(component.action, { sql, tables: model.tables, joins: model.joins }) : undefined}
    />
  ),
  DataSearch: (args) => {
    const open = opener(args);
    return (
      <WithDiscovery>
        <DataSearch sourceIds={text(args.props.sourceId) ? [text(args.props.sourceId)] : undefined} height={typeof args.props.height === "number" ? args.props.height : undefined} onOpen={(object) => open(object.ref?.table ?? "", { column: object.ref?.column ?? "" })} />
      </WithDiscovery>
    );
  },
  ObjectDetail: (args) => {
    const open = opener(args);
    const table = text(args.props.table);
    return (
      <WithDiscovery>
        {table ? (
          <ObjectDetail key={table} objectRef={tableRef(text(args.props.sourceId), table)} onOpen={(object) => open(object.ref?.table ?? "")} />
        ) : (
          <p className="sf-search-empty">Open a table to see what is known about it.</p>
        )}
      </WithDiscovery>
    );
  },
  RelationshipGraph: (args) => {
    const open = opener(args);
    const table = text(args.props.table);
    return (
      <WithDiscovery>
        {table ? <RelationshipGraph key={table} objectRef={tableRef(text(args.props.sourceId), table)} onOpen={(object) => open(object.ref?.table ?? "")} /> : null}
      </WithDiscovery>
    );
  },
  NodeGraph: ({ props, component, dispatch, setData, reportContext }) => {
    const levels = props.levels !== null && typeof props.levels === "object" ? (props.levels as Record<string, string>) : undefined;
    return (
      <NodeGraph
        label={text(props.label)}
        nodes={Array.isArray(props.nodes) ? (props.nodes as Parameters<typeof NodeGraph>[0]["nodes"]) : []}
        links={Array.isArray(props.links) ? (props.links as Parameters<typeof NodeGraph>[0]["links"]) : []}
        {...(text(props.selected) ? { selected: text(props.selected) } : {})}
        {...(Array.isArray(props.groups) ? { groups: props.groups as string[] } : {})}
        {...(levels ? { levels } : {})}
        {...(text(props.noun) ? { noun: text(props.noun) } : {})}
        {...(typeof props.height === "number" ? { height: props.height } : {})}
        onSelect={(node) => {
          // Bound to a path, the open node is written there, so anything else bound to it follows with no agent.
          if (component.selected !== null && typeof component.selected === "object") setData(component.selected, node);
          if (component.action != null) dispatch(component.action, { node });
        }}
        onContext={reportContext}
      />
    );
  },
  AskData: ({ props }) => (
    <WithDiscovery>
      <AskData sourceIds={text(props.sourceId) ? [text(props.sourceId)] : undefined} contextPackId={text(props.contextPackId) || undefined} />
    </WithDiscovery>
  ),
  Sparkline: ({ props }) => withFilters(props.filters, (filters) => (
    <Sparkline
      filters={filters}
      sourceId={text(props.sourceId)}
      sql={text(props.sql)}
      x={text(props.x)}
      grain={props.grain as SparklineProps["grain"]}
      column={text(props.column) || undefined}
      aggregate={props.aggregate as SparklineProps["aggregate"]}
      label={text(props.label)}
      format={(text(props.format) || undefined) as SparklineProps["format"]}
      currency={text(props.currency) || undefined}
      points={typeof props.points === "number" ? props.points : undefined}
      emptyMessage={text(props.emptyMessage) || undefined}
      errorMessage={text(props.errorMessage) || undefined}
    />
  )),
  BulletGraph: ({ props }) => withFilters(props.filters, (filters) => (
    <BulletGraph
      filters={filters}
      sourceId={text(props.sourceId)}
      sql={text(props.sql)}
      column={text(props.column) || undefined}
      aggregate={props.aggregate as SparklineProps["aggregate"]}
      label={text(props.label)}
      target={typeof props.target === "number" ? props.target : undefined}
      ranges={(props.ranges as { to: number; label: string }[]) ?? []}
      format={(text(props.format) || undefined) as SparklineProps["format"]}
      currency={text(props.currency) || undefined}
      emptyMessage={text(props.emptyMessage) || undefined}
      errorMessage={text(props.errorMessage) || undefined}
    />
  )),
  StepFlow: ({ props }) => <StepFlow label={text(props.label)} steps={(props.steps as FlowStep[]) ?? []} />,
  PlanReview: ({ props, component, dispatch }) => (
    <PlanReview
      title={text(props.title)}
      summary={text(props.summary) || undefined}
      proposedBy={text(props.proposedBy) || undefined}
      steps={(props.steps as PlanStep[]) ?? []}
      onDecide={(decision) => dispatch(component.action, { ...decision })}
    />
  ),
  ActionReceipt: ({ props, component, dispatch }) => (
    <ActionReceipt
      title={text(props.title)}
      outcome={(text(props.outcome) || "done") as ActionReceiptProps["outcome"]}
      summary={text(props.summary) || undefined}
      ranAt={text(props.ranAt) || undefined}
      ranBy={text(props.ranBy) || undefined}
      approvedBy={(props.approvedBy as ActionReceiptProps["approvedBy"]) ?? []}
      sql={text(props.sql) || undefined}
      changes={(props.changes as ActionReceiptProps["changes"]) ?? []}
      undo={props.undo as ActionReceiptProps["undo"]}
      onUndo={component.action ? () => dispatch(component.action, {}) : undefined}
    />
  ),
  PiiReview: ({ props, component, dispatch }) => (
    <PiiReview
      table={text(props.table)}
      purpose={text(props.purpose) || undefined}
      columns={(props.columns as PiiColumn[]) ?? []}
      onDecide={(decision) => dispatch(component.action, { ...decision })}
    />
  ),
  ThemeSwitch: ({ props }) => <ThemeSwitchView props={props} />,
  QueryPlan: ({ props }) => <QueryPlan sourceId={text(props.sourceId)} sql={text(props.sql)} />,
  SourceList: () => <SourceList />,
  PipelineGraph: ({ props, component, dispatch }) => <PipelineGraphView props={props} action={component.action} dispatch={dispatch} />,
  PipelineView: ({ props, component, dispatch, reportContext }) => (
    <WithPipelines>
      <PipelineView
        pipelineId={text(props.pipelineId)}
        onRun={component.action != null ? ({ kind, ...event }) => dispatch(component.action, { ...event, event: kind }) : undefined}
        onContext={reportContext}
      />
    </WithPipelines>
  ),
  DatasetReview: (renderProps) => <DatasetReviewView {...renderProps} />,
  IngestWizard: ({ props }) => (
    <WithPipelines>
      <IngestWizardView props={props} />
    </WithPipelines>
  ),
  RunHistory: ({ props }) => <RunHistory runs={(props.runs as PipelineRun[]) ?? []} />,
  ExpectationsPanel: ({ props }) => <ExpectationsPanel expectations={(props.expectations as Expectation[]) ?? []} />,
  SchemaDiff: ({ props }) => (
    <SchemaDiff changes={(props.changes as SchemaChange[]) ?? []} rescuedCount={typeof props.rescuedCount === "number" ? props.rescuedCount : undefined} mode={text(props.mode) || undefined} />
  ),
  StreamMetrics: ({ props }) => <StreamMetrics progress={(props.progress as StreamProgress[]) ?? []} />,
  ContextBuilder: (renderProps) => (
    <WithDiscovery>
      <ContextBuilderView {...renderProps} />
    </WithDiscovery>
  ),
};
