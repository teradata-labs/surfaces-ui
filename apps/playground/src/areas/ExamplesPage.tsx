import { PageStudio } from "@surfaces-ui/chat";
import { Chart, DataGrid, Metric, Sparkline } from "@surfaces-ui/components";
import type { PageDocument } from "@surfaces-ui/spec";
import { createViewState, decodeState, encodeState, parseViewState, persist, browserStorage, syncUrl } from "@surfaces-ui/state";
import { useHistory, useStore } from "@surfaces-ui/state/react";
import { useEffect, useMemo, useState } from "react";
import { SaveToLibrary } from "../SaveToLibrary.js";
import { useAgentChoice } from "../agentChoice.js";
import { useProviderMenu } from "../providers.js";
import { agentFor } from "../composerAgent.js";
import { demoPageStarters } from "../demoPageAgent.js";
import { pagesFor } from "../examples.js";
import { type DataFocus, focusFor } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";

type ChartSpec = DataFocus["charts"][number];

/**
 * A dashboard written by hand in React, to show the state services: one
 * shared view state filters every tile, clicking a chart filters the others,
 * the filters are in the address bar and saved, and each click can be undone.
 *
 * Cross-filtering only makes sense between views of one query: a column of
 * one query means nothing to another. So every view reads the dataset's one
 * wide query (`focus.cross`).
 */
function CrossFilterDashboard({ focus }: { focus: DataFocus }) {
  const { sourceId } = focus;
  // Every view reads one query, so a column clicked in one means the same in all.
  const sql = focus.cross.sql;
  const view = useMemo(() => createViewState(), []);
  const state = useStore(view);
  const history = useHistory(view);
  useEffect(() => {
    const saved = persist(view, { key: `surfaces-docs-crossfilter:${sourceId}`, storage: browserStorage(), parse: parseViewState });
    // The address bar wins over saved state, so a shared link opens as sent.
    // The parameter names the dataset, so filters on one dataset's columns never reach another's.
    const stopUrl = syncUrl(view, {
      param: `filters-${sourceId}`,
      encode: (value) => (Object.keys(value.selections).length === 0 ? "" : encodeState(value.selections)),
      decode: (text) => {
        try {
          return parseViewState({ selections: decodeState(text) });
        } catch {
          return undefined;
        }
      },
    });
    return () => {
      saved.stop();
      stopUrl();
    };
  }, [view, sourceId]);

  const { measure, rows, dimensions, time } = focus.cross;
  const tiles: DataFocus["metrics"] = [
    { label: measure.label, sql, column: measure.column, aggregate: "sum", format: measure.format },
    { label: rows, sql, aggregate: "count", format: "compact" },
  ];
  const chosen = Object.entries(state.selections);
  return (
    <div className="examples-dashboard">
      <div className="examples-filters" aria-live="polite">
        {chosen.length === 0 ? (
          <span className="hint">Click a bar to filter everything else.</span>
        ) : (
          chosen.flatMap(([column, values]) =>
            values.map((value) => (
              <button key={`${column}:${value}`} type="button" className="sf-button" aria-label={`Remove filter ${column} is ${value}`} onClick={() => view.toggle(column, value)}>
                {column}: {String(value)} ×
              </button>
            )),
          )
        )}
        <button type="button" className="sf-button" disabled={!history.canUndo()} onClick={history.undo}>
          Undo
        </button>
        <button type="button" className="sf-button" disabled={!history.canRedo()} onClick={history.redo}>
          Redo
        </button>
        <button type="button" className="sf-button" disabled={chosen.length === 0} onClick={() => view.clear()}>
          Clear filters
        </button>
      </div>
      <div className="sf-a2-grid" style={{ ["--sf-grid-columns" as string]: Math.min(4, tiles.length + 1) }}>
        {tiles.map((m) => (
          <Metric
            key={m.label}
            sourceId={sourceId}
            sql={sql}
            column={m.aggregate === "count" ? undefined : m.column}
            aggregate={m.aggregate}
            label={m.label}
            format={m.format}
            filters={view.filters()}
          />
        ))}
        {/* A headline number is read against something: its own trend. Over the same query it is filtered the same way; over another query it cannot be, and says so. */}
        <Sparkline
          sourceId={sourceId}
          sql={sql}
          x={time}
          grain="month"
          column={measure.column}
          aggregate="sum"
          label={`${measure.label} by month`}
          format={measure.format}
          filters={view.filters()}
        />
      </div>
      <div className="sf-a2-grid">
        {/* Each chart leaves out its own column, so its bars stay there to be clicked. */}
        {dimensions.map((x) => (
          <Chart
            key={x}
            sourceId={sourceId}
            sql={sql}
            type="bar"
            x={x}
            y={[{ column: measure.column, aggregate: "sum", label: measure.label }]}
            yTitle={measure.label}
            filters={view.filters(x)}
            onPointClick={(point) => point.x !== null && view.toggle(x, point.x)}
            height={260}
            label={`${measure.label} by ${x.replaceAll("_", " ")}. Click a bar to filter.`}
          />
        ))}
      </div>
      <DataGrid sourceId={sourceId} sql={sql} filters={view.filters()} sorts={state.sorts} onSortsChange={(sorts) => view.setSorts(sorts)} height={280} />
    </div>
  );
}

/** Example pages and dashboards over the picked dataset: documents an agent can change from plain language, and one built by hand. */
export function ExamplesPage({ source }: { source: ActiveSource }) {
  const focus = useMemo(() => focusFor(source.sourceId, firstTable(source)), [source]);
  const pages = useMemo(() => pagesFor(focus), [focus]);
  const choice = useAgentChoice(source.kind === "server");
  const { picked } = choice;
  const agent = useMemo(() => agentFor(picked, source.dataSource, focus, undefined, source.semantics, choice.model), [picked, source.dataSource, focus, source.semantics, choice.model]);
  const menu = useProviderMenu(choice);
  const [active, setActive] = useState(pages[0]!.id);
  const page = pages.find((p) => p.id === active);
  const [current, setCurrent] = useState<PageDocument | undefined>(page);
  const tabs = [...pages.map((p) => ({ id: p.id, label: p.title })), { id: "cross-filter", label: "Cross-filter (hand-built)" }];
  const pick = (id: string) => {
    setActive(id);
    setCurrent(pages.find((p) => p.id === id));
  };
  return (
    <section className="card examples">
      <div className="card-head">
        <h2>Pages and dashboards: {focus.title}</h2>
      </div>
      <div className="sf-segmented sf-result-views" data-thumb="off" role="group" aria-label="Example">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" aria-pressed={active === tab.id} className="sf-segment" data-checked={active === tab.id || undefined} onClick={() => pick(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      {page ? (
        <>
          <PageStudio key={page.id} agent={agent} page={page} starters={demoPageStarters(focus)} onChange={setCurrent} arrange {...menu} />
          {current && <SaveToLibrary source={source} page={current} defaultTags={[source.sourceId]} />}
          <p className="hint">
            Each page is a JSON document of catalog components, built from the picked dataset; for a sample industry model, the first pages are the model's own starters. The box on the right sends your words and the page to an agent, and its reply is
            applied as edits that the catalog checks first. {picked.kind === "scripted" ? "Here the agent is a fixed script that matches a few phrasings, not a model; pick a model in the box's Model menu." : picked.detail}
          </p>
        </>
      ) : (
        <>
          <CrossFilterDashboard key={focus.sourceId} focus={focus} />
          <p className="hint">
            Written as ordinary React with the state services: one shared view state, kept in the address bar and in storage, with undo. Filtering
            still happens in the database.
          </p>
        </>
      )}
    </section>
  );
}
