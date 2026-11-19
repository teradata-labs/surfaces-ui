import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { type AdbcConnection, AdbcDatabase } from "@apache-arrow/adbc-driver-manager";
import {
  type Engine,
  type EngineCheck,
  EngineError,
  type EngineResult,
  type ExecuteOptions,
  type Param,
  type StoreOptions,
  type StoredRelation,
  type TableModel,
  withTableModel,
} from "@surfaces-ui/engine";
import {
  ConnectionKind,
  Engine as EngineKind,
  FileEntryKind,
  SqlDialect,
  TableFormat,
  TableKind,
  type TableRef,
  type TimeTravel,
} from "@surfaces-ui/proto";
import { Bool, Float64, Int64, type RecordBatch, Table, Utf8, vectorFromArray } from "apache-arrow";

export type DuckDbTableFormat = "parquet" | "csv" | "json" | "delta" | "iceberg";

/** One table the engine exposes. Queries refer to it by `name`. */
export interface DuckDbTable {
  name: string;
  format: DuckDbTableFormat;
  /**
   * Where the data is. A file or glob for parquet/csv/json, the table root
   * for Delta, and the table root or a metadata.json file for Iceberg.
   */
  path: string;
  comment?: string;
  /** Keys and column descriptions the files themselves do not hold. */
  model?: TableModel;
}

/** Credentials for one connection, as resolved on the server. Never sent to a client or logged. */
export interface DuckDbSecretValues {
  /** Access key ID (S3, GCS HMAC). */
  keyId?: string;
  /** Secret access key. */
  secret?: string;
  sessionToken?: string;
  /** Azure storage connection string. */
  connectionString?: string;
  /** Bearer token (HTTP, Iceberg REST catalogs). */
  token?: string;
  /** Database password (Postgres). */
  password?: string;
}

/**
 * How the engine reaches data that is not on this machine: an object store
 * or web location that tables read from. Only paths under `scope` can be
 * read, and credentials are named, never written here.
 */
export interface DuckDbConnection {
  name: string;
  kind: "s3" | "gcs" | "azure" | "http";
  /** Bucket or prefix this connection covers, e.g. `s3://acme-lake/sales` or `https://data.example.com/`. */
  scope: string;
  /** Name of a secret the server resolves. Omit for public data. */
  secret?: string;
  /** Use the credentials this machine already has (AWS profile, instance role, workload identity) instead of a named secret. */
  ambientCredentials?: boolean;
  region?: string;
  /** For S3-compatible stores such as MinIO or R2, e.g. `minio.internal:9000`. */
  endpoint?: string;
  urlStyle?: "path" | "vhost";
  useSsl?: boolean;
  /** Azure storage account name, when not using a connection string. */
  accountName?: string;
}

/** A catalog attached to the engine: every table in it is listed under its own catalog and schema. */
export interface DuckDbCatalog {
  /** The catalog's name in SQL: tables are `name.schema.table`. */
  name: string;
  /**
   * `iceberg-rest` is an Iceberg REST catalog (also Polaris, Lakekeeper, S3 Tables, Unity's Iceberg endpoint);
   * `postgres` is a Postgres database (also Supabase, Neon, RDS); `duckdb` is a DuckDB database file.
   */
  kind: "iceberg-rest" | "postgres" | "duckdb";
  /**
   * REST endpoint for `iceberg-rest`; file path for `duckdb`; for `postgres`
   * a connection string without the password, e.g.
   * `host=db.example.com port=5432 dbname=shop user=reader sslmode=require`.
   */
  uri: string;
  /** Warehouse name or location, for `iceberg-rest`. */
  warehouse?: string;
  /** Name of a secret holding a bearer `token` (`iceberg-rest`) or a `password` (`postgres`). */
  secret?: string;
}

export interface DuckDbEngineOptions {
  tables: DuckDbTable[];
  /** Object stores and web locations the tables read from. */
  connections?: DuckDbConnection[];
  /** Catalogs to attach read-only. */
  catalogs?: DuckDbCatalog[];
  /** Looks up a named secret. Required when a connection or catalog names one. */
  resolveSecret?(name: string): DuckDbSecretValues | undefined | Promise<DuckDbSecretValues | undefined>;
  /** Path to the DuckDB shared library. Defaults to the one shipped with `@duckdb/node-bindings`. */
  libraryPath?: string;
  /**
   * After setup, restrict file access to the directories of the registered
   * tables so queries cannot read arbitrary files. Defaults to true.
   */
  lockFileAccess?: boolean;
}

const CATALOG = "memory";
const SCHEMA = "main";

const FORMAT: Record<DuckDbTableFormat, TableFormat> = {
  parquet: TableFormat.PARQUET,
  csv: TableFormat.CSV,
  json: TableFormat.JSON,
  delta: TableFormat.DELTA,
  iceberg: TableFormat.ICEBERG,
};

/** Path of the DuckDB shared library shipped with `@duckdb/node-bindings` for this platform. */
export function duckDbLibraryPath(): string {
  return defaultLibrary();
}

function defaultLibrary(): string {
  const require = createRequire(import.meta.url);
  const file =
    process.platform === "darwin" ? "libduckdb.dylib" : process.platform === "win32" ? "duckdb.dll" : "libduckdb.so";
  const pkg = `@duckdb/node-bindings-${process.platform}-${process.arch}`;
  const bindings = path.dirname(require.resolve("@duckdb/node-bindings/package.json"));
  const local = createRequire(path.join(bindings, "package.json"));
  return path.join(path.dirname(local.resolve(`${pkg}/package.json`)), file);
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const text = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** The most entries one folder listing returns; a larger folder is reported as not read to the end. */
const FILE_LIST_CAP = 5000;

/** The folder a local table reads from: the path itself when it is a folder (Delta, Iceberg), its parent otherwise. */
const localFolder = (tablePath: string) => (fs.existsSync(tablePath) && fs.statSync(tablePath).isDirectory() ? path.resolve(tablePath) : path.dirname(path.resolve(tablePath)));

/** What a file can be read as, by its extension. */
function fileFormat(name: string): TableFormat {
  const lower = name.toLowerCase().replace(/\.(gz|zst)$/, "");
  if (lower.endsWith(".parquet")) return TableFormat.PARQUET;
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return TableFormat.CSV;
  if (lower.endsWith(".json") || lower.endsWith(".ndjson") || lower.endsWith(".jsonl")) return TableFormat.JSON;
  return TableFormat.UNSPECIFIED;
}

/** A local folder that is the root of a Delta or Iceberg table, by what it holds. */
function folderFormat(folder: string): TableFormat {
  try {
    if (fs.existsSync(path.join(folder, "_delta_log"))) return TableFormat.DELTA;
    const metadata = path.join(folder, "metadata");
    if (fs.existsSync(metadata) && fs.readdirSync(metadata).some((name) => name.endsWith(".metadata.json"))) return TableFormat.ICEBERG;
  } catch {
    // Unreadable: not a table as far as a listing can tell.
  }
  return TableFormat.UNSPECIFIED;
}


function bindTable(params: Param[]): Table {
  return new Table(
    Object.fromEntries(
      params.map((value, i) => {
        const type =
          typeof value === "bigint"
            ? new Int64()
            : typeof value === "number"
              ? new Float64()
              : typeof value === "boolean"
                ? new Bool()
                : new Utf8();
        return [`p${i}`, vectorFromArray([value], type)];
      }),
    ),
  );
}

function rows(table: Table): Record<string, unknown>[] {
  return table.toArray().map((r) => (r as { toJSON(): Record<string, unknown> }).toJSON());
}

const RESULTS = "_sf_results";
const REMOTE = /^[a-z][a-z0-9+.-]*:\/\//i;
/** Functions that describe stored credentials. They redact values, but queries have no business calling them. */
const SECRET_FUNCTIONS = /\b(duckdb_secrets|which_secret)\s*\(/i;
/**
 * Functions that hand a string of SQL to an attached database to run as it
 * is. They would let a query do anything the server's database login can,
 * out of sight of the read-only check, so they are refused.
 */
const PASS_THROUGH = /\b(postgres|mysql|sqlite)_(query|execute|scan|scan_pushdown|attach)\s*\(/i;

/** True for `s3://`, `gs://`, `az://`, `https://` and similar; false for paths on this machine. */
export function isRemotePath(location: string): boolean {
  return REMOTE.test(location);
}

/**
 * The statement that registers a connection's credentials with DuckDB. The
 * values are written into SQL text that goes only to the engine, so each is
 * escaped as a string literal.
 */
export function secretSql(connection: DuckDbConnection, values: DuckDbSecretValues | undefined): string | undefined {
  if (connection.kind === "http" && !values?.token) return undefined;
  // Where the store is (its endpoint, region, address style) has to reach the engine even when there are no credentials: public data on a store that is not AWS is read anonymously, but still from that store.
  const placed = connection.kind !== "http" && (connection.endpoint !== undefined || connection.urlStyle !== undefined || connection.useSsl !== undefined || connection.region !== undefined);
  if (!values && !connection.ambientCredentials && connection.kind !== "azure" && !placed) return undefined;
  const options: string[] = [`TYPE ${connection.kind}`];
  const add = (key: string, value: string | undefined) => value !== undefined && value !== "" && options.push(`${key} ${text(value)}`);
  if (connection.ambientCredentials) options.push("PROVIDER credential_chain");
  if (connection.kind === "http") add("BEARER_TOKEN", values?.token);
  else if (connection.kind === "azure") {
    add("CONNECTION_STRING", values?.connectionString);
    add("ACCOUNT_NAME", connection.accountName);
  } else {
    add("KEY_ID", values?.keyId);
    add("SECRET", values?.secret);
    add("SESSION_TOKEN", values?.sessionToken);
    add("REGION", connection.region);
    add("ENDPOINT", connection.endpoint);
    add("URL_STYLE", connection.urlStyle);
    if (connection.useSsl !== undefined) options.push(`USE_SSL ${connection.useSsl ? "true" : "false"}`);
  }
  add("SCOPE", connection.scope);
  return `CREATE OR REPLACE SECRET ${ident(`sf_${connection.name}`)} (${options.join(", ")})`;
}

/**
 * Errors arrive as JSON (errors_as_json is set at start-up), which carries
 * the kind of error and where in the SQL it is. `shift` is the length of
 * anything this adapter put in front of the caller's SQL.
 */
function engineError(error: unknown, shift = 0): EngineError {
  if (error instanceof EngineError) return error;
  const raw = error instanceof Error ? error.message : String(error);
  const start = raw.indexOf("{");
  let parsed: { exception_type?: string; exception_message?: string; position?: string; error_subtype?: string } | undefined;
  if (start >= 0) {
    try {
      parsed = JSON.parse(raw.slice(start));
    } catch {
      parsed = undefined;
    }
  }
  if (!parsed) {
    const clean = raw.replace(/^.*?(?=(Binder|Catalog|Parser|Conversion|Invalid Input|IO|Permission|Not implemented) Error)/s, "");
    return new EngineError(/^Catalog Error/.test(clean) ? "UNKNOWN_TABLE" : "ENGINE", clean.split("\n")[0]!.trim() || "The query failed.");
  }
  const kind = parsed.exception_type ?? "";
  const code =
    kind === "Parser"
      ? "SYNTAX"
      : kind === "Catalog"
        ? "UNKNOWN_TABLE"
        : parsed.error_subtype === "COLUMN_NOT_FOUND"
          ? "UNKNOWN_COLUMN"
          : "ENGINE";
  // The first line says what is wrong; later lines are suggestions, which are kept after it.
  const lines = (parsed.exception_message ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const message = `${kind ? `${kind} error: ` : ""}${lines.join(" ")}` || "The query failed.";
  const offset = parsed.position === undefined ? Number.NaN : Number(parsed.position) - shift;
  return new EngineError(code, message, parsed.error_subtype ?? "", Number.isInteger(offset) && offset >= 0 ? offset : undefined);
}

/**
 * Arguments that locate an Iceberg table. Given a table root, the newest
 * metadata file is named explicitly (no version hint file is needed) and
 * moved paths are allowed, so a table copied to another folder still reads.
 */
function icebergArgs(location: string, forSnapshots = false): string {
  const metadata = path.join(location, "metadata");
  const newest =
    fs.existsSync(metadata) && fs.statSync(metadata).isDirectory()
      ? fs
          .readdirSync(metadata)
          .filter((f) => f.endsWith(".metadata.json"))
          .sort()
          .at(-1)
      : undefined;
  if (!newest) return text(location);
  // iceberg_snapshots reads only the metadata file and takes no relocation options.
  if (forSnapshots) return text(path.join(metadata, newest));
  return `${text(location)}, allow_moved_paths => true, version => ${text(newest.replace(/\.metadata\.json$/, ""))}`;
}

/** The relation expression for a table, optionally pinned to an earlier point. */
function scan(table: DuckDbTable, at?: TimeTravel): string {
  const p = text(table.path);
  const pin = at?.at;
  switch (table.format) {
    case "parquet":
      return `read_parquet(${p})`;
    case "csv":
      return `read_csv(${p})`;
    case "json":
      return `read_json(${p})`;
    case "delta": {
      if (!pin?.case) return `delta_scan(${p})`;
      if (pin.case === "version") return `delta_scan(${p}, version => ${BigInt(pin.value)})`;
      if (pin.case === "snapshotId" && /^\d+$/.test(pin.value)) return `delta_scan(${p}, version => ${pin.value})`;
      throw new EngineError("UNSUPPORTED", "Delta tables can be read at a version number, not a timestamp.");
    }
    case "iceberg": {
      const base = `iceberg_scan(${icebergArgs(table.path)}`;
      if (!pin?.case) return `${base})`;
      if (pin.case === "snapshotId" && /^\d+$/.test(pin.value)) return `${base}, snapshot_from_id => ${pin.value})`;
      if (pin.case === "timestamp") {
        const when = new Date(pin.value);
        if (Number.isNaN(when.getTime())) throw new EngineError("UNSUPPORTED", "The time travel timestamp is not valid.");
        const stamp = when.toISOString().replace("T", " ").replace("Z", "");
        return `${base}, snapshot_from_timestamp => TIMESTAMP ${text(stamp)})`;
      }
      throw new EngineError("UNSUPPORTED", "Iceberg tables can be read at a snapshot ID or a timestamp.");
    }
  }
}

/**
 * DuckDB behind the Engine interface, reached through ADBC so results arrive
 * as Arrow batches with their types intact.
 *
 * Tables are registered as views over files and lake tables. Each query runs
 * on its own connection; time travel is done by shadowing the view with a
 * connection-local temporary view pinned to the requested snapshot.
 */
export async function createDuckDbEngine(options: DuckDbEngineOptions): Promise<Engine> {
  const tables = new Map(options.tables.map((t) => [t.name.toLowerCase(), { ...t, path: isRemotePath(t.path) ? t.path : path.resolve(t.path) }]));
  const connections = options.connections ?? [];
  const catalogs = options.catalogs ?? [];
  const attached = new Set(catalogs.map((c) => c.name.toLowerCase()));
  for (const name of [...connections.map((c) => c.name), ...catalogs.map((c) => c.name)]) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new EngineError("UNSUPPORTED", `Connection and catalog names use letters, digits and underscores: ${name}`);
  }
  const secretOf = async (name: string | undefined) => {
    if (!name) return undefined;
    const values = await options.resolveSecret?.(name);
    // The name is safe to show; it tells the person which secret to set.
    if (!values) throw new EngineError("UNSUPPORTED", `The secret "${name}" is not set on the server.`);
    return values;
  };
  const database = new AdbcDatabase({ driver: options.libraryPath ?? defaultLibrary(), entrypoint: "duckdb_adbc_init" });

  const withConnection = async <T>(run: (connection: AdbcConnection) => Promise<T>): Promise<T> => {
    const connection = await database.connect();
    try {
      return await run(connection);
    } catch (error) {
      throw engineError(error);
    } finally {
      await connection.close().catch(() => {});
    }
  };

  const formats = new Set([...tables.values()].map((t) => t.format));
  /** Remote tables and catalogs that could not be opened at start-up, with the reason. */
  const unreachable = new Map<string, string>();
  const CATALOG_KIND = { duckdb: ConnectionKind.DATABASE_FILE, postgres: ConnectionKind.POSTGRES, "iceberg-rest": ConnectionKind.ICEBERG_REST } as const;
  /** A connection string with only what is safe to show: where it points, not who signs in. */
  const shown = (catalog: DuckDbCatalog) =>
    catalog.kind === "duckdb"
      ? path.basename(catalog.uri)
      : catalog.kind === "postgres"
        ? ["host", "port", "dbname"].map((key) => new RegExp(`\\b${key}\\s*=\\s*(\\S+)`, "i").exec(catalog.uri)?.[1]).filter(Boolean).join(" / ")
        : catalog.uri;
  await withConnection(async (connection) => {
    const extensions = new Set<string>();
    for (const extension of ["delta", "iceberg"] as const) if (formats.has(extension)) extensions.add(extension);
    if (connections.length > 0 || [...tables.values()].some((t) => isRemotePath(t.path))) extensions.add("httpfs");
    if (connections.some((c) => c.kind === "azure")) extensions.add("azure");
    if (connections.some((c) => c.ambientCredentials && c.kind === "s3")) extensions.add("aws");
    if (catalogs.some((c) => c.kind === "iceberg-rest")) extensions.add("iceberg").add("httpfs");
    if (catalogs.some((c) => c.kind === "postgres")) extensions.add("postgres");
    for (const extension of extensions) await connection.query(`INSTALL ${extension}; LOAD ${extension};`);
    for (const item of connections) {
      const sql = secretSql(item, await secretOf(item.secret));
      if (sql) await connection.query(sql);
    }
    // Dates and times mean the same wherever the server runs: truncating to a day or month uses UTC.
    await connection.query("SET GLOBAL TimeZone = 'UTC'");
    for (const catalog of catalogs) {
      const secret = ident(`sf_catalog_${catalog.name}`);
      try {
        if (catalog.kind === "duckdb") {
          await connection.query(`ATTACH ${text(path.resolve(catalog.uri))} AS ${ident(catalog.name)} (READ_ONLY)`);
        } else if (catalog.kind === "postgres") {
          if (/\bpassword\s*=/i.test(catalog.uri)) throw new EngineError("UNSUPPORTED", `Take the password out of the address for "${catalog.name}" and name a secret instead.`);
          const password = (await secretOf(catalog.secret))?.password;
          if (password) await connection.query(`CREATE OR REPLACE SECRET ${secret} (TYPE postgres, PASSWORD ${text(password)})`);
          await connection.query(`ATTACH ${text(catalog.uri)} AS ${ident(catalog.name)} (TYPE postgres${password ? `, SECRET ${secret}` : ""}, READ_ONLY)`);
        } else {
          const token = (await secretOf(catalog.secret))?.token;
          if (token) await connection.query(`CREATE OR REPLACE SECRET ${secret} (TYPE iceberg, TOKEN ${text(token)})`);
          await connection.query(
            `ATTACH ${text(catalog.warehouse ?? "")} AS ${ident(catalog.name)} (TYPE iceberg, ENDPOINT ${text(catalog.uri)}${token ? `, SECRET ${secret}` : ""})`,
          );
        }
      } catch (error) {
        // A missing secret or a bad address is a mistake in the config: say so at once.
        if (error instanceof EngineError || catalog.kind === "duckdb") throw error;
        // A database that is down must not stop the other sources from working.
        unreachable.set(catalog.name, engineError(error).message);
        attached.delete(catalog.name.toLowerCase());
      }
    }
    for (const table of tables.values()) {
      try {
        await connection.query(`CREATE OR REPLACE VIEW ${ident(table.name)} AS SELECT * FROM ${scan(table)}`);
        if (table.comment) await connection.query(`COMMENT ON VIEW ${ident(table.name)} IS ${text(table.comment)}`);
      } catch (error) {
        // A table on a store that cannot be reached must not stop the others from working.
        if (!isRemotePath(table.path)) throw error;
        unreachable.set(table.name, engineError(error).message);
      }
    }
    await connection.query(`CREATE SCHEMA IF NOT EXISTS ${ident(RESULTS)}`);
    await connection.query("SET GLOBAL errors_as_json = true");
    if (options.lockFileAccess ?? true) {
      // Only the registered tables' folders, the connections' scopes and the catalogs' endpoints can be read.
      const local = [...tables.values()].filter((t) => !isRemotePath(t.path)).map((t) => (fs.existsSync(t.path) && fs.statSync(t.path).isDirectory() ? t.path : path.dirname(t.path)));
      const remote = [...tables.values()].filter((t) => isRemotePath(t.path) && !connections.some((c) => t.path.startsWith(c.scope))).map((t) => t.path);
      const roots = [...new Set([...local, ...remote, ...connections.map((c) => c.scope), ...catalogs.map((c) => (c.kind === "duckdb" ? path.dirname(path.resolve(c.uri)) : c.uri))])];
      await connection.query(`SET allowed_directories = [${roots.map(text).join(", ")}]`);
      await connection.query("SET enable_external_access = false");
      await connection.query("SET lock_configuration = true");
    }
  });

  /** Tables and views built by pipelines, by lower-cased name. */
  const built = new Map<string, { name: string; view: boolean }>();
  const FORMAT_NAME: Partial<Record<TableFormat, DuckDbTableFormat>> = {
    [TableFormat.PARQUET]: "parquet",
    [TableFormat.CSV]: "csv",
    [TableFormat.JSON]: "json",
    [TableFormat.DELTA]: "delta",
    [TableFormat.ICEBERG]: "iceberg",
  };

  /** Queries may not inspect stored credentials, even though the engine redacts them. */
  const guard = (sql: string) => {
    if (SECRET_FUNCTIONS.test(sql)) throw new EngineError("UNSUPPORTED", "Queries cannot read connection secrets.");
    if (PASS_THROUGH.test(sql)) throw new EngineError("UNSUPPORTED", "Queries cannot send SQL straight to an attached database. Name its tables instead, e.g. pg.sales.orders.");
  };
  const isAttached = (ref: TableRef | undefined) => attached.has((ref?.catalog ?? "").toLowerCase());
  const qualified = (ref: TableRef) => [ref.catalog, ref.schema, ref.table].map(ident).join(".");

  const lookup = (ref: TableRef | undefined): DuckDbTable => {
    const table = tables.get((ref?.table ?? "").toLowerCase());
    if (!table) throw new EngineError("UNKNOWN_TABLE", `Table not found: ${ref?.table ?? ""}`);
    return table;
  };

  const pinned = (at: TimeTravel | undefined): DuckDbTable[] => {
    if (!at?.at.case) return [];
    if (at.table) return [lookup({ table: at.table } as TableRef)];
    // With no table named, pin every table that understands this kind of pin:
    // version numbers belong to Delta, snapshot IDs and timestamps to Iceberg.
    const format = at.at.case === "version" ? "delta" : "iceberg";
    return [...tables.values()].filter((t) => t.format === format);
  };

  return {
    kind: EngineKind.DUCKDB,
    dialect: SqlDialect.DUCKDB,
    capabilities: {
      cancel: true,
      explain: true,
      explainJson: true,
      timeTravel: formats.has("delta") || formats.has("iceberg"),
      keysetPaging: false,
      storedResults: true,
      exactCount: true,
      columnStats: false,
    },

    connections: [
      ...connections.map((c) => ({
        name: c.name,
        kind: { s3: ConnectionKind.S3, gcs: ConnectionKind.GCS, azure: ConnectionKind.AZURE, http: ConnectionKind.HTTP }[c.kind],
        scope: c.scope,
        credentialsSecret: c.secret ?? "",
        region: c.region ?? "",
        ambientCredentials: c.ambientCredentials ?? false,
      })),
      ...catalogs.map((c) => ({
        name: c.name,
        kind: CATALOG_KIND[c.kind],
        scope: shown(c),
        credentialsSecret: c.secret ?? "",
      })),
    ],

    async check(): Promise<EngineCheck[]> {
      const targets = [
        ...[...tables.values()].filter((t) => !unreachable.has(t.name)).map((t) => ({ name: t.name, sql: `SELECT * FROM ${ident(t.name)} LIMIT 0` })),
        ...catalogs.filter((c) => !unreachable.has(c.name)).map((c) => ({ name: c.name, sql: `SELECT 1 FROM information_schema.schemata WHERE catalog_name = ${text(c.name)} LIMIT 1` })),
      ];
      const failed = [...unreachable].map(([name, message]) => ({ name, ok: false, message, elapsedMs: 0 }));
      const checked = await Promise.all(
        targets.map(async (target) => {
          const started = Date.now();
          try {
            await withConnection((connection) => connection.query(target.sql));
            return { name: target.name, ok: true, message: "Reachable", elapsedMs: Date.now() - started };
          } catch (error) {
            return { name: target.name, ok: false, message: error instanceof Error ? error.message : String(error), elapsedMs: Date.now() - started };
          }
        }),
      );
      return [...checked, ...failed].sort((a, b) => a.name.localeCompare(b.name));
    },

    async execute(sql: string, params: Param[], executeOptions: ExecuteOptions = {}): Promise<EngineResult> {
      guard(sql);
      const connection = await database.connect();
      const close = () => connection.close().catch(() => {});
      try {
        for (const table of pinned(executeOptions.timeTravel)) {
          await connection.query(
            `CREATE OR REPLACE TEMP VIEW ${ident(table.name)} AS SELECT * FROM ${scan(table, executeOptions.timeTravel)}`,
          );
        }
        const reader = await connection.queryStream(sql, params.length > 0 ? bindTable(params) : undefined);
        // The reader's schema is only known once it has been opened.
        const iterator = reader[Symbol.asyncIterator]();
        const first = await iterator.next();
        const signal = executeOptions.signal;
        async function* batches(): AsyncGenerator<RecordBatch> {
          try {
            let current = first;
            while (!current.done) {
              if (signal?.aborted) throw new EngineError("CANCELLED", "The query was cancelled.");
              yield current.value;
              current = await iterator.next();
            }
          } catch (error) {
            throw engineError(error);
          } finally {
            await iterator.return?.();
            await close();
          }
        }
        return { schema: reader.schema, batches: batches() };
      } catch (error) {
        await close();
        throw engineError(error);
      }
    },

    async explain(sql, params) {
      guard(sql);
      const connection = await database.connect();
      try {
        const bound = params.length > 0 ? bindTable(params) : undefined;
        const plan = rows(await connection.query(`EXPLAIN ${sql}`, bound));
        const json = rows(await connection.query(`EXPLAIN (FORMAT JSON) ${sql}`, bound));
        const value = (r: Record<string, unknown>[]) => r.map((x) => String(x.explain_value ?? "")).join("\n");
        return { planText: value(plan), planJson: value(json) };
      } catch (error) {
        throw engineError(error, "EXPLAIN ".length);
      } finally {
        await connection.close().catch(() => {});
      }
    },

    async store(sql: string, params: Param[], storeOptions: StoreOptions): Promise<StoredRelation> {
      guard(sql);
      const relation = `${ident(RESULTS)}.${ident(`r_${randomUUID().replace(/-/g, "")}`)}`;
      const connection = await database.connect();
      try {
        for (const table of pinned(storeOptions.timeTravel)) {
          await connection.query(
            `CREATE OR REPLACE TEMP VIEW ${ident(table.name)} AS SELECT * FROM ${scan(table, storeOptions.timeTravel)}`,
          );
        }
        // One row past the limit shows whether the result was cut short.
        const created = await connection.query(
          `CREATE TABLE ${relation} AS SELECT * FROM (${sql}) AS "_sf" LIMIT ${storeOptions.maxRows + 1}`,
          params.length > 0 ? bindTable(params) : undefined,
        );
        const rowCount = Number(rows(created)[0]?.Count ?? 0);
        if (storeOptions.signal?.aborted) {
          await connection.query(`DROP TABLE IF EXISTS ${relation}`);
          throw new EngineError("CANCELLED", "The query was cancelled.");
        }
        return { relation, rowCount: Math.min(rowCount, storeOptions.maxRows), complete: rowCount <= storeOptions.maxRows };
      } catch (error) {
        throw engineError(error);
      } finally {
        await connection.close().catch(() => {});
      }
    },

    async materialize(name, sql, materializeOptions = {}) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new EngineError("UNSUPPORTED", `Dataset names use letters, digits and underscores: ${name}`);
      if (tables.has(name.toLowerCase())) throw new EngineError("UNSUPPORTED", `"${name}" is already a table of this source.`);
      guard(sql);
      return withConnection(async (connection) => {
        const existing = built.get(name.toLowerCase());
        // A table cannot replace a view of the same name, or the reverse, without dropping it first.
        if (existing && existing.view !== Boolean(materializeOptions.view)) await connection.query(`DROP ${existing.view ? "VIEW" : "TABLE"} IF EXISTS ${ident(existing.name)}`);
        if (materializeOptions.view) {
          await connection.query(`CREATE OR REPLACE VIEW ${ident(name)} AS ${sql}`);
          built.set(name.toLowerCase(), { name, view: true });
          return { rowCount: 0 };
        }
        const created = await connection.query(`CREATE OR REPLACE TABLE ${ident(name)} AS ${sql}`);
        built.set(name.toLowerCase(), { name, view: false });
        return { rowCount: Number(rows(created)[0]?.Count ?? 0) };
      });
    },

    dropMaterialized: (name) =>
      withConnection(async (connection) => {
        const existing = built.get(name.toLowerCase());
        if (!existing) return;
        await connection.query(`DROP ${existing.view ? "VIEW" : "TABLE"} IF EXISTS ${ident(existing.name)}`);
        built.delete(name.toLowerCase());
      }),

    async listFiles(dir) {
      // The same places queries may read: the folders of the registered tables and the connections' scopes.
      const everyFolder = [...new Set([...tables.values()].filter((t) => !isRemotePath(t.path)).map((t) => localFolder(t.path)))];
      // A table's folder inside another table's folder is reached through it, not listed twice.
      const localRoots = everyFolder.filter((folder) => !everyFolder.some((other) => other !== folder && folder.startsWith(other + path.sep)));
      const scopes = connections.map((c) => c.scope.replace(/\/+$/, ""));
      const tableAt = (where: string) => [...tables.values()].find((t) => (isRemotePath(t.path) ? t.path.replace(/\/+$/, "") === where : path.resolve(t.path) === where))?.name ?? "";
      if (!dir) {
        return {
          entries: [
            ...localRoots.map((root) => ({ name: path.basename(root) || root, path: root, kind: FileEntryKind.FOLDER, format: folderFormat(root), table: tableAt(root) })),
            ...scopes.map((scope) => ({ name: scope, path: scope, kind: FileEntryKind.FOLDER, format: TableFormat.UNSPECIFIED, table: tableAt(scope) })),
          ],
        };
      }
      if (isRemotePath(dir)) {
        const folder = dir.replace(/\/+$/, "");
        if (!scopes.some((scope) => folder === scope || folder.startsWith(`${scope}/`))) throw new EngineError("UNSUPPORTED", "That location is outside what this source may read.");
        // An object store has no folders: everything under the prefix is listed (up to a cap) and grouped by its next path part.
        const found = await withConnection(async (connection) => rows(await connection.query(`SELECT file FROM glob(${text(`${folder}/**`)}) LIMIT ${FILE_LIST_CAP + 1}`)));
        const folders = new Set<string>();
        const files: string[] = [];
        for (const row of found.slice(0, FILE_LIST_CAP)) {
          const rest = String(row.file).slice(folder.length + 1);
          const cut = rest.indexOf("/");
          if (cut < 0) files.push(rest);
          else folders.add(rest.slice(0, cut));
        }
        return {
          entries: [
            ...[...folders].sort().map((name) => ({ name, path: `${folder}/${name}`, kind: FileEntryKind.FOLDER, format: TableFormat.UNSPECIFIED, table: tableAt(`${folder}/${name}`) })),
            ...files.sort().map((name) => ({ name, path: `${folder}/${name}`, kind: FileEntryKind.FILE, format: fileFormat(name), table: tableAt(`${folder}/${name}`) })),
          ],
          truncated: found.length > FILE_LIST_CAP,
        };
      }
      // A local folder is read from disk, after checking where it really is: `..` and links cannot lead outside the roots.
      let real: string;
      try {
        real = fs.realpathSync(path.resolve(dir));
      } catch {
        throw new EngineError("UNSUPPORTED", "That folder does not exist.");
      }
      const inside = localRoots.some((root) => {
        const base = fs.existsSync(root) ? fs.realpathSync(root) : root;
        return real === base || real.startsWith(base + path.sep);
      });
      if (!inside) throw new EngineError("UNSUPPORTED", "That location is outside what this source may read.");
      if (!fs.statSync(real).isDirectory()) throw new EngineError("UNSUPPORTED", "That is a file, not a folder.");
      const names = fs.readdirSync(real, { withFileTypes: true }).filter((entry) => !entry.name.startsWith("."));
      const entries = names.slice(0, FILE_LIST_CAP).flatMap((entry) => {
        const full = path.join(real, entry.name);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(full);
        } catch {
          return [];
        }
        const folder = stat.isDirectory();
        return [
          {
            name: entry.name,
            path: full,
            kind: folder ? FileEntryKind.FOLDER : FileEntryKind.FILE,
            ...(folder ? {} : { sizeBytes: BigInt(stat.size) }),
            modifiedAt: stat.mtime.toISOString(),
            format: folder ? folderFormat(full) : fileFormat(entry.name),
            table: tableAt(full),
          },
        ];
      });
      entries.sort((a, b) => a.kind - b.kind || a.name.localeCompare(b.name));
      return { entries, truncated: names.length > FILE_LIST_CAP };
    },

    inspect: (format, location) =>
      withConnection(async (connection) => {
        const kind = FORMAT_NAME[format];
        if (!kind) throw new EngineError("UNSUPPORTED", "Choose Parquet, CSV, JSON, Delta or Iceberg.");
        if (!isRemotePath(location) && !path.isAbsolute(location)) throw new EngineError("UNSUPPORTED", "Give the full path, or an address such as s3://bucket/folder.");
        // The location is a quoted literal, and the engine's own access rules decide whether it may be read.
        const relation = scan({ name: "inspect", format: kind, path: location });
        const described = rows(await connection.query(`DESCRIBE SELECT * FROM ${relation}`));
        const schema = (await connection.query(`SELECT * FROM ${relation} LIMIT 0`)).schema;
        const counted = kind === "csv" || kind === "json" ? undefined : rows(await connection.query(`SELECT COUNT(*) AS n FROM ${relation}`))[0]?.n;
        return {
          columns: described.map((column, i) => ({
            name: String(column.column_name),
            nativeType: String(column.column_type),
            arrowType: String(schema.fields[i]?.type ?? ""),
            nullable: column.null !== "NO",
            ordinal: i + 1,
          })),
          rowCount: counted === undefined ? undefined : BigInt(counted as bigint | number),
        };
      }),

    dropStored: (relation) =>
      withConnection(async (connection) => {
        // Only names this adapter made are dropped.
        if (!relation.startsWith(`${ident(RESULTS)}."r_`)) return;
        await connection.query(`DROP TABLE IF EXISTS ${relation}`);
      }),

    listCatalogs: async () => [{ name: CATALOG }, ...catalogs.filter((c) => attached.has(c.name.toLowerCase())).map((c) => ({ name: c.name }))],

    async listSchemas(catalog) {
      if (!attached.has(catalog.toLowerCase())) return catalog === "" || catalog === CATALOG ? [{ catalog: CATALOG, name: SCHEMA }] : [];
      return withConnection(async (connection) => {
        const found = await connection.query(
          `SELECT schema_name AS name FROM information_schema.schemata WHERE catalog_name = ${text(catalog)} AND schema_name NOT IN ('information_schema') AND schema_name NOT LIKE 'pg\\_%' ESCAPE '\\' ORDER BY 1`,
        );
        return rows(found).map((r) => ({ catalog, name: String(r.name) }));
      });
    },

    async listTables({ catalog, schema, search }) {
      const needle = search.toLowerCase();
      const registered =
        catalog === "" || catalog === CATALOG
          ? [...tables.values()]
              .filter((t) => t.name.toLowerCase().includes(needle))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => ({
                ref: { catalog: CATALOG, schema: SCHEMA, table: t.name },
                kind: TableKind.EXTERNAL,
                format: FORMAT[t.format],
                comment: t.comment ?? "",
              }))
          : [];
      if (catalog === "" || catalog === CATALOG) {
        for (const item of [...built.values()].sort((a, b) => a.name.localeCompare(b.name))) {
          if (!item.name.toLowerCase().includes(needle)) continue;
          registered.push({ ref: { catalog: CATALOG, schema: SCHEMA, table: item.name }, kind: item.view ? TableKind.VIEW : TableKind.TABLE, format: TableFormat.UNSPECIFIED, comment: "Built by a pipeline" });
        }
      }
      const wanted = catalogs.filter((c) => attached.has(c.name.toLowerCase()) && (catalog === "" || c.name.toLowerCase() === catalog.toLowerCase()));
      if (wanted.length === 0) return registered;
      const kindOf = new Map(catalogs.map((c) => [c.name.toLowerCase(), c.kind]));
      // The engine filters and caps the list, so a catalog with very many tables is never read whole.
      const found = await withConnection((connection) =>
        connection.query(
          `SELECT table_catalog AS c, table_schema AS s, table_name AS t, table_type AS k FROM information_schema.tables WHERE table_catalog IN (${wanted.map((c) => text(c.name)).join(", ")})${schema ? ` AND table_schema = ${text(schema)}` : ""} AND table_schema NOT IN ('information_schema', ${text(RESULTS)}) AND table_schema NOT LIKE 'pg\\_%' ESCAPE '\\' AND lower(table_name) LIKE ${text(`%${needle.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`)} ESCAPE '\\' ORDER BY 1, 2, 3 LIMIT 5000`,
        ),
      );
      return [
        ...registered,
        ...rows(found).map((r) => ({
          ref: { catalog: String(r.c), schema: String(r.s), table: String(r.t) },
          kind: r.k === "VIEW" ? TableKind.VIEW : TableKind.TABLE,
          format: kindOf.get(String(r.c).toLowerCase()) === "iceberg-rest" ? TableFormat.ICEBERG : TableFormat.UNSPECIFIED,
          comment: "",
        })),
      ];
    },

    describeTable: (ref, includeStats) =>
      withConnection(async (connection) => {
        // A table named without its catalog is looked for in the attached ones, when it is not one of this source's own.
        if (!isAttached(ref) && attached.size > 0 && !tables.has((ref?.table ?? "").toLowerCase()) && !built.has((ref?.table ?? "").toLowerCase())) {
          const found = rows(
            await connection.query(
              `SELECT table_catalog AS c, table_schema AS s, table_name AS t FROM information_schema.tables WHERE table_catalog IN (${[...attached].map(text).join(", ")}) AND lower(table_name) = ${text((ref?.table ?? "").toLowerCase())}${ref?.schema ? ` AND table_schema = ${text(ref.schema)}` : ""} AND table_schema NOT LIKE 'pg\\_%' ESCAPE '\\' AND table_schema <> 'information_schema' LIMIT 2`,
            ),
          );
          if (found.length > 1) throw new EngineError("UNKNOWN_TABLE", `More than one table is called ${ref?.table}. Say which schema it is in.`);
          if (found.length === 1) ref = { ...ref, catalog: String(found[0]!.c), schema: String(found[0]!.s), table: String(found[0]!.t) } as TableRef;
        }
        if (isAttached(ref)) {
          const name = qualified(ref);
          const columns = rows(await connection.query(`DESCRIBE ${name}`));
          const schema = (await connection.query(`SELECT * FROM ${name} LIMIT 0`)).schema;
          const total = includeStats ? rows(await connection.query(`SELECT COUNT(*) AS n FROM ${name}`))[0]?.n : undefined;
          return {
            summary: { ref: { catalog: ref.catalog, schema: ref.schema, table: ref.table }, kind: TableKind.TABLE },
            columns: columns.map((column, i) => ({
              name: String(column.column_name),
              nativeType: String(column.column_type),
              arrowType: String(schema.fields[i]?.type ?? ""),
              nullable: column.null !== "NO",
              ordinal: i + 1,
            })),
            rowCount: total === undefined ? undefined : BigInt(total as bigint | number),
          };
        }
        const made = built.get((ref?.table ?? "").toLowerCase());
        if (made) {
          const columns = rows(await connection.query(`DESCRIBE ${ident(made.name)}`));
          const schema = (await connection.query(`SELECT * FROM ${ident(made.name)} LIMIT 0`)).schema;
          const total = includeStats ? rows(await connection.query(`SELECT COUNT(*) AS n FROM ${ident(made.name)}`))[0]?.n : undefined;
          return {
            summary: { ref: { catalog: CATALOG, schema: SCHEMA, table: made.name }, kind: made.view ? TableKind.VIEW : TableKind.TABLE, comment: "Built by a pipeline" },
            columns: columns.map((column, i) => ({
              name: String(column.column_name),
              nativeType: String(column.column_type),
              arrowType: String(schema.fields[i]?.type ?? ""),
              nullable: column.null !== "NO",
              ordinal: i + 1,
            })),
            rowCount: total === undefined ? undefined : BigInt(total as bigint | number),
          };
        }
        const table = lookup(ref);
        const described = rows(await connection.query(`DESCRIBE ${ident(table.name)}`));
        const arrow = (await connection.query(`SELECT * FROM ${ident(table.name)} LIMIT 0`)).schema;
        const count = includeStats
          ? rows(await connection.query(`SELECT COUNT(*) AS n FROM ${ident(table.name)}`))[0]?.n
          : undefined;
        return withTableModel({
          summary: {
            ref: { catalog: CATALOG, schema: SCHEMA, table: table.name },
            kind: TableKind.EXTERNAL,
            format: FORMAT[table.format],
            comment: table.comment ?? "",
          },
          columns: described.map((column, i) => ({
            name: String(column.column_name),
            nativeType: String(column.column_type),
            arrowType: String(arrow.fields[i]?.type ?? ""),
            nullable: column.null !== "NO",
            ordinal: i + 1,
          })),
          rowCount: count === undefined ? undefined : BigInt(count as bigint | number),
          location: table.path,
          properties: { format: table.format },
        }, table.model);
      }),

    async listSnapshots(ref) {
      if (isAttached(ref) || built.has((ref?.table ?? "").toLowerCase())) return [];
      const table = lookup(ref);
      if (table.format === "iceberg") {
        return withConnection(async (connection) => {
          const found = await connection.query(
            `SELECT CAST(snapshot_id AS VARCHAR) AS id, CAST(sequence_number AS VARCHAR) AS seq, strftime(timestamp_ms, '%Y-%m-%dT%H:%M:%S.%gZ') AS at FROM iceberg_snapshots(${icebergArgs(table.path, true)}) ORDER BY sequence_number DESC`,
          );
          return rows(found).map((s) => ({
            id: String(s.id),
            committedAt: String(s.at),
            operation: "",
            summary: { sequence_number: String(s.seq) },
          }));
        });
      }
      if (table.format === "delta") {
        const log = path.join(table.path, "_delta_log");
        const commits = fs.existsSync(log) ? fs.readdirSync(log).filter((f) => /^\d{20}\.json$/.test(f)) : [];
        return commits
          .sort()
          .reverse()
          .map((file) => {
            const info = fs
              .readFileSync(path.join(log, file), "utf8")
              .split("\n")
              .filter(Boolean)
              .map((line) => JSON.parse(line) as { commitInfo?: { timestamp?: number; operation?: string } })
              .find((entry) => entry.commitInfo)?.commitInfo;
            return {
              id: String(Number(file.slice(0, 20))),
              committedAt: info?.timestamp ? new Date(info.timestamp).toISOString() : "",
              operation: info?.operation ?? "",
            };
          });
      }
      return [];
    },

    version: () => withConnection(async (c) => String(rows(await c.query("SELECT version() AS v"))[0]?.v ?? "")),
    close: () => database.close(),
  };
}
