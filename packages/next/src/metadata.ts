import { siteLink } from "@surfaces-ui/spec";
import type { Metadata } from "next";
import type { ImageResolver } from "./prepare.js";
import { type SiteMeta, type SiteRoutes, matchRoute, routePath } from "./routes.js";
import { type RouteParams, segmentsOf } from "./params.js";

export interface SiteMetadataOptions {
  /** The name of the catch-all segment, as for `siteParams`. Default "route". */
  param?: string;
  /** Turns an image name in `meta.image` into an address. An http(s) address is used as written. */
  resolveImage?: ImageResolver;
  /**
   * The meta of a route that takes values, worked out from them: an essay's own title and summary. Merged over
   * the route's `meta`.
   */
  describe?: (route: string, values: Record<string, string>) => SiteMeta | undefined | Promise<SiteMeta | undefined>;
}

/**
 * Next.js metadata for an address of the site, for `generateMetadata`: the title (with the site's title after
 * it, through Next.js's title template), the description, the canonical path and a link preview. The page's own
 * title and description are used where the route's `meta` says nothing. An address the site does not have gets
 * no metadata; the page itself answers it with a 404.
 */
export async function siteMetadata(site: SiteRoutes, params: RouteParams, options: SiteMetadataOptions = {}): Promise<Metadata> {
  const match = matchRoute(site, await segmentsOf(params, options.param));
  if (!match) return {};
  const described = options.describe ? await options.describe(match.entry.route, match.values) : undefined;
  const meta: SiteMeta = { ...match.entry.meta, ...described };
  const title = meta.title ?? match.entry.page.title;
  const description = meta.description ?? match.entry.page.description;
  const image = meta.image ? (options.resolveImage?.(meta.image) ?? meta.image) : undefined;
  const imageAddress = image ? siteLink(image) : undefined;
  const path = routePath(match.entry.route, match.values);
  const isHome = match.entry.route === "/";
  return {
    ...(title ? { title: isHome || !site.title ? { absolute: title } : `${title} · ${site.title}` } : {}),
    ...(description ? { description } : {}),
    alternates: { canonical: path },
    openGraph: {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(site.title ? { siteName: site.title } : {}),
      url: path,
      ...(imageAddress ? { images: [imageAddress] } : {}),
    },
  };
}
