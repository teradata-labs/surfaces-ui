import type { MessageInitShape } from "@bufbuild/protobuf";
import type {
  CapabilitiesSchema,
  CatalogSchema,
  ColumnSchema,
  ConnectionSchema,
  Engine as EngineKind,
  FileEntrySchema,
  SchemaSchema,
  SqlDialect,
  TableDetailSchema,
  TableFormat,
  TableRef,
  TableSnapshotSchema,
  TableSummarySchema,
  TimeTravel,
} from "@surfaces-ui/proto";
import type { RecordBatch, Schema } from "apache-arrow";

/** A value bound to a `?` placeholder. */
export type Param = string | number | bigint | boolean;

export interface EngineResult {
  schema: Schema;
  /** Batches as the engine produces them. Stop iterating to cancel. */
  batches: AsyncIterable<RecordBatch>;
}

export interface ExecuteOptions {
  signal?: AbortSignal;
  /** Read tables as of an earlier snapshot, version or time. */
  timeTravel?: TimeTravel;
}

export interface StoreOptions extends ExecuteOptions {
  /** Keep at most this many rows. A longer result is reported as not complete. */
  maxRows: number;
}

/** A query result the engine is holding so it can be read again without re-running the query. */
export interface StoredRelation {
  /** How to name the stored rows in a FROM clause, already quoted for the dialect. */
  relation: string;
  rowCount: number;
  /** False when the result had more than `maxRows` rows; the caller should drop it and query live. */
  complete: boolean;
}

export interface EngineCheck {
  name: string;
  ok: boolean;
  message: string;
  elapsedMs: number;
}

export interface ListTablesOptions {
  catalog: string;
  schema: string;
  search: string;
  /**
   * The page wanted, for an engine that sets `pagesTables`: at most `limit`
   * tables after skipping `offset`. Other engines ignore both and return the
   * whole list.
   */
  limit?: number;
  offset?: number;
}

/**
 * One query engine behind the contract. An adapter runs SQL that has already
 * been checked and rewritten for its dialect, and describes what it holds.
 * It knows nothing about ViewQuery, Connect or the UI.
 */
export interface Engine {
  readonly kind: EngineKind;
  readonly dialect: SqlDialect;
  readonly capabilities: MessageInitShape<typeof CapabilitiesSchema>;
  /** How this engine reaches data outside the server, for display. Secret names only, never values. */
  readonly connections?: MessageInitShape<typeof ConnectionSchema>[];
  /**
   * True when `listTables` cuts the page itself (`limit` and `offset`), as an
   * engine over a catalog too large to list must. With no `limit` such an
   * engine returns a capped list, never everything.
   */
  readonly pagesTables?: boolean;
  /** Tries to reach each table and catalog, so a person can see which connection is broken. */
  check?(): Promise<EngineCheck[]>;
  execute(sql: string, params: Param[], options?: ExecuteOptions): Promise<EngineResult>;
  explain(sql: string, params: Param[]): Promise<{ planText: string; planJson: string }>;
  /**
   * Runs a query once and keeps its rows (a temporary table or the engine's
   * equivalent). Optional: without it every view of a query runs it again.
   */
  store?(sql: string, params: Param[], options: StoreOptions): Promise<StoredRelation>;
  /** Releases rows kept by `store`. */
  dropStored?(relation: string): Promise<void>;
  /**
   * Builds or replaces a table (or view) the engine owns from a query, and
   * lists it in the catalog under `name`. This is how pipelines write. The
   * SQL must come from server configuration, never from a client.
   */
  materialize?(name: string, sql: string, options?: { view?: boolean }): Promise<{ rowCount: number }>;
  /** Removes something built by `materialize`. */
  dropMaterialized?(name: string): Promise<void>;
  /**
   * Lists the folders and files in the engine's storage: with no path, the
   * places it is allowed to read; with a path, what is in that folder. A path
   * outside those places is refused. Names, sizes and dates only.
   */
  listFiles?(path: string): Promise<{ entries: MessageInitShape<typeof FileEntrySchema>[]; truncated?: boolean }>;
  /** Reads the schema of files at a location the engine is allowed to reach, without loading them. */
  inspect?(format: TableFormat, location: string): Promise<{ columns: MessageInitShape<typeof ColumnSchema>[]; rowCount?: bigint }>;
  listCatalogs(): Promise<MessageInitShape<typeof CatalogSchema>[]>;
  listSchemas(catalog: string): Promise<MessageInitShape<typeof SchemaSchema>[]>;
  listTables(options: ListTablesOptions): Promise<MessageInitShape<typeof TableSummarySchema>[]>;
  describeTable(ref: TableRef, includeStats: boolean): Promise<MessageInitShape<typeof TableDetailSchema>>;
  listSnapshots(ref: TableRef): Promise<MessageInitShape<typeof TableSnapshotSchema>[]>;
  version(): Promise<string>;
  close(): Promise<void>;
}

/** Thrown by adapters for problems the user can act on. Codes match `QueryErrorDetail.code`. */
export class EngineError extends Error {
  constructor(
    readonly code: "ENGINE" | "SYNTAX" | "UNKNOWN_TABLE" | "UNKNOWN_COLUMN" | "UNSUPPORTED" | "CANCELLED" | "TIMEOUT",
    message: string,
    readonly engineCode = "",
    /** 0-based character offset of the problem in the SQL that was passed in, when the engine reports one. */
    readonly position?: number,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

/**
 * What a table's owner declares about it beyond what the engine stores:
 * its key, the keys it refers to, and what each column means. File formats
 * such as Parquet keep none of this, so a source's config can supply it.
 */
export interface TableModel {
  primaryKey?: string[];
  /** Column name to description. */
  columns?: Record<string, string>;
  foreignKeys?: { columns: string[]; table: string; references: string[] }[];
}

/**
 * Adds a declared model to a described table: marks key columns, fills in
 * column descriptions the engine had none for, and lists foreign keys whose
 * columns exist. Names are matched without regard to case.
 */
export function withTableModel(
  detail: MessageInitShape<typeof TableDetailSchema>,
  model: TableModel | undefined,
): MessageInitShape<typeof TableDetailSchema> {
  if (!model) return detail;
  const lower = (s: string) => s.toLowerCase();
  const key = new Set((model.primaryKey ?? []).map(lower));
  const notes = new Map(Object.entries(model.columns ?? {}).map(([name, text]) => [lower(name), text]));
  const columns = (detail.columns ?? []).map((column) => {
    const name = lower(column.name ?? "");
    return { ...column, primaryKey: column.primaryKey || key.has(name), comment: column.comment || notes.get(name) || "" };
  });
  const present = new Set(columns.map((c) => lower(c.name ?? "")));
  const ref = detail.summary?.ref;
  const foreignKeys = (model.foreignKeys ?? [])
    .filter((fk) => fk.columns.length > 0 && fk.columns.length === fk.references.length && fk.columns.every((c) => present.has(lower(c))))
    .map((fk) => ({ columns: fk.columns, references: { catalog: ref?.catalog ?? "", schema: ref?.schema ?? "", table: fk.table }, referencedColumns: fk.references }));
  // Spread drops a message's type name, so the result is plain init data.
  return { ...detail, $typeName: undefined, columns, foreignKeys: [...(detail.foreignKeys ?? []), ...foreignKeys] } as MessageInitShape<typeof TableDetailSchema>;
}
