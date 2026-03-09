/**
 * CellCodeMirror – CodeMirror 6 editor for NotebookCell.
 *
 * Uses the same stack already in the project (@uiw/react-codemirror):
 *   - SQL syntax via @codemirror/lang-sql
 *   - Markdown syntax via @codemirror/lang-markdown
 *   - Python syntax via @codemirror/lang-python
 *   - Covalent highlight theme with light/dark mode via CSS custom properties
 *
 * The component is deliberately thin – it wires value/onChange,
 * language extensions, and the Shift+Enter → run shortcut.
 */

import * as React from 'react';
import CodeMirror, { type ReactCodeMirrorProps } from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { keymap, EditorView } from '@codemirror/view';
import { type Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { NotebookCellType } from './NotebookCell';

/* ── Figma-matched highlight theme ──────────────────────────────────── */

/**
 * Uses CSS custom properties so colours adapt to light/dark mode.
 *
 * Light (Atom One Light – from Figma light frame):
 *   Keywords → #a626a4   Text → #383a42   Strings → #377e22
 *   Numbers → #986801    Comments → #a0a1a7   Links → #4078f2
 *
 * Dark (Atom One Dark – from Figma dark frame):
 *   Keywords → #c678dd   Text → #abb2bf   Strings → #98c379
 *   Numbers → #d19a66    Comments → #5c6370   Links → #61afef
 */
const covalentHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--cm-keyword)' },
  { tag: tags.operatorKeyword, color: 'var(--cm-keyword)' },
  { tag: tags.modifier, color: 'var(--cm-keyword)' },
  { tag: tags.controlKeyword, color: 'var(--cm-keyword)' },
  { tag: tags.definitionKeyword, color: 'var(--cm-keyword)' },
  { tag: tags.typeOperator, color: 'var(--cm-keyword)' },
  { tag: [tags.name, tags.variableName, tags.propertyName], color: 'var(--cm-text)' },
  { tag: tags.string, color: 'var(--cm-string)' },
  { tag: tags.number, color: 'var(--cm-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--cm-comment)', fontStyle: 'italic' },
  { tag: tags.operator, color: 'var(--cm-text)' },
  { tag: tags.punctuation, color: 'var(--cm-text)' },
  { tag: [tags.heading, tags.heading1, tags.heading2, tags.heading3], color: 'var(--cm-keyword)', fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.link, color: 'var(--cm-link)', textDecoration: 'underline' },
]);

const covalentTheme: Extension = syntaxHighlighting(covalentHighlightStyle);

/* ── Language map ────────────────────────────────────────────────────── */

/** Returns the appropriate CodeMirror language extension. */
function langExtension(type: NotebookCellType, language?: string): Extension {
  if (language === 'python') return python();
  if (type === 'markdown') return markdown();
  return sql(); // default for code cells
}

/* ── Component ───────────────────────────────────────────────────────── */

export interface CellCodeMirrorProps {
  /** Cell type (determines default language) */
  type: NotebookCellType;
  /** Editor value */
  value: string;
  /** Called on every edit */
  onChange?: (value: string) => void;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Run callback wired to Shift+Enter */
  onRun?: () => void;
  /** Explicit language override (e.g. 'python', 'sql', 'markdown') */
  language?: string;
  /** Additional CodeMirror extensions */
  extensions?: Extension[];
  /** Minimum height (CSS value) */
  minHeight?: string;
  /** Pass-through props for @uiw/react-codemirror */
  cmProps?: Partial<ReactCodeMirrorProps>;
}

export function CellCodeMirror({
  type,
  value,
  onChange,
  editable = true,
  onRun,
  language,
  extensions: extraExtensions = [],
  minHeight = '24px',
  cmProps,
}: CellCodeMirrorProps) {
  const runKeymap = React.useMemo(() => {
    return keymap.of([
      {
        key: 'Shift-Enter',
        run: () => {
          onRun?.();
          return true;
        },
      },
    ]);
  }, [onRun]);

  // Set aria-label on the contenteditable .cm-content element via CM6 API
  const ariaLabel = React.useMemo(
    () =>
      EditorView.contentAttributes.of({
        'aria-label': `${type} cell input`,
      }),
    [type],
  );

  const extensions = React.useMemo<Extension[]>(
    () => [
      langExtension(type, language),
      covalentTheme,
      ariaLabel,
      ...(onRun ? [runKeymap] : []),
      ...extraExtensions,
    ],
    [type, language, ariaLabel, runKeymap, onRun, extraExtensions],
  );

  return (
    <div className="cell-codemirror">
      <CodeMirror
        value={value}
        onChange={onChange}
        editable={editable}
        extensions={extensions}
        minHeight={minHeight}
        basicSetup={{
          lineNumbers: false,
          highlightActiveLineGutter: false,
          foldGutter: false,
          highlightActiveLine: false,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          indentOnInput: true,
          searchKeymap: true,
        }}
        placeholder={type === 'code' ? 'Enter code...' : 'Enter markdown...'}
        style={{
          fontSize: '16px',
          lineHeight: '24px',
          fontFamily:
            type === 'code'
              ? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
              : 'inherit',
        }}
        theme="none"
        {...cmProps}
      />
    </div>
  );
}
