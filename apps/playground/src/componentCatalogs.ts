import { type Catalog, SITE_COMPONENT_NAMES, analyticsCatalog, catalogJson, siteCatalog } from "@surfaces-ui/spec";
import { type ComponentRenderer, analyticsRenderers, lazyAnalyticsRenderers, siteRenderers } from "@surfaces-ui/spec/react";

/**
 * The Components area lists two catalogs: the analytics catalog (the basics among it) and the components the site
 * catalog adds. Each component is drawn and checked through its own catalog, as an agent's surface would be.
 */
const SITE = new Set<string>(SITE_COMPONENT_NAMES);

export const isSiteComponent = (name: string) => SITE.has(name);
export const catalogOf = (name: string): Catalog => (SITE.has(name) ? siteCatalog : analyticsCatalog);
export const renderersOf = (name: string, lazy = false): Record<string, ComponentRenderer> => (SITE.has(name) ? siteRenderers : lazy ? lazyAnalyticsRenderers : analyticsRenderers);
export const definitionOf = (name: string) => catalogOf(name).components[name];
/** The JSX elements an example is written with. */
export const markupOf = (name: string) => (SITE.has(name) ? "siteMarkup" : "analyticsMarkup");

export const COMPONENT_NAMES = [...Object.keys(analyticsCatalog.components), ...SITE_COMPONENT_NAMES];
export const COMPONENT_SCHEMA = {
  ...(catalogJson(analyticsCatalog).components as Record<string, unknown>),
  ...Object.fromEntries(SITE_COMPONENT_NAMES.map((name) => [name, (catalogJson(siteCatalog).components as Record<string, unknown>)[name]])),
};
