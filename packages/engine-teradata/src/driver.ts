import { EngineError } from "@surfaces-ui/engine";
import { type SessionSettings, type TeradataClient, type TeradataResult, sessionStatements } from "./client.js";
import { teradataError } from "./errors.js";

/**
 * The parts of a database driver's cursor this transport uses. It is the
 * shape of the `teradatasql` driver's cursor (`execute`, `fetchall`,
 * `description`, `close`); calls may answer directly or with a promise.
 */
export interface DriverCursor {
  execute(sql: string, params?: unknown[]): unknown;
  fetchall(): unknown;
  /**
   * Up to `count` more rows, and none once the result is read. When a cursor
   * has it, rows are read a batch at a time with a pause between, because a
   * driver's `fetchall` can hold the whole process still while it reads a
   * large result (the `teradatasql` driver's does).
   */
  fetchmany?(count: number): unknown;
  /** One entry per column: `[name, type, ...]` or `{ name, type }`. */
  readonly description?: unknown;
  close(): unknown;
}

/** Rows read per batch when a cursor can be read in batches. */
const FETCH_BATCH = 2000;

/** Every row of a cursor's result. Read in batches when the cursor allows, letting other work run between them. */
async function fetched(cursor: DriverCursor): Promise<unknown[][]> {
  if (typeof cursor.fetchmany !== "function") return ((await cursor.fetchall()) as unknown[][] | null) ?? [];
  const rows: unknown[][] = [];
  for (;;) {
    const batch = ((await cursor.fetchmany(FETCH_BATCH)) as unknown[][] | null) ?? [];
    if (batch.length === 0) return rows;
    for (const row of batch) rows.push(row);
    await new Promise<void>((resume) => setImmediate(resume));
  }
}

export interface DriverConnection {
  cursor(): DriverCursor | Promise<DriverCursor>;
  close(): unknown;
}

const described = (entry: unknown): { name: string; type: string } => {
  const [name, type] = Array.isArray(entry) ? (entry as unknown[]) : [(entry as { name?: unknown } | null)?.name, (entry as { type?: unknown } | null)?.type];
  // With `column_type: "true"`, teradatasql puts the type after a tab in the name: "amount\tDECIMAL(18,2)".
  const text = String(name ?? "");
  const tab = text.indexOf("\t");
  if (tab >= 0) return { name: text.slice(0, tab), type: text.slice(tab + 1).trim() };
  // A driver may give a type as a name or as something of its own; only a name is used.
  return { name: text, type: typeof type === "string" ? type : "" };
};

/**
 * A transport over a connection the consumer opens with a driver they have
 * installed themselves, for example:
 *
 *   driverClient(() => teradatasql.connect({ host, user, password: process.env.TD_PASSWORD }))
 *
 * This package never imports a driver. The consumer's own code holds the
 * credential and should read it from the environment or a vault, not from
 * configuration.
 *
 * The connection is opened on first use, set to UTC with a query band, and
 * runs one statement at a time. A running statement cannot be interrupted
 * through this shape; a cancelled query is abandoned when it returns.
 */
export function driverClient(connect: () => DriverConnection | Promise<DriverConnection>, settings: SessionSettings = {}): TeradataClient {
  let connection: Promise<DriverConnection> | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  const run = async (target: DriverConnection, sql: string, params: unknown[]): Promise<TeradataResult> => {
    const cursor = await target.cursor();
    try {
      await cursor.execute(sql, params.length > 0 ? params : undefined);
      const columns = Array.isArray(cursor.description) ? cursor.description.map(described) : [];
      return { columns, rows: columns.length > 0 ? await fetched(cursor) : [] };
    } catch (error) {
      if (error instanceof EngineError) throw error;
      throw teradataError(undefined, error instanceof Error ? error.message : String(error));
    } finally {
      await Promise.resolve(cursor.close()).catch(() => {});
    }
  };

  const open = (): Promise<DriverConnection> => {
    connection ??= (async () => {
      let target: DriverConnection;
      try {
        target = await connect();
      } catch {
        // A driver's connection error can repeat the connection settings, so its text is not passed on.
        throw new EngineError("ENGINE", "The connection to Teradata could not be opened. Check the host, the user and the credential on the server.");
      }
      for (const statement of sessionStatements(settings)) await run(target, statement, []);
      return target;
    })();
    connection.catch(() => {
      connection = undefined;
    });
    return connection;
  };

  return {
    query(sql, params, options = {}) {
      const next = queue.then(async () => {
        if (options.signal?.aborted) throw new EngineError("CANCELLED", "The query was cancelled.");
        const result = await run(await open(), sql, params);
        if (options.signal?.aborted) throw new EngineError("CANCELLED", "The query was cancelled.");
        return result;
      });
      queue = next.catch(() => {});
      return next;
    },
    async close() {
      const pending = connection;
      connection = undefined;
      if (!pending) return;
      await queue;
      try {
        await (await pending).close();
      } catch {
        // Already closed.
      }
    },
  };
}
