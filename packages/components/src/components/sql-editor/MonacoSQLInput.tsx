/**
 * MonacoSQLInput - SQL editor with syntax highlighting
 *
 * Features:
 * - Syntax highlighting for SQL (using Prism)
 * - Line numbers
 * - Keyboard shortcuts (Ctrl+Enter to execute)
 * - Works in single-file HTML bundles
 */

import * as React from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism-tomorrow.css';
import { cn } from '../../lib/utils';
import type { SQLInputProps } from './types';

export function MonacoSQLInput({
  value,
  onChange,
  onExecute,
  disabled = false,
  readOnly = false,
  placeholder = 'Enter SQL query...',
}: SQLInputProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to execute
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!disabled && !readOnly) {
          onExecute();
        }
      }
    },
    [disabled, readOnly, onExecute]
  );

  const highlight = React.useCallback((code: string) => {
    return Prism.highlight(code, Prism.languages.sql, 'sql');
  }, []);

  return (
    <div
      ref={editorRef}
      className={cn(
        'relative border border-border rounded-md overflow-hidden',
        'min-h-[100px] max-h-[300px] overflow-auto',
        disabled && 'opacity-50 pointer-events-none'
      )}
      onKeyDown={handleKeyDown}
    >
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={highlight}
        padding={12}
        disabled={disabled || readOnly}
        placeholder={placeholder}
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          fontSize: 14,
          minHeight: '100px',
          backgroundColor: 'rgb(45, 45, 45)',
          color: 'rgb(204, 204, 204)',
        }}
        textareaClassName="focus:outline-none"
      />
      {!readOnly && (
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          Ctrl+Enter to execute
        </div>
      )}
    </div>
  );
}
