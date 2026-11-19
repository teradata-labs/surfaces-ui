import { Children, type ReactElement, type ReactNode, isValidElement, useId, useMemo } from "react";
import { analyticsCatalog } from "../analytics.js";
import type { Catalog } from "../catalog.js";
import { pageSurface } from "../page.js";
import type { SurfaceAction, SurfaceComponent } from "../surface.js";
import { type ComponentRenderer, type SurfaceNote, type SurfaceProblem, SurfaceView } from "./Surface.js";
import { lazyAnalyticsRenderers } from "./lazy.js";

/**
 * Catalog components written as JSX: `<Ui.Row><Ui.Metric … /><Ui.Chart … /></Ui.Row>`. Each element takes exactly
 * the props the catalog gives that component (the same props an agent sends in A2UI), and the components it holds
 * as JSX children. The outermost element gathers everything inside it into one surface and draws it through
 * `SurfaceView`, so it is checked against the catalog like any agent's surface: an unknown prop or a malformed value
 * shows a notice in place of the component. `toMarkup` in `@surfaces-ui/spec` writes the same JSX from A2UI.
 */

/** What the outermost element takes besides the component's own props. */
export interface MarkupRootProps {
  /** Values the components bind to with `{ path }`. */
  data?: unknown;
  onAction?(action: SurfaceAction): void;
  onProblem?(problem: SurfaceProblem): void;
  onContext?(componentId: string, note: SurfaceNote): void;
  onDataChange?(data: unknown): void;
  className?: string;
}

const ROOT_ONLY = ["data", "onAction", "onProblem", "onContext", "onDataChange", "className"] as const;

type MarkupElementType = ((props: Record<string, unknown>) => ReactNode) & { catalogName: string };

/** One element of the markup: a catalog component's props, and on the outermost element the surface's own. */
export type MarkupComponent = (props: Record<string, unknown> & MarkupRootProps & { children?: ReactNode }) => ReactNode;

/** A catalog as JSX elements, one per component, named as the catalog names them (`Ui.Metric`). */
export type Markup<Name extends string = string> = Record<Name, MarkupComponent>;

const nameOf = (element: ReactElement): string | undefined => (element.type as Partial<MarkupElementType>)?.catalogName;

/**
 * The components a markup tree stands for, in the order `toMarkup` writes them: the outermost element is `root`
 * (unless it says otherwise), and any other element without an `id` is named after its kind, numbered when
 * repeated. Anything inside that is not a markup element (text, a plain React element) is left out and reported.
 */
export function markupComponents(element: ReactElement, catalog: Catalog = analyticsCatalog): { components: SurfaceComponent[]; ignored: string[] } {
  const components: SurfaceComponent[] = [];
  const ignored: string[] = [];
  const seen = new Map<string, number>();
  const madeUp = (kind: string) => {
    const n = (seen.get(kind) ?? 0) + 1;
    seen.set(kind, n);
    return n === 1 ? kind.toLowerCase() : `${kind.toLowerCase()}-${n}`;
  };
  const walk = (node: ReactElement, isRoot: boolean): string => {
    const kind = nameOf(node)!;
    const { children, ...given } = node.props as Record<string, unknown> & { children?: ReactNode };
    const own = Object.fromEntries(Object.entries(given).filter(([k, v]) => v !== undefined && !(isRoot && (ROOT_ONLY as readonly string[]).includes(k))));
    const id = typeof own.id === "string" ? own.id : isRoot ? "root" : madeUp(kind);
    const component: SurfaceComponent = { ...own, id, component: kind };
    components.push(component);
    const kids: string[] = [];
    for (const child of Children.toArray(children)) {
      if (isValidElement(child) && nameOf(child)) kids.push(walk(child, false));
      else if (typeof child === "string" ? child.trim() : child != null) ignored.push(typeof child === "string" ? `the text "${child.trim()}"` : "an element that is not from the catalog");
    }
    const accepts = Object.keys(catalog.components[kind]?.props ?? {});
    if (accepts.includes("children")) component.children = kids;
    else if (accepts.includes("child") && kids[0]) {
      component.child = kids[0];
      if (kids.length > 1) ignored.push(`${kids.length - 1} more inside ${kind}, which holds one`);
    } else if (kids.length) ignored.push(`what is inside ${kind}, which holds nothing`);
    return id;
  };
  walk(element, true);
  return { components, ignored };
}

/** Builds the markup elements for a catalog and its renderers. */
export function createMarkup<Name extends string = string>(catalog: Catalog & { names?: readonly Name[] }, renderers: Record<string, ComponentRenderer>): Markup<Name> {
  const markup: Record<string, MarkupComponent> = {};
  for (const name of Object.keys(catalog.components)) {
    const Element = ((props: Record<string, unknown> & MarkupRootProps) => {
      // Only the outermost element draws: its tree is compiled into one surface. Elements inside it are read, not rendered.
      const id = useId();
      const self = { type: Element, props } as unknown as ReactElement;
      const { components, ignored } = markupComponents(self, catalog);
      const key = JSON.stringify([components, props.data ?? null]);
      // biome-ignore lint/correctness/useExhaustiveDependencies: key stands for the components and data.
      const surface = useMemo(() => pageSurface({ id: `markup${id}`, title: name, catalogId: catalog.id, components, data: props.data }), [key]);
      return (
        <>
          <SurfaceView
            surface={surface}
            catalog={catalog}
            renderers={renderers}
            onAction={props.onAction}
            onProblem={props.onProblem}
            onContext={props.onContext}
            onDataChange={props.onDataChange}
            className={props.className}
          />
          {ignored.length > 0 && (
            <p className="sf-surface-notice" role="note">
              Left out: {ignored.join("; ")}. Only catalog components can go inside one another.
            </p>
          )}
        </>
      );
    }) as MarkupElementType;
    Element.catalogName = name;
    (Element as unknown as { displayName: string }).displayName = `Ui.${name}`;
    markup[name] = Element as MarkupComponent;
  }
  return markup as Markup<Name>;
}

/**
 * The analytics catalog as JSX: `import { analyticsMarkup as Ui } from "@surfaces-ui/spec/react"`. It draws with the
 * renderers loaded on first use (`lazyAnalyticsRenderers`), so a page that uses a few elements does not load every
 * chart, editor and grid up front. For app code that needs no catalog checks, import the components themselves from
 * `@surfaces-ui/components`; for the renderers loaded at once, `createMarkup(analyticsCatalog, analyticsRenderers)`.
 */
export const analyticsMarkup = createMarkup(analyticsCatalog, lazyAnalyticsRenderers);
