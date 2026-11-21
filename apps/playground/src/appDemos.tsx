import { create } from "@bufbuild/protobuf";
import { AnalyticsChat, type AttachResult, Chat, type ChatProvider, type ChatSettings, PageStudio, browserSpeech, memorySessions } from "@surfaces-ui/chat";
import {
  CertificationBadge,
  ChecksPanel,
  ConnectionBuilder,
  type ConnectionDraft,
  DataSourceProvider,
  ItemControls,
  ModelLineage,
  NavBar,
  type NavBarProps,
  ObjectInfo,
  ResizeHandle,
  type ResizeHandleProps,
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
