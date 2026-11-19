import type { MessageInitShape } from "@bufbuild/protobuf";
import { type DataSource, type QueryErrorInfo, collect, queryErrorInfo } from "@surfaces-ui/data";
import type { FilterSchema, Notice, SortSchema, TimeTravelSchema, ValueSchema } from "@surfaces-ui/proto";
import type { Field, Table } from "apache-arrow";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SortInit = MessageInitShape<typeof SortSchema>;
export type FilterInit = MessageInitShape<typeof FilterSchema>;
export type TimeTravelInit = MessageInitShape<typeof TimeTravelSchema>;
export type ValueInit = MessageInitShape<typeof ValueSchema>;

/** What to show: the user's SQL plus the view state applied on top of it. */
export interface RowWindowQuery {
  sourceId: string;
  sql: string;
  sorts?: SortInit[];
  filters?: FilterInit[];
  parameters?: ValueInit[];
  timeTravel?: TimeTravelInit;
  /**
   * ISO 8601 time of the run this view belongs to (e.g. when Run was
   * pressed). A backend that keeps results runs the query again when its
   * copy is older. Give every view of one run the same value.
   */
  notBefore?: string;
}

/** A result the backend kept, so views of it do not run the query again. */
export interface StoredInfo {
  /** ISO 8601 time the query ran; the data is as of then. */
  createdAt: string;
  rowCount: number;
}

export interface RowWindowOptions {
  /** Rows fetched per request. Defaults to 200. */
  blockSize?: number;
  /** Blocks kept in memory; the furthest from view are dropped first. Defaults to 60. */
  maxBlocks?: number;
}

export interface RowWindow {
  status: "loading" | "ready" | "error";
  error?: string;
  /** Code and position of the error in the SQL, when the backend reports them. */
  errorInfo?: QueryErrorInfo;
  /** Set when the rows come from a result the backend kept. */
  stored?: StoredInfo;
  /** Total rows the query returns, once known. */
  total: number | undefined;
  /** Result columns, once the first block has arrived. */
  fields: Field[];
  /** SQL the engine ran for the most recent block. */
  executedSql: string;
  notices: Notice[];
  /** Server time for the most recent block, in ms. */
  elapsedMs: number | undefined;
  /** A cell's value, or `undefined` while its block is not loaded (null is a real value). */
  getCell(row: number, column: number): unknown;
  isLoaded(row: number): boolean;
  /** Asks for rows [start, end) to be loaded. Cheap to call on every scroll. */
  ensure(start: number, end: number): void;
  /** Discards everything and loads again. */
  refresh(): void;
  /** Stops the queries in flight. The backend is told to stop too. */
  cancel(): void;
}

interface Store {
  blocks: Map<number, Table>;
  pending: Set<number>;
  controller: AbortController;
  wanted: [number, number];
  timer: ReturnType<typeof setTimeout> | undefined;
  counted: boolean;
}

const stringify = (value: unknown) => JSON.stringify(value, (_, v) => (typeof v === "bigint" ? `${v}n` : v));

/**
 * Loads a query's rows in blocks as they are needed and keeps a bounded cache,
 * so a grid can scroll over any number of rows while holding only what is
 * near the viewport. Every block is a separate paged query; the engine does
 * the sorting and filtering.
 */
export function useRowWindow(dataSource: DataSource, query: RowWindowQuery, options: RowWindowOptions = {}): RowWindow {
  const blockSize = options.blockSize ?? 200;
  const maxBlocks = options.maxBlocks ?? 60;
  const key = stringify(query);
  // The query object changes identity every render; the key decides when it really changed.
  const stable = useMemo(() => query, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const store = useRef<Store | undefined>(undefined);
  const [, setVersion] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState("");
  const notBefore = refreshedAt > (stable.notBefore ?? "") ? refreshedAt : (stable.notBefore ?? "");
  const [meta, setMeta] = useState<{
    status: RowWindow["status"];
    error?: string;
    errorInfo?: QueryErrorInfo;
    stored?: StoredInfo;
    total?: number;
    fields: Field[];
    executedSql: string;
    notices: Notice[];
    elapsedMs?: number;
  }>({ status: "loading", fields: [], executedSql: "", notices: [] });

  const load = useCallback(
    (block: number) => {
      const current = store.current;
      if (!current || current.blocks.has(block) || current.pending.has(block)) return;
      current.pending.add(block);
      const { controller } = current;
      collect(
        dataSource.execute(
          {
            sourceId: stable.sourceId,
            timeTravel: stable.timeTravel,
            notBefore,
            query: {
              baseSql: stable.sql,
              sorts: stable.sorts,
              filters: stable.filters,
              parameters: stable.parameters,
              page: { limit: blockSize, offset: BigInt(block * blockSize) },
            },
          },
          { signal: controller.signal },
        ),
      )
        .then((result) => {
          if (controller.signal.aborted) return;
          current.pending.delete(block);
          current.blocks.set(block, result.table);
          if (current.blocks.size > maxBlocks) {
            const centre = (current.wanted[0] + current.wanted[1]) / 2 / blockSize;
            const furthest = [...current.blocks.keys()].sort((a, b) => Math.abs(b - centre) - Math.abs(a - centre));
            for (const drop of furthest.slice(0, current.blocks.size - maxBlocks)) current.blocks.delete(drop);
          }
          const kept = result.header.stored;
          const stored = kept ? { createdAt: kept.createdAt, rowCount: Number(kept.rowCount) } : undefined;
          let total: number | undefined;
          if (block === 0 && !current.counted) {
            current.counted = true;
            // Counting is a query of its own, so it is skipped whenever the answer is already known.
            if (stored && (stable.filters?.length ?? 0) === 0) total = stored.rowCount;
            else if (result.table.numRows < blockSize) total = result.table.numRows;
            else {
              dataSource
                .count(
                  {
                    sourceId: stable.sourceId,
                    timeTravel: stable.timeTravel,
                    notBefore,
                    query: { baseSql: stable.sql, filters: stable.filters, parameters: stable.parameters },
                  },
                  { signal: controller.signal },
                )
                .then((response) => {
                  if (!controller.signal.aborted) setMeta((previous) => ({ ...previous, total: Number(response.rowCount) }));
                })
                .catch(() => {
                  // The rows are on screen; a failed count only leaves the total unknown.
                });
            }
          }
          setMeta((previous) => ({
            ...previous,
            status: "ready",
            stored,
            total: total ?? previous.total,
            fields: result.table.schema.fields,
            executedSql: result.header.executedSql,
            notices: result.header.notices,
            elapsedMs: Number(result.footer.elapsedMs),
          }));
          setVersion((v) => v + 1);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          current.pending.delete(block);
          const errorInfo = queryErrorInfo(error);
          setMeta((previous) => ({ ...previous, status: "error", error: errorInfo.message, errorInfo, fields: [], executedSql: "", notices: [] }));
        });
    },
    [dataSource, stable, blockSize, maxBlocks, notBefore],
  );

  useEffect(() => {
    const current: Store = {
      blocks: new Map(),
      pending: new Set(),
      controller: new AbortController(),
      wanted: [0, blockSize],
      timer: undefined,
      counted: false,
    };
    store.current = current;
    setMeta((previous) => ({ ...previous, status: "loading", error: undefined, errorInfo: undefined, total: undefined }));
    load(0);
    return () => {
      current.controller.abort();
      if (current.timer) clearTimeout(current.timer);
    };
  }, [dataSource, stable, blockSize, load]);

  const ensure = useCallback(
    (start: number, end: number) => {
      const current = store.current;
      if (!current) return;
      current.wanted = [start, end];
      if (current.timer) return;
      // A short delay means a fast scroll fetches where it lands, not every block it passes.
      current.timer = setTimeout(() => {
        current.timer = undefined;
        const [from, to] = current.wanted;
        const first = Math.max(0, Math.floor(from / blockSize));
        const last = Math.max(first, Math.floor(Math.max(to - 1, from) / blockSize));
        for (let block = first; block <= last; block++) load(block);
      }, 40);
    },
    [blockSize, load],
  );

  const getCell = useCallback(
    (row: number, column: number): unknown => {
      const table = store.current?.blocks.get(Math.floor(row / blockSize));
      if (!table) return undefined;
      const index = row % blockSize;
      if (index >= table.numRows) return undefined;
      return table.getChildAt(column)?.get(index) ?? null;
    },
    [blockSize],
  );

  const isLoaded = useCallback(
    (row: number) => {
      const table = store.current?.blocks.get(Math.floor(row / blockSize));
      return table !== undefined && row % blockSize < table.numRows;
    },
    [blockSize],
  );

  const refresh = useCallback(() => setRefreshedAt(new Date().toISOString()), []);
  const cancel = useCallback(() => {
    const current = store.current;
    if (!current || current.pending.size === 0) return;
    current.controller.abort();
    current.pending.clear();
    setMeta((previous) => ({ ...previous, status: "error", error: "Cancelled.", errorInfo: { message: "Cancelled.", code: "CANCELLED", line: 0, column: 0 }, fields: [], executedSql: "", notices: [] }));
  }, []);

  return {
    status: meta.status,
    error: meta.error,
    errorInfo: meta.errorInfo,
    stored: meta.stored,
    total: meta.total,
    fields: meta.fields,
    executedSql: meta.executedSql,
    notices: meta.notices,
    elapsedMs: meta.elapsedMs,
    getCell,
    isLoaded,
    ensure,
    refresh,
    cancel,
  };
}

/** A readable message from a failed call, without transport prefixes like "[invalid_argument]". */
export function messageOf(error: unknown): string {
  return queryErrorInfo(error).message;
}
