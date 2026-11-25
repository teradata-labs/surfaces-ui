import type { PageDocument } from "@surfaces-ui/spec";
import type { ThemeRequest } from "@surfaces-ui/tokens";

/** What a route says about itself to search engines and link previews. */
export interface SiteMeta {
  title?: string;
  description?: string;
  /** An image for link previews: a name the app's `resolveImage` turns into an address, or an http(s) address. */
  image?: string;
}

/** One page of a site and the route it is served on. */
export interface SiteRoute {
  /** A path: "/", "/pricing", "/essays/[slug]". A segment in brackets takes a value from the app. */
  route: string;
  page: PageDocument;
  meta?: SiteMeta;
}

/**
 * The pages of a site, each on its route. This is the part of the planned site document (`docs/plans/sites.md`,
 * step 4) that a Next.js app needs to serve pages, so that document will be accepted here as it is.
 */
export interface SiteRoutes {
  title?: string;
  /** The look of every page, unless a page asks for its own. */
  theme?: ThemeRequest;
  pages: SiteRoute[];
}

/** One part of a route: a fixed name, or a value named in brackets. */
export type RouteSegment = { kind: "fixed"; name: string } | { kind: "value"; name: string };

const FIXED = /^[A-Za-z0-9._~!$&'()*+,;=:@%-]+$/;
const VALUE = /^\[([A-Za-z_][A-Za-z0-9_]*)\]$/;

/** The segments of a route, or what is wrong with it. */
export function parseRoute(route: string): { segments: RouteSegment[] } | { problem: string } {
  if (typeof route !== "string" || !route.startsWith("/")) return { problem: `A route is a path that starts with "/", not "${String(route)}".` };
  if (route !== "/" && route.endsWith("/")) return { problem: `Write "${route}" without the "/" at the end.` };
  const parts = route === "/" ? [] : route.slice(1).split("/");
  const segments: RouteSegment[] = [];
  const names = new Set<string>();
  for (const part of parts) {
    const value = VALUE.exec(part);
    if (value) {
      const name = value[1]!;
      if (names.has(name)) return { problem: `"${route}" names [${name}] twice.` };
      names.add(name);
      segments.push({ kind: "value", name });
    } else if (part.startsWith("[")) {
      return { problem: `"${part}" in "${route}" is not a value Surfaces can fill: write one name in brackets, such as [slug]. Catch-all segments ([...path]) are not supported.` };
    } else if (!part || part === "." || part === ".." || !FIXED.test(part)) {
      return { problem: `"${part}" in "${route}" is not a path segment.` };
    } else {
      segments.push({ kind: "fixed", name: part });
    }
  }
  return { segments };
}

/** The names a route takes values for, in order: ["slug"] for "/essays/[slug]". */
export function routeValueNames(route: string): string[] {
  const parsed = parseRoute(route);
  return "segments" in parsed ? parsed.segments.filter((s) => s.kind === "value").map((s) => s.name) : [];
}

export interface SiteProblem {
  route: string;
  message: string;
}

/**
 * What is wrong with a site's routes: a route that is not a path, two pages on one route, or two routes that
 * would answer the same address ("/[a]" and "/[b]"). A fixed route always wins over one with a value, so
 * "/essays/new" beside "/essays/[slug]" is fine.
 */
export function siteProblems(site: SiteRoutes): SiteProblem[] {
  const problems: SiteProblem[] = [];
  const shapes = new Map<string, string>();
  for (const { route, page } of site.pages ?? []) {
    const parsed = parseRoute(route);
    if ("problem" in parsed) {
      problems.push({ route, message: parsed.problem });
      continue;
    }
    if (!page || !Array.isArray(page.components)) problems.push({ route, message: `"${route}" has no page.` });
    const shape = parsed.segments.map((s) => (s.kind === "fixed" ? s.name : "[]")).join("/");
    const before = shapes.get(shape);
    if (before === route) problems.push({ route, message: `Two pages are on "${route}".` });
    else if (before) problems.push({ route, message: `"${route}" and "${before}" answer the same addresses. Give one of them a fixed segment.` });
    else shapes.set(shape, route);
  }
  return problems;
}

/** A page found for an address, with the values its route took from it. */
export interface MatchedRoute {
  entry: SiteRoute;
  values: Record<string, string>;
}

/**
 * The page for an address, given as Next.js gives a catch-all route's segments (`["essays", "first-post"]`; none
 * for the home page). A route whose segments are all fixed wins over one that takes values, segment by segment
 * from the left, as in Next.js.
 */
export function matchRoute(site: SiteRoutes, segments: readonly string[] | string | undefined): MatchedRoute | undefined {
  const parts = (segments === undefined ? [] : typeof segments === "string" ? [segments] : [...segments]).map(decodeSegment);
  if (parts.some((part) => part === undefined)) return undefined;
  let best: { match: MatchedRoute; rank: string } | undefined;
  for (const entry of site.pages ?? []) {
    const parsed = parseRoute(entry.route);
    if ("problem" in parsed || parsed.segments.length !== parts.length) continue;
    const values: Record<string, string> = {};
    let fits = true;
    for (const [i, segment] of parsed.segments.entries()) {
      const part = parts[i]!;
      if (segment.kind === "fixed") fits = segment.name === part;
      else if (part) values[segment.name] = part;
      else fits = false;
      if (!fits) break;
    }
    if (!fits) continue;
    // "0" for a fixed segment sorts before "1" for a value: the more fixed segments to the left, the better.
    const rank = parsed.segments.map((s) => (s.kind === "fixed" ? "0" : "1")).join("");
    if (!best || rank < best.rank) best = { match: { entry, values }, rank };
  }
  return best?.match;
}

function decodeSegment(part: string): string | undefined {
  try {
    return decodeURIComponent(part);
  } catch {
    return undefined;
  }
}

/** The address of a route with its values filled in: "/essays/first-post". Values are encoded. */
export function routePath(route: string, values: Record<string, string> = {}): string {
  const parsed = parseRoute(route);
  if ("problem" in parsed) throw new Error(parsed.problem);
  const parts = parsed.segments.map((segment) => {
    if (segment.kind === "fixed") return segment.name;
    const value = values[segment.name];
    if (!value) throw new Error(`"${route}" needs a value for [${segment.name}].`);
    return encodeURIComponent(value);
  });
  return `/${parts.join("/")}`;
}

/**
 * Where a route's values come from, by route: a list of values when it takes one ("/essays/[slug]" →
 * `["first-post", "second-post"]`), or of objects when it takes several. From files, a CMS or a database; the app
 * decides, and Surfaces only asks.
 */
export type RouteValues = Record<string, () => Iterable<string | Record<string, string>> | Promise<Iterable<string | Record<string, string>>>>;

export interface SiteParamsOptions {
  /** The name of the catch-all segment in the app's folder, `app/[[...route]]`. Default "route". */
  param?: string;
}

/**
 * Every address of a site as Next.js's `generateStaticParams` wants it for an optional catch-all route,
 * `app/[[...route]]/page.tsx`: `[{ route: [] }, { route: ["pricing"] }, { route: ["essays", "first-post"] }]`.
 * A route that takes values with none given is an error, so a static export never leaves a page out quietly.
 */
export async function siteParams(site: SiteRoutes, values: RouteValues = {}, options: SiteParamsOptions = {}): Promise<Record<string, string[]>[]> {
  const param = options.param ?? "route";
  const problems = siteProblems(site);
  if (problems.length) throw new Error(`The site's routes have problems: ${problems.map((p) => p.message).join(" ")}`);
  const unknown = Object.keys(values).filter((route) => !site.pages.some((p) => p.route === route));
  if (unknown.length) throw new Error(`Values are given for routes the site does not have: ${unknown.join(", ")}.`);
  const params: Record<string, string[]>[] = [];
  for (const { route } of site.pages) {
    const names = routeValueNames(route);
    if (!names.length) {
      params.push({ [param]: route === "/" ? [] : route.slice(1).split("/") });
      continue;
    }
    const source = values[route];
    if (!source) throw new Error(`"${route}" takes ${names.map((n) => `[${n}]`).join(" and ")}: pass its values to siteParams, as { "${route}": () => [...] }.`);
    for (const given of await source()) {
      const filled = typeof given === "string" ? (names.length === 1 ? { [names[0]!]: given } : undefined) : given;
      if (!filled) throw new Error(`"${route}" takes ${names.length} values, so give each as an object, such as { ${names.map((n) => `${n}: "…"`).join(", ")} }.`);
      // Next.js hands the segments back decoded, so they are given decoded.
      params.push({ [param]: routePath(route, filled).slice(1).split("/").map(decodeURIComponent) });
    }
  }
  return params;
}
