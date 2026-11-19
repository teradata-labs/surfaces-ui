/** One column of a result, as the transport reports it. */
export interface TeradataColumn {
  name: string;
  /**
   * Teradata's name for the type, e.g. `INTEGER`, `DECIMAL(18,2)`,
   * `TIMESTAMP(6)`. Empty when the transport does not say; the engine then
   * goes by the values.
   */
  type: string;
}

export interface TeradataResult {
  columns: TeradataColumn[];
  rows: unknown[][];
  /** True when the transport stopped at its row limit and there were more rows. */
  truncated?: boolean;
}

/**
 * How statements reach Teradata. The engine only ever hands a transport a
 * statement with `?` placeholders and the values for them, in order; a
 * transport must bind the values and never write them into the statement.
 *
 * Two are built in: `queryServiceClient` (Teradata Query Service over HTTP)
 * and `driverClient` (a driver connection the consumer supplies).
 */
export interface TeradataClient {
  query(sql: string, params: unknown[], options?: { signal?: AbortSignal }): Promise<TeradataResult>;
  close?(): Promise<void>;
}

export interface SessionSettings {
  /** Default database for names written without one. */
  database?: string;
  /** Recorded in the session's query band so a DBA can see where queries come from. */
  applicationName?: string;
}

export const APPLICATION_NAME = "surfaces-ui";

/** A name in double quotes, so that it can only ever be a name. */
export const quoteName = (name: string) => `"${name.replace(/"/g, '""')}"`;

export function applicationName(settings: SessionSettings): string {
  const name = settings.applicationName ?? APPLICATION_NAME;
  // The name sits inside a quoted query band, where `=`, `;` and quotes have meaning.
  if (!/^[A-Za-z0-9_. -]{1,64}$/.test(name)) throw new Error("The application name may hold letters, digits, spaces, dots, dashes and underscores.");
  return name;
}

/**
 * Statements a transport runs once on a session it owns.
 *
 * - Time zone: UTC, so TIMESTAMP values read the same whatever the user's or
 *   the system's own zone is.
 * - Query band: names the application for workload rules and logs.
 * - Default database, when one is configured.
 *
 * Transaction mode (ANSI or Teradata) is left as the system has it: the SQL
 * this library writes is valid in both. The one difference that matters here
 * is that text comparison is case specific in ANSI mode, which is why the
 * catalog queries compare lower-cased names.
 */
export function sessionStatements(settings: SessionSettings): string[] {
  return [
    "SET TIME ZONE INTERVAL '00:00' HOUR TO MINUTE",
    `SET QUERY_BAND = 'ApplicationName=${applicationName(settings)};' FOR SESSION`,
    ...(settings.database ? [`DATABASE ${quoteName(settings.database)}`] : []),
  ];
}
