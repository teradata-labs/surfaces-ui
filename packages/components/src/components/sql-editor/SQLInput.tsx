/**
 * SQLInput - Textarea input for SQL code with keyboard shortcuts.
 */

import * as React from 'react';
import { cn } from '../../lib/utils';
import type { SQLInputProps } from './types';

export function SQLInput({
  value,
  onChange,
  onExecute,
  disabled = false,
  readOnly = false,
  placeholder = 'Enter SQL query...',
}: SQLInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!disabled && !readOnly) {
          onExecute();
        }
      }
    },
    [disabled, readOnly, onExecute]
  );

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 80), 300)}px`;
    }
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        aria-label="SQL query input"
        aria-describedby="sql-input-hint"
        className={cn(
          'w-full min-h-[80px] max-h-[300px] resize-none',
          'px-4 py-3 font-mono text-sm',
          'bg-muted/30 border border-border rounded-md',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          readOnly && 'cursor-default'
        )}
      />
      {!readOnly && (
        <div
          id="sql-input-hint"
          className="absolute bottom-2 right-2 text-xs text-muted-foreground"
        >
          Ctrl+Enter to execute
        </div>
      )}
    </div>
  );
}
