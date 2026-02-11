/**
 * CodeMirrorSQLInput - SQL editor using CodeMirror 6
 *
 * CodeMirror 6 works in sandboxed environments like Claude Desktop's MCP Apps
 * because it doesn't require web workers or external resources.
 *
 * Features:
 * - SQL syntax highlighting
 * - Line numbers
 * - Bracket matching
 * - Auto-indentation
 * - Search/replace
 * - Keyboard shortcuts (Ctrl+Enter to execute)
 * - Fully bundled (no CDN dependencies)
 */

import * as React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
import { cn } from '../../lib/utils';
import type { SQLInputProps } from './types';

export function CodeMirrorSQLInput({
  value,
  onChange,
  onExecute,
  disabled = false,
  readOnly = false,
  placeholder = 'Enter SQL query...',
}: SQLInputProps) {
  // Create keyboard shortcut for Ctrl+Enter / Cmd+Enter
  const executeKeymap = React.useMemo(() => {
    return keymap.of([
      {
        key: 'Mod-Enter', // Mod = Ctrl on Windows/Linux, Cmd on Mac
        run: () => {
          if (!disabled && !readOnly) {
            onExecute();
          }
          return true;
        },
      },
    ]);
  }, [disabled, readOnly, onExecute]);

  return (
    <div
      className={cn(
        'relative border border-border rounded-md overflow-hidden',
        'min-h-[100px]',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <CodeMirror
        value={value}
        minHeight="100px"
        theme={oneDark}
        extensions={[
          sql(),
          executeKeymap,
        ]}
        onChange={(value) => onChange(value)}
        editable={!disabled && !readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          searchKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
        placeholder={placeholder}
        className="codemirror-wrapper"
        style={{
          fontSize: '14px',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
        }}
      />
    </div>
  );
}
