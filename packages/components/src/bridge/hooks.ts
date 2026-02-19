/**
 * MCP Bridge Hooks
 *
 * Custom React hooks that provide ergonomic access to MCP tool calls
 * with built-in loading, error, and pagination state management.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMcpBridge } from './McpBridgeProvider';

// ---------------------------------------------------------------------------
// useMcpTool
// ---------------------------------------------------------------------------

export interface UseMcpToolOptions {
  /** Whether to automatically fetch on mount and when args change. Default true. */
  enabled?: boolean;
  /** Interval in ms to refetch automatically. 0 or undefined to disable. */
  refetchInterval?: number;
}

export interface UseMcpToolResult<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Generic hook for calling an MCP tool with automatic loading/error state.
 *
 * Automatically fetches on mount when `enabled` is true (default).
 * Supports periodic refetching via `refetchInterval`.
 *
 * @param toolName - Name of the MCP tool to call
 * @param args - Optional arguments to pass to the tool
 * @param options - Options controlling fetch behavior
 *
 * @example
 * ```tsx
 * function SystemStatus() {
 *   const { data, loading, error } = useMcpTool<SystemInfo>('get_system_status');
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *   return <StatusDisplay info={data} />;
 * }
 * ```
 */
export function useMcpTool<T = unknown>(
  toolName: string,
  args?: Record<string, unknown>,
  options?: UseMcpToolOptions,
): UseMcpToolResult<T> {
  const { bridge } = useMcpBridge();
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = options?.enabled ?? true;
  const refetchInterval = options?.refetchInterval ?? 0;

  // Track the latest args by serialized value to detect changes
  const argsRef = useRef(args);
  const argsKey = JSON.stringify(args);

  // Keep argsRef in sync
  useEffect(() => {
    argsRef.current = args;
  }, [argsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track whether the component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await bridge.callTool<T>(toolName, argsRef.current);

      if (!mountedRef.current) return;

      if (result.success) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error ?? 'Unknown error');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [bridge, toolName, argsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch on mount and when args change
  useEffect(() => {
    if (enabled) {
      void fetchData();
    }
  }, [enabled, fetchData]);

  // Periodic refetch
  useEffect(() => {
    if (!enabled || refetchInterval <= 0) return;

    const interval = setInterval(() => {
      void fetchData();
    }, refetchInterval);

    return () => clearInterval(interval);
  }, [enabled, refetchInterval, fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// ---------------------------------------------------------------------------
// useMcpPagination
// ---------------------------------------------------------------------------

export interface UseMcpPaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  pageCount: number;
  loading: boolean;
  error: string | null;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
  refetch: () => Promise<void>;
}

/**
 * Pagination hook for list-based MCP tool calls.
 *
 * Manages page state, fetches the appropriate page via `fetchPage`,
 * and provides navigation controls.
 *
 * @param toolName - Name of the MCP tool that returns paginated data
 * @param pageSize - Number of items per page
 * @param filters - Optional filters to apply to the query
 *
 * @example
 * ```tsx
 * function QueryList() {
 *   const { data, page, pageCount, loading, nextPage, prevPage } =
 *     useMcpPagination<Query>('list_queries', 20, { status: 'running' });
 *
 *   return (
 *     <>
 *       {data.map(q => <QueryRow key={q.id} query={q} />)}
 *       <button onClick={prevPage} disabled={page === 0}>Prev</button>
 *       <span>Page {page + 1} of {pageCount}</span>
 *       <button onClick={nextPage} disabled={page >= pageCount - 1}>Next</button>
 *     </>
 *   );
 * }
 * ```
 */
export function useMcpPagination<T = unknown>(
  toolName: string,
  pageSize: number,
  filters?: Record<string, unknown>,
): UseMcpPaginationResult<T> {
  const { bridge } = useMcpBridge();
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtersKey = JSON.stringify(filters);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const pageCount = total > 0 ? Math.ceil(total / pageSize) : 0;

  const fetchPageData = useCallback(
    async (targetPage: number) => {
      if (!mountedRef.current) return;

      setLoading(true);
      setError(null);

      try {
        const result = await bridge.fetchPage<T>(toolName, {
          offset: targetPage * pageSize,
          limit: pageSize,
          filters: filtersRef.current,
        });

        if (!mountedRef.current) return;

        setData(result.rows);
        setTotal(result.total);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Unexpected error');
        setData([]);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [bridge, toolName, pageSize, filtersKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Fetch when page, pageSize, toolName, or filters change
  useEffect(() => {
    void fetchPageData(page);
  }, [page, fetchPageData]);

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [filtersKey]);

  const nextPage = useCallback(() => {
    setPage((prev) => {
      const maxPage = pageCount > 0 ? pageCount - 1 : 0;
      return Math.min(prev + 1, maxPage);
    });
  }, [pageCount]);

  const prevPage = useCallback(() => {
    setPage((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToPage = useCallback(
    (targetPage: number) => {
      const maxPage = pageCount > 0 ? pageCount - 1 : 0;
      setPage(Math.max(0, Math.min(targetPage, maxPage)));
    },
    [pageCount],
  );

  const refetch = useCallback(async () => {
    await fetchPageData(page);
  }, [fetchPageData, page]);

  return {
    data,
    total,
    page,
    pageCount,
    loading,
    error,
    nextPage,
    prevPage,
    goToPage,
    refetch,
  };
}

// ---------------------------------------------------------------------------
// useMcpStream
// ---------------------------------------------------------------------------

export interface UseMcpStreamResult<T> {
  chunks: T[];
  isStreaming: boolean;
  error: string | null;
  start: (args?: Record<string, unknown>) => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Streaming hook for long-running MCP operations that produce incremental results.
 *
 * Accumulates chunks as they arrive and provides controls to start, stop, and reset.
 *
 * @param toolName - Name of the MCP tool to stream from
 *
 * @example
 * ```tsx
 * function LogViewer() {
 *   const { chunks, isStreaming, start, stop, reset } =
 *     useMcpStream<LogEntry>('stream_logs');
 *
 *   return (
 *     <>
 *       <button onClick={() => start({ level: 'error' })}>Start</button>
 *       <button onClick={stop} disabled={!isStreaming}>Stop</button>
 *       <button onClick={reset}>Clear</button>
 *       {chunks.map((entry, i) => <LogLine key={i} entry={entry} />)}
 *     </>
 *   );
 * }
 * ```
 */
export function useMcpStream<T = unknown>(
  toolName: string,
): UseMcpStreamResult<T> {
  const { bridge } = useMcpBridge();
  const [chunks, setChunks] = useState<T[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeStreamRef = useRef<{
    id: number;
    unsubscribe: () => void;
  } | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cleanup any active stream on unmount
      if (activeStreamRef.current) {
        activeStreamRef.current.unsubscribe();
        bridge.cancelStream(activeStreamRef.current.id);
        activeStreamRef.current = null;
      }
    };
  }, [bridge]);

  const start = useCallback(
    (args?: Record<string, unknown>) => {
      // Stop any existing stream first
      if (activeStreamRef.current) {
        activeStreamRef.current.unsubscribe();
        bridge.cancelStream(activeStreamRef.current.id);
        activeStreamRef.current = null;
      }

      setError(null);
      setIsStreaming(true);

      const { id, result } = bridge.startStream<T>(toolName, args);

      // Subscribe to chunks for this stream
      const unsubscribe = bridge.onStreamChunk(id, (chunk) => {
        if (mountedRef.current) {
          setChunks((prev) => [...prev, chunk as T]);
        }
      });

      activeStreamRef.current = { id, unsubscribe };

      // Handle stream completion
      void result.then((finalResult) => {
        if (!mountedRef.current) return;

        if (activeStreamRef.current?.id === id) {
          activeStreamRef.current.unsubscribe();
          activeStreamRef.current = null;
        }

        setIsStreaming(false);

        if (!finalResult.success && finalResult.error) {
          setError(finalResult.error);
        }
      });
    },
    [bridge, toolName],
  );

  const stop = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.unsubscribe();
      bridge.cancelStream(activeStreamRef.current.id);
      activeStreamRef.current = null;
    }
    setIsStreaming(false);
  }, [bridge]);

  const reset = useCallback(() => {
    // Stop if streaming
    if (activeStreamRef.current) {
      activeStreamRef.current.unsubscribe();
      bridge.cancelStream(activeStreamRef.current.id);
      activeStreamRef.current = null;
    }
    setChunks([]);
    setIsStreaming(false);
    setError(null);
  }, [bridge]);

  return { chunks, isStreaming, error, start, stop, reset };
}
