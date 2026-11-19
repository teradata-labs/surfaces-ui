import { analyticsCatalog, pageSurface } from "@surfaces-ui/spec";
import { SurfaceView, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { useMemo } from "react";
import { examplePages } from "../examples.js";
import { focusFor } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";

/**
 * One example page drawn alone, the way an app built on the library would show it: no playground around it, just the
 * page over the picked data. `#view?page=2` picks another of the example pages. Used to show the same page on
 * several screens at once.
 */
export function PageView({ source }: { source: ActiveSource }) {
  const focus = useMemo(() => focusFor(source.sourceId, firstTable(source)), [source]);
  const pages = useMemo(() => examplePages(focus), [focus]);
  const index = Number(new URLSearchParams(location.hash.split("?")[1] ?? "").get("page") ?? 0);
  const page = pages[Number.isInteger(index) && index >= 0 && index < pages.length ? index : 0]!;
  const surface = useMemo(() => pageSurface(page), [page]);
  return (
    <article className="page-view sf-container" aria-label={page.title}>
      <h1 className="page-view-title">{page.title}</h1>
      <SurfaceView surface={surface} catalog={analyticsCatalog} renderers={lazyAnalyticsRenderers} />
    </article>
  );
}
