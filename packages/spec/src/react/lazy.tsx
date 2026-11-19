import { type ComponentType, Suspense, lazy } from "react";
import { analyticsCatalog } from "../analytics.js";
import type { ComponentRenderer, RenderProps } from "./Surface.js";

let renderers: Promise<Record<string, ComponentRenderer>> | undefined;
/** The full renderers, loaded once, the first time any agent component is drawn. */
const load = () => {
  renderers ??= import("./renderers.js").then((m) => m.analyticsRenderers);
  return renderers;
};

/** Starts loading the renderers now, for example when a chat page opens, so the first drawn component does not wait. */
export function preloadRenderers(): Promise<unknown> {
  return load();
}

function lazyRenderer(name: string): ComponentRenderer {
  const Loaded = lazy(async (): Promise<{ default: ComponentType<RenderProps> }> => {
    const all = await load();
    const render = all[name];
    return { default: (args: RenderProps) => (render ? render(args) : null) };
  });
  return (args) => (
    <Suspense fallback={<span className="sf-a2-loading">Loading…</span>}>
      <Loaded {...args} />
    </Suspense>
  );
}

/**
 * The same renderers as `analyticsRenderers`, loaded on first use. The
 * charts, editor and grids (ECharts and CodeMirror among them) then stay out
 * of a page's first load: a chat shows its thread at once and fetches the
 * renderers when an agent first draws something. Use it wherever surfaces
 * are drawn; the result is the same.
 */
export const lazyAnalyticsRenderers: Record<string, ComponentRenderer> = Object.fromEntries(
  Object.keys(analyticsCatalog.components).map((name) => [name, lazyRenderer(name)]),
);
