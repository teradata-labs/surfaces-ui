import { useTheme } from "@surfaces-ui/components";
import { hostStyleVariables } from "@surfaces-ui/tokens";
import { Client } from "@modelcontextprotocol/client";
import type { McpUiStyles } from "@modelcontextprotocol/ext-apps";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { memoryPipelines } from "@surfaces-ui/data";
import { DatasetKind } from "@surfaces-ui/proto";
import { registerSurfacesApps } from "@surfaces-ui/mcp";
import appHtml from "@surfaces-ui/mcp/app.html?raw";
import { A2UI_VERSION, analyticsCatalog } from "@surfaces-ui/spec";
import { useEffect, useMemo, useRef, useState } from "react";
import { type DataFocus, focusFor } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";

interface Sample {
  label: string;
  tool: string;
  args: Record<string, unknown>;
}

const v = A2UI_VERSION;
/** What a model might call, written against the picked data. */
function samples(f: DataFocus): Sample[] {
  const { breakdown: b, measure: m } = f;
  return [
    { label: "show_data_grid", tool: "show_data_grid", args: { sql: f.rowsSql, title: f.table } },
    { label: "show_chart", tool: "show_chart", args: { sql: b.sql, type: "bar", x: b.x, y: b.y, title: b.label } },
    { label: "show_query_result", tool: "show_query_result", args: { sql: f.rowsSql } },
    { label: "open_sql_editor", tool: "open_sql_editor", args: { sql: `SELECT ${b.x}, COUNT(*) AS n\nFROM (${b.sql}) AS t\nGROUP BY 1\nORDER BY n DESC` } },
    { label: "show_schema_explorer", tool: "show_schema_explorer", args: {} },
    {
      label: "render_surface (dashboard)",
      tool: "render_surface",
      args: {
        messages: [
          { version: v, createSurface: { surfaceId: "main", catalogId: analyticsCatalog.id } },
          {
            version: v,
            updateComponents: {
              surfaceId: "main",
              components: [
                { id: "root", component: "Column", children: ["title", "stats", "tabs", "ask"] },
                { id: "title", component: "Text", text: { "@path": "/title" }, variant: "h2" },
                { id: "stats", component: "Row", children: ["s1", "s2"] },
                { id: "s1", component: "Metric", sourceId: { "@path": "/source" }, sql: m.sql, ...(m.column ? { column: m.column } : {}), aggregate: m.aggregate, label: m.label, ...(m.format ? { format: m.format } : {}) },
                { id: "s2", component: "Sparkline", sourceId: { "@path": "/source" }, sql: f.trend.sql, x: f.trend.x, grain: "month", ...(f.trend.column ? { column: f.trend.column } : {}), aggregate: f.trend.aggregate, label: f.trend.label },
                { id: "tabs", component: "Tabs", tabs: [{ title: "Chart", child: "chart" }, { title: "Rows", child: "grid" }] },
                { id: "chart", component: "Chart", sourceId: { "@path": "/source" }, sql: b.sql, type: "bar", x: b.x, y: b.y },
                { id: "grid", component: "DataGrid", sourceId: { "@path": "/source" }, sql: f.rowsSql, height: 300 },
                { id: "ask", component: "Button", child: "ask-label", variant: "primary", action: { event: { name: "explain", context: { about: b.label } } } },
                { id: "ask-label", component: "Text", text: `Ask about ${b.label.toLowerCase()}` },
              ],
            },
          },
          { version: v, updateDataModel: { surfaceId: "main", value: { title: f.title } } },
        ],
      },
    },
    { label: "show_pipeline", tool: "show_pipeline", args: { pipelineId: "demo" } },
    {
      label: "propose_dataset",
      tool: "propose_dataset",
      args: {
        pipelineId: "demo",
        name: "breakdown",
        sql: `SELECT ${b.x}, COUNT(*) AS n FROM ${CLEAN} GROUP BY ${b.x}`,
        depends: [CLEAN],
        grain: `one row per ${b.x}`,
        primaryKey: [b.x],
        description: `Rows of ${f.table} counted by ${b.x}.`,
        columns: [
          { name: b.x, description: `The ${b.x} the rows are counted by.` },
          { name: "n", type: "BIGINT", description: "Number of rows." },
        ],
        checks: [{ kind: "row_count", min: 1, warnOnly: true }],
      },
    },
    { label: "show_data_grid (bad SQL)", tool: "show_data_grid", args: { sql: `DROP TABLE ${f.table}` } },
  ];
}

const CLEAN = "rows_clean";
/** A pipeline kept in this page, over the picked table, so proposals and saves need no server. Its runs complete at once and query nothing. */
const demoPipelines = (f: DataFocus, sourceId: string) =>
  memoryPipelines([
    {
      summary: { id: "demo", name: "Demo pipeline", sourceId },
      version: 1,
      datasets: [
        { name: f.table, kind: DatasetKind.SOURCE },
        { name: CLEAN, sql: f.rowsSql, inputs: [f.table], inputsDeclared: true, grain: `one row per row of ${f.table}` },
      ],
    },
  ]);

/**
 * Runs the real MCP App page inside a sandboxed frame, with this page acting
 * as the host: an MCP server and client connected in memory, and the Apps
 * bridge between the client and the frame. It exercises the same path a
 * desktop host uses, without needing one.
 */
export function McpPreview({ source }: { source: ActiveSource }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const session = useRef<{ client: Client; bridge: AppBridge } | undefined>(undefined);
  const { resolvedMode, theme } = useTheme();
  // The frame is told the host's colours as well as its mode, so the page inside it is drawn in the same theme.
  const styles = useMemo(() => ({ variables: hostStyleVariables(theme, resolvedMode) as McpUiStyles }), [theme, resolvedMode]);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(200);
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((previous) => [...previous.slice(-40), line]);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe?.contentWindow) return;
    let closed = false;
    const server = new McpServer({ name: "surfaces", version: "0.0.0" });
    // The dashboard sample binds its source ID, so both the server and the memory fallback work.
    const pipelines = demoPipelines(focusFor(source.sourceId, firstTable(source)), source.sourceId);
    registerSurfacesApps(server, { dataSource: source.dataSource, pipelines, appHtml, defaultSourceId: source.sourceId });
    const client = new Client({ name: "docs-host", version: "0.0.0" });
    const bridge = new AppBridge(
      client,
      { name: "Surfaces docs host", version: "0.0.0" },
      { serverTools: {}, openLinks: {}, logging: {}, updateModelContext: { text: {} } },
      { hostContext: { theme: resolvedMode, styles } },
    );
    bridge.onupdatemodelcontext = async ({ content }) => {
      const last = (content ?? []).map((block) => (block.type === "text" ? block.text.split("\n").at(-1) : `[${block.type}]`)).join(" ");
      note(`app → model context: ${last}`);
      return {};
    };
    bridge.oninitialized = () => {
      if (!closed) setReady(true);
    };
    bridge.onsizechange = ({ height: next }) => {
      if (typeof next === "number" && next > 0) setHeight(Math.min(Math.ceil(next) + 2, 1400));
    };
    bridge.onmessage = async ({ content }) => {
      note(`app → chat: ${content.map((block) => (block.type === "text" ? block.text : `[${block.type}]`)).join(" ")}`);
      return {};
    };
    bridge.onopenlink = async ({ url }) => {
      note(`app asked to open: ${url}`);
      return {};
    };
    const [a, b] = InMemoryTransport.createLinkedPair();
    void (async () => {
      await Promise.all([server.connect(a), client.connect(b)]);
      if (closed) return;
      await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
      if (closed) return;
      session.current = { client, bridge };
      // Load the app only once this bridge is listening, so its handshake reaches a live host.
      iframe.srcdoc = appHtml;
    })().catch((error: unknown) => {
      if (!closed) note(`host error: ${error instanceof Error ? error.message : String(error)}`);
    });
    return () => {
      closed = true;
      session.current = undefined;
      setReady(false);
      void bridge.close().catch(() => {});
      void client.close().catch(() => {});
    };
    // The session is built once per data source; theme changes are sent separately.
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready) void session.current?.bridge.sendHostContextChange({ theme: resolvedMode, styles });
  }, [resolvedMode, styles, ready]);

  const run = async (sample: Sample) => {
    const current = session.current;
    if (!current) return;
    const args = sample.tool === "render_surface" ? withSource(sample.args, source.sourceId) : sample.args;
    note(`model → ${sample.tool}(${JSON.stringify(args).slice(0, 140)}${JSON.stringify(args).length > 140 ? "…" : ""})`);
    await current.bridge.sendToolInput({ arguments: args });
    const result = await current.client.callTool({ name: sample.tool, arguments: args });
    const first = (result.content as { text?: string }[] | undefined)?.[0]?.text ?? "";
    note(`${result.isError ? "error" : "result"} → model: ${first}`);
    await current.bridge.sendToolResult(result as never);
  };

  return (
    <div className="mcp">
      <aside className="card" aria-label="Tool calls">
        <div className="card-head">
          <h2>Call a tool</h2>
          <span className={ready ? "badge" : "badge warn"}>{ready ? "App connected" : "Connecting"}</span>
        </div>
        <p className="hint">Each button calls the MCP server the way a model would, then hands the result to the app page.</p>
        <div className="mcp-calls">
          {samples(focusFor(source.sourceId, firstTable(source))).map((sample) => (
            <button key={sample.label} type="button" className="btn" disabled={!ready} onClick={() => void run(sample)}>
              {sample.label}
            </button>
          ))}
        </div>
      </aside>
      <div className="stage">
        <section className="card">
          <div className="card-head">
            <h2>App page (sandboxed frame)</h2>
            <span className="hint">{Math.round(appHtml.length / 1024)} KB, one file</span>
          </div>
          <iframe ref={frame} className="mcp-frame" title="Surfaces MCP app" sandbox="allow-scripts" style={{ height }} />
        </section>
        <section className="card">
          <div className="card-head">
            <h2>What the model and chat see</h2>
          </div>
          <pre className="mcp-log" tabIndex={0}>
            {log.length > 0 ? log.join("\n") : "Nothing yet."}
          </pre>
        </section>
      </div>
    </div>
  );
}

/** Puts the active source ID into a surface's data model. */
function withSource(args: Record<string, unknown>, sourceId: string): Record<string, unknown> {
  const messages = (args.messages as Record<string, unknown>[]).map((message) => {
    const update = message.updateDataModel as { value?: Record<string, unknown> } | undefined;
    return update?.value ? { ...message, updateDataModel: { ...update, value: { ...update.value, source: sourceId } } } : message;
  });
  return { ...args, messages };
}
