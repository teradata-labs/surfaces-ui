import { create } from "@bufbuild/protobuf";
import { AnalyticsChat, type AttachResult, Chat, type ChatProvider, type ChatSettings, PageStudio, browserSpeech, memorySessions } from "@surfaces-ui/chat";
import {
  CertificationBadge,
  ChecksPanel,
  Combobox,
  type ComboboxOption,
  type ComboboxProps,
  ConfirmDialog,
  type ConfirmDialogProps,
  ConnectionBuilder,
  type ConnectionDraft,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
  DataTable,
  DataSourceProvider,
  ItemControls,
  Pagination,
  type PaginationProps,
  type SelectionAction,
  SelectionBar,
  type SelectionBarProps,
  StatusBadge,
  type StatusBadgeProps,
  ModelLineage,
  NavBar,
  type NavBarProps,
  ObjectInfo,
  Popover,
  type PopoverProps,
  ResizeHandle,
  type ResizeHandleProps,
  SegmentedControl,
  type SegmentedControlProps,
  ThemePicker,
  standardControls,
} from "@surfaces-ui/components";
import { type Pipelines, semanticModelFromDataset } from "@surfaces-ui/data";
import { SurfacesDevTools } from "@surfaces-ui/devtools";
import { A2UI_VERSION, analyticsCatalog } from "@surfaces-ui/spec";
import { SurfaceView, lazyAnalyticsRenderers, useSurfaces } from "@surfaces-ui/spec/react";
import { createRecorder } from "@surfaces-ui/trace";
import { AgentInfoSchema, CertificationSchema, CheckKind, CheckSeverity, PipelineSchema, RunSchema, RunState } from "@surfaces-ui/proto";
import { memoryStorage } from "@surfaces-ui/state";
import { presets } from "@surfaces-ui/tokens";
import { type ReactNode, useMemo, useState } from "react";
import { demoAgent } from "./demoAgent.js";
import { demoPageAgent, demoPageStarters } from "./demoPageAgent.js";
import { pagesFor } from "./examples.js";
import { focusFor } from "./focus.js";
import { type ActiveSource, firstTable } from "./source.js";

/*
 * Working demos for the parts of each app component that take code: an
 * agent, saved conversations, a pipeline backend, a set of controls. The
 * Components area switches each on or off; what a component calls back is
 * written to the page's log.
 */

export interface DemoProps {
  props: Record<string, unknown>;
  /** The parts switched on. */
  parts: Set<string>;
  source: ActiveSource;
  /** Records a callback: which prop, and what it was given. */
  log(prop: string, value?: unknown): void;
  /** Writes a plain prop back to the page's props, for a component the host holds the value of. */
  setProp(prop: string, value: unknown): void;
}

const PROVIDERS: ChatProvider[] = [
  { id: "scripted", label: "Scripted demo", detail: "A fixed script in this page; not a model", models: [{ id: "script", label: "Demo script" }] },
  { id: "local", label: "This machine", detail: "Shown as an example; not connected here", models: [{ id: "qwen3:8b" }, { id: "llama3.2:3b" }] },
];
const AGENTS = [
  create(AgentInfoSchema, {
    id: "demo",
    name: "Demo analyst",
    isDefault: true,
    models: [{ id: "script", label: "Demo script" }],
    skills: [
      { id: "chart-standards", name: "Chart standards", description: "Tufte and Few's rules for every chart." },
      { id: "personal-data", name: "Personal data", description: "Asks before showing a column that may hold personal data." },
    ],
  }),
];

function useFocus(source: ActiveSource) {
  const table = firstTable(source);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the focus depends only on the source id and table.
  return useMemo(() => focusFor(source.sourceId, table), [source.sourceId, table]);
}

const on = <T,>(parts: Set<string>, prop: string, value: T): T | undefined => (parts.has(prop) ? value : undefined);

function AnalyticsChatDemo({ props, parts, source, log }: DemoProps) {
  const focus = useFocus(source);
  const agent = useMemo(() => demoAgent(source.dataSource, focus), [source.dataSource, focus]);
  const sessions = useMemo(() => memorySessions(), []);
  const speech = useMemo(() => browserSpeech(), []);
  const [voice, setVoice] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>(() => ({ sourceId: source.sourceId, ...(props.settings as object) }));
  const attachFiles = async (files: File[]): Promise<AttachResult[]> => {
    log("attachFiles", files.map((f) => f.name));
    return files.map((file) => ({ file, error: "Kept on this computer: this page only shows the chip." }));
  };
  return (
    <AnalyticsChat
      {...props}
      agent={agent}
      settings={settings}
      onSettingsChange={(next) => {
        setSettings(next);
        log("onSettingsChange", next);
      }}
      sessions={on(parts, "sessions", sessions)}
      browse={on(parts, "browse", { sourceId: source.sourceId, sourceLabel: source.sourceId })}
      agents={on(parts, "agents", AGENTS)}
      providers={on(parts, "providers", PROVIDERS)}
      attachFiles={parts.has("attachFiles") ? attachFiles : undefined}
      speech={on(parts, "speech", speech)}
      speechConsent={{ given: voice, onGive: () => setVoice(true) }}
      onContext={(note) => log("onContext", note.summary)}
      onLayoutChange={(layout) => log("onLayoutChange", layout.columns)}
      onConnect={(connector) => log("onConnect", connector.id)}
    />
  );
}

function ChatDemo({ props, parts, source, log }: DemoProps) {
  const focus = useFocus(source);
  const agent = useMemo(() => demoAgent(source.dataSource, focus), [source.dataSource, focus]);
  const storage = useMemo(() => memoryStorage(), []);
  const [settings, setSettings] = useState<ChatSettings>(() => ({ sourceId: source.sourceId, ...(props.settings as object) }));
  const menus = parts.has("agents") || parts.has("providers");
  return (
    <Chat
      {...props}
      agent={agent}
      storage={on(parts, "storage", storage)}
      agents={on(parts, "agents", AGENTS)}
      providers={on(parts, "providers", PROVIDERS)}
      settings={settings}
      onSettingsChange={
        menus
          ? (next) => {
              setSettings(next);
              log("onSettingsChange", next);
            }
          : undefined
      }
      onThreadChange={(thread) => log("onThreadChange", `${thread.messages.length} messages`)}
      onContext={(note) => log("onContext", note.summary)}
    />
  );
}

function PageStudioDemo({ props, parts, source, log }: DemoProps) {
  const focus = useFocus(source);
  const agent = useMemo(() => demoPageAgent(source.dataSource, focus), [source.dataSource, focus]);
  const page = useMemo(() => pagesFor(focus)[0]!, [focus]);
  const [settings, setSettings] = useState({});
  return (
    <PageStudio
      starters={demoPageStarters(focus)}
      {...props}
      agent={agent}
      page={page}
      providers={on(parts, "providers", PROVIDERS)}
      settings={settings}
      onSettingsChange={(next) => {
        setSettings(next);
        log("onSettingsChange", next);
      }}
      onChange={(next) => log("onChange", `${next.components.length} components`)}
    />
  );
}

/** A small pipeline whose one dataset a model is built on, with a run whose checks passed but one warned. */
const pipeline = create(PipelineSchema, {
  summary: { id: "refunds", name: "Refunds", sourceId: "demo" },
  datasets: [
    {
      name: "lines_clean",
      description: "Order lines, cleaned.",
      grain: "One order line.",
      primaryKey: ["line_id"],
      inputs: ["lines"],
      inputsDeclared: true,
      columns: [
        { name: "line_id", type: "BIGINT" },
        { name: "region", type: "VARCHAR", description: "Sales region." },
        { name: "line_amount", type: "DOUBLE" },
      ],
      checks: [
        { name: "unique_line_id", kind: CheckKind.UNIQUE, columns: ["line_id"], implied: true },
        { name: "not_null_line_id", kind: CheckKind.NOT_NULL, columns: ["line_id"], implied: true },
        { name: "accepted_values_region", kind: CheckKind.ACCEPTED_VALUES, columns: ["region"], severity: CheckSeverity.WARN },
      ],
      state: RunState.COMPLETED,
      builtAt: "2026-11-14T08:30:00Z",
      lastRunId: "run-1",
    },
  ],
});
const run = create(RunSchema, {
  id: "run-1",
  pipelineId: "refunds",
  datasetRuns: [
    {
      name: "lines_clean",
      checks: [
        { name: "unique_line_id", failedRecords: 0n },
        { name: "not_null_line_id", failedRecords: 0n },
        { name: "accepted_values_region", severity: CheckSeverity.WARN, failedRecords: 2n, summary: "2 rows have a region not in the list." },
      ],
    },
  ],
});
/** Only what `ModelLineage` reads: the pipeline and its run. */
const lineagePipelines = {
  listPipelines: async () => ({ pipelines: [pipeline.summary] }),
  getPipeline: async () => ({ pipeline }),
  getRun: async () => ({ run }),
} as unknown as Pipelines;
const lineageModel = semanticModelFromDataset(pipeline, "lines_clean");

function ItemControlsDemo({ props, log }: DemoProps) {
  const act = (what: string) => () => log("onSelect", what);
  const controls = standardControls("Revenue by month", {
    edit: act("change"),
    wider: act("wider"),
    narrower: false,
    earlier: act("earlier"),
    later: act("later"),
    duplicate: act("duplicate"),
    remove: act("remove"),
  });
  return (
    <div className="app-demo-tile sf-controls-host" data-controls="corner">
      <ItemControls label="Item controls" {...props} controls={controls} />
      <p className="hint">A tile. Point at it or tab into it; Narrower is greyed because the tile is already as narrow as it goes.</p>
    </div>
  );
}

type DemoRow = Record<string, unknown> & { id: string };
const rowsOf = (value: unknown): DemoRow[] => (Array.isArray(value) ? value.filter((r): r is DemoRow => !!r && typeof r === "object" && typeof (r as DemoRow).id === "string") : []);

/** A table whose host sorts the rows it holds, as a server would, and keeps the selection. */
function DataTableDemo({ props, parts, log, setProp }: DemoProps) {
  const given = props as unknown as Partial<DataTableProps<DemoRow>>;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const columns: DataTableColumn<DemoRow>[] = (Array.isArray(given.columns) ? given.columns : [])
    .filter((c) => c && typeof c.id === "string" && typeof c.label === "string")
    .map((c) => (c.id === "status" ? { ...c, cell: (row: DemoRow) => <StatusBadge label={String(row.status)} tone={row.status === "On" ? "success" : "danger"} /> } : c));
  const sort = given.sort;
  // The host's server sorts; here the page stands in for it.
  const rows = [...rowsOf(given.rows)].sort((a, b) => {
    if (!sort) return 0;
    const [x, y] = [a[sort.column], b[sort.column]];
    const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return sort.desc ? -order : order;
  });
  return (
    <DataTable<DemoRow>
      label={given.label ?? "Rows"}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      rowName={(row) => String(row.name ?? row.id)}
      rowHeader={given.rowHeader}
      sort={sort}
      onSortChange={(next: DataTableSort) => {
        setProp("sort", next);
        log("onSortChange", next);
      }}
      selected={on(parts, "selected", selected)}
      onSelectedChange={(next) => {
        setSelected(next);
        log("onSelectedChange", [...next]);
      }}
      allSelected={given.allSelected}
      selectable={on(parts, "selectable", (row: DemoRow) => row.id !== "u1")}
      rowControls={on(parts, "rowControls", (row: DemoRow) => [
        row.status === "On"
          ? { id: "turn-off", label: `Turn off ${row.name}`, icon: "power" as const, onSelect: () => log("turn off", row.id) }
          : { id: "turn-on", label: `Turn on ${row.name}`, icon: "power" as const, onSelect: () => log("turn on", row.id) },
        { id: "sign-out", label: `Sign ${row.name} out everywhere`, icon: "sign-out" as const, onSelect: () => log("sign out", row.id), disabled: row.status !== "On" },
        { id: "open", label: `Open ${row.name}'s page`, icon: "more" as const, onSelect: () => log("open", row.id) },
      ])}
      controlsShow={given.controlsShow}
      rowMenu={on(parts, "rowMenu", (row: DemoRow) => [
        { label: "Copy email", onSelect: () => log("copy email", row.email) },
        { label: "Open their page", onSelect: () => log("open", row.id) },
      ])}
      rowState={on(parts, "rowState", (row: DemoRow) => (row.status === "On" ? undefined : "off"))}
      loading={given.loading}
      empty={on(parts, "empty", <span>No one matches. Try another search.</span>)}
    />
  );
}

function SelectionBarDemo({ props, parts, log, setProp }: DemoProps) {
  const given = props as unknown as Partial<SelectionBarProps>;
  const [handing, setHanding] = useState(false);
  const actions: SelectionAction[] = (Array.isArray(given.actions) ? given.actions : [])
    .filter((a) => a && typeof a.id === "string" && typeof a.label === "string")
    .map((a) => ({ ...a, onSelect: () => log("onSelect", a.id) }));
  if (parts.has("children")) actions.push({ id: "hand-over", label: "Hand over their work…", expanded: handing, onSelect: () => setHanding(!handing) });
  return (
    <SelectionBar
      {...given}
      count={typeof given.count === "number" ? given.count : 0}
      actions={actions}
      onClear={() => {
        setProp("count", 0);
        log("onClear");
      }}
      onAllMatchingChange={(all) => {
        setProp("allMatching", all);
        if (all && typeof given.total === "number") setProp("count", given.total);
        log("onAllMatchingChange", all);
      }}
    >
      {handing && parts.has("children") ? (
        <form className="app-demo-row" onSubmit={(event) => (event.preventDefault(), log("hand over"))}>
          <label>
            Hand everything they own to <input className="sf-input" type="email" required />
          </label>
          <button type="submit" className="sf-button" data-variant="primary">
            Hand over
          </button>
        </form>
      ) : null}
    </SelectionBar>
  );
}

function ConfirmDialogDemo({ props, parts, log, setProp }: DemoProps) {
  const given = props as unknown as Partial<ConfirmDialogProps>;
  const title = given.title ?? "Go ahead?";
  return (
    <div>
      <button type="button" className="sf-button" data-variant={given.danger ? "danger" : undefined} onClick={() => setProp("open", true)}>
        {given.confirmLabel ?? "Confirm"}…
      </button>
      <ConfirmDialog
        {...given}
        open={given.open === true}
        title={title}
        body={on(parts, "body", <p>They are signed out everywhere now and cannot sign in until turned back on. What they own stays theirs.</p>)}
        onConfirm={() => {
          setProp("open", false);
          log("onConfirm");
        }}
        onCancel={() => {
          setProp("open", false);
          log("onCancel");
        }}
      />
    </div>
  );
}

function ComboboxDemo({ props, log, setProp }: DemoProps) {
  const given = props as unknown as Partial<ComboboxProps>;
  const all: ComboboxOption[] = Array.isArray(given.options) ? given.options.filter((o) => o && typeof o.value === "string" && typeof o.label === "string") : [];
  const value = typeof given.value === "string" ? given.value : "";
  // The host searches, as its server would; the box shows what comes back.
  const words = value.trim().toLowerCase();
  const options = words ? all.filter((o) => `${o.label} ${o.value} ${o.detail ?? ""}`.toLowerCase().includes(words)) : all;
  return (
    <div className="app-demo-narrow">
      <Combobox
        {...given}
        label={given.label ?? "Choose"}
        value={value}
        options={options}
        onChange={(next) => {
          setProp("value", next);
          log("onChange", next);
        }}
        onPick={(option) => log("onPick", option.value)}
      />
    </div>
  );
}

/** Two panes side by side, the handle on the first one's right edge: the page holds the share, as a host would. */
function ResizeHandleDemo({ props, parts, log, setProp }: DemoProps) {
  const given = props as unknown as Partial<ResizeHandleProps>;
  const share = typeof given.value === "number" ? given.value : 0.5;
  const words = (value: number) => `${Math.round(value * 100)}% and ${Math.round((1 - value) * 100)}%`;
  const move = (value: number) => {
    setProp("value", value);
    setProp("valueText", words(value));
  };
  return (
    <div className="app-demo-split" style={{ gridTemplateColumns: `minmax(0, ${share}fr) minmax(0, ${1 - share}fr)` }}>
      <div className="app-demo-pane">
        <strong>Map</strong>
        <p className="hint">Drag the line at this pane's right edge, or tab to it and use the arrow keys, Home and End.</p>
        <ResizeHandle
          edge="right"
          label="Resize the map and the list"
          {...given}
          value={given.value}
          // One unit is the whole width of the two panes, so a share moves with the pointer.
          unitPixels={(handle) => handle.closest(".app-demo-split")?.getBoundingClientRect().width ?? 1}
          {...(on(parts, "startFrom", true) ? { startFrom: () => 0.5 } : {})}
          {...(on(parts, "onReset", true) ? {
                onReset: () => {
                  move(0.5);
                  log("onReset");
                },
              } : {})}
          onChange={move}
          onChangeEnd={(value, end) => log("onChangeEnd", { value: Math.round(value * 1000) / 1000, ...end })}
        />
      </div>
      <div className="app-demo-pane">
        <strong>List</strong>
        <p className="hint">{words(share)}</p>
      </div>
    </div>
  );
}

/** What the dev tools wrap in their demo: a small surface built from messages, with buttons that send more, one of them wrong. */
function TracedSurface({ source }: { source: ActiveSource }) {
  const table = firstTable(source);
  const { surfaces, apply, reset } = useSurfaces(analyticsCatalog);
  const draw = () => {
    reset();
    apply([
      { version: A2UI_VERSION, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } },
      {
        version: A2UI_VERSION,
        updateComponents: {
          surfaceId: "main",
          components: [
            { id: "root", component: "Column", children: ["title", "rows"] },
            { id: "title", component: "Text", text: `Rows of ${table}`, variant: "h3" },
            { id: "rows", component: "DataGrid", sourceId: source.sourceId, sql: `SELECT * FROM ${table}`, height: 220 },
          ],
        },
      },
    ]);
  };
  return (
    <div className="app-demo-stack">
      <div className="app-demo-row">
        <button type="button" className="sf-button" data-variant="primary" onClick={draw}>
          Draw a surface
        </button>
        <button type="button" className="sf-button" disabled={!surfaces.main} onClick={() => apply({ version: A2UI_VERSION, updateComponents: { surfaceId: "main", components: [{ id: "title", component: "Text", text: `Rows of ${table}, sent again at ${new Date().toLocaleTimeString()}`, variant: "h3" }] } })}>
          Send a change
        </button>
        <button type="button" className="sf-button" disabled={!surfaces.main} onClick={() => apply({ version: A2UI_VERSION, updateComponents: { surfaceId: "main", components: [{ id: "title", component: "Stat", label: 4 } as never] } })}>
          Send a component the catalog refuses
        </button>
      </div>
      {surfaces.main ? <SurfaceView surface={surfaces.main} catalog={analyticsCatalog} renderers={lazyAnalyticsRenderers} /> : <p className="hint">Nothing drawn yet. Draw a surface, then open the dev tools below and step back through what was sent.</p>}
    </div>
  );
}

function DevToolsDemo({ props, parts, source, log }: DemoProps) {
  const recorder = useMemo(() => createRecorder(), []);
  return (
    <SurfacesDevTools {...props} recorder={on(parts, "recorder", recorder)} catalog={on(parts, "catalog", analyticsCatalog)} onOpenChange={(open) => log("onOpenChange", open)}>
      <DataSourceProvider dataSource={source.dataSource}>
        <TracedSurface source={source} />
      </DataSourceProvider>
    </SurfacesDevTools>
  );
}

const WIDTHS = [
  { value: "Fit", label: "Fit to the window" },
  { value: "Phone", label: "Phone" },
  { value: "Tablet", label: "Tablet" },
  { value: "Desktop", label: "Desktop" },
];
const ZOOMS = ["50%", "75%", "100%", "125%"];
const DATA_STATES = [
  { value: "Real data", label: "Real" },
  { value: "Empty", label: "Empty" },
  { value: "Loading", label: "Loading" },
];

/** A toolbar's View button: three settings behind one button, its summary kept up to date as a host would. */
function PopoverDemo({ props, log, setProp }: DemoProps) {
  const given = props as unknown as Partial<PopoverProps>;
  const [width, setWidth] = useState("Fit");
  const [zoom, setZoom] = useState("100%");
  const [data, setData] = useState("Real data");
  const choose = (next: { width?: string; zoom?: string; data?: string }) => {
    const all = { width, zoom, data, ...next };
    setWidth(all.width);
    setZoom(all.zoom);
    setData(all.data);
    setProp("summary", `${all.width} · ${all.zoom} · ${all.data}`);
  };
  const held = typeof given.open === "boolean";
  return (
    <div className="app-demo-row">
      <Popover
        label={typeof given.label === "string" && given.label ? given.label : "View"}
        summary={typeof given.summary === "string" ? given.summary : undefined}
        align={given.align}
        disabled={given.disabled}
        defaultOpen={given.defaultOpen}
        open={held ? given.open : undefined}
        onOpenChange={(open) => {
          if (held) setProp("open", open);
          log("onOpenChange", open);
        }}
      >
        <label className="sf-form-field">
          <span className="sf-form-label">Width</span>
          <select className="sf-input" value={width} onChange={(event) => choose({ width: event.target.value })}>
            {WIDTHS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <label className="sf-form-field">
          <span className="sf-form-label">Zoom</span>
          <select className="sf-input" value={zoom} onChange={(event) => choose({ zoom: event.target.value })}>
            {ZOOMS.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
        <SegmentedControl label="Data" fit="fill" options={DATA_STATES} value={data} onChange={(value) => choose({ data: value })} />
      </Popover>
    </div>
  );
}

/** The component, drawn live with the parts switched on. */
export function AppDemo({ name, ...demo }: DemoProps & { name: string }): ReactNode {
  const { props, parts, source, log, setProp } = demo;
  switch (name) {
    case "AnalyticsChat":
      return <AnalyticsChatDemo {...demo} />;
    case "SurfacesDevTools":
      return <DevToolsDemo {...demo} />;
    case "Chat":
      return <ChatDemo {...demo} />;
    case "PageStudio":
      return <PageStudioDemo {...demo} />;
    case "ThemePicker":
      return <ThemePicker {...props} presets={on(parts, "presets", presets.filter((p) => ["Aurora", "Ink", "Berry"].includes(p.name)))} />;
    case "ConnectionBuilder":
      return (
        <ConnectionBuilder
          value={props.value as ConnectionDraft}
          onChange={(next) => {
            setProp("value", next);
            log("onChange", { storage: next.storage, scope: next.scope, tables: next.tables.length });
          }}
        />
      );
    case "ModelLineage":
      return (
        <ModelLineage
          {...props}
          model={lineageModel}
          pipelines={on(parts, "pipelines", lineagePipelines)}
          onOpenDataset={(pipelineId, dataset) => log("onOpenDataset", { pipelineId, dataset })}
          onUseDataset={(standing) => log("onUseDataset", standing.dataset)}
        />
      );
    case "ChecksPanel":
      return <ChecksPanel checks={(props.checks as never) ?? []} onOpenFailing={(check) => log("onOpenFailing", check.name)} />;
    case "ObjectInfo":
      return <ObjectInfo sourceId={source.sourceId} table={firstTable(source)} {...props} onClose={() => log("onClose")} />;
    case "CertificationBadge":
      return (
        <p>
          orders <CertificationBadge certification={props.certification ? create(CertificationSchema, props.certification as never) : undefined} />
        </p>
      );
    case "ItemControls":
      return <ItemControlsDemo {...demo} />;
    case "ResizeHandle":
      return <ResizeHandleDemo {...demo} />;
    case "SegmentedControl": {
      const given = props as unknown as Partial<SegmentedControlProps>;
      const options = Array.isArray(given.options) ? given.options.filter((o) => o && typeof o.value === "string" && typeof o.label === "string") : [];
      return (
        <SegmentedControl
          label={given.label ?? "Choose"}
          fit={given.fit}
          options={options}
          value={given.value ?? ""}
          onChange={(value) => {
            demo.setProp("value", value);
            log("onChange", value);
          }}
        />
      );
    }
    case "DataTable":
      return <DataTableDemo {...demo} />;
    case "SelectionBar":
      return <SelectionBarDemo {...demo} />;
    case "Pagination": {
      const given = props as unknown as Partial<PaginationProps>;
      return (
        <Pagination
          {...given}
          offset={typeof given.offset === "number" ? given.offset : 0}
          pageSize={typeof given.pageSize === "number" ? given.pageSize : 50}
          total={typeof given.total === "number" ? given.total : 0}
          onChange={(offset) => {
            setProp("offset", offset);
            log("onChange", offset);
          }}
        />
      );
    }
    case "ConfirmDialog":
      return <ConfirmDialogDemo {...demo} />;
    case "StatusBadge": {
      const given = props as unknown as Partial<StatusBadgeProps>;
      return (
        <p>
          Ben Brook <StatusBadge {...given} label={given.label ?? "Status"} />
        </p>
      );
    }
    case "Combobox":
      return <ComboboxDemo {...demo} />;
    case "Popover":
      return <PopoverDemo {...demo} />;
    case "NavBar":
      return (
        <div className="app-demo-navbar">
          <NavBar
            {...(props as unknown as NavBarProps)}
            brand={on(parts, "brand", <strong>Acme</strong>)}
            actions={on(parts, "actions", <span className="hint">Signed in</span>)}
            onSelect={(id) => {
              setProp("current", id);
              log("onSelect", id);
            }}
          />
        </div>
      );
    default:
      return <p className="hint">No demo for {name}.</p>;
  }
}
