import type { DataSource } from "@surfaces-ui/data";
import { type Connection, ConnectionKind, Engine, type Source, type TestSourceResponse } from "@surfaces-ui/proto";
import { useEffect, useState } from "react";
import { useDataSource } from "../data/DataSourceProvider.js";
import { messageOf } from "../data/useRowWindow.js";

export interface SourceListProps {
  /** Called when a source is chosen. */
  onSelect?(source: Source): void;
  dataSource?: DataSource;
  className?: string;
}

const ENGINE_LABEL: Partial<Record<Engine, string>> = {
  [Engine.DUCKDB]: "DuckDB",
  [Engine.DATAFUSION]: "DataFusion",
  [Engine.TERADATA]: "Teradata",
  [Engine.POSTGRES]: "Postgres",
  [Engine.MYSQL]: "MySQL",
  [Engine.SQLSERVER]: "SQL Server",
  [Engine.SNOWFLAKE]: "Snowflake",
  [Engine.BIGQUERY]: "BigQuery",
  [Engine.DATABRICKS]: "Databricks",
  [Engine.ORACLE]: "Oracle",
};

export const CONNECTION_LABEL: Partial<Record<ConnectionKind, string>> = {
  [ConnectionKind.S3]: "Amazon S3",
  [ConnectionKind.GCS]: "Google Cloud Storage",
  [ConnectionKind.AZURE]: "Azure Storage",
  [ConnectionKind.HTTP]: "Web (https)",
  [ConnectionKind.ICEBERG_REST]: "Iceberg REST catalog",
  [ConnectionKind.DATABASE_FILE]: "Database file",
  [ConnectionKind.POSTGRES]: "Postgres database",
};

/** How a connection signs in, in words. Only the secret's name is ever known here. */
export function credentialText(connection: Connection): string {
  if (connection.ambientCredentials) return "The server's own cloud credentials";
  return connection.credentialsSecret ? `Secret ${connection.credentialsSecret}` : "None (public)";
}

/**
 * The data sources a backend offers: what runs their SQL, how they reach
 * storage and catalogs, and whether each table can be reached right now.
 * Credentials are shown by name only; their values never leave the server.
 */
export function SourceList(props: SourceListProps) {
  const dataSource = useDataSource(props.dataSource);
  const [sources, setSources] = useState<Source[] | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [tests, setTests] = useState<Record<string, TestSourceResponse | "running" | { error: string }>>({});

  useEffect(() => {
    let current = true;
    dataSource
      .listSources({})
      .then((response) => current && setSources(response.sources))
      .catch((e: unknown) => current && setError(messageOf(e)));
    return () => {
      current = false;
    };
  }, [dataSource]);

  const test = (id: string) => {
    if (!dataSource.testSource) return;
    setTests((previous) => ({ ...previous, [id]: "running" }));
    dataSource
      .testSource({ target: { case: "id", value: id } })
      .then((response) => setTests((previous) => ({ ...previous, [id]: response })))
      .catch((e: unknown) => setTests((previous) => ({ ...previous, [id]: { error: messageOf(e) } })));
  };

  if (error) {
    return (
      <p className="sf-search-error" role="alert">
        {error}
      </p>
    );
  }
  if (!sources) return <p className="sf-object-muted">Loading…</p>;
  if (sources.length === 0) return <p className="sf-object-muted">No sources are configured.</p>;

  return (
    <ul className={["sf-sources", props.className].filter(Boolean).join(" ")}>
      {sources.map((source) => {
        const result = tests[source.id];
        const done = result && result !== "running" && !("error" in result) ? result : undefined;
        return (
          <li key={source.id} className="sf-source">
            <header className="sf-source-head">
              <div>
                <h3 className="sf-object-title">{source.displayName || source.id}</h3>
                <p className="sf-object-facts">
                  {[source.id, ENGINE_LABEL[source.engine], source.readOnly ? "Read only" : undefined, source.capabilities?.timeTravel ? "Time travel" : undefined, source.capabilities?.storedResults ? "Keeps results" : undefined]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="sf-object-buttons">
                {props.onSelect && (
                  <button type="button" className="sf-button" onClick={() => props.onSelect?.(source)}>
                    Open
                  </button>
                )}
                {dataSource.testSource && (
                  <button type="button" className="sf-button" disabled={result === "running"} onClick={() => test(source.id)}>
                    {result === "running" ? "Testing…" : "Test connection"}
                  </button>
                )}
              </div>
            </header>

            {source.connections.length > 0 && (
              <div className="sf-object-table" tabIndex={0} role="region" aria-label={`Connections of ${source.displayName || source.id}`}>
                <table>
                  <caption className="sf-a2-visually-hidden">Connections of {source.displayName || source.id}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Connection</th>
                      <th scope="col">Type</th>
                      <th scope="col">Covers</th>
                      <th scope="col">Signs in with</th>
                    </tr>
                  </thead>
                  <tbody>
                    {source.connections.map((connection) => (
                      <tr key={connection.name}>
                        <th scope="row">{connection.name}</th>
                        <td>{CONNECTION_LABEL[connection.kind] ?? "Other"}</td>
                        <td className="sf-object-type">{connection.scope}</td>
                        <td>{credentialText(connection)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div aria-live="polite">
              {result && result !== "running" && "error" in result && (
                <p className="sf-search-error" role="alert">
                  {result.error}
                </p>
              )}
              {done && (
                <>
                  <p className="sf-source-result" data-ok={done.ok || undefined}>
                    <span aria-hidden="true">{done.ok ? "✓" : "!"}</span> {done.message}
                    {done.engineVersion ? ` · ${ENGINE_LABEL[source.engine] ?? "Engine"} ${done.engineVersion}` : ""} · {Number(done.elapsedMs)} ms
                  </p>
                  {done.checks.length > 0 && (
                    <ul className="sf-source-checks">
                      {done.checks.map((check) => (
                        <li key={check.name} data-ok={check.ok || undefined}>
                          <span aria-hidden="true">{check.ok ? "✓" : "!"}</span>
                          <strong>{check.name}</strong>
                          <span>{check.ok ? "Reachable" : check.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
