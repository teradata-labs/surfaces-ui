import type { DataSource } from "@surfaces-ui/data";
import type { SemanticModel } from "@surfaces-ui/proto";
import { useCallback, useMemo, useState } from "react";
import type { OnContext } from "../controls/context.js";
import { label as text } from "../locale/locale.js";
import { ItemControls, standardControls } from "../controls/ItemControls.js";
import { toggleValueFilter } from "../data/controls.js";
import { useDataSource } from "../data/DataSourceProvider.js";
import { QueryFilters } from "../filter/QueryFilters.js";
import { ExploreView, Explorer, exploreReading } from "./Explorer.js";
import { ModelLineage } from "./ModelLineage.js";
import type { Pill } from "./model.js";
import { MAX_TILES, type ReportState, type ReportTile, draftState, editTile, emptyReport, keepDraft, moveTile, normalizeReport, removeTile, setTile, tileState, withDraft } from "./report.js";

export interface ReportBuilderProps {
  /** Where the query runs. Left out, the model's source. */
  sourceId?: string;
  /** The query the report is over: a table, or a join wide enough for every view. Left out, the model's query. */
  sql?: string;
  /** The semantic model the report's fields come from: its metrics mean the same in this report as in every other on it. */
  model?: SemanticModel;
  /** Offers "Add to the model" on a field that is not the model's own. See `Explorer`. */
  onPromote?(pill: Pill, all: Pill[]): Promise<string | void> | string | void;
  /** The report, when the host holds it. With no fields, pills are generated from the query's columns. */
  value?: ReportState;
  defaultValue?: ReportState;
  onChange?(report: ReportState): void;
  /** "build" shows the pills and shelves above the report; "view" shows the report alone, with its filters. A person can switch unless the host sets it. */
  mode?: "build" | "view";
  onModeChange?(mode: "build" | "view"): void;
  /** Shows a box to ask for a field, a view or a whole report in words. The host passes the words to its agent, which answers by setting `value`. */
  onAsk?(text: string, report: ReportState): void;
  /** Name recorded on pills a person makes or edits. Defaults to "you". */
  editor?: string;
  /** Told what a person does to the report as they do it (a view added, changed, moved or removed, a filter set, a bar clicked, a mode switched), for an agent's context. */
  onContext?: OnContext;
  dataSource?: DataSource;
  className?: string;
}

/**
 * Building a report from pills. The pills are the report's own: defined
 * once, used by every view, so a metric means the same thing in each tile.
 * A person (or an agent) puts pills on the shelves to make a view, keeps it
 * as a tile, and makes the next from where they are. Every tile follows one
 * set of filters, and a click on a bar filters the whole report. Switched
 * to "view" it is the dashboard alone. The whole report is plain data.
 */
export function ReportBuilder(props: ReportBuilderProps) {
  const { onChange, onAsk, editor, model } = props;
  const sourceId = props.sourceId ?? model?.sourceId ?? "";
  const sql = props.sql ?? model?.sql ?? "";
  const dataSource = useDataSource(props.dataSource);
  const [own, setOwn] = useState<ReportState>(props.defaultValue ?? emptyReport);
  const report = useMemo(() => normalizeReport(props.value ?? own), [props.value, own]);
  const set = useCallback(
    (next: ReportState) => {
      const clean = normalizeReport(next);
      setOwn(clean);
      onChange?.(clean);
    },
    [onChange],
  );
  const [ownMode, setOwnMode] = useState<"build" | "view">("build");
  const mode = props.mode ?? ownMode;
  const setMode = (next: "build" | "view") => {
    setOwnMode(next);
    props.onModeChange?.(next);
    props.onContext?.({ kind: "mode.changed", summary: next === "view" ? "Switched to viewing the report." : "Switched to building the report.", subject: { mode: next } });
  };
  const [note, setNote] = useState("");
  /** Says what happened to the person, and tells the host the same as context for an agent. */
  const say = (kind: string, summary: string, subject?: Record<string, unknown>) => {
    setNote(summary);
    props.onContext?.({ kind, summary, ...(subject ? { subject } : {}) });
  };
  const shelves = (tile: Pick<ReportTile, "rows" | "split" | "values" | "view">) => ({ rows: tile.rows, split: tile.split ?? null, values: tile.values, view: tile.view ?? "chart" });

  const draft = useMemo(() => draftState(report), [report]);
  const editing = report.tiles.find((t) => t.id === report.editing);
  const full = !editing && report.tiles.length >= MAX_TILES;
  const titleOf = (tile: ReportTile) => tile.title || exploreReading(tileState(report, tile)) || text("report.untitled");

  const keep = () => {
    const next = keepDraft(report);
    if (next === report) return setNote(full ? text("report.maxViews", { max: MAX_TILES }) : text("report.needMeasure"));
    set(next);
    const kept = editing ? next.tiles.find((t) => t.id === editing.id) : next.tiles.at(-1);
    say(editing ? "view.changed" : "view.added", editing ? `${titleOf(editing)} updated: it now shows ${exploreReading(normalizeTile(report))}.` : `Added to the report: ${exploreReading(normalizeTile(report)) || "a view"}. The shelves are as you left them, for the next one.`, kept ? { tile: kept.id, ...shelves(kept) } : undefined);
  };

  const tiles = (
    <div className="sf-report-tiles" data-mode={mode}>
      {report.tiles.map((tile, index) => {
        const state = tileState(report, tile);
        const title = titleOf(tile);
        return (
          <section key={tile.id} className="sf-report-tile sf-controls-host" data-controls="corner" data-span={tile.span ?? 1} data-editing={report.editing === tile.id || undefined} aria-label={title}>
            <header className="sf-report-tile-head">
              {mode === "build" ? (
                <input className="sf-report-tile-title" aria-label={text("report.tileTitle", { title })} value={tile.title ?? ""} placeholder={exploreReading(state)} onChange={(e) => set(setTile(report, tile.id, { title: e.target.value || undefined }))} />
              ) : (
                <h4 className="sf-report-tile-title">{title}</h4>
              )}
              {mode === "build" && (
                <ItemControls
                  label={text("report.tileControls", { title })}
                  controls={standardControls(title, {
                    edit: () => (set(editTile(report, tile.id)), say("view.opened", `${title} is on the shelves. Change it, then press “Update view”.`, { tile: tile.id, ...shelves(tile) })),
                    ...(state.rows.length > 0 ? { view: { now: tile.view ?? "chart", toggle: () => (set(setTile(report, tile.id, { view: (tile.view ?? "chart") === "chart" ? "table" : "chart" })), say("view.changed", `${title} is shown as a ${(tile.view ?? "chart") === "chart" ? "table" : "chart"}.`, { tile: tile.id, view: (tile.view ?? "chart") === "chart" ? "table" : "chart" })) } } : {}),
                    wider: (tile.span ?? 1) < 3 ? () => (set(setTile(report, tile.id, { span: ((tile.span ?? 1) + 1) as 2 | 3 })), say("view.resized", `${title} made wider.`, { tile: tile.id, span: (tile.span ?? 1) + 1 })) : false,
                    narrower: (tile.span ?? 1) > 1 ? () => (set(setTile(report, tile.id, { span: ((tile.span ?? 1) - 1) as 1 | 2 })), say("view.resized", `${title} made narrower.`, { tile: tile.id, span: (tile.span ?? 1) - 1 })) : false,
                    earlier: index > 0 ? () => (set(moveTile(report, tile.id, -1)), say("view.moved", `${title} moved earlier.`, { tile: tile.id, order: moveTile(report, tile.id, -1).tiles.map((t) => t.id) })) : false,
                    later: index < report.tiles.length - 1 ? () => (set(moveTile(report, tile.id, 1)), say("view.moved", `${title} moved later.`, { tile: tile.id, order: moveTile(report, tile.id, 1).tiles.map((t) => t.id) })) : false,
                    remove: () => (set(removeTile(report, tile.id)), say("view.removed", `${title} removed from the report.`, { tile: tile.id, ...shelves(tile) })),
                  })}
                />
              )}
            </header>
            <ExploreView
              dataSource={dataSource}
              sourceId={sourceId}
              sql={sql}
              state={state}
              height={240}
              label={title}
              onPointClick={(column, value) => {
                const filters = toggleValueFilter(report.filters, column, value);
                set({ ...report, filters });
                const on = filters.some((f) => f.column === column && f.op === "eq");
                say("point.selected", on ? `Clicked ${value} in “${title}”: the report is filtered to ${column} is ${value}. Click the bar again to clear it.` : `Clicked ${value} in “${title}” again: the filter on ${column} is cleared.`, { tile: tile.id, column, value, filters });
              }}
            />
          </section>
        );
      })}
    </div>
  );

  return (
    <div className={["sf-report", props.className].filter(Boolean).join(" ")} data-mode={mode}>
      <header className="sf-report-head">
        {mode === "build" ? (
          <input className="sf-report-title" aria-label={text("report.title")} placeholder={text("report.untitledReport")} value={report.title ?? ""} onChange={(e) => set({ ...report, title: e.target.value || undefined })} />
        ) : (
          <h3 className="sf-report-title">{report.title || text("report.untitledReport")}</h3>
        )}
        <div className="sf-segmented" role="group" aria-label={text("report.mode")}>
          {(["build", "view"] as const).map((m) => (
            <button key={m} type="button" className="sf-segment" aria-pressed={mode === m} data-checked={mode === m || undefined} onClick={() => setMode(m)}>
              {m === "build" ? text("report.build") : text("report.view")}
            </button>
          ))}
        </div>
      </header>
      {model?.dataset && <ModelLineage model={model} compact />}

      {mode === "build" && (
        <section className="sf-report-builder" aria-label={text("report.builder")}>
          {editing && (
            <p className="sf-report-editing" role="status">
              {text("report.changing", { title: titleOf(editing) })}{" "}
              <button type="button" className="sf-button" onClick={() => (set({ ...report, editing: undefined }), setNote(text("report.leftAsItWas")))}>
                {text("report.leaveAsItWas")}
              </button>
            </p>
          )}
          <Explorer
            dataSource={dataSource}
            sourceId={sourceId}
            sql={sql}
            model={model}
            onPromote={props.onPromote}
            value={draft}
            onChange={(state) => set(withDraft(report, state))}
            onAsk={onAsk ? (text) => onAsk(text, report) : undefined}
            editor={editor}
            onContext={props.onContext}
            chartHeight={240}
            controls={[
              {
                id: "keep",
                label: editing ? text("report.updateView") : text("report.addToReport"),
                icon: editing ? "confirm" : "add",
                onSelect: keep,
                disabled: full,
                // The one thing a person has to be able to find without pointing at the chart first.
                pinned: true,
              },
            ]}
          />
        </section>
      )}

      <section className="sf-report-body" aria-label={text("report.body")}>
        {mode === "view" && report.fields.length > 0 && <QueryFilters dataSource={dataSource} sourceId={sourceId} sql={sql} filters={report.filters} onChange={(filters) => set({ ...report, filters })} onContext={props.onContext} />}
        {report.tiles.length === 0 ? (
          <p className="sf-explore-empty">
            {mode === "build" ? text("report.emptyBuild") : text("report.emptyView")}
          </p>
        ) : (
          tiles
        )}
      </section>
      <p className="sf-explore-note" role="status">
        {note}
      </p>
    </div>
  );
}

/** The draft as it would be kept, for saying what was added. */
function normalizeTile(report: ReportState) {
  return tileState(report, report.draft ?? { rows: [], values: [] });
}
