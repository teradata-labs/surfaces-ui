import type { DataSource } from "@surfaces-ui/data";
import { type TableDetail, TableFormat, TableKind, type TableSummary } from "@surfaces-ui/proto";
import { useEffect, useState } from "react";
import { useDataSource } from "../data/DataSourceProvider.js";
import { messageOf } from "../data/useRowWindow.js";
import { numberFormat } from "../locale/locale.js";

export interface ObjectInfoProps {
  sourceId: string;
  /** What to describe. With `table` it is a table; without, a schema or a catalog (database). */
  catalog?: string;
  schema?: string;
  table?: string;
  onClose?(): void;
  dataSource?: DataSource;
  className?: string;
}

const count = { format: (n: number | bigint) => numberFormat().format(n) };
const KIND: Record<number, string> = { [TableKind.TABLE]: "Table", [TableKind.VIEW]: "View", [TableKind.MATERIALIZED_VIEW]: "Materialised view", [TableKind.EXTERNAL]: "External table" };

function bytes(n: bigint | number): string {
  const units = ["bytes", "KB", "MB", "GB", "TB", "PB"];
  let value = Number(n);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

/** The name as it is written in SQL, qualified by what is known. */
export function qualifiedName(parts: { catalog?: string; schema?: string; table?: string; column?: string }): string {
  const quote = (name: string) => (/^[A-Za-z_]\w*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`);
  return [parts.catalog, parts.schema, parts.table, parts.column].filter((p): p is string => Boolean(p)).map(quote).join(".");
}

type Loaded = { table: TableDetail } | { tables: TableSummary[]; more: boolean } | { error: string } | undefined;

/**
 * What the backend knows about a database, schema or table: for a table its
 * kind, format, location, size and every column with its type and keys; for
 * a database or schema the tables in it. Row counts come from the catalog
 * when it has them and are never worked out by scanning.
 */
export function ObjectInfo(props: ObjectInfoProps) {
  const { sourceId, catalog, schema, table, onClose } = props;
  const dataSource = useDataSource(props.dataSource);
  const [loaded, setLoaded] = useState<Loaded>();
  const name = qualifiedName({ catalog, schema, table });

  useEffect(() => {
    let current = true;
    setLoaded(undefined);
    const request = table
      ? dataSource.describeTable({ sourceId, ref: { catalog: catalog ?? "", schema: schema ?? "", table } }).then((r): Loaded => (r.table ? { table: r.table } : { error: "The backend returned nothing for this table." }))
      : dataSource.listTables({ sourceId, catalog: catalog ?? "", schema: schema ?? "", pageSize: 50 }).then((r): Loaded => ({ tables: r.tables, more: r.nextPageToken !== "" }));
    request.then((result) => current && setLoaded(result)).catch((error: unknown) => current && setLoaded({ error: messageOf(error) }));
    return () => {
      current = false;
    };
  }, [dataSource, sourceId, catalog, schema, table]);

  const facts: [string, string][] = [];
  if (loaded && "table" in loaded) {
    const { summary, rowCount, sizeBytes, location, properties } = loaded.table;
    facts.push(["Kind", KIND[summary?.kind ?? 0] ?? "Table"]);
    if (summary?.format) facts.push(["Format", TableFormat[summary.format]?.toLowerCase() ?? ""]);
    if (rowCount !== undefined) facts.push(["Rows", count.format(rowCount)]);
    if (sizeBytes !== undefined) facts.push(["Size", bytes(sizeBytes)]);
    if (location) facts.push(["Location", location]);
    facts.push(["Columns", count.format(loaded.table.columns.length)]);
    for (const [key, value] of Object.entries(properties)) facts.push([key, value]);
  }

  return (
    <section
      className={["sf-info", props.className].filter(Boolean).join(" ")}
      aria-label={`Details of ${name || sourceId}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && onClose) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="sf-info-head">
        <div>
          <p className="sf-info-kind">{table ? "Table" : schema ? "Schema" : catalog ? "Database" : "Source"}</p>
          <p className="sf-info-name">{name || sourceId}</p>
        </div>
        {onClose && (
          <button type="button" className="sf-button" onClick={onClose} autoFocus>
            Close
          </button>
        )}
      </header>
      {loaded === undefined && <p className="sf-object-muted">Loading…</p>}
      {loaded && "error" in loaded && (
        <p className="sf-metric-error" role="alert">
          Could not read the details: {loaded.error}
        </p>
      )}
      {loaded && "table" in loaded && (
        <>
          {loaded.table.summary?.comment && <p className="sf-info-comment">{loaded.table.summary.comment}</p>}
          <dl className="sf-info-facts">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="sf-info-scroll" tabIndex={0} role="region" aria-label="Columns">
            <table className="sf-info-table">
              <thead>
                <tr>
                  <th scope="col">Column</th>
                  <th scope="col">Type</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loaded.table.columns.map((column) => (
                  <tr key={column.name}>
                    <th scope="row">{column.name}</th>
                    <td>{column.nativeType || column.arrowType}</td>
                    <td>{[column.primaryKey && "Key", column.partitionKey && "Partition", !column.nullable && "Required", column.comment].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {loaded && "tables" in loaded && (
        <>
          <p className="sf-object-muted">
            {loaded.tables.length === 0 ? "No tables found." : `${loaded.more ? "The first " : ""}${loaded.tables.length} ${loaded.tables.length === 1 ? "table" : "tables"}${loaded.more ? "; more exist" : ""}.`}
          </p>
          <div className="sf-info-scroll" tabIndex={0} role="region" aria-label="Tables">
            <table className="sf-info-table">
              <thead>
                <tr>
                  <th scope="col">Table</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {loaded.tables.map((summary) => (
                  <tr key={qualifiedName(summary.ref ?? {})}>
                    <th scope="row">{qualifiedName({ schema: summary.ref?.schema, table: summary.ref?.table })}</th>
                    <td>{[KIND[summary.kind] ?? "Table", summary.format ? TableFormat[summary.format]?.toLowerCase() : ""].filter(Boolean).join(", ")}</td>
                    <td>{summary.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
