import { DataSourceProvider, type Labels, SurfacesText, ThemeProvider } from "@surfaces-ui/components";
import "@surfaces-ui/components/styles.css";
import { type DataSource, pageDataSource } from "@surfaces-ui/data";
import { type PageDocument, type SurfaceAction, analyticsCatalog, pageSurface } from "@surfaces-ui/spec";
import { type ComponentRenderer, SurfaceView, analyticsRenderers } from "@surfaces-ui/spec/react";
import { type Mode, type Theme, defaultTheme, presetByName } from "@surfaces-ui/tokens";
import { StrictMode } from "react";
import { type Root, createRoot } from "react-dom/client";

export interface MountOptions {
  /** A preset's name ("Berry") or a whole theme. Defaults to the first preset. */
  theme?: string | Theme;
  /** "light", "dark" or "system" (follows the device). Defaults to "system". */
  mode?: Mode;
  /** The locale for numbers and dates, such as "en-GB". Defaults to "en-US". */
  locale?: string;
  /** Words to use instead of the English defaults, by name (see `defaultLabels` in @surfaces-ui/components). */
  labels?: Partial<Labels>;
  /**
   * Where the data components read from. Defaults to the page's own rows,
   * `page.data.tables`, as source "page" (see `pageDataSource`).
   */
  dataSource?: DataSource;
  /** Called when a person uses a button or another control that sends an event. */
  onAction?(action: SurfaceAction): void;
  /** Called with the page's whole data after a person changes it through an input. */
  onDataChange?(data: unknown): void;
}

export interface MountedPage {
  /** Draws a new version of the page in the same place (new data, new layout). */
  update(page: PageDocument): void;
  /** Removes the page and everything it drew. */
  unmount(): void;
}

function themeFrom(theme: MountOptions["theme"]): Theme {
  if (theme === undefined) return defaultTheme;
  if (typeof theme !== "string") return theme;
  const found = presetByName(theme);
  if (!found) throw new Error(`There is no theme called "${theme}".`);
  return found;
}

/**
 * Draws a page (plain JSON: catalog components and their data) into an
 * element, themed, with its data components reading the page's own rows.
 *
 *   <link rel="stylesheet" href="surfaces-page.css">
 *   <script src="echarts.js"></script>
 *   <script src="surfaces-page.js"></script>
 *   <script>surfaces.mountPage(document.getElementById("app"), page, { theme: "Berry" })</script>
 *
 * Every component is checked against the catalog before it is drawn; anything
 * unknown or malformed is shown as a small notice, never rendered.
 */
export function mountPage(element: Element, page: PageDocument, options: MountOptions = {}): MountedPage {
  const theme = themeFrom(options.theme);
  if (options.locale !== undefined) {
    try {
      Intl.getCanonicalLocales(options.locale.replaceAll("_", "-"));
    } catch {
      throw new Error(`"${options.locale}" is not a locale; use a tag such as "en-US".`);
    }
  }
  const root: Root = createRoot(element);
  const renderers: Record<string, ComponentRenderer> = analyticsRenderers;
  const draw = (current: PageDocument) => {
    const data = options.dataSource ?? pageDataSource(current.data);
    root.render(
      <StrictMode>
        <SurfacesText locale={options.locale} labels={options.labels}>
          <ThemeProvider initialTheme={theme} initialMode={options.mode ?? "system"} store={null} scope="scoped">
            <DataSourceProvider dataSource={data}>
              <SurfaceView
                surface={pageSurface(current)}
                catalog={analyticsCatalog}
                renderers={renderers}
                onAction={options.onAction}
                onDataChange={options.onDataChange}
              />
            </DataSourceProvider>
          </ThemeProvider>
        </SurfacesText>
      </StrictMode>,
    );
  };
  draw(page);
  return { update: draw, unmount: () => root.unmount() };
}

export { pageDataSource, plainRows } from "@surfaces-ui/data";
export { presets } from "@surfaces-ui/tokens";
