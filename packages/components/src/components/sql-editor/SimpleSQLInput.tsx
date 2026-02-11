/**
 * SimpleSQLInput - Simple textarea-based SQL editor
 *
 * A lightweight SQL editor that works in any environment, including
 * Claude Desktop's sandboxed MCP Apps iframe. No external dependencies.
 *
 * Features:
 * - Syntax-aware monospace textarea
 * - Tab key support for indentation
 * - Ctrl+Enter / Cmd+Enter to execute
 * - Auto-resizing
 */

import * as React from 'react';
import { cn } from '../../lib/utils';
import type { SQLInputProps } from './types';

export function SimpleSQLInput({
  value,
  onChange,
  onExecute,
  disabled = false,
  readOnly = false,
  placeholder = 'Enter SQL query...',
}: SQLInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!disabled && !readOnly) {
        onExecute();
      }
      return;
    }

    // Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Auto-focus on mount
  React.useEffect(() => {
    if (textareaRef.current && !readOnly) {
      textareaRef.current.focus();
    }
  }, [readOnly]);

  return (
    <div
      className={cn(
        'relative border border-border rounded-md overflow-hidden',
        'min-h-[100px]',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        className={cn(
          'w-full h-full min-h-[200px] resize-y',
          'px-3 py-3',
          'bg-background text-foreground',
          'font-mono text-sm leading-relaxed',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
          'placeholder:text-muted-foreground',
          readOnly && 'cursor-default'
        )}
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '14px',
          lineHeight: '1.6',
          tabSize: 2,
        }}
      />
    </div>
  );
}
