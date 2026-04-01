/**
 * SQLEditor - Collapsible SQL editor with clause highlighting
 * Based on wireframe design from visual-explain-app.html
 */

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SQLHighlights, StepType } from './teradata-types';
import {
  executePromptAction,
  buildOptimizeQueryPrompt,
  buildCTERewritePrompt,
  buildCollectStatsPrompt,
} from './send-prompt-utils';

export interface SQLEditorProps {
  /** SQL text to display/edit */
  sql: string;

  /** Raw EXPLAIN text */
  rawExplain: string;

  /** Highlights map for active step */
  highlights?: SQLHighlights;

  /** Currently active step type (determines what to highlight) */
  activeStepType?: StepType | null;

  /** Initially collapsed */
  defaultOpen?: boolean;

  /** Query count meta info */
  queryCount?: number;
}

/** Escape HTML for safe injection */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function SQLEditor({
  sql,
  rawExplain,
  highlights,
  activeStepType,
  defaultOpen = false,
  queryCount,
}: SQLEditorProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [showRawExplain, setShowRawExplain] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const highlightRef = React.useRef<HTMLPreElement>(null);

  // Get highlighted SQL markup
  const highlightedSql = React.useMemo(() => {
    if (!highlights || !activeStepType) {
      return escapeHtml(sql);
    }

    const highlightText = activeStepType === 'lock' ? highlights.lock
      : activeStepType === 'agg' ? highlights.agg
      : activeStepType === 'sort' ? highlights.sort
      : activeStepType === 'return' ? highlights.return
      : activeStepType === 'retrieve' ? highlights.retrieve
      : activeStepType === 'scan' ? highlights.scan
      : undefined;

    if (!highlightText) {
      return escapeHtml(sql);
    }

    const escapedSql = escapeHtml(sql);
    const escapedHighlight = escapeHtml(highlightText);

    // Replace highlight text with <mark> wrapper
    return escapedSql.replace(escapedHighlight, `<mark>${escapedHighlight}</mark>`);
  }, [sql, highlights, activeStepType]);

  const handleOptimize = () => {
    executePromptAction(buildOptimizeQueryPrompt(sql));
  };

  const handleRewriteCTE = () => {
    executePromptAction(buildCTERewritePrompt(sql));
  };

  const handleCollectStats = () => {
    executePromptAction(buildCollectStatsPrompt(sql));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="border-t border-border bg-card flex-shrink-0">
      {/* Summary (Collapsed State) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted hover:bg-muted/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          📄 SQL editor
          {queryCount && (
            <span className="text-[11px] text-muted-foreground font-normal">
              {queryCount} {queryCount === 1 ? 'query' : 'queries'} loaded
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            isOpen && 'transform rotate-180',
          )}
        />
      </button>

      {/* Editor Body (Expanded State) */}
      {isOpen && (
        <div className="p-3 flex flex-col gap-2.5">
          {/* SQL Textarea with Highlight Overlay */}
          <div className="relative border border-border rounded-lg overflow-hidden bg-card">
            {/* Highlight layer (behind) */}
            <pre
              ref={highlightRef}
              className="absolute top-0 left-0 right-0 font-mono text-xs leading-relaxed p-3 pointer-events-none whitespace-pre-wrap break-words text-transparent z-[1]"
              dangerouslySetInnerHTML={{ __html: highlightedSql }}
              style={{
                // Sync height with textarea
                minHeight: textareaRef.current?.offsetHeight || '100px',
              }}
            />

            {/* Textarea (on top, transparent bg) */}
            <textarea
              ref={textareaRef}
              value={sql}
              readOnly
              spellCheck={false}
              className="relative w-full min-h-[100px] p-3 font-mono text-xs leading-relaxed border-none outline-none bg-transparent text-foreground resize-y z-[2] caret-foreground"
              style={{
                // Transparent bg to show highlight layer
                background: 'transparent',
              }}
            />

            {/* Mark tag styling via global CSS */}
            <style>
              {`
                .relative pre mark {
                  background: rgba(239, 159, 39, 0.28);
                  color: transparent;
                  border-radius: 2px;
                  padding: 1px 0;
                }
              `}
            </style>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleOptimize}
              className="text-xs px-3 py-1.5 border border-border bg-card rounded-lg hover:bg-muted transition-colors"
            >
              Optimize ↗
            </button>
            <button
              onClick={handleRewriteCTE}
              className="text-xs px-3 py-1.5 border border-border bg-card rounded-lg hover:bg-muted transition-colors"
            >
              Rewrite as CTE ↗
            </button>
            <button
              onClick={handleCollectStats}
              className="text-xs px-3 py-1.5 border border-border bg-card rounded-lg hover:bg-muted transition-colors"
            >
              Collect STATS ↗
            </button>
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 border border-border bg-card rounded-lg hover:bg-muted transition-colors"
            >
              Copy
            </button>
          </div>

          {/* Raw EXPLAIN Nested Collapsible */}
          <div className="border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowRawExplain(!showRawExplain)}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-muted hover:bg-muted/80 transition-colors text-xs text-muted-foreground"
            >
              <span>Raw EXPLAIN output</span>
              <ChevronDown
                className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  showRawExplain && 'transform rotate-180',
                )}
              />
            </button>
            {showRawExplain && (
              <pre className="font-mono text-[11px] leading-relaxed p-3 bg-muted whitespace-pre-wrap break-words text-muted-foreground max-h-[150px] overflow-y-auto">
                {rawExplain}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
