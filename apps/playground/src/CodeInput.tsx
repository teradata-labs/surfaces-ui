import { HighlightedCode } from "@surfaces-ui/components";
import { useRef } from "react";

/**
 * A plain textarea with the same text drawn highlighted underneath it, so
 * typed JSON is coloured by the theme's code tokens. The textarea keeps
 * every native behaviour (undo, selection, screen readers); only its text
 * colour is made transparent. The box has a fixed height (drag its corner to
 * change it); the textarea scrolls and the highlighted copy follows it.
 */
export function CodeInput({ value, onChange, language, label, invalid }: { value: string; onChange(value: string): void; language: string; label: string; invalid?: boolean }) {
  const pre = useRef<HTMLPreElement>(null);
  return (
    <div className="code-input">
      <pre aria-hidden="true" ref={pre}>
        <HighlightedCode code={value.endsWith("\n") ? `${value} ` : value} language={language} />
      </pre>
      <textarea spellCheck={false} aria-label={label} aria-invalid={invalid || undefined} value={value} onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (!pre.current) return;
          pre.current.scrollTop = e.currentTarget.scrollTop;
          pre.current.scrollLeft = e.currentTarget.scrollLeft;
        }}
      />
    </div>
  );
}
