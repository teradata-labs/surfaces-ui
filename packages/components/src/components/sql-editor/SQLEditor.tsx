/**
 * SQLEditor - Main SQL Editor component using MCP Bridge.
 *
 * Features:
 * - SQL input with syntax highlighting (Monaco Editor)
 * - Result display with charts, tables, and filtering
 * - MCP bridge integration for executing queries
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
 * This polling approach handles the async nature of tool execution in MCP Apps.
 */

import * as React from 'react';
import { Card, CardContent } from '../../primitives/card';
import { useMcpTool } from '../../bridge/hooks';
import { cn } from '../../lib/utils';

import { MonacoSQLInput } from './MonacoSQLInput';
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
  const [code, setCode] = React.useState(initialCode);
  const [result, setResult] = React.useState<SQLResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [resultsConfig, setResultsConfig] = React.useState<SQLResultsConfig | undefined>(undefined);

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
  React.useEffect(() => {
    if (lastResultData && lastResultData.query && lastResultData.output) {
      // Update code with the last executed query
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
        } else if (parsed.success !== undefined) {
          // Already in SQLResult format
          setResult(parsed);
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
        }
      }

      if (!lastResultData.success && lastResultData.error) {
        setError(lastResultData.error);
      }
    }
  }, [lastResultData, onCodeChange]);

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
        <MonacoSQLInput
          value={code}
          onChange={handleCodeChange}
          onExecute={handleExecute}
          disabled={isExecuting}
          readOnly={readOnly}
        />

        {resultData && (
          <div className="border-t border-border pt-4 min-h-[200px] max-h-[500px] overflow-auto">
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
        )}
      </CardContent>
    </Card>
  );
}
