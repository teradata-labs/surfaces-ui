/**
 * Debug Panel - Shows console logs in UI for MCP apps
 * (since browser DevTools aren't accessible in Claude Desktop)
 */

import * as React from 'react';

interface LogEntry {
  id: number;
  timestamp: Date;
  args: unknown[];
}

export function DebugPanel() {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = React.useState(true);
  const logIdRef = React.useRef(0);

  React.useEffect(() => {
    // Intercept console.log
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      // Call original
      originalLog(...args);

      // Capture for UI
      setLogs(prev => [...prev, {
        id: logIdRef.current++,
        timestamp: new Date(),
        args,
      }].slice(-50)); // Keep last 50 logs
    };

    return () => {
      console.log = originalLog;
    };
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 px-3 py-2 bg-muted border border-border rounded-lg text-xs z-50"
      >
        Show Debug Logs
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-[600px] max-h-[400px] bg-card border border-border rounded-lg shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-foreground">Debug Console ({logs.length})</span>
        <div className="flex gap-2">
          <button
            onClick={() => setLogs([])}
            className="text-xs px-2 py-1 hover:bg-muted rounded"
          >
            Clear
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs px-2 py-1 hover:bg-muted rounded"
          >
            Close
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] leading-relaxed">
        {logs.map(log => (
          <div key={log.id} className="mb-1 text-foreground">
            <span className="text-muted-foreground">
              {log.timestamp.toLocaleTimeString()}.{log.timestamp.getMilliseconds()}
            </span>
            {' '}
            {log.args.map((arg, idx) => (
              <span key={idx}>
                {typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)}
                {idx < log.args.length - 1 ? ' ' : ''}
              </span>
            ))}
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-muted-foreground text-center py-4">
            No logs yet
          </div>
        )}
      </div>
    </div>
  );
}
