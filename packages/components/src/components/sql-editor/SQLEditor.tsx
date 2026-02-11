/**
 * SQLEditor - Main SQL Editor component using MCP Bridge.
 *
 * Features:
 * - SQL input with syntax highlighting (CodeMirror)
 * - Result display with charts, tables, and filtering
 * - MCP bridge integration for executing queries
 * - State persistence (SQL query, results, UI state)
 *
 * ## MCP Apps Timing Behavior
 *
 * When used in MCP Apps context (Claude Desktop), there's a timing challenge:
 * Claude Desktop loads the UI *before* executing the SQL query. This means
 * the UI cannot rely on query parameters being passed in the resource URI.
 *
 * Solution: The UI polls `get_last_result` every 500ms for up to 5 seconds.
 * Once the SQL executes (typically within 1 second), the next poll retrieves
 * the result and populates the editor with the executed SQL and results.
 *
 * ## State Persistence
 *
 * State priority (highest to lowest):
 * 1. Fresh data from thread context (via get_last_result polling)
 * 2. Persisted state from localStorage (for reopening threads)
 *
 * When fresh data arrives from the thread, it replaces persisted state.
 * State is kept in localStorage for 24 hours. When you reopen the conversation,
 * the editor restores your last query and results until fresh data arrives.
 */

import * as React from 'react';
import { Card, CardContent } from '../../primitives/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../primitives/collapsible';
import { useMcpTool } from '../../bridge/hooks';
import { cn } from '../../lib/utils';

import { CodeMirrorSQLInput } from './CodeMirrorSQLInput';
import { SQLToolbar } from './SQLToolbar';
import { SQLResultsDisplay } from '../sql-results/SQLResultsDisplay';
import type { SQLResultsConfig, SQLResultsAction } from '../sql-results/types';
import type { SQLEditorProps, SQLResult } from './types';

export interface SQLEditorExtendedProps extends SQLEditorProps {
  /** Project ID for "Open in Teradata" deep link */
  projectId?: string;
  /** Base URL for Teradata app (default: http://localhost:8080) */
  teradataBaseUrl?: string;
  /** Runtime context for portability */
  context?: 'web' | 'mcp-apps';
  /** Custom actions for the results toolbar */
  customActions?: SQLResultsAction[];
}

// Type for the last result response from vantage-mcp
interface LastResultResponse {
  query?: string;
  output?: string;
  success?: boolean;
  error?: string;
  timestamp?: string;
}

// Type for persisted state in localStorage
interface PersistedState {
  code: string;
  result: SQLResult | null;
  error: string | null;
  editorOpen: boolean;
  resultsOpen: boolean;
  timestamp: number;
}

const STORAGE_KEY = 'teradata-sql-editor-state';
const STATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function SQLEditor({
  initialCode = '',
  title = 'SQL Editor',
  onCodeChange,
  onExecutionComplete,
  autoExecute = false,
  connectionId,
  className,
  readOnly = false,
  projectId,
  teradataBaseUrl,
  context = 'web',
  customActions,
}: SQLEditorExtendedProps) {
  // Load persisted state on mount
  const loadPersistedState = React.useCallback((): Partial<PersistedState> | null => {
    if (context !== 'mcp-apps' || typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const state: PersistedState = JSON.parse(stored);
      const age = Date.now() - state.timestamp;

      // Ignore stale state (older than 24 hours)
      if (age > STATE_TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return state;
    } catch (err) {
      console.warn('Failed to load persisted SQL editor state:', err);
      return null;
    }
  }, [context]);

  const persistedState = loadPersistedState();

  const [code, setCode] = React.useState(persistedState?.code || initialCode);
  const [result, setResult] = React.useState<SQLResult | null>(persistedState?.result || null);
  const [error, setError] = React.useState<string | null>(persistedState?.error || null);
  const [resultsConfig, setResultsConfig] = React.useState<SQLResultsConfig | undefined>(undefined);
  const [editorOpen, setEditorOpen] = React.useState(persistedState?.editorOpen ?? true);
  const [resultsOpen, setResultsOpen] = React.useState(persistedState?.resultsOpen ?? false);

  const {
    data: mcpResult,
    loading: isExecuting,
    error: mcpError,
    refetch: executeSql,
  } = useMcpTool<SQLResult>('execute_sql', { query: code, connection_id: connectionId }, {
    enabled: false,
  });

  // Fetch last result from vantage-mcp when in MCP Apps context
  // This shows Claude's query results in the UI automatically
  // Note: 'get_last_result' is mapped to 'teradata_get_last_result' by the bridge
  const {
    data: lastResultData,
    refetch: fetchLastResult,
  } = useMcpTool<LastResultResponse>('get_last_result', {}, {
    enabled: false,
  });

  // Fetch last result on mount in MCP Apps context with polling
  // Polls every 500ms for up to 5 seconds to handle the timing issue where
  // Claude Desktop loads the UI before executing the SQL query
  React.useEffect(() => {
    if (context !== 'mcp-apps') return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 500;

    const pollForResult = async () => {
      if (cancelled || attempts >= maxAttempts) return;

      attempts++;
      await fetchLastResult();

      // Schedule another poll if we haven't cancelled or exceeded max attempts
      setTimeout(() => {
        if (!cancelled && attempts < maxAttempts) {
          pollForResult();
        }
      }, pollInterval);
    };

    // Start polling after small delay to ensure bridge is connected
    const initialTimer = setTimeout(pollForResult, 200);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
    };
  }, [context, fetchLastResult]);

  // Process last result when received
  // This takes precedence over persisted state - fresh data from the thread
  React.useEffect(() => {
    if (lastResultData && lastResultData.query && lastResultData.output) {
      // Update code with the last executed query from thread context
      setCode(lastResultData.query);
      onCodeChange?.(lastResultData.query);

      // Parse the output to extract result data
      try {
        const parsed = JSON.parse(lastResultData.output);
        // Transform vantage-mcp format { columns, rows } to SQLResult format
        if (parsed.columns && parsed.rows) {
          const columns = parsed.columns as string[];
          const rows = parsed.rows as unknown[][];
          const data = rows.map((row) => {
            const rowObj: Record<string, unknown> = {};
            columns.forEach((col, i) => {
              rowObj[col] = i < row.length ? row[i] : null;
            });
            return rowObj;
          });
          setResult({
            success: true,
            columns,
            data,
            row_count: data.length,
          });
          // Auto-collapse editor and expand results when results arrive
          setEditorOpen(false);
          setResultsOpen(true);
        } else if (parsed.success !== undefined) {
          // Already in SQLResult format
          setResult(parsed);
          // Auto-collapse editor and expand results when results arrive
          setEditorOpen(false);
          setResultsOpen(true);
        }
      } catch {
        // If output is not JSON, show as success message
        if (lastResultData.success) {
          setResult({
            success: true,
            columns: [],
            data: [],
            row_count: 0,
            message: lastResultData.output,
          });
          // Auto-collapse editor and expand results when results arrive
          setEditorOpen(false);
          setResultsOpen(true);
        }
      }

      if (!lastResultData.success && lastResultData.error) {
        setError(lastResultData.error);
      }

      // Clear persisted state since we have fresh data from the thread
      if (context === 'mcp-apps' && typeof window !== 'undefined') {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
          console.warn('Failed to clear persisted state:', err);
        }
      }
    }
  }, [lastResultData, onCodeChange, context]);

  React.useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  React.useEffect(() => {
    if (mcpResult) {
      setResult(mcpResult);
      setError(mcpResult.error ?? null);
      onExecutionComplete?.(mcpResult);
    }
  }, [mcpResult, onExecutionComplete]);

  React.useEffect(() => {
    if (mcpError) {
      setError(mcpError);
      setResult(null);
    }
  }, [mcpError]);

  React.useEffect(() => {
    if (autoExecute && code.trim()) {
      const timer = setTimeout(() => executeSql(), 100);
      return () => clearTimeout(timer);
    }
  }, [autoExecute]);

  // Persist state to localStorage whenever it changes
  React.useEffect(() => {
    if (context !== 'mcp-apps' || typeof window === 'undefined') return;

    try {
      const state: PersistedState = {
        code,
        result,
        error,
        editorOpen,
        resultsOpen,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to persist SQL editor state:', err);
    }
  }, [context, code, result, error, editorOpen, resultsOpen]);

  const handleCodeChange = React.useCallback((newCode: string) => {
    setCode(newCode);
    onCodeChange?.(newCode);
  }, [onCodeChange]);

  const handleExecute = React.useCallback(() => {
    if (!code.trim() || isExecuting) return;
    setError(null);
    executeSql();
  }, [code, isExecuting, executeSql]);

  const handleClear = React.useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const handleConfigChange = React.useCallback((config: SQLResultsConfig) => {
    setResultsConfig(config);
  }, []);

  const hasResult = result !== null;
  const hasError = !!error || (result?.success === false);

  // Build result data for SQLResultsDisplay
  const resultData = React.useMemo(() => {
    if (!result) return null;
    return {
      success: result.success,
      columns: result.columns,
      data: result.data,
      row_count: result.row_count,
      error: error || result.error,
    };
  }, [result, error]);

  return (
    <Card className={cn('overflow-visible', className)}>
      <SQLToolbar
        title={title}
        isExecuting={isExecuting}
        hasResult={hasResult && !hasError}
        hasError={hasError}
        onExecute={handleExecute}
        onClear={handleClear}
      />

      <CardContent className="p-4 space-y-4">
        {/* Editor Section - Collapsible */}
        <Collapsible open={editorOpen} onOpenChange={setEditorOpen}>
          <CollapsibleTrigger className="mb-2 px-2 py-1 rounded hover:bg-muted">
            <span className="flex items-center gap-2">
              <span className={cn(
                'transition-transform',
                editorOpen ? 'rotate-90' : ''
              )}>▶</span>
              <span>SQL Query Editor</span>
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CodeMirrorSQLInput
              value={code}
              onChange={handleCodeChange}
              onExecute={handleExecute}
              disabled={isExecuting}
              readOnly={readOnly}
            />
          </CollapsibleContent>
        </Collapsible>

        {/* Results Section - Collapsible */}
        {resultData && (
          <Collapsible open={resultsOpen} onOpenChange={setResultsOpen}>
            <CollapsibleTrigger className="mb-2 px-2 py-1 rounded hover:bg-muted border-t border-border pt-4">
              <span className="flex items-center gap-2">
                <span className={cn(
                  'transition-transform',
                  resultsOpen ? 'rotate-90' : ''
                )}>▶</span>
                <span>Query Results</span>
                {result?.row_count !== undefined && (
                  <span className="text-muted-foreground text-xs">
                    ({result.row_count} rows)
                  </span>
                )}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="min-h-[100px] max-h-[800px] overflow-auto">
                <SQLResultsDisplay
                  data={resultData}
                  sql={code}
                  savedConfig={resultsConfig}
                  onConfigChange={handleConfigChange}
                  actions={customActions}
                  context={context}
                  projectId={projectId}
                  teradataBaseUrl={teradataBaseUrl}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
