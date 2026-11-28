import { Fragment, type ReactNode, useMemo, useState } from "react";
import { highlight } from "./highlight.js";
import { resolveImageAddress, useImageResolver } from "./Image.js";

/** Only http(s) and mailto links are rendered as links; anything else stays text. */
function safeHref(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*|_[^_\n]+_)|(!\[[^\]\n]*\]\([^)\s]+\)|\[[^\]\n]+\]\([^)\s]+\))/g;

/** How a host takes part in links and images; every address is checked again as http(s) before use. */
interface Links {
  resolve?: (href: string) => string | undefined;
  image?: (src: string) => string | undefined;
  open?: (href: string) => boolean;
}

/** Inline Markdown as React nodes: code, bold, italic and links. Never produces HTML from the text. */
function inline(text: string, links: Links = {}): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    if (match[1]) out.push(<code key={key++}>{token.slice(1, -1)}</code>);
    else if (match[2]) out.push(<strong key={key++}>{inline(token.slice(2, -2), links)}</strong>);
    else if (match[3]) out.push(<em key={key++}>{inline(token.slice(1, -1), links)}</em>);
    else if (token.startsWith("!")) {
      // An image is drawn only when the host gives its address (`resolveImage`); otherwise its description stands in,
      // so text from a model cannot load an image from anywhere it likes.
      const split = token.indexOf("](");
      const alt = token.slice(2, split);
      const src = resolveImageAddress(links.image, token.slice(split + 2, -1));
      out.push(src ? <img key={key++} className="sf-markdown-image" src={src} alt={alt} loading="lazy" decoding="async" /> : alt);
    } else {
      const split = token.indexOf("](");
      const label = token.slice(1, split);
      const target = token.slice(split + 2, -1);
      // A host may turn its own links (a relative docs path, an anchor) into safe ones; the result is checked again.
      const href = safeHref(target) ?? (links.resolve ? safeHref(links.resolve(target) ?? "") : undefined);
      const open = links.open;
      out.push(
        href ? (
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            onClick={
              open &&
              ((event) => {
                // A plain click on a link the host keeps (a page of its own) stays in the app; any modifier opens a tab.
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                if (open(href)) event.preventDefault();
              })
            }
          >
            {inline(label, links)}
          </a>
        ) : (
          label
        ),
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; language: string; code: string }
  | { kind: "list"; ordered: boolean; items: string[]; start?: number }
  | { kind: "quote"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "rule" };

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

/** Splits Markdown into blocks. Text still arriving (an unclosed code fence, a half table) is handled. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i]!;
    const fence = /^\s*```(\S*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```\s*$/.test(lines[i]!); i++) body.push(lines[i]!);
      i++;
      blocks.push({ kind: "code", language: fence[1] ?? "", code: body.join("\n") });
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1]!.length, text: heading[2]! });
      i++;
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }
    if (line.includes("|") && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1] ?? "")) {
      const head = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i]!.includes("|") && lines[i]!.trim() !== ""; i++) rows.push(cells(lines[i]!));
      blocks.push({ kind: "table", head, rows });
      continue;
    }
    const bullet = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      const ordered = bullet[1] !== undefined;
      const items: string[] = [];
      for (; i < lines.length; i++) {
        const item = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/.exec(lines[i]!);
        if (item && (item[1] !== undefined) === ordered) items.push(item[2]!);
        else if (items.length > 0 && /^\s{2,}\S/.test(lines[i]!)) items[items.length - 1] += ` ${lines[i]!.trim()}`;
        else break;
      }
      // A numbered list broken by a code block carries on from its own number ("2." after the code).
      const start = ordered ? Number(bullet[1]) : undefined;
      blocks.push(start !== undefined && start !== 1 ? { kind: "list", ordered, items, start } : { kind: "list", ordered, items });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]!); i++) body.push(lines[i]!.replace(/^\s*>\s?/, ""));
      blocks.push({ kind: "quote", text: body.join(" ") });
      continue;
    }
    const body: string[] = [];
    for (; i < lines.length && lines[i]!.trim() !== "" && !/^\s*(```|#{1,6}\s|>|[-*+]\s|\d+[.)]\s)/.test(lines[i]!); i++) body.push(lines[i]!.trim());
    if (body.length === 0) body.push(lines[i++]!.trim());
    blocks.push({ kind: "paragraph", text: body.join(" ") });
  }
  return blocks;
}

export interface CodeBlockProps {
  code: string;
  /** Shown as a label, e.g. "sql". */
  language?: string;
  /** Shows a Run button for SQL and is called with the code. Nothing runs unless a person presses it. */
  onRun?(code: string): void;
  /** Accessible name for the block; defaults to the language. */
  label?: string;
  /** Hide the bar with the language and the Copy button, for code shown as part of a larger view. */
  bare?: boolean;
  className?: string;
}

/** Code as coloured tokens. Colours come from `--sf-code-*`, so they follow the theme. */
export function HighlightedCode({ code, language }: { code: string; language?: string }) {
  const tokens = useMemo(() => highlight(code, language), [code, language]);
  return (
    <code data-language={language || undefined}>
      {tokens.map((token, i) =>
        token.kind ? (
          <span key={i} className={`sf-tok-${token.kind}`}>
            {token.text}
          </span>
        ) : (
          <Fragment key={i}>{token.text}</Fragment>
        ),
      )}
    </code>
  );
}

/** A block of code with a copy button. */
export function CodeBlock({ code, language, onRun, label, bare, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };
  return (
    <div className={["sf-code", bare && "sf-code-bare", className].filter(Boolean).join(" ")}>
      {!bare && (
      <div className="sf-code-bar">
        <span>{language || "text"}</span>
        <span className="sf-code-actions">
          {onRun && (
            <button type="button" className="sf-button" onClick={() => onRun(code)}>
              Run
            </button>
          )}
          <button type="button" className="sf-button" onClick={copy} aria-live="polite">
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </div>
      )}
      <pre tabIndex={0} aria-label={label ?? (language ? `${language} code` : "Code")}>
        <HighlightedCode code={code} language={language} />
      </pre>
    </div>
  );
}

export interface MarkdownProps {
  /** Markdown text. May be incomplete while it streams in. */
  text: string;
  /** Called when a person presses Run on a SQL code block. Omit to show no Run button. */
  onRunSql?(sql: string): void;
  /** Render one line of inline Markdown (code, emphasis, links) in a span, for labels and descriptions. */
  inline?: boolean;
  /** The heading level a `#` becomes. Defaults to 3, so a reply never outranks the page's own headings. */
  headingStart?: number;
  /** Turns a link the text gives (such as a relative path) into a full http(s) address, or undefined to leave it as text. */
  resolveLink?(href: string): string | undefined;
  /**
   * Turns an image the text gives (`![alt](src)`) into the address to draw (http(s), a `blob:`, a raster `data:image/` or a
   * path on the same origin). Without it, or when it returns undefined, the image's description is shown instead. Left out,
   * the resolver given to `ImageResolverProvider` (or `SurfaceView`'s `resolveImage`) above is used.
   */
  resolveImage?(src: string): string | undefined;
  /** Called on a plain click on a link, with its full address; return true to handle it in the app, so it does not open a new tab. */
  openLink?(href: string): boolean;
  className?: string;
}

/**
 * Renders Markdown as React elements: headings, paragraphs, lists, quotes,
 * tables, code blocks, and inline code, emphasis and links. The text is never
 * inserted as HTML, so model output cannot add markup or scripts.
 */
export function Markdown({ text, onRunSql, inline: oneLine, headingStart = 3, resolveLink, resolveImage, openLink, className }: MarkdownProps) {
  const provided = useImageResolver();
  const links: Links = { resolve: resolveLink, image: resolveImage ?? provided, open: openLink };
  const line = (value: string) => inline(value, links);
  if (oneLine) return <span className={["sf-markdown-inline", className].filter(Boolean).join(" ")}>{line(text)}</span>;
  return (
    <div className={["sf-markdown", className].filter(Boolean).join(" ")}>
      {parseMarkdown(text).map((block, index) => {
        switch (block.kind) {
          case "heading": {
            // Headings start at h3 so a reply never outranks the page's own headings.
            const Tag = `h${Math.min(6, block.level + Math.max(0, Math.min(5, headingStart - 1)))}` as "h3";
            return <Tag key={index}>{line(block.text)}</Tag>;
          }
          case "code":
            return <CodeBlock key={index} code={block.code} language={block.language} onRun={onRunSql && /^sql$/i.test(block.language) ? onRunSql : undefined} />;
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag key={index} start={block.start}>
                {block.items.map((item, i) => (
                  <li key={i}>{line(item)}</li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return <blockquote key={index}>{line(block.text)}</blockquote>;
          case "rule":
            return <hr key={index} />;
          case "table":
            return (
              // A wide table scrolls sideways, so it can be focused and scrolled with the arrow keys.
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be reachable by keyboard.
              <div key={index} className="sf-markdown-table" tabIndex={0} role="region" aria-label={`Table: ${block.head.slice(0, 3).join(", ")}`}>
                <table>
                  <thead>
                    <tr>
                      {block.head.map((cell, i) => (
                        <th key={i} scope="col">
                          {line(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {block.head.map((_, c) => (
                          <td key={c}>{line(row[c] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <p key={index}>{line(block.text)}</p>;
        }
      })}
      <Fragment />
    </div>
  );
}
