// Stands in for @surfaces-ui/components' SqlEditor in the page bundle: a plain
// text box with the same props, so the bundle leaves out CodeMirror (about a
// third of its size) and a page that shows an editor still works, without
// highlighting or completion.
import type { KeyboardEvent } from "react";

export type SqlEditorDialect = "standard" | "duckdb" | "postgres" | "teradata";

export interface SqlEditorError {
  message: string;
  line?: number;
  column?: number;
}

export interface SqlEditorProps {
  value: string;
  onChange(value: string): void;
  onRun?(sql: string): void;
  dialect?: SqlEditorDialect;
  schema?: Record<string, string[]>;
  readOnly?: boolean;
  error?: SqlEditorError;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  label?: string;
  className?: string;
}

export function SqlEditor({ value, onChange, onRun, readOnly, error, placeholder, minHeight = 120, maxHeight, label, className }: SqlEditorProps) {
  const run = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!onRun || event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    const box = event.currentTarget;
    onRun(box.selectionStart !== box.selectionEnd ? box.value.slice(box.selectionStart, box.selectionEnd) : box.value);
  };
  return (
    <div className={["sf-sql-editor", className].filter(Boolean).join(" ")}>
      <textarea
        className="sf-input"
        aria-label={label ?? "SQL editor"}
        aria-invalid={error ? true : undefined}
        spellCheck={false}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={run}
        style={{ width: "100%", minHeight, maxHeight, fontFamily: "var(--sf-font-mono)", resize: "vertical" }}
      />
      {error && (
        <p className="sf-sql-editor-error" role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}

/** Pages have no autocomplete, so there is nothing to load. */
export function useSqlSchema(_sourceId: string, _options?: unknown): Record<string, string[]> {
  return {};
}
