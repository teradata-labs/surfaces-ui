import { DataSourceProvider, DiscoveryProvider, NavBar, SemanticsProvider } from "@surfaces-ui/components";
import { type ReactNode, Suspense, lazy, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { ComposerPage } from "./areas/ComposerPage.js";
import { HomePage } from "./areas/HomePage.js";
import { PageView } from "./areas/PageView.js";
import { HostsPage } from "./areas/HostsPage.js";
import { ShowcasePage } from "./areas/ShowcasePage.js";
import { LibraryPage } from "./areas/LibraryPage.js";
import { ModelsPage } from "./areas/ModelsPage.js";
import { AnalysisPage } from "./areas/AnalysisPage.js";
import { ChatPage } from "./areas/ChatPage.js";
import { ComponentCatalog } from "./areas/ComponentCatalog.js";
import { Discover } from "./areas/Discover.js";
import { ExamplesPage } from "./areas/ExamplesPage.js";
import { McpPreview } from "./areas/McpPreview.js";
import { ModelPage } from "./areas/ModelPage.js";
import { SemanticPage } from "./areas/SemanticPage.js";
import { PatternsPage } from "./areas/PatternsPage.js";
import { PipelinePage } from "./areas/PipelinePage.js";
import { SourcesPage } from "./areas/SourcesPage.js";
import { ThemeGallery } from "./areas/ThemeGallery.js";
import { ThemePage } from "./areas/ThemePage.js";
import { Workbench } from "./areas/Workbench.js";
import { ThemeMenu } from "./ThemeMenu.js";
import { type ActiveSource, type LoadingStatus, SERVER, chooseSource, engineLabel, isRealSource, sampleSource } from "./source.js";

interface Area {
  id: string;
  label: string;
  /** One line under the label, saying what the area is for. */
  hint: string;
  /** True when the area works on the model picked in the sidebar; others use the sample orders they were written for. */
  picked?: boolean;
  /** False when nothing on the area reads the picked data (each saved surface, model or source names its own), so it has no data picker. */
  data?: false;
  /** True when the area is a demo written against a sample model's measures and categories. On a real source it stays on sample data and says so. */
  demo?: boolean;
  /** `picker` is the data picker, for an area with no heading of its own to put it in. */
  render(source: ActiveSource, picker: ReactNode): ReactNode;
}

// The guides carry the text of every doc, so they load only when Docs is opened.
const DocsPage = lazy(() => import("./areas/DocsPage.js").then((m) => ({ default: m.DocsPage })));
/** Every area of the playground, grouped as the sidebar shows them. The id is the URL hash. */
const GROUPS: { label: string; areas: Area[] }[] = [
  {
    label: "Build",
    areas: [
      { id: "composer", label: "Playground", hint: "Build a surface with an agent or by hand, over sample data or your own", render: (s) => <ComposerPage source={s} /> },
      { id: "pages", demo: true, label: "Reports and pages", hint: "A report builder with pills, and pages edited by plain-language instructions", render: (s) => <ExamplesPage source={s} /> },
      { id: "chat", label: "Chat", hint: "An agent drawing live components in a thread", render: (s) => <ChatPage source={s} /> },
      { id: "analysis", demo: true, label: "Sample analysis", hint: "Written conversations that go end to end: connect a source, clean it, run a pipeline, agree a model, build a report and keep a dashboard", render: (s) => <AnalysisPage source={s} /> },
      { id: "models", data: false, label: "Models", hint: "Which model each agent runs, and the agent the Playground, Chat and Pages use", render: (s) => <ModelsPage source={s} /> },
    ],
  },
  {
    label: "Components",
    areas: [
      { id: "catalog", demo: true, label: "Catalog", hint: "Every component: live props, preview, the events it sends and its API", render: (s) => <ComponentCatalog source={s} /> },
      { id: "patterns", demo: true, label: "Patterns", hint: "Comparisons, chart advice and every human-in-the-loop pattern", render: (s) => <PatternsPage source={s} /> },
      { id: "themes", demo: true, label: "Themes", hint: "Every preset over the same data", render: (s) => <ThemeGallery source={s} /> },
      { id: "theme", demo: true, label: "Theme editor", hint: "Accent, radius, density and chart colours", render: (s) => <ThemePage source={s} /> },
    ],
  },
  {
    label: "Data",
    areas: [
      { id: "workbench", picked: true, label: "SQL workbench", hint: "Browse, write SQL, read the result", render: (s) => <Workbench source={s} /> },
      { id: "model", picked: true, label: "Data model", hint: "Drag tables and columns to build joins", render: (s) => <ModelPage source={s} /> },
      { id: "semantic", picked: true, label: "Semantic models", hint: "Dimensions, measures and metrics, defined once for every report", render: (s) => <SemanticPage source={s} /> },
      { id: "discover", picked: true, label: "Data catalog", hint: "Search, table detail, ask and agent context", render: (s) => <Discover source={s} /> },
      { id: "pipelines", label: "Pipelines", hint: "Datasets built from one another, with quality rules", render: (s) => <PipelinePage source={s} /> },
      { id: "sources", data: false, label: "Sources", hint: "What the backend offers and how it connects", render: (s) => <SourcesPage source={s} /> },
    ],
  },
  {
    label: "Library",
    areas: [{ id: "library", data: false, label: "Saved surfaces", hint: "Pages, charts, forms and explorers, by kind, with versions", render: (s) => <LibraryPage source={s} /> }],
  },
  {
    label: "Docs",
    areas: [{ id: "docs", data: false, label: "Guides", hint: "Getting started, agent integration, accessibility, the recipes and the app components", render: () => <Suspense fallback={<p className="hint" role="status">Loading the guides…</p>}><DocsPage /></Suspense> }],
  },
  {
    label: "Showcase",
    areas: [
      { id: "showcase", demo: true, label: "By role", hint: "Setups for the people who work with data, each made from the same components", render: (s) => <ShowcasePage source={s} onOpen={openArea} /> },
      { id: "hosts", label: "Hosts", hint: "One saved surface in a page, a chat reply, a side panel and an MCP frame", render: (s) => <HostsPage source={s} /> },
      { id: "mcp", demo: true, label: "MCP app", hint: "The real MCP app page with this page as its host", render: (s) => <McpPreview source={s} /> },
    ],
  },
];
/** Opens an area by its hash, with anything after "?" for the area itself (`showcase?persona=analyst`). */
function openArea(target: string) {
  location.hash = target;
  window.scrollTo({ top: 0 });
}
/** The overview the site opens on. The brand in the bar goes back to it; it is not a section of its own. */
const HOME: Area = { id: "home", demo: true, label: "Overview", hint: "", render: (s, picker) => <HomePage source={s} onOpen={openArea} picker={picker} /> };
/** One example page alone, with no playground around it (`#view`), for showing the same page on several screens. Not in the navigation. */
const VIEW: Area = { id: "view", demo: true, label: "Page", hint: "", render: (s) => <PageView source={s} /> };
const AREAS = [HOME, VIEW, ...GROUPS.flatMap((g) => g.areas)];
/** The areas as the navigation lists them: each group a section in the top bar, its areas the pages beneath. */
const NAV = GROUPS.map((group) => ({ label: group.label, items: group.areas.map((area) => ({ id: area.id, label: area.label, href: `#${area.id}` })) }));
// The overview is what opens first; the playground keeps its hash "composer", so saved links keep working.
const DEFAULT = "home";
/** The area in the hash; anything after "?" (such as `?surface=<id>`) belongs to the area. */
const hashArea = () => location.hash.slice(1).split("?")[0] ?? "";
const hashQuery = () => location.hash.split("?")[1];
const areaFromHash = () => AREAS.find((a) => a.id === hashArea())?.id ?? DEFAULT;

const BACKEND: Record<ActiveSource["kind"], { label: string; detail: string }> = {
  server: { label: "Dev server", detail: `The local server at ${SERVER.replace(/^https?:\/\//, "")}` },
  browser: { label: "DuckDB in this page", detail: "WebAssembly; no server, nothing leaves the browser" },
  memory: { label: "Sample in memory", detail: "Rows held in the page; start the dev server for real SQL" },
};

const NOTHING_LOADING: LoadingStatus = { get: () => undefined, set: () => {}, subscribe: () => () => {} };

/** What the page is still loading, as one sentence, or undefined. */
function useLoading(status: LoadingStatus | undefined): string | undefined {
  const store = status ?? NOTHING_LOADING;
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** True while the dev server, which answered when the page loaded, does not answer. Checked every 10 seconds and when the tab is shown again. */
function useServerGone(watching: boolean): boolean {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!watching) return setGone(false);
    let live = true;
    let misses = 0;
    const check = async () => {
      try {
        // Any reply, even an error status, means the server is there; only a failed connection means it is not.
        await fetch(SERVER, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(5000) });
        misses = 0;
        if (live) setGone(false);
      } catch {
        // One slow answer is a busy server (it may be building its search index), not a stopped one.
        misses += 1;
        if (live && misses >= 3) setGone(true);
      }
    };
    const timer = window.setInterval(() => void check(), 10000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [watching]);
  return gone;
}

// Started as the page's code loads, not after its first draw, so the database's download begins as early as it can.
const choosing = chooseSource();

export function App() {
  const [source, setSource] = useState<ActiveSource | undefined>();
  const [areaId, setArea] = useState(areaFromHash);
  // Changing area cross-fades the page under the bar where the browser has view transitions and motion is wanted;
  // elsewhere it simply changes.
  const setAreaId = useCallback((next: string) => {
    type Transition = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };
    const start = (document as Document & { startViewTransition?: (update: () => void) => Transition }).startViewTransition;
    const still = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!start || still) {
      setArea(next);
      return;
    }
    const transition = start.call(document, () => flushSync(() => setArea(next)));
    // A transition the browser gives up on (a hidden tab cannot take a snapshot) still changes the area; only the
    // animation is skipped, so its rejections are not errors.
    for (const step of [transition.ready, transition.finished, transition.updateCallbackDone]) step.catch(() => undefined);
  }, []);
  const area = AREAS.find((a) => a.id === areaId)!;
  const areaRef = useRef(areaId);
  areaRef.current = areaId;
  const [picked, setPicked] = useState(() => new URLSearchParams(location.search).get("source") ?? "");
  // The source whose tables are loaded; nothing is drawn until it is the one picked.
  const [ready, setReady] = useState<string>();
  const pickedId = source?.sources.some((s) => s.id === picked) ? picked : (source?.sources.find((s) => s.seed)?.id ?? source?.sampleId ?? "");
  // Every area works on the dataset picked in the sidebar.
  const areaSource = source && { ...source, sourceId: pickedId };
  // A demo page drawn while a real source is picked stays on sample data.
  const onSample = !!areaSource && !!area.demo && isRealSource(areaSource);
  const shownSource = areaSource && onSample ? sampleSource(areaSource) : areaSource;

  useEffect(() => {
    if (!source || !pickedId) return;
    let current = true;
    // A source that cannot load says so where its data is shown; in the browser the page then moves to rows in memory.
    void source
      .prepare(pickedId)
      .catch(() => undefined)
      .finally(() => current && setReady(pickedId));
    const url = new URL(location.href);
    url.searchParams.set("source", pickedId);
    history.replaceState(null, "", url);
    return () => {
      current = false;
    };
  }, [source, pickedId]);
  // In the browser every query waits for its own tables, so the page is drawn at once and fills in; a server's sources
  // are there already.
  const preparing = ready !== pickedId && source?.kind !== "browser";
  const loading = useLoading(source?.loading);
  // The guides read no data, so the database loading behind them is not worth a word there.
  const shownLoading = area.id === "docs" ? undefined : loading;

  useEffect(() => {
    void choosing.then((chosen) => {
      setSource(chosen);
      // When DuckDB cannot start in this browser, the page carries on with rows held in memory.
      void chosen.fallback?.then((memory) => memory && setSource(memory));
      // For tinkering from the browser console in development: `await playground.dataSource.listSources({})`.
      if (import.meta.env.DEV) (window as unknown as { playground: ActiveSource }).playground = chosen;
    });
  }, []);
  // The dev server can stop after the page loaded; say so instead of leaving bare "Failed to fetch" errors.
  const serverGone = useServerGone(source?.kind === "server");
  useEffect(() => {
    const onHash = () => {
      const next = areaFromHash();
      if (next !== areaRef.current) setAreaId(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [setAreaId]);
  useEffect(() => {
    const query = hashArea() === areaId ? hashQuery() : undefined;
    history.replaceState(null, "", `${location.pathname}${location.search}${areaId === DEFAULT && !query ? "" : `#${areaId}${query ? `?${query}` : ""}`}`);
    document.title = `${area.label} · Surfaces UI`;
  }, [areaId, area.label]);

  // How tall the bars really are, which changes with the width (two rows, one that wraps, or a phone's one row):
  // columns that stick beneath them and pages sized to the window read it as --shell-bar.
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = shell.current?.querySelector<HTMLElement>(".shell-bar");
    if (!bar || typeof ResizeObserver === "undefined") return;
    const measure = () => shell.current?.style.setProperty("--shell-bar", `${bar.offsetHeight}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    measure();
    return () => observer.disconnect();
  }, []);

  // The data picker sits on the pages that read it, never in the top bar: the Library, Models and Sources do not.
  const picker =
    source && source.sources.length > 1 && area.data !== false ? (
      <label className="shell-picker">
        <span>Data</span>
        <select value={pickedId} onChange={(e) => setPicked(e.target.value)} title="The data this page and the other pages that read data use">
          {source.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  return (
    <div className="shell" ref={shell} data-bare={area.id === VIEW.id || undefined}>
      <NavBar
        className="shell-bar"
        label="Surfaces UI"
        groups={NAV}
        current={areaId}
        onSelect={setAreaId}
        brand={
          <a className="shell-brand" href={`#${DEFAULT}`} onClick={() => setAreaId(DEFAULT)}>
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={26} height={26} />
            Surfaces UI
          </a>
        }
        actions={
          <div className="shell-actions">
            {source && (
              <>
              <p className="shell-backend" title={BACKEND[source.kind].detail}>
                <span className={`shell-dot ${source.kind}`} aria-hidden="true" />
                <span>{BACKEND[source.kind].label}</span>
                <span className="shell-backend-detail">
                  {source.kind === "server" && areaSource ? `${engineLabel(areaSource)} through ${BACKEND.server.detail.toLowerCase()}` : BACKEND[source.kind].detail}
                </span>
              </p>
              </>
            )}
            <ThemeMenu onOpenArea={setAreaId} />
          </div>
        }
      />
      {serverGone && (
        <p className="shell-backend-down" role="alert">
          The dev server at {SERVER} stopped answering, so data cannot load. Start it again with <code>pnpm serve</code>; the page carries on when it answers.
        </p>
      )}
      {/* Always in the page, so a screen reader hears the sentence change and then go. */}
      <p className="shell-loading" role="status" data-shown={shownLoading ? "" : undefined}>
        {shownLoading}
      </p>
      <div className="shell-main">
        {area.id !== HOME.id && area.id !== VIEW.id && area.id !== "docs" && (
          <header className="shell-head">
            <div className="shell-head-text">
              <h1>{area.label}</h1>
              <p className="hint">{area.hint}</p>
            </div>
            {picker}
          </header>
        )}
        <main className="shell-area">
          {!source || !areaSource ? (
            <p className="hint" role="status">
              Connecting…
            </p>
          ) : preparing ? (
            <p className="hint" role="status">
              Loading {source.sources.find((s) => s.id === pickedId)?.label}…
            </p>
          ) : (
            <DataSourceProvider dataSource={source.dataSource}>
              <DiscoveryProvider discovery={source.discovery}>
              <SemanticsProvider semantics={source.semantics}>
                {onSample && shownSource && (
                  <p className="shell-sample-note" role="note">
                    This page is a demo, shown on sample data ({source.sources.find((s) => s.id === shownSource.sourceId)?.label}). To build on{" "}
                    {source.sources.find((s) => s.id === pickedId)?.label}, use the <a href="#composer">Playground</a>, <a href="#chat">Chat</a> or the Data pages.
                  </p>
                )}
                <div key={`${area.id}:${shownSource!.sourceId}`}>{area.render(shownSource!, picker)}</div>
              </SemanticsProvider>
              </DiscoveryProvider>
            </DataSourceProvider>
          )}
        </main>
      </div>
    </div>
  );
}
