import { type PageDocument, analyticsCatalog, pageSurface } from "@surfaces-ui/spec";
import { SurfaceView, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

export interface InventoryItem {
  name: string;
  /** What it is for, in a sentence. */
  summary: string;
  /** The catalog example drawn as its picture. */
  page?: PageDocument;
  /** For an app component, which has no catalog example: draws its demo, as its own page does. */
  draw?: () => ReactNode;
  tags: string[];
}

/** A catalog example, drawn through the catalog as an agent's surface would be. */
function CatalogExample({ page }: { page: PageDocument }) {
  const surface = useMemo(() => pageSurface(page), [page]);
  return <SurfaceView surface={surface} catalog={analyticsCatalog} renderers={lazyAnalyticsRenderers} />;
}

/** Draws a component's example only once its card comes near the screen, so 75 live previews do not all query at once. */
function Thumb({ children }: { children: () => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const seen = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "300px" });
    seen.observe(el);
    return () => seen.disconnect();
  }, [near]);
  return (
    <div ref={ref} className="inventory-thumb" aria-hidden="true">
      {near && (
        <div className="inventory-thumb-scale sf-container" inert>
          {children()}
        </div>
      )}
    </div>
  );
}

/**
 * Every component at a glance, grouped as the list beside it is: each card draws the component's own catalog example,
 * small and over the picked data, and opens its page. The filter is the list's, so the two always agree.
 */
export function ComponentInventory({
  groups,
  filter,
  onFilter,
  onOpen,
}: {
  groups: readonly (readonly [string, readonly InventoryItem[]])[];
  filter: string;
  onFilter(text: string): void;
  onOpen(name: string): void;
}) {
  const needle = filter.trim().toLowerCase();
  const matches = (item: InventoryItem) =>
    !needle || item.name.toLowerCase().includes(needle) || item.summary.toLowerCase().includes(needle) || item.tags.some((t) => t.includes(needle));
  const shown = groups.map(([label, items]) => [label, items.filter(matches)] as const).filter(([, items]) => items.length > 0);
  const total = groups.reduce((n, [, items]) => n + items.length, 0);
  const count = shown.reduce((n, [, items]) => n + items.length, 0);
  const open = (event: MouseEvent, name: string) => {
    // A plain click opens the page here; a modified click opens it in a new tab as any link does.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onOpen(name);
  };

  return (
    <div className="catalog-main inventory">
      <section className="card catalog-head">
        <h2 className="catalog-name">All components</h2>
        <p className="hint">
          {total} components, each drawn from its own example over the picked data. Open one for its preview, props, code and events.
        </p>
        <input
          className="catalog-filter inventory-filter"
          type="search"
          placeholder="Filter by name or what it does"
          aria-label="Filter all components"
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
        />
        <p className="hint" role="status">
          {needle ? `${count} of ${total} match "${filter.trim()}".` : ""}
        </p>
      </section>

      {shown.length === 0 && <p className="hint">Nothing matches. Try a shorter word.</p>}
      {shown.map(([label, items]) => (
        <section key={label} className="inventory-group" aria-label={label}>
          <h2 className="inventory-group-title">
            {label} <span className="hint">{items.length}</span>
          </h2>
          <ul className="inventory-grid">
            {items.map((item) => (
              <li key={item.name}>
                <a className="inventory-card" href={`?component=${encodeURIComponent(item.name)}#catalog`} onClick={(e) => open(e, item.name)}>
                  {item.page ? (
                    <Thumb>{() => <CatalogExample page={item.page!} />}</Thumb>
                  ) : item.draw ? (
                    <Thumb>{item.draw}</Thumb>
                  ) : (
                    <div className="inventory-thumb inventory-thumb-app" aria-hidden="true">
                      <span>{item.name}</span>
                    </div>
                  )}
                  <span className="inventory-name">
                    {item.name}
                    {item.tags.map((tag) => (
                      <span key={tag} className="catalog-tag">
                        {tag}
                      </span>
                    ))}
                  </span>
                  <span className="inventory-summary">{item.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
