import { Client } from "@modelcontextprotocol/client";
import type { McpUiStyles } from "@modelcontextprotocol/ext-apps";
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { useTheme } from "@surfaces-ui/components";
import { hostStyleVariables } from "@surfaces-ui/tokens";
import { surfaceKindLabel } from "@surfaces-ui/data";
import { registerSurfacesApps } from "@surfaces-ui/mcp";
import appHtml from "@surfaces-ui/mcp/app.html?raw";
import { type SavedSurface, SurfaceKind, type SurfaceSummary } from "@surfaces-ui/proto";
import { type PageDocument, analyticsCatalog, pageMessages, pageSurface } from "@surfaces-ui/spec";
import { SurfaceView, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { pageOf, surfaceLink } from "../libraryLinks.js";
import type { ActiveSource } from "../source.js";
import { MaybePipelines, listAll, usePrepared } from "./LibraryPage.js";

/**
 * The real MCP App page in a sandboxed frame, with this page as its host
 * (as in the MCP app area), sent one page through `render_surface`: the
 * same A2UI messages a model would send.
 */
function McpFrame({ source, page }: { source: ActiveSource; page: PageDocument }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const session = useRef<{ client: Client; bridge: AppBridge } | undefined>(undefined);
  const { resolvedMode, theme } = useTheme();
  // The frame is told the host's colours as well as its mode, so the page inside it is drawn in the same theme.
  const styles = useMemo(() => ({ variables: hostStyleVariables(theme, resolvedMode) as McpUiStyles }), [theme, resolvedMode]);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(200);
  const [status, setStatus] = useState("Connecting");

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe?.contentWindow) return;
    let closed = false;
    const server = new McpServer({ name: "surfaces", version: "0.0.0" });
    registerSurfacesApps(server, { dataSource: source.dataSource, appHtml, defaultSourceId: source.sourceId });
    const client = new Client({ name: "playground-hosts", version: "0.0.0" });
    const bridge = new AppBridge(client, { name: "Surfaces playground host", version: "0.0.0" }, { serverTools: {}, openLinks: {}, logging: {} }, { hostContext: { theme: resolvedMode, styles } });
    bridge.oninitialized = () => {
      if (!closed) setReady(true);
    };
    bridge.onsizechange = ({ height: next }) => {
      if (typeof next === "number" && next > 0) setHeight(Math.min(Math.ceil(next) + 2, 1400));
    };
    bridge.onmessage = async () => ({});
    bridge.onopenlink = async () => ({});
    const [a, b] = InMemoryTransport.createLinkedPair();
    void (async () => {
      await Promise.all([server.connect(a), client.connect(b)]);
      if (closed) return;
      await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
      if (closed) return;
      session.current = { client, bridge };
      iframe.srcdoc = appHtml;
    })().catch((error: unknown) => {
      if (!closed) setStatus(`Host error: ${error instanceof Error ? error.message : String(error)}`);
    });
    return () => {
      closed = true;
      session.current = undefined;
      setReady(false);
      void bridge.close().catch(() => {});
      void client.close().catch(() => {});
    };
    // One session per data source; theme changes are sent separately.
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ready) void session.current?.bridge.sendHostContextChange({ theme: resolvedMode, styles });
  }, [resolvedMode, styles, ready]);

  useEffect(() => {
    const current = session.current;
    if (!ready || !current) return;
    let live = true;
    const args = { messages: pageMessages(page) };
    void (async () => {
      await current.bridge.sendToolInput({ arguments: args });
      const result = await current.client.callTool({ name: "render_surface", arguments: args });
      await current.bridge.sendToolResult(result as never);
      if (live) setStatus(result.isError ? "The server refused the surface; the frame shows why." : "Shown through render_surface");
    })().catch((error: unknown) => live && setStatus(`Could not send the surface: ${error instanceof Error ? error.message : String(error)}`));
    return () => {
      live = false;
    };
  }, [page, ready]);

  return (
    <>
      <p className="hint" role="status">
        {ready ? status : "Connecting to the app page…"}
      </p>
      <iframe ref={frame} className="mcp-frame" title={`${page.title} in the MCP app page`} sandbox="allow-scripts" style={{ height }} />
    </>
  );
}

/** One saved surface drawn in each place a surface can live: a page, a chat reply, a side panel and an MCP frame. */
export function HostsPage({ source }: { source: ActiveSource }) {
  const id = useId();
  const [all, setAll] = useState<SurfaceSummary[] | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [chosen, setChosen] = useState("");
  const [surface, setSurface] = useState<SavedSurface | undefined>();

  useEffect(() => {
    let current = true;
    listAll(source.library)
      .then((list) => {
        if (!current) return;
        setAll(list);
        setChosen((previous) => previous || (list.find((s) => s.kind === SurfaceKind.DASHBOARD && s.tags.includes(source.sourceId)) ?? list.find((s) => s.kind === SurfaceKind.DASHBOARD) ?? list[0])?.id || "");
      })
      .catch((e: unknown) => current && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      current = false;
    };
  }, [source.library, source.sourceId]);

  useEffect(() => {
    if (!chosen) return;
    let current = true;
    setSurface(undefined);
    source.library
      .getSurface({ id: chosen })
      .then(({ surface: found }) => current && setSurface(found))
      .catch((e: unknown) => current && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      current = false;
    };
  }, [chosen, source.library]);

  const page = useMemo(() => (surface ? pageOf(surface) : undefined), [surface]);
  const drawn = useMemo(() => (page ? pageSurface(page) : undefined), [page]);
  const prepared = usePrepared(source, page);

  const view = (label: string) =>
    drawn && prepared.ready ? (
      <MaybePipelines source={source}>
        <SurfaceView key={`${label}:${surface?.id}:${surface?.version}`} surface={drawn} catalog={analyticsCatalog} renderers={lazyAnalyticsRenderers} />
      </MaybePipelines>
    ) : (
      <p className="hint">Loading…</p>
    );

  return (
    <div className="hosts-wrap">
      <section className="card">
        <div className="card-head">
          <h2>One surface, four hosts</h2>
        </div>
        <p className="hint">
          The same saved document, drawn by the same components in a page, a chat reply, a narrow side panel and the MCP app page. Each component
          responds to the space it is given, not to the window.
        </p>
        {error && (
          <p className="library-error" role="alert">
            {error}
          </p>
        )}
        {all && all.length === 0 ? (
          <p className="hint">
            The library is empty. Open <a href="#library">the library</a> once to load the examples, or save a page.
          </p>
        ) : (
          <div className="actions">
            <label className="library-inline" htmlFor={`${id}-pick`}>
              <span>Surface</span>
            </label>
            <select id={`${id}-pick`} className="sf-input" value={chosen} onChange={(e) => setChosen(e.target.value)} disabled={!all}>
              {(all ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({surfaceKindLabel(s.kind)})
                </option>
              ))}
            </select>
            {chosen && <a href={surfaceLink(chosen)}>Open in the library</a>}
          </div>
        )}
        {prepared.error && (
          <p className="library-error" role="alert">
            {prepared.error}
          </p>
        )}
        {surface && !page && (
          <p className="library-error" role="alert">
            This saved surface does not hold a page document, so it cannot be drawn.
          </p>
        )}
      </section>

      {page && (
        <div className="hosts">
          <section className="card host host-page" aria-labelledby={`${id}-page`}>
            <h2 id={`${id}-page`}>Page</h2>
            <p className="hint">Full width, as a page of an app.</p>
            {view("page")}
          </section>

          <section className="card host" aria-labelledby={`${id}-chat`}>
            <h2 id={`${id}-chat`}>Chat reply</h2>
            <p className="hint">Inside a reply in a thread, with the chat package's own styles.</p>
            <ul className="sf-chat-list host-chat" aria-label="Chat thread">
              <li className="sf-chat-message" data-role="user">
                <span className="sf-a2-visually-hidden">You said:</span>
                <p>Show me {page.title.toLowerCase()}.</p>
              </li>
              <li className="sf-chat-message" data-role="assistant">
                <span className="sf-a2-visually-hidden">The reply:</span>
                <p>Here it is.</p>
                <div className="sf-chat-surface">{view("chat")}</div>
                <p className="sf-chat-by">Drawn from the library; no agent took part.</p>
              </li>
            </ul>
          </section>

          <section className="card host host-panel" aria-labelledby={`${id}-panel`}>
            <h2 id={`${id}-panel`}>Side panel</h2>
            <p className="hint">A narrow panel, 20rem (320px) wide.</p>
            {view("panel")}
          </section>

          <section className="card host" aria-labelledby={`${id}-mcp`}>
            <h2 id={`${id}-mcp`}>MCP frame</h2>
            <p className="hint">
              The real MCP app page in a sandboxed frame, sent this page as A2UI messages through <code>render_surface</code>. Data comes through the
              app's own read-only tool. The frame has no discovery backend, so catalog components there say so.
            </p>
            {prepared.ready ? <McpFrame source={source} page={page} /> : <p className="hint">Loading…</p>}
          </section>
        </div>
      )}
    </div>
  );
}
