import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { PostgreSQL, type SQLDialect, StandardSQL, sql } from "@codemirror/lang-sql";
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { type Diagnostic, setDiagnostics } from "@codemirror/lint";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers, placeholder as placeholderText } from "@codemirror/view";
import type { DataSource } from "@surfaces-ui/data";
import { tags } from "@lezer/highlight";
import { useEffect, useRef, useState } from "react";
import { useDataSource } from "../data/DataSourceProvider.js";

export type SqlEditorDialect = "standard" | "duckdb" | "postgres" | "teradata";

export interface SqlEditorError {
  message: string;
  /** 1-based position in the text; 0 or missing marks the whole first line. */
  line?: number;
  column?: number;
}

export interface SqlEditorProps {
  value: string;
  onChange(value: string): void;
  /** Called on Cmd/Ctrl+Enter with the selected text, or all of it when nothing is selected. */
  onRun?(sql: string): void;
  dialect?: SqlEditorDialect;
  /** Tables and their columns, for autocomplete. See `useSqlSchema`. */
  schema?: Record<string, string[]>;
  readOnly?: boolean;
  /** Marks a problem in the text, e.g. from a failed query. */
  error?: SqlEditorError;
  placeholder?: string;
  /** Minimum height in px. Defaults to 120. The editor grows with its content up to `maxHeight`. */
  minHeight?: number;
  maxHeight?: number;
  /** Accessible name. Defaults to "SQL editor". */
  label?: string;
  className?: string;
}

const DIALECTS: Record<SqlEditorDialect, SQLDialect> = {
  standard: StandardSQL,
  teradata: StandardSQL,
  duckdb: PostgreSQL,
  postgres: PostgreSQL,
};

// Every colour is a theme variable, so the editor follows ThemeProvider with no re-creation.
const theme = EditorView.theme({
  "&": { color: "var(--sf-color-text)", backgroundColor: "var(--sf-color-bg)", fontSize: "var(--sf-font-size)" },
  "&.cm-focused": { outline: "2px solid var(--sf-color-focus)", outlineOffset: "-1px" },
  ".cm-content": { fontFamily: "var(--sf-font-mono)", caretColor: "var(--sf-color-text)", padding: "var(--sf-space-2) 0" },
  ".cm-scroller": { fontFamily: "var(--sf-font-mono)", lineHeight: "1.6" },
  ".cm-gutters": { backgroundColor: "var(--sf-color-surface)", color: "var(--sf-color-muted)", border: "none" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--sf-color-surface) 60%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--sf-color-text)" },
  ".cm-cursor": { borderLeftColor: "var(--sf-color-text)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--sf-color-accent-soft)",
  },
  ".cm-matchingBracket": { backgroundColor: "var(--sf-color-accent-soft)", outline: "1px solid var(--sf-color-border-strong)" },
  ".cm-placeholder": { color: "var(--sf-color-muted)" },
  ".cm-tooltip": {
    backgroundColor: "var(--sf-color-surface)",
    color: "var(--sf-color-text)",
    border: "1px solid var(--sf-color-border-strong)",
    borderRadius: "var(--sf-radius)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--sf-color-accent)",
    color: "var(--sf-color-on-accent)",
  },
  ".cm-diagnostic-error": { borderLeftColor: "var(--sf-color-danger)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--sf-color-danger)",
    textUnderlineOffset: "3px",
  },
});

// The same theme tokens as every other code block (--sf-code-*), so the editor changes with the theme.
const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword], color: "var(--sf-code-keyword)", fontWeight: "600" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--sf-code-string)" },
  { tag: [tags.number], color: "var(--sf-code-number)" },
  { tag: [tags.bool, tags.null], color: "var(--sf-code-literal)" },
  { tag: [tags.comment], color: "var(--sf-code-comment)", fontStyle: "italic" },
  { tag: [tags.typeName, tags.standard(tags.name)], color: "var(--sf-code-type)" },
  { tag: [tags.function(tags.variableName), tags.function(tags.name)], color: "var(--sf-code-function)" },
  { tag: [tags.propertyName, tags.special(tags.name)], color: "var(--sf-code-property)" },
  { tag: [tags.punctuation, tags.operator, tags.bracket], color: "var(--sf-code-punctuation)" },
]);

/**
 * A SQL editor (CodeMirror 6) with syntax highlighting, schema-aware
 * autocomplete, run on Cmd/Ctrl+Enter and inline error marking. Dropping a
 * table or column dragged from SchemaExplorer inserts its name.
 */
export function SqlEditor(props: SqlEditorProps) {
  const { value, dialect = "standard", schema, readOnly = false, error, minHeight = 120, maxHeight = 480 } = props;
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | undefined>(undefined);
  const language = useRef(new Compartment());
  const editable = useRef(new Compartment());
  // Handlers change every render; the editor reads the latest through a ref.
  const handlers = useRef(props);
  handlers.current = props;

  useEffect(() => {
    if (!host.current) return;
    const run = (target: EditorView) => {
      const { from, to } = target.state.selection.main;
      const text = from === to ? target.state.doc.toString() : target.state.sliceDoc(from, to);
      handlers.current.onRun?.(text);
      return true;
    };
    const created = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: handlers.current.value,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          highlightActiveLine(),
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": handlers.current.label ?? "SQL editor" }),
          placeholderText(handlers.current.placeholder ?? ""),
          Prec.highest(keymap.of([{ key: "Mod-Enter", run }])),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
          language.current.of(sql({ dialect: DIALECTS[dialect], schema, upperCaseKeywords: true })),
          editable.current.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) handlers.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = created;
    return () => {
      created.destroy();
      view.current = undefined;
    };
    // The editor is created once; later prop changes are applied by the effects below.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const current = view.current;
    if (current && current.state.doc.toString() !== value) {
      current.dispatch({ changes: { from: 0, to: current.state.doc.length, insert: value } });
    }
  }, [value]);

  const schemaKey = JSON.stringify(schema ?? {});
  useEffect(() => {
    view.current?.dispatch({
      effects: language.current.reconfigure(sql({ dialect: DIALECTS[dialect], schema, upperCaseKeywords: true })),
    });
  }, [dialect, schemaKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
    });
  }, [readOnly]);

  useEffect(() => {
    const current = view.current;
    if (!current) return;
    const diagnostics: Diagnostic[] = [];
    if (error) {
      const doc = current.state.doc;
      const line = doc.line(Math.max(1, Math.min(doc.lines, error.line || 1)));
      const from = error.line ? Math.min(line.to, line.from + Math.max(0, (error.column ?? 1) - 1)) : line.from;
      const to = error.line ? Math.min(line.to, Math.max(from + 1, current.state.wordAt(from)?.to ?? from + 1)) : line.to;
      diagnostics.push({ from, to: Math.max(to, from), severity: "error", message: error.message });
    }
    current.dispatch(setDiagnostics(current.state, diagnostics));
  }, [error?.message, error?.line, error?.column, value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={host}
      className={["sf-editor", props.className].filter(Boolean).join(" ")}
      style={{ minHeight, maxHeight }}
      data-readonly={readOnly || undefined}
    />
  );
}

/**
 * Loads table and column names from a source for the editor's autocomplete.
 * Describes at most `maxTables` tables so very large catalogs stay cheap.
 */
export function useSqlSchema(sourceId: string, options: { dataSource?: DataSource; maxTables?: number } = {}): Record<string, string[]> {
  const dataSource = useDataSource(options.dataSource);
  const maxTables = options.maxTables ?? 50;
  const [schema, setSchema] = useState<Record<string, string[]>>({});
  useEffect(() => {
    let current = true;
    (async () => {
      const { tables } = await dataSource.listTables({ sourceId });
      const names = tables.map((t) => t.ref?.table ?? "").filter(Boolean);
      const described = await Promise.all(
        names.slice(0, maxTables).map(async (table) => {
          const detail = await dataSource.describeTable({ sourceId, ref: { table } }).catch(() => undefined);
          return [table, detail?.table?.columns.map((c) => c.name) ?? []] as const;
        }),
      );
      if (current) setSchema({ ...Object.fromEntries(names.map((n) => [n, [] as string[]])), ...Object.fromEntries(described) });
    })().catch(() => {});
    return () => {
      current = false;
    };
  }, [dataSource, sourceId, maxTables]);
  return schema;
}
