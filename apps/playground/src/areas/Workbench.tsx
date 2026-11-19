import { ObjectBrowser, QueryResult, SqlEditor, type SqlEditorError, useDataSource, useSqlSchema } from "@surfaces-ui/components";
import type { TableSnapshot } from "@surfaces-ui/proto";
import { type PageDocument, analyticsCatalog } from "@surfaces-ui/spec";
import { SaveToLibrary } from "../SaveToLibrary.js";
import { useEffect, useMemo, useState } from "react";
import { type ActiveSource, engineLabel, startSql } from "../source.js";

/** SQL workbench: browse tables, write SQL, and explore the result as a table or chart. */
export function Workbench({ source }: { source: ActiveSource }) {
  const { sourceId, kind } = source;
  const dataSource = useDataSource();
  const schema = useSqlSchema(sourceId);
  const [draft, setDraft] = useState(() => startSql(source));
  const [sql, setSql] = useState(draft);
  const [error, setError] = useState<SqlEditorError | undefined>();
  const [ranAt, setRanAt] = useState(() => new Date().toISOString());
  const [snapshots, setSnapshots] = useState<TableSnapshot[]>([]);
  const [snapshot, setSnapshot] = useState("");

  // A query over exactly one table can be read as of an earlier snapshot.
  const table = useMemo(() => {
    const name = /^\s*select\s+.+\s+from\s+"?(\w+)"?\s*;?\s*$/is.exec(sql)?.[1]?.toLowerCase();
    return Object.keys(schema).find((t) => t.toLowerCase() === name);
  }, [sql, schema]);

  useEffect(() => {
    setSnapshot("");
    setSnapshots([]);
    if (!table) return;
    let current = true;
    dataSource
      .listSnapshots({ sourceId, ref: { table } })
      .then((response) => current && setSnapshots(response.snapshots))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [dataSource, sourceId, table]);

  const run = (text: string) => {
    setError(undefined);
    setSql(text);
    // Pressing Run always runs the query, even when the SQL has not changed.
    setRanAt(new Date().toISOString());
  };
  const insert = (name: string) => setDraft((current) => (/\s$/.test(current) || current === "" ? current + name : `${current} ${name}`));
  // The query as a data-explorer surface: a page whose root is a QueryResult.
  const explorer = useMemo<PageDocument>(
    () => ({ id: "workbench-query", title: `Query on ${sourceId}`, catalogId: analyticsCatalog.id, components: [{ id: "root", component: "QueryResult", sourceId, sql }] }),
    [sourceId, sql],
  );
  const timeTravel = snapshot && table ? { at: { case: "snapshotId" as const, value: snapshot }, table } : undefined;

  return (
    <div className="workbench">
      <aside className="card side" aria-label="Schema">
        <div className="card-head">
          <h2>Tables</h2>
          <span className={kind === "memory" ? "badge warn" : "badge"}>{engineLabel(source)}</span>
        </div>
        <ObjectBrowser sourceId={sourceId} discovery={source.discovery} height={520} onInsert={insert} onUseSql={(statement) => setDraft(statement)} />
        <p className="hint">
          Open a table to see its columns and the tables it joins with. Double-click or drag a name into the editor; double-click a join
          to insert its JOIN clause. Right-click anything (or press Shift+F10) for SQL and details.
        </p>
      </aside>

      <div className="stage">
        <section className="card">
          <SqlEditor
            value={draft}
            onChange={setDraft}
            onRun={run}
            dialect="duckdb"
            schema={schema}
            error={error}
            minHeight={110}
            placeholder="SELECT …"
          />
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => run(draft)}>
              Run query
            </button>
            <span className="hint">or press ⌘/Ctrl + Enter</span>
            <SaveToLibrary source={source} page={explorer} defaultKind="data-explorer" defaultTags={[sourceId]} label="Save as surface" />
            {snapshots.length > 0 && (
              <label className="inline">
                <span>Read as of</span>
                <select value={snapshot} onChange={(e) => setSnapshot(e.target.value)}>
                  <option value="">Latest</option>
                  {snapshots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.committedAt ? s.committedAt.slice(0, 19).replace("T", " ") : `Version ${s.id}`}
                      {s.id.length < 6 ? ` (v${s.id})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {kind === "memory" && (
            <p className="hint">
              The dev server is not running, so this page is using 5,000 sample rows held in memory, which only understands{" "}
              <code>SELECT * FROM orders</code>. Run <code>pnpm serve</code> and reload for full SQL over Parquet, Delta and
              Iceberg.
            </p>
          )}
        </section>

        <section className="card">
          <QueryResult
            sourceId={sourceId}
            sql={sql}
            timeTravel={timeTravel}
            notBefore={ranAt}
            height={440}
            onError={(message, info) => setError(message ? { message, line: info?.line, column: info?.column } : undefined)}
          />
        </section>
      </div>
    </div>
  );
}
