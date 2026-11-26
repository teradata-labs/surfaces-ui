"use client";

import { ThemeProvider, useOptionalTheme } from "@surfaces-ui/components";
import { type Catalog, type PageDocument, type SurfaceAction, analyticsCatalog, basicsCatalog, pageSurface, siteCatalog } from "@surfaces-ui/spec";
import {
  type ComponentRenderer,
  MediaPolicyProvider,
  SurfaceView,
  basicsRenderers,
  lazyAnalyticsRenderers,
  siteRenderers,
} from "@surfaces-ui/spec/react";
import { useRouter } from "next/navigation";
import { type MouseEvent, type ReactNode, useCallback, useMemo } from "react";

/** The catalogs a page may name, with what draws each. */
const CATALOGS: Record<string, { catalog: Catalog; renderers: Record<string, ComponentRenderer> }> = {
  [siteCatalog.id]: { catalog: siteCatalog, renderers: siteRenderers },
  [basicsCatalog.id]: { catalog: basicsCatalog, renderers: basicsRenderers },
  [analyticsCatalog.id]: { catalog: analyticsCatalog, renderers: lazyAnalyticsRenderers },
};

export interface SiteSurfaceProps {
  /** The page, prepared on the server (`preparePage`): plain JSON. */
  page: PageDocument;
  /** The address of each image name the page uses. */
  images?: Record<string, string>;
  /** Origins an image may also come from as written ("https://images.example.com"). */
  imageOrigins?: string[];
  /** For an app's own catalog (from a client file of the app's): the catalog and its renderers. */
  catalog?: Catalog;
  renderers?: Record<string, ComponentRenderer>;
  /** Told of an event a control sends. A site has no agent, so with none an event goes nowhere. */
  onAction?(action: SurfaceAction): void;
}

/**
 * Draws one page of a site in a Next.js app. It is a client component, and is rendered to HTML on the server
 * like any other: the site's components render with no browser, and a data component draws once the page has
 * loaded. A link to a path on the site moves through Next.js's router, so the page is not loaded again; any other
 * link, a link opened in a new tab and a download behave as links do.
 */
export function SiteSurface({ page, images, imageOrigins, catalog, renderers, onAction }: SiteSurfaceProps) {
  const router = useRouter();
  const known = CATALOGS[page.catalogId];
  const drawWith = catalog && renderers ? { catalog, renderers } : known;
  const surface = useMemo(() => pageSurface(page), [page]);
  const policy = useMemo(() => ({ resolve: (name: string) => images?.[name], origins: imageOrigins }), [images, imageOrigins]);
  const follow = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const to = sitePathOf(event);
      if (!to) return;
      event.preventDefault();
      router.push(to);
    },
    [router],
  );
  if (!drawWith) {
    return <p role="alert">This page names the catalog "{page.catalogId}", which this site does not draw.</p>;
  }
  return (
    <WithTheme>
      <MediaPolicyProvider policy={policy}>
        {/* A wrapper that takes no room: it only hears clicks on the page's links. */}
        <div onClick={follow} style={{ display: "contents" }}>
          <SurfaceView surface={surface} catalog={drawWith.catalog} renderers={drawWith.renderers} onAction={onAction} />
        </div>
      </MediaPolicyProvider>
    </WithTheme>
  );
}

/** The app's own theme when it has a `ThemeProvider`, else one kept to the page's region and in memory. */
function WithTheme({ children }: { children: ReactNode }) {
  const outer = useOptionalTheme();
  if (outer) return <>{children}</>;
  return (
    <ThemeProvider scope="scoped" storage={null}>
      {children}
    </ThemeProvider>
  );
}

/**
 * The path a click should go to through the router, or nothing when the browser should handle it: a press that
 * is not a plain left click, a link that opens elsewhere, downloads, or leaves the site.
 */
export function sitePathOf(event: Pick<MouseEvent, "defaultPrevented" | "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "target">): string | undefined {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return undefined;
  const target = event.target as Element | null;
  const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!link) return undefined;
  if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return undefined;
  const href = link.getAttribute("href") ?? "";
  if (href.startsWith("#")) return undefined;
  const here = globalThis.location;
  if (!here) return undefined;
  const url = new URL(href, here.href);
  if (url.origin !== here.origin) return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}
