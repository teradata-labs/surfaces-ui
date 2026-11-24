/**
 * Where each page of the playground lives. Every page has a path of its own (`/chat/`, `/docs/getting-started/`,
 * `/catalog/Chart/`), so a search engine, a link preview and a person's bookmark each name one page. The build writes
 * an HTML file at each of these paths (`prerender.tsx`), and the app reads the path when it starts and follows it as a
 * person moves around, without loading the page again.
 *
 * Addresses from before paths (`#chat`, `#docs?page=…`, `?component=Chart#catalog`) still open the page they named:
 * `legacyTarget` reads them and the app moves the address to the path.
 *
 * Plain data and functions only: no React, no DOM beyond `location` and `history` in the last few functions, so the
 * build can read the same list.
 */

export interface AreaInfo {
  id: string;
  label: string;
  /** One line under the label, saying what the area is for. Also the page's description for search and link previews. */
  hint: string;
  /** True when the area works on the model picked in the sidebar; others use the sample orders they were written for. */
  picked?: boolean;
  /** False when nothing on the area reads the picked data (each saved surface, model or source names its own), so it has no data picker. */
  data?: false;
  /** True when the area is a demo written against a sample model's measures and categories. On a real source it stays on sample data and says so. */
  demo?: boolean;
}

/** Every area, grouped as the navigation shows them. */
export const AREA_GROUPS: { label: string; areas: AreaInfo[] }[] = [
  {
    label: "Build",
    areas: [
      { id: "composer", label: "Playground", hint: "Build a surface with an agent or by hand, over sample data or your own" },
      { id: "pages", demo: true, label: "Reports and pages", hint: "A report builder with pills, and pages edited by plain-language instructions" },
      { id: "chat", label: "Chat", hint: "An agent drawing live components in a thread" },
      { id: "analysis", demo: true, label: "Sample analysis", hint: "Written conversations that go end to end: connect a source, clean it, run a pipeline, agree a model, build a report and keep a dashboard" },
      { id: "models", data: false, label: "Models", hint: "Which model each agent runs, and the agent the Playground, Chat and Pages use" },
    ],
  },
  {
    label: "Components",
    areas: [
      { id: "catalog", demo: true, label: "Catalog", hint: "Every component: live props, preview, the events it sends and its API" },
      { id: "patterns", demo: true, label: "Patterns", hint: "Comparisons, chart advice and every human-in-the-loop pattern" },
      { id: "themes", demo: true, label: "Themes", hint: "Every preset over the same data" },
      { id: "theme", demo: true, label: "Theme editor", hint: "Accent, radius, density and chart colours" },
    ],
  },
  {
    label: "Data",
    areas: [
      { id: "workbench", picked: true, label: "SQL workbench", hint: "Browse, write SQL, read the result" },
      { id: "model", picked: true, label: "Data model", hint: "Drag tables and columns to build joins" },
      { id: "semantic", picked: true, label: "Semantic models", hint: "Dimensions, measures and metrics, defined once for every report" },
      { id: "discover", picked: true, label: "Data catalog", hint: "Search, table detail, ask and agent context" },
      { id: "pipelines", label: "Pipelines", hint: "Datasets built from one another, with quality rules" },
      { id: "sources", data: false, label: "Sources", hint: "What the backend offers and how it connects" },
    ],
  },
  {
    label: "Library",
    areas: [{ id: "library", data: false, label: "Saved surfaces", hint: "Pages, charts, forms and explorers, by kind, with versions" }],
  },
  {
    label: "Docs",
    areas: [{ id: "docs", data: false, label: "Guides", hint: "Getting started, agent integration, accessibility, the recipes and the app components" }],
  },
  {
    label: "Showcase",
    areas: [
      { id: "showcase", demo: true, label: "By role", hint: "Setups for the people who work with data, each made from the same components" },
      { id: "hosts", label: "Hosts", hint: "One saved surface in a page, a chat reply, a side panel and an MCP frame" },
      { id: "mcp", demo: true, label: "MCP app", hint: "The real MCP app page with this page as its host" },
    ],
  },
];

/** The overview the site opens on, at the site's root. */
export const HOME_INFO: AreaInfo = {
  id: "home",
  demo: true,
  label: "Overview",
  hint: "A React library for data and analytics apps that people and agents build together: tables at scale, charts, chat, semantic models and dashboards, over DuckDB, Teradata or your own backend.",
};
/** One example page alone, with no playground around it, for showing the same page on several screens. Not in the navigation or the sitemap. */
export const VIEW_INFO: AreaInfo = { id: "view", demo: true, label: "Page", hint: "" };

export const AREA_INFO: AreaInfo[] = [HOME_INFO, VIEW_INFO, ...AREA_GROUPS.flatMap((g) => g.areas)];
const AREA_IDS = new Set(AREA_INFO.map((a) => a.id));
export const isArea = (id: string) => AREA_IDS.has(id);

/** Parameters of the whole site rather than of one page: kept as a person moves between pages. */
const GLOBAL_PARAMS = ["source", "theme", "mode"];

export interface Route {
  area: string;
  /** The page's own parameters: a guide's `page`, a catalog `component`, a saved `surface`, a `persona`. */
  params: URLSearchParams;
}

/** The route a path and query name. `base` is where the site is served from (`/`, or `/surfaces-ui/`). */
export function parseRoute(pathname: string, search: string, base = "/"): Route {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, "");
  const parts = rest.split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(search);
  for (const key of GLOBAL_PARAMS) params.delete(key);
  const [first = "home", ...more] = parts;
  if (first === "index.html" || !isArea(first)) return { area: "home", params };
  if (first === "docs" && more.length > 0) params.set("page", more.join("/"));
  if (first === "catalog" && more[0]) params.set("component", more[0]);
  return { area: first, params };
}

/** A target written the way the app has always named one: `chat`, `docs?page=styling`, `library?surface=<id>`. */
export function targetRoute(target: string): Route {
  const [area = "home", query = ""] = target.replace(/^#/, "").split("?");
  return { area: isArea(area) ? area : "home", params: new URLSearchParams(query) };
}

/** The path of a route, under `base`, with the page's own parameters (and `keep`, the site's) as its query. */
export function routePath(route: Route, base = "/", keep?: URLSearchParams): string {
  const params = new URLSearchParams(route.params);
  let path = base;
  if (route.area === "docs" && params.get("page")) {
    path += `docs/${params.get("page")!.split("/").map(encodeURIComponent).join("/")}/`;
    params.delete("page");
  } else if (route.area === "catalog" && params.get("component")) {
    path += `catalog/${encodeURIComponent(params.get("component")!)}/`;
    params.delete("component");
  } else if (route.area !== "home") path += `${route.area}/`;
  for (const key of GLOBAL_PARAMS) {
    const value = keep?.get(key);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * The page an address from before paths names, or undefined when it names none: `#chat`, `#docs?page=x`, and the
 * catalog's `?component=Chart#catalog`.
 */
export function legacyTarget(search: string, hash: string): Route | undefined {
  const area = hash.replace(/^#/, "").split("?")[0] ?? "";
  if (!area || !isArea(area)) return undefined;
  const route = targetRoute(hash);
  const component = new URLSearchParams(search).get("component");
  if (area === "catalog" && component && !route.params.has("component")) route.params.set("component", component);
  return route;
}

// What follows reads and moves the browser's address.

const BASE = (import.meta as { env?: Record<string, string | undefined> }).env?.BASE_URL ?? "/";
/** Sent on the window when the app moves to another page itself (`history.pushState` sends nothing). */
const ROUTE_EVENT = "surfaces:route";

/** The route the address names now. */
export function currentRoute(): Route {
  return legacyTarget(location.search, location.hash) ?? parseRoute(location.pathname, location.search, BASE);
}

/** One of the current page's own parameters. */
export const routeParam = (name: string): string | undefined => currentRoute().params.get(name) ?? undefined;

/** The address of a target (`chat`, `docs?page=styling`), keeping the site's parameters (the data picked). */
export const hrefOf = (target: string): string => routePath(targetRoute(target), BASE, new URLSearchParams(location.search));

/** Opens a target as a new entry in the history, without loading the page again. */
export function go(target: string | Route, { replace = false, scroll = true } = {}): void {
  const route = typeof target === "string" ? targetRoute(target) : target;
  const url = routePath(route, BASE, new URLSearchParams(location.search));
  if (url !== `${location.pathname}${location.search}` || location.hash) history[replace ? "replaceState" : "pushState"](null, "", url);
  window.dispatchEvent(new Event(ROUTE_EVENT));
  if (scroll && !replace) window.scrollTo({ top: 0 });
}

/** Calls `listener` whenever the address changes: the app moving, a link, Back and Forward. */
export function onRoute(listener: () => void): () => void {
  window.addEventListener(ROUTE_EVENT, listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener(ROUTE_EVENT, listener);
    window.removeEventListener("popstate", listener);
  };
}

/**
 * Follows a press on a link to another page of this site in place, so the sample database and what a person has open
 * stay loaded. A press with a modifier key, or on a link meant for another tab, is left to the browser.
 */
export function followLinks(root: Document = document): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    const legacy = legacyTarget(url.search, url.hash);
    if (legacy) {
      event.preventDefault();
      go(legacy);
      return;
    }
    if (url.hash || !url.pathname.startsWith(BASE)) return;
    const first = url.pathname.slice(BASE.length).split("/")[0] ?? "";
    if (first !== "" && !isArea(first)) return;
    event.preventDefault();
    go(parseRoute(url.pathname, url.search, BASE));
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}
