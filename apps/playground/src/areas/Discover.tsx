import {
  AskData,
  ContextBuilder,
  type ContextDraft,
  DataSearch,
  ObjectDetail,
  RelationshipGraph,
  addToContext,
  emptyContextDraft,
  tableRef,
} from "@surfaces-ui/components";
import type { DataObject } from "@surfaces-ui/proto";
import { type PageDocument, analyticsCatalog } from "@surfaces-ui/spec";
import { useMemo, useState } from "react";
import { SaveToLibrary } from "../SaveToLibrary.js";
import { type ActiveSource, engineLabel, openingTable } from "../source.js";

/** Find data, understand it, and assemble what an agent needs to work with it. */
export function Discover({ source }: { source: ActiveSource }) {
  const [open, setOpen] = useState<{ sourceId: string; table: string }>({ sourceId: source.sourceId, table: openingTable(source) });
  const [draft, setDraft] = useState<ContextDraft>(emptyContextDraft);

  const show = (object: DataObject) => {
    if (object.ref) setOpen({ sourceId: object.ref.sourceId, table: object.ref.table });
  };
  const inContext = (object: DataObject) => draft.items.some((i) => i.sourceId === object.ref?.sourceId && i.table === object.ref?.table);
  const add = (object: DataObject) => (
    <button
      type="button"
      className="sf-button"
      disabled={inContext(object)}
      aria-label={inContext(object) ? `In context: ${object.ref?.table}` : `Add to context: ${object.ref?.table}`}
      onClick={() => object.ref && setDraft(addToContext(draft, object.ref.sourceId, object.ref.table))}
    >
      {inContext(object) ? "In context" : "Add to context"}
    </button>
  );

  // What this page shows, as a metadata-explorer surface built from the same catalog components.
  // Opening a table anywhere in it writes /table and the detail and graph read it, so the saved surface
  // navigates on its own, in the library, a chat reply or an MCP frame, with no agent behind it.
  const sourceLabel = source.sources.find((s) => s.id === open.sourceId)?.label ?? open.sourceId;
  const catalogPage = useMemo<PageDocument>(() => {
    const opened = { "@path": "/table" };
    const event = { event: { name: "open_table" } };
    return {
      id: `${open.sourceId}-data-catalog`,
      title: `${sourceLabel} data catalog`,
      description: "Search the catalog, and what is known about one table and the tables around it. Opening a table shows it here.",
      catalogId: analyticsCatalog.id,
      data: { table: open.table },
      components: [
        { id: "root", component: "Column", children: ["search", "panes"] },
        { id: "search", component: "DataSearch", sourceId: open.sourceId, opened, action: event },
        { id: "panes", component: "Grid", columns: 2, children: ["detail", "around"] },
        { id: "detail", component: "ObjectDetail", sourceId: open.sourceId, table: opened, opened, action: event },
        { id: "around", component: "RelationshipGraph", sourceId: open.sourceId, table: opened, opened, action: event },
      ],
    };
  }, [open, sourceLabel]);

  return (
    <>
      <div className="discover-intro">
        <p className="hint">
          The data catalog, built from the Discovery components: search, table detail, ask, connections and agent context. It is a worked example
          of composing them, not a component of its own.
        </p>
        <SaveToLibrary source={source} page={catalogPage} defaultKind="metadata-explorer" defaultTags={[open.sourceId]} label="Save as surface" />
      </div>
      <div className="discover">
        <div>
          <section className="card" aria-label="Ask">
            <div className="card-head">
              <h2>Ask</h2>
            </div>
            <AskData key={source.sourceId} sourceIds={[source.sourceId]} onOpen={show} renderActions={add} />
          </section>
          <section className="card" aria-label="Search">
            <div className="card-head">
              <h2>Find data</h2>
              <span className={source.kind === "memory" ? "badge warn" : "badge"}>{engineLabel(source)}</span>
            </div>
            <DataSearch key={source.sourceId} sourceIds={[source.sourceId]} onOpen={show} renderActions={add} height={560} />
          </section>
        </div>

        <div>
          {open.table ? (
            <>
              <section className="card">
                <ObjectDetail objectRef={tableRef(open.sourceId, open.table)} onOpen={show} renderActions={add} showSampleRows certifier="Demo steward" />
              </section>
              <section className="card">
                <div className="card-head">
                  <h2>Connections</h2>
                </div>
                <RelationshipGraph objectRef={tableRef(open.sourceId, open.table)} onOpen={show} />
              </section>
            </>
          ) : (
            <section className="card">
              <p className="hint">Search or ask to find a table; its description, columns and connections show here.</p>
            </section>
          )}
        </div>

        <div>
          <section className="card" aria-label="Agent context">
            <div className="card-head">
              <h2>Agent context</h2>
            </div>
            <ContextBuilder value={draft} onChange={setDraft} tokenBudget={2000} />
          </section>
        </div>
      </div>
    </>
  );
}
