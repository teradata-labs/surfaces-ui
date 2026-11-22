import {
  Chart,
  type ChartGrain,
  type ChartMeasure,
  type ChartType,
  DataGrid,
  type LegendPlacement,
  type PivotDimension,
  type PivotMeasure,
  PivotTable,
  QueryResult,
} from "@surfaces-ui/components";
import { type FilterInit, type FilterSpec, type GridColumns, type GridSort, type ResultView, type SortSpec, chosenValues, filtersExcept, filtersFromSpec, filtersToSpec, sortsFromSpec, sortsToSpec, toggleValueFilter } from "@surfaces-ui/components";
import { type CSSProperties, type ReactNode, createElement, useEffect, useId, useState } from "react";
import { basicsCatalog } from "../basics.js";
import { type ComponentRenderer, type RenderProps, useRequiredInputs } from "./Surface.js";
import { formRenderers } from "./forms.js";
import { moreRenderers } from "./more.js";

const text = (value: unknown): string => (value == null ? "" : typeof value === "object" ? "" : String(value));

/**
 * Draws a data component with the filters an agent gave it. Filters that do
 * not make sense are reported in place of the component: showing unfiltered
 * data under a filter that was asked for would mislead.
 */
export function withFilters(value: unknown, draw: (filters: FilterInit[] | undefined) => ReactNode): ReactNode {
  if (!Array.isArray(value)) return draw(undefined);
  try {
    return draw(filtersFromSpec(value as FilterSpec[]));
  } catch (error) {
    return (
      <p className="sf-surface-notice" role="note">
        {error instanceof Error ? error.message : "The filters could not be read."}
      </p>
    );
  }
}

/** State that starts from, and is reset by, a value set from outside, and that a person can then change. */
function useSettable<T>(given: T | undefined, fallback: T): [T, (next: T) => void] {
  const [state, setState] = useState<T>(given ?? fallback);
  const key = JSON.stringify(given ?? null);
  useEffect(() => {
    if (given !== undefined) setState(given);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [state, setState];
}

function DataGridView({ props, filters, reportControls }: { props: Record<string, unknown>; filters: FilterInit[] | undefined; reportControls: RenderProps["reportControls"] }) {
  const [sorts, setSortsState] = useSettable<GridSort[]>(Array.isArray(props.sorts) ? sortsFromSpec(props.sorts as SortSpec[]) : undefined, []);
  const [columns, setColumnsState] = useSettable<GridColumns>(props.columns as GridColumns | undefined, {});
  // A person's changes are reported in catalog form, so the host and the agent see them.
  const setSorts = (next: GridSort[]) => {
    setSortsState(next);
    reportControls({ sorts: sortsToSpec(next), columns });
  };
  const setColumns = (next: GridColumns) => {
    setColumnsState(next);
    reportControls({ sorts: sortsToSpec(sorts), columns: next });
  };
  return (
    <DataGrid
      sourceId={text(props.sourceId)}
      sql={text(props.sql)}
      mode={props.mode === "pages" ? "pages" : "scroll"}
      height={typeof props.height === "number" ? props.height : 360}
      label={text(props.label) || undefined}
      filters={filters}
      sorts={sorts}
      onSortsChange={setSorts}
      columns={columns}
      onColumnsChange={setColumns}
      emptyMessage={text(props.emptyMessage) || undefined}
      errorMessage={text(props.errorMessage) || undefined}
    />
  );
}

const JUSTIFY: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  spaceBetween: "space-between",
  spaceAround: "space-around",
  spaceEvenly: "space-evenly",
  stretch: "stretch",
};
const ALIGN: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };
const VARIANT_TAG: Record<string, string> = { h1: "h2", h2: "h3", h3: "h4", h4: "h5", h5: "h6", body: "p", caption: "p" };

function flex(props: Record<string, unknown>): CSSProperties {
  return { justifyContent: JUSTIFY[text(props.justify)] ?? "flex-start", alignItems: ALIGN[text(props.align)] ?? "stretch" };
}

/**
 * A Button. With `requires` it waits for the inputs named: while one is missing or wrong it is marked unavailable but
 * can still be reached and pressed, and a press then sends nothing, has each input say what is wrong and moves to
 * the first, so a person is never left guessing why nothing happened.
 */
function ButtonView({ props, component, child, dispatch }: RenderProps) {
  const required = useRequiredInputs(props.requires);
  const [told, setTold] = useState(false);
  const waiting = required.waiting.length > 0;
  return (
    <>
      <button
        type="button"
        className="sf-button sf-a2-button"
        data-variant={text(props.variant) || "default"}
        aria-disabled={waiting || undefined}
        onClick={() => {
          if (waiting) {
            setTold(true);
            required.show();
            return;
          }
          dispatch(component.action);
        }}
      >
        {child(component.child)}
      </button>
      {waiting && told && (
        <span className="sf-visually-hidden" role="status">
          {required.waiting.length === 1 ? `Nothing was sent. ${required.waiting[0]!.problem}` : `Nothing was sent. ${required.waiting.length} fields need attention: ${required.waiting.map((field) => field.label).join(", ")}.`}
        </span>
      )}
    </>
  );
}

function TabsView({ props, child }: RenderProps) {
  const tabs = (props.tabs as { title: unknown; child: unknown }[]) ?? [];
  const [active, setActive] = useState(0);
  const id = useId();
  const current = Math.min(active, tabs.length - 1);
  return (
    <div className="sf-a2-tabs">
      <div className="sf-segmented sf-a2-tablist" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={index === current}
            aria-controls={`${id}-panel`}
            className="sf-segment"
            data-checked={index === current || undefined}
            onClick={() => setActive(index)}
          >
            {text(tab.title)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${current}`}>
        {child(tabs[current]?.child)}
      </div>
    </div>
  );
}

/** React implementations of the analytics catalog. Data components need a DataSourceProvider above the surface. */
export const analyticsRenderers: Record<string, ComponentRenderer> = {
  Text: ({ props }) => {
    const variant = text(props.variant) || "body";
    return createElement(VARIANT_TAG[variant] ?? "p", { className: "sf-a2-text", "data-variant": variant }, text(props.text));
  },
  Row: ({ props, component, children }) => {
    const drawn = children(component.children);
    // A share per child, when there is exactly one for each; anything else leaves them equal.
    const widths = Array.isArray(props.widths) && props.widths.length === drawn.length && props.widths.every((w) => typeof w === "number" && w > 0) ? (props.widths as number[]) : undefined;
    return (
      <div className="sf-a2-row" data-arrange-container style={flex(props)} data-widths={widths ? true : undefined}>
        {widths
          ? drawn.map((node, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a row's cells are its children in order.
              <div key={i} className="sf-a2-row-cell" style={{ flex: `${widths[i]} 1 0` }}>
                {node}
              </div>
            ))
          : drawn}
      </div>
    );
  },
  Column: ({ props, component, children }) => (
    <div className="sf-a2-column" style={flex(props)}>
      {children(component.children)}
    </div>
  ),
  Card: ({ component, child }) => <div className="sf-a2-card">{child(component.child)}</div>,
  Divider: ({ props }) => <hr className="sf-a2-divider" data-axis={text(props.axis) || "horizontal"} />,
  Tabs: (renderProps) => <TabsView {...renderProps} />,
  Button: (renderProps) => <ButtonView {...renderProps} />,
  Stat: ({ props }) => (
    <div className="sf-a2-stat">
      <span className="sf-a2-stat-label">{text(props.label)}</span>
      <span className="sf-a2-stat-value">{text(props.value)}</span>
      {props.delta != null && (
        <span className="sf-a2-stat-delta" data-tone={text(props.tone) || "neutral"}>
          {text(props.delta)}
        </span>
      )}
    </div>
  ),
  KeyValue: ({ props }) => (
    <dl className="sf-a2-keyvalue">
      {((props.items as { label: unknown; value: unknown }[]) ?? []).map((item, index) => (
        <div key={index}>
          <dt>{text(item.label)}</dt>
          <dd>{text(item.value)}</dd>
        </div>
      ))}
    </dl>
  ),
  Badge: ({ props }) => (
    <span className="sf-a2-badge" data-tone={text(props.tone) || "neutral"}>
      {text(props.text)}
    </span>
  ),
  Progress: ({ props }) => {
    const max = Number(props.max ?? 100) || 100;
    const value = Math.max(0, Math.min(max, Number(props.value) || 0));
    return (
      <div className="sf-a2-progress">
        {props.label != null && <span>{text(props.label)}</span>}
        <progress value={value} max={max} aria-label={text(props.label) || "Progress"} />
        <span className="sf-a2-progress-value">{Math.round((value / max) * 100)}%</span>
      </div>
    );
  },
  DataGrid: ({ props, reportControls }) => withFilters(props.filters, (filters) => <DataGridView props={props} filters={filters} reportControls={reportControls} />),
  Chart: ({ props, component, setData, dispatch, reportContext }) => {
    const x = text(props.x);
    // A chart that filters the page: a click writes to the shared list, and the chart leaves out filters on its own column so the clicked bars stay.
    const selects = component.select != null && !props.xGrain && !props.xBins && x !== "";
    const shared = Array.isArray(props.select) ? (props.select as FilterSpec[]) : [];
    const own = selects && Array.isArray(props.filters) ? filtersExcept(props.filters as FilterSpec[], x) : props.filters;
    const clicked =
      selects || component.action != null
        ? (point: { x: string | number | null; series: string }) => {
            if (point.x == null) return;
            if (selects) {
              const next = toggleValueFilter(shared, x, point.x);
              setData(component.select, next);
              const chosen = chosenValues(next, x);
              const on = chosen.some((v) => String(v) === String(point.x));
              reportContext({
                kind: "point.selected",
                summary: on
                  ? `Clicked ${point.x} in the chart: the page is filtered to ${x} ${chosen.length === 1 ? "is" : "is one of"} ${chosen.join(", ")}.`
                  : `Clicked ${point.x} in the chart again: ${point.x} is taken out of the filter on ${x}${chosen.length === 0 ? ", which is now cleared" : ""}.`,
                subject: { column: x, value: point.x, series: point.series, filters: next },
              });
            }
            if (component.action != null) dispatch(component.action, { column: x, value: String(point.x), series: point.series });
          }
        : undefined;
    return withFilters(own, (filters) => (
      <Chart
        filters={filters}
        sourceId={text(props.sourceId)}
        sql={text(props.sql)}
        type={text(props.type) as ChartType}
        x={x}
        y={(props.y as ChartMeasure[]) ?? []}
        xGrain={(text(props.xGrain) || undefined) as ChartGrain | undefined}
        xBins={typeof props.xBins === "number" ? props.xBins : undefined}
        splitBy={text(props.splitBy) || undefined}
        stacked={props.stacked === true}
        sort={props.sort === "x" || props.sort === "value" ? props.sort : undefined}
        legend={(text(props.legend) || undefined) as LegendPlacement | undefined}
        xTitle={text(props.xTitle) || undefined}
        yTitle={text(props.yTitle) || undefined}
        yRightTitle={text(props.yRightTitle) || undefined}
        yFormat={props.yFormat === "number" || props.yFormat === "compact" || props.yFormat === "currency" || props.yFormat === "percent" ? props.yFormat : undefined}
        height={typeof props.height === "number" ? props.height : 300}
        label={text(props.label) || undefined}
        onPointClick={clicked}
        emptyMessage={text(props.emptyMessage) || undefined}
        errorMessage={text(props.errorMessage) || undefined}
      />
    ));
  },
  PivotTable: ({ props }) => withFilters(props.filters, (filters) => (
    <PivotTable
      filters={filters}
      sourceId={text(props.sourceId)}
      sql={text(props.sql)}
      rows={(props.rows as PivotDimension[]) ?? []}
      columns={(props.columns as PivotDimension[]) ?? []}
      measures={(props.measures as PivotMeasure[]) ?? []}
      totals={props.totals !== false}
      height={typeof props.height === "number" ? props.height : 360}
      label={text(props.label) || undefined}
      emptyMessage={text(props.emptyMessage) || undefined}
      errorMessage={text(props.errorMessage) || undefined}
    />
  )),
  QueryResult: ({ props, reportControls }) =>
    withFilters(props.filters, (filters) => (
      <QueryResult
        sourceId={text(props.sourceId)}
        sql={text(props.sql)}
        height={typeof props.height === "number" ? props.height : 400}
        view={(text(props.view) || undefined) as ResultView | undefined}
        filters={filters}
        sorts={Array.isArray(props.sorts) ? sortsFromSpec(props.sorts as SortSpec[]) : undefined}
        columns={props.columns as GridColumns | undefined}
        onControlsChange={(c) => reportControls({ view: c.view, filters: filtersToSpec(c.filters), sorts: sortsToSpec(c.sorts), columns: c.columns })}
        emptyMessage={text(props.emptyMessage) || undefined}
        errorMessage={text(props.errorMessage) || undefined}
      />
    )),
  ...moreRenderers,
  ...formRenderers,
};

/** The renderers of the basic components (`basicsCatalog`): the same functions `analyticsRenderers` draws them with. */
export const basicsRenderers: Record<string, ComponentRenderer> = Object.fromEntries(basicsCatalog.names.map((name) => [name, analyticsRenderers[name]!]));
