/**
 * MonacoSQLInput - SQL editor with Monaco Editor (VS Code editor)
 *
 * Features:
 * - Syntax highlighting for SQL
 * - IntelliSense / autocomplete
 * - Multi-cursor editing
 * - Find/replace
 * - Keyboard shortcuts (Ctrl+Enter to execute)
 * - Requires HTTP serving (not single-file HTML)
 */

import * as React from 'react';
import Editor from '@monaco-editor/react';
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
  const editorRef = React.useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;

    // Add Ctrl+Enter / Cmd+Enter keyboard shortcut to execute
    editor.addCommand(
      // monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter
      2048 | 3, // CtrlCmd + Enter
      () => {
        if (!disabled && !readOnly) {
          onExecute();
        }
      }
    );

    // Focus the editor
    editor.focus();
  };

  const handleChange = (newValue: string | undefined) => {
    onChange(newValue || '');
  };

  return (
    <div
      className={cn(
        'relative border border-border rounded-md overflow-hidden',
        'min-h-[100px] max-h-[300px]',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <Editor
        height="200px"
        defaultLanguage="sql"
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          wrappingIndent: 'same',
          fontSize: 14,
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          readOnly: readOnly || disabled,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          tabSize: 2,
          insertSpaces: true,
          contextmenu: true,
          // SQL-specific options
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
        }}
      />
      {!readOnly && (
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          Ctrl+Enter to execute
        </div>
      )}
    </div>
  );
}
