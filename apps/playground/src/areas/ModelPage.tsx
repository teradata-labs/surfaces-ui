import { ModelDiagram, ObjectBrowser, QueryResult } from "@surfaces-ui/components";
import { seedById } from "@surfaces-ui/seeds";
import { useMemo, useState } from "react";
import { type ActiveSource, openingTable } from "../source.js";

/** Build a data model by dragging tables from the browser and columns onto each other, then query it. */
export function ModelPage({ source }: { source: ActiveSource }) {
  const { sourceId } = source;
  // A sample model opens on its own model: the tables its starter catalog draws, joined by the keys they declare.
  const tables = useMemo(() => {
    const drawn = seedById(sourceId)
      ?.starters.flatMap((s) => s.page.components)
      .find((c) => c.component === "ModelDiagram");
    return Array.isArray(drawn?.tables) ? (drawn.tables as string[]) : openingTable(source) ? [openingTable(source)] : [];
  }, [sourceId, source]);
  const [query, setQuery] = useState<{ sql: string; ranAt: string } | undefined>();
  return (
    <div className="workbench">
      <aside className="card side" aria-label="Data objects">
        <div className="card-head">
          <h2>Data</h2>
        </div>
        <ObjectBrowser sourceId={sourceId} discovery={source.discovery} height={520} />
        <p className="hint">Drag a table onto the diagram to add it.</p>
      </aside>
      <div className="stage">
        <section className="card">
          <div className="card-head">
            <h2>Data model</h2>
          </div>
          <ModelDiagram
            sourceId={sourceId}
            discovery={source.discovery}
            key={sourceId}
            tables={tables}
            height={460}
            onUseSql={(sql) => setQuery({ sql, ranAt: new Date().toISOString() })}
          />
        </section>
        {query && (
          <section className="card">
            <QueryResult sourceId={sourceId} sql={query.sql} notBefore={query.ranAt} height={360} />
          </section>
        )}
      </div>
    </div>
  );
}
