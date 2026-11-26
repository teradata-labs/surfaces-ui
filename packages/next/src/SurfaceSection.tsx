import type { PageDocument } from "@surfaces-ui/spec";
import type { ThemeRequest } from "@surfaces-ui/tokens";
import { assertPage } from "./check.js";
import { SiteSurface } from "./client.js";
import { type ImageResolver, prepareDocument } from "./prepare.js";

export interface SurfaceSectionProps {
  /** The components to draw, as a page document: written by hand, by an agent, or kept in a store. */
  page: PageDocument;
  /** Data for the page's bindings, worked out on the server and merged over its own. Plain JSON. */
  data?: Record<string, unknown>;
  /** A theme the page's own is laid over. Without either, the section is drawn in the default theme, or in the app's
   * own `ThemeProvider` when one is above it. */
  theme?: ThemeRequest;
  /** Turns an image name the page uses into an address on the site. */
  resolveImage?: ImageResolver;
  /** Origins an image may also come from as written. */
  imageOrigins?: string[];
}

/**
 * Surfaces components as one part of a Next.js page the app writes itself, as a server component: the app's own
 * markup around it, any number on one page. It is rendered to HTML on the server and themed only in its own region,
 * so the rest of the page keeps the app's look. A page the catalog refuses stops the build with what is wrong.
 */
export function SurfaceSection({ page, data, theme, resolveImage, imageOrigins }: SurfaceSectionProps) {
  const prepared = prepareDocument(page, { data, theme, resolveImage });
  assertPage(prepared.page, `"${page.id}"`);
  return <SiteSurface page={prepared.page} images={prepared.images} imageOrigins={imageOrigins} />;
}
