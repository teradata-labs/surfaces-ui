import { type PageDocument, type SurfaceComponent, siteLink, upgradePage } from "@surfaces-ui/spec";
import type { ThemeRequest } from "@surfaces-ui/tokens";
import type { MatchedRoute, SiteRoutes } from "./routes.js";

/** Turns an image name a page uses ("dashboard") into an address the site serves it from. */
export type ImageResolver = (name: string) => string | undefined;

/**
 * Where a page's data comes from on the server: anything a page binds to (an essay's title and text, a list of
 * posts), as plain JSON. It is merged over the page's own `data`.
 */
export type PageData = (route: string, values: Record<string, string>) => unknown | Promise<unknown>;

/** A page ready to send to the browser: plain JSON, with nothing in it the browser has to ask the server for. */
export interface PreparedPage {
  page: PageDocument;
  /** The address for each image name the page uses, worked out on the server. */
  images: Record<string, string>;
}

/** Where the route's values are put in the page's data, so a page can write `${/@route/slug}`. */
export const ROUTE_DATA_KEY = "@route";

/**
 * Prepares the page an address matched: the site's theme under the page's own, the route's values and the app's
 * data in its data model, and the address of every image it names. Functions stay on the server, since none can
 * cross to the browser.
 */
export async function preparePage(site: SiteRoutes, match: MatchedRoute, options: { data?: PageData; resolveImage?: ImageResolver } = {}): Promise<PreparedPage> {
  const given = options.data ? await options.data(match.entry.route, match.values) : undefined;
  return prepareDocument(match.entry.page, {
    data: { ...(isRecord(given) ? given : {}), [ROUTE_DATA_KEY]: match.values },
    theme: site.theme,
    resolveImage: options.resolveImage,
  });
}

export interface PrepareOptions {
  /** Merged over the page's own data. */
  data?: Record<string, unknown>;
  /** A theme the page's own `theme` is laid over (the site's). */
  theme?: ThemeRequest;
  resolveImage?: ImageResolver;
}

/** Prepares any page to send to the browser: data merged in, themes merged, image names resolved. */
export function prepareDocument(given: PageDocument, options: PrepareOptions = {}): PreparedPage {
  const page = upgradePage(given);
  const data = { ...(isRecord(page.data) ? page.data : {}), ...options.data };
  const theme = mergeTheme(options.theme, page.theme);
  const images: Record<string, string> = {};
  if (options.resolveImage) {
    for (const name of mediaNames(page.components)) {
      const address = siteLink(options.resolveImage(name));
      if (address) images[name] = address;
    }
  }
  return { page: { ...page, data, ...(theme ? { theme } : {}) }, images };
}

function mergeTheme(site: ThemeRequest | undefined, page: ThemeRequest | undefined): ThemeRequest | undefined {
  if (!site && !page) return undefined;
  return { ...site, ...page };
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** The image names a page's Media components use, written as text (a bound one is resolved in the browser). */
function mediaNames(components: SurfaceComponent[]): string[] {
  return [...new Set(components.flatMap((c) => (c.component === "Media" && typeof c.src === "string" && c.src ? [c.src] : [])))];
}
