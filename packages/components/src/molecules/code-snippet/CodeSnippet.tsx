import * as React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Covalent syntax-highlighting theme.
 *
 * Uses CSS custom properties from tokens.css (--cm-keyword, --cm-string, etc.)
 * so the palette automatically adapts to light / dark mode.
 */
const covalentTheme: Record<string, React.CSSProperties> = {
  'code[class*="language-"]': {
    color: 'var(--cm-text)',
    background: 'none',
    fontFamily: 'inherit',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: 'inherit',
    tabSize: 2,
  },
  'pre[class*="language-"]': {
    color: 'var(--cm-text)',
    background: 'none',
    fontFamily: 'inherit',
    textAlign: 'left',
    whiteSpace: 'pre',
    wordSpacing: 'normal',
    wordBreak: 'normal',
    wordWrap: 'normal',
    lineHeight: 'inherit',
    tabSize: 2,
    padding: 0,
    margin: 0,
    overflow: 'auto',
  },
  // Comments
  comment: { color: 'var(--cm-comment)' },
  prolog: { color: 'var(--cm-comment)' },
  doctype: { color: 'var(--cm-comment)' },
  cdata: { color: 'var(--cm-comment)' },
  // Punctuation
  punctuation: { color: 'var(--cm-text)' },
  // Keywords & tags
  property: { color: 'var(--cm-keyword)' },
  tag: { color: 'var(--cm-keyword)' },
  keyword: { color: 'var(--cm-keyword)' },
  'attr-name': { color: 'var(--cm-keyword)' },
  builtin: { color: 'var(--cm-keyword)' },
  // Numbers & constants
  boolean: { color: 'var(--cm-number)' },
  number: { color: 'var(--cm-number)' },
  constant: { color: 'var(--cm-number)' },
  symbol: { color: 'var(--cm-number)' },
  entity: { color: 'var(--cm-number)' },
  'class-name': { color: 'var(--cm-number)' },
  // Strings
  selector: { color: 'var(--cm-string)' },
  string: { color: 'var(--cm-string)' },
  char: { color: 'var(--cm-string)' },
  inserted: { color: 'var(--cm-string)' },
  'attr-value': { color: 'var(--cm-string)' },
  regex: { color: 'var(--cm-string)' },
  // Functions & links
  function: { color: 'var(--cm-link)' },
  url: { color: 'var(--cm-link)' },
  // General
  operator: { color: 'var(--cm-text)' },
  variable: { color: 'var(--cm-text)' },
  important: { color: 'var(--cm-keyword)', fontWeight: 'bold' },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
};

/** Map common file extensions to Prism language identifiers */
const EXT_LANG_MAP: Record<string, string> = {
  sql: 'sql',
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  sh: 'bash',
  bash: 'bash',
  md: 'markdown',
};

export interface CodeSnippetProps {
  /** Code content to display */
  code: string;
  /** Language for syntax highlighting (e.g. "sql", "javascript", "python") */
  language?: string;
  /** Filename shown in header (overrides language label) */
  filename?: string;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Show copy button */
  copyable?: boolean;
  /** Allow editing the code content */
  editable?: boolean;
  /** Called when editable code changes */
  onCodeChange?: (code: string) => void;
  /** Max height before scrolling */
  maxHeight?: string;
  className?: string;
}

const CodeSnippet = React.forwardRef<HTMLDivElement, CodeSnippetProps>(
  (
    {
      code,
      language,
      filename,
      showLineNumbers = false,
      copyable = true,
      editable = false,
      onCodeChange,
      maxHeight,
      className,
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    // Sync textarea scroll with the highlight layer
    const handleScroll = React.useCallback(() => {
      if (textareaRef.current && scrollRef.current) {
        scrollRef.current.scrollTop = textareaRef.current.scrollTop;
        scrollRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }, []);

    const handleCopy = async () => {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const headerLabel = filename || language;

    // Resolve highlight language: explicit language prop, or infer from filename extension
    const inferredLang = React.useMemo(() => {
      if (language) return language.toLowerCase();
      if (filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        if (ext && ext in EXT_LANG_MAP) return EXT_LANG_MAP[ext];
      }
      return undefined;
    }, [language, filename]);
    const highlightLanguage = inferredLang;

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl bg-surface overflow-hidden',
          className
        )}
      >
        {/* Header */}
        {(headerLabel || copyable) && (
          <div className="flex items-center justify-between h-16 px-4 border-b border-su-outline-variant">
            {headerLabel && (
              <span className="text-base font-medium text-on-surface-variant font-mono">
                {headerLabel}
              </span>
            )}
            {copyable && (
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy code'}
                className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-foreground transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-success" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Code body */}
        <div
          className="overflow-auto"
          style={maxHeight ? { maxHeight } : undefined}
        >
          {editable && highlightLanguage ? (
            /* Editable + highlighted: transparent textarea over syntax-highlighted pre */
            <div className="relative min-h-24">
              {/* Highlight layer (behind) */}
              <div
                ref={scrollRef}
                aria-hidden
                className="absolute inset-0 overflow-hidden pointer-events-none"
              >
                <SyntaxHighlighter
                  language={highlightLanguage}
                  style={covalentTheme}
                  showLineNumbers={false}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: 'transparent',
                    fontSize: '0.75rem',
                    lineHeight: '1.25rem',
                  }}
                  codeTagProps={{
                    style: { fontFamily: 'inherit' },
                  }}
                  PreTag="pre"
                  className="font-mono"
                >
                  {/* Append a trailing newline so the highlight layer matches textarea height */}
                  {code + '\n'}
                </SyntaxHighlighter>
              </div>
              {/* Input layer (on top, transparent text) */}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => onCodeChange?.(e.target.value)}
                onScroll={handleScroll}
                spellCheck={false}
                className={cn(
                  'relative w-full resize-none bg-transparent p-4',
                  'text-xs font-mono leading-5',
                  'outline-none border-none',
                  'min-h-24 text-transparent caret-foreground',
                  'selection:bg-primary/20',
                )}
                style={{ tabSize: 2 }}
                rows={Math.max(code.split('\n').length + 1, 3)}
              />
            </div>
          ) : editable ? (
            /* Editable without highlighting: plain textarea */
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => onCodeChange?.(e.target.value)}
              spellCheck={false}
              className={cn(
                'w-full resize-none bg-transparent p-4',
                'text-xs font-mono leading-5 text-foreground',
                'outline-none border-none',
                'min-h-24',
              )}
              style={{ tabSize: 2 }}
              rows={Math.max(code.split('\n').length, 3)}
            />
          ) : highlightLanguage ? (
            <SyntaxHighlighter
              language={highlightLanguage}
              style={covalentTheme}
              showLineNumbers={showLineNumbers}
              lineNumberStyle={{
                minWidth: '2rem',
                paddingRight: '1rem',
                textAlign: 'right',
                userSelect: 'none',
                opacity: 0.5,
                color: 'var(--cm-comment)',
              }}
              customStyle={{
                margin: 0,
                padding: '1rem',
                background: 'transparent',
                fontSize: '0.75rem',
                lineHeight: '1.25rem',
              }}
              codeTagProps={{
                style: { fontFamily: 'inherit' },
              }}
              PreTag="pre"
              className="font-mono"
            >
              {code}
            </SyntaxHighlighter>
          ) : (
            <pre className="p-4 text-xs font-mono text-foreground leading-5">
              <code>
                {showLineNumbers
                  ? code.split('\n').map((line, i) => (
                      <div key={i} className="flex">
                        <span className="select-none w-8 shrink-0 text-right pr-4 text-on-surface-variant/50">
                          {i + 1}
                        </span>
                        <span>{line}</span>
                      </div>
                    ))
                  : code}
              </code>
            </pre>
          )}
        </div>
      </div>
    );
  }
);
CodeSnippet.displayName = 'CodeSnippet';

export { CodeSnippet };
