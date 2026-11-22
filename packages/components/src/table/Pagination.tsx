import { numberFormat, label as text } from "../locale/locale.js";

export interface PaginationProps {
  /** Where this page starts, counting from 0. */
  offset: number;
  /** How many rows a page holds. */
  pageSize: number;
  /** How many rows there are in all. */
  total: number;
  /** Asked for with the offset of the page a person moves to. The host fetches it. */
  onChange(offset: number): void;
  /** Names the navigation for assistive technology. Defaults to "Pages". */
  label?: string;
  /** A page is being fetched: Previous and Next wait. */
  busy?: boolean;
  className?: string;
}

/**
 * Which rows are shown, "51–100 of 126", with Previous and Next. For a list a host pages on its server; it holds no
 * page of its own. Nothing is drawn when every row fits on one page.
 */
export function Pagination({ offset, pageSize, total, onChange, label, busy, className }: PaginationProps) {
  if (total <= pageSize && offset === 0) return null;
  const size = Math.max(1, Math.trunc(pageSize));
  const number = (n: number) => numberFormat().format(n);
  const from = total === 0 ? 0 : Math.min(offset + 1, total);
  const to = Math.min(offset + size, total);
  return (
    <nav className={["sf-pagination", className].filter(Boolean).join(" ")} aria-label={label ?? text("pages.label")}>
      <span className="sf-pagination-range" aria-live="polite">
        {text("pages.range", { from: number(from), to: number(to), total: number(total) })}
      </span>
      <button type="button" className="sf-button" disabled={busy || offset <= 0} onClick={() => onChange(Math.max(0, offset - size))}>
        {text("pages.previous")}
      </button>
      <button type="button" className="sf-button" disabled={busy || offset + size >= total} onClick={() => onChange(offset + size)}>
        {text("pages.next")}
      </button>
    </nav>
  );
}
