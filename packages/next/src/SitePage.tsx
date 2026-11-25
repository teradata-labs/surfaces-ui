import { analyticsCatalog, basicsCatalog, siteCatalog, validatePage } from "@surfaces-ui/spec";
import { notFound } from "next/navigation";
import { SiteSurface } from "./client.js";
import { type RouteParams, segmentsOf } from "./params.js";
import { type ImageResolver, type PageData, preparePage } from "./prepare.js";
import { type SiteRoutes, matchRoute } from "./routes.js";

const CHECKED = [siteCatalog, basicsCatalog, analyticsCatalog];

export interface SitePageProps {
  site: SiteRoutes;
  /** The `params` Next.js gives the page. */
  params: RouteParams;
  /** The name of the catch-all segment, as for `siteParams`. Default "route". */
  param?: string;
  /** Data for the page, worked out on the server and merged over its own. */
  data?: PageData;
  /** Turns an image name a page uses into an address on the site. */
  resolveImage?: ImageResolver;
  /** Origins an image may also come from as written. */
  imageOrigins?: string[];
}

/**
 * The page of a site for an address, as a server component: `export default function Page({ params }) { return
 * <SitePage site={site} params={params} /> }` in `app/[[...route]]/page.tsx`. An address the site does not have is
 * Next.js's 404 (`notFound`). A page the catalog refuses stops the build, or the request, with what is wrong, so a
 * static export never ships a broken page.
 */
export async function SitePage({ site, params, param, data, resolveImage, imageOrigins }: SitePageProps) {
  const match = matchRoute(site, await segmentsOf(params, param));
  if (!match) notFound();
  const prepared = await preparePage(site, match, { data, resolveImage });
  const catalog = CHECKED.find((c) => c.id === prepared.page.catalogId);
  if (catalog) {
    const issues = validatePage(prepared.page, catalog);
    if (issues.length) {
      throw new Error(`The page on "${match.entry.route}" does not fit the ${catalog.id} catalog: ${issues.map((i) => `${i.path} ${i.message}`).join("; ")}`);
    }
  }
  return <SiteSurface page={prepared.page} images={prepared.images} imageOrigins={imageOrigins} />;
}
