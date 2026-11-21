import { type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ControlIcon } from "../controls/ItemControls.js";

export interface SideNavItem {
  id: string;
  label: string;
  /** Where the item goes. Without one the item is a button and only `onSelect` is called. */
  href?: string;
}

export interface SideNavGroup {
  /** A heading over the group's items. */
  label?: string;
  items: SideNavItem[];
}

export interface SideNavProps {
  /** What the navigation is for, for assistive technology: "Playground". */
  label: string;
  groups: SideNavGroup[];
  /** The id of the item for the page being shown. */
  current?: string;
  onSelect?(id: string): void;
  /** Whether the navigation stays open beside the page. Give it with `onPinnedChange` to hold it yourself. */
  pinned?: boolean;
  /** Whether it starts pinned when it holds the state itself. Defaults to true. */
  defaultPinned?: boolean;
  onPinnedChange?(pinned: boolean): void;
  /** Shown above the items: a name, a status, a picker. */
  header?: ReactNode;
  /** Shown below the items. */
  footer?: ReactNode;
  className?: string;
}

/** Below this width the navigation is always folded away: docked beside a phone's page it would leave the page no room. */
export const SIDENAV_NARROW = "(max-width: 40rem)";

const narrowQuery = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(SIDENAV_NARROW) : undefined);

/** The width, in rem, under which whatever holds the navigation is too narrow to dock it beside the page. */
const NARROW_REM = 40;
/** The least room, in px each way, a drawer needs: in a smaller box it takes the window instead. */
export const SIDENAV_LEAST = 240;

/** A box on screen, in px from the window's top left. */
export interface NavBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Where a folded navigation's drawer goes: the part of its holder that is on screen. Nothing (the whole window) when
 * the holder is not laid out, is off screen, or shows less than `least` px either way.
 */
export function drawerBox(holder: NavBox | undefined, viewport: { width: number; height: number }, least = SIDENAV_LEAST): NavBox | undefined {
  if (!holder) return undefined;
  const top = Math.max(holder.top, 0);
  const left = Math.max(holder.left, 0);
  const width = Math.min(holder.left + holder.width, viewport.width) - left;
  const height = Math.min(holder.top + holder.height, viewport.height) - top;
  if (!(width >= least) || !(height >= least)) return undefined;
  return { top, left, width, height };
}

/** What holds the navigation when it is drawn inside a region that answers to its own size (a surface, a result). */
const holderOf = (element: Element | null) => element?.closest(".sf-container") ?? undefined;

/** True when the window, or the region the navigation is drawn in, is too narrow to dock it. */
function useNarrow(root: RefObject<HTMLElement | null>): boolean {
  const [narrow, setNarrow] = useState(() => narrowQuery()?.matches ?? false);
  const [tight, setTight] = useState(false);
  useEffect(() => {
    const query = narrowQuery();
    if (!query) return;
    const change = () => setNarrow(query.matches);
    change();
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const holder = holderOf(root.current);
    if (!holder || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const width = holder.getBoundingClientRect().width;
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // A holder that is not laid out says nothing.
      setTight(width > 0 && width < NARROW_REM * rem);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(holder);
    return () => observer.disconnect();
  }, [root]);
  return narrow || tight;
}

/** "Site navigation" for "Site", and "Main navigation" left as it is: a label that already says so is not said twice. */
export const navigationName = (label: string) => (/\bnavigation\s*$/i.test(label) ? label.trim() : `${label.trim()} navigation`);

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Side navigation that can get out of the way. Pinned, it sits beside the page. Unpinned, it keeps only the room its
 * menu button takes: a slim strip where the navigation was, so the button never sits over the page or a host's own
 * toolbar. Pressing it slides the navigation in from the left as a dialog: over the window, or, drawn inside a region
 * that answers to its own size (a surface in a host's canvas, a chat reply), over that region only. Focus moves into
 * it and stays there until it closes, on Escape, on its close button, or when an item is chosen; focus then goes back
 * to the menu button. Where the window or that region is under 40rem wide (`SIDENAV_NARROW`) it is always folded and
 * offers no pin.
 */
export function SideNav({ label, groups, current, onSelect, pinned: given, defaultPinned = true, onPinnedChange, header, footer, className }: SideNavProps) {
  const id = useId();
  const [kept, setKept] = useState(defaultPinned);
  const root = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(root);
  // On a narrow screen it is folded whatever was chosen; the choice comes back on a wider one.
  const pinned = (given ?? kept) && !narrow;
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = () => document.getElementById(`${id}-open`);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => opener()?.focus());
  };
  const setPinned = (next: boolean) => {
    setKept(next);
    setOpen(false);
    onPinnedChange?.(next);
    // Folding away from the button inside the panel: focus goes to the menu button that opens it again.
    if (!next) requestAnimationFrame(() => opener()?.focus());
  };
  const taking = !pinned && open;
  // Where the drawer goes while it is open: the part of its holder on screen, kept current as that moves.
  const [box, setBox] = useState<NavBox | undefined>(undefined);
  useLayoutEffect(() => {
    if (!taking) return;
    const place = () => {
      const rect = holderOf(root.current)?.getBoundingClientRect();
      const next = drawerBox(rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : undefined, { width: window.innerWidth, height: window.innerHeight });
      setBox((before) => (before && next && before.top === next.top && before.left === next.left && before.width === next.width && before.height === next.height ? before : next));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [taking]);
  const placed = !pinned && box ? ({ "--sf-sidenav-top": `${box.top}px`, "--sf-sidenav-left": `${box.left}px`, "--sf-sidenav-width": `${box.width}px`, "--sf-sidenav-height": `${box.height}px` } as CSSProperties) : undefined;
  // Opened over the page: focus goes in, to the close button first.
  useEffect(() => {
    if (taking) panel.current?.querySelector<HTMLElement>(".sf-sidenav-close")?.focus();
  }, [taking]);

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!taking) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    // Focus stays inside while it covers the page.
    if (event.key === "Tab" && panel.current) {
      const all = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = all[0];
      const last = all[all.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  const choose = (item: string) => {
    onSelect?.(item);
    if (taking) close();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape and Tab are handled here for everything inside; the controls themselves are buttons and links.
    <div ref={root} className={`sf-sidenav${className ? ` ${className}` : ""}`} data-pinned={pinned} data-open={open || undefined} data-narrow={narrow || undefined} style={placed} onKeyDown={onKey}>
      {!pinned && (
        <button id={`${id}-open`} type="button" className="sf-sidenav-open" aria-expanded={open} aria-controls={`${id}-panel`} aria-label={`Show ${navigationName(label)}`} onClick={() => setOpen(true)}>
          <ControlIcon icon="menu" />
        </button>
      )}
      {/* Folded, the drawer and the dimmed page behind it live in a stage laid over the holder, which clips the drawer as it slides. */}
      <div className="sf-sidenav-stage">
      {/* The page behind a drawer is dimmed, and a press on it closes the drawer; Escape and the close button do the same. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: a pointer's shortcut; the keyboard closes it with Escape or the close button. */}
      {taking && <div className="sf-sidenav-backdrop" aria-hidden="true" onClick={close} />}
      <div
        id={`${id}-panel`}
        ref={panel}
        className="sf-sidenav-panel"
        role={pinned ? undefined : "dialog"}
        aria-modal={taking || undefined}
        aria-label={pinned ? undefined : navigationName(label)}
      >
        <div className="sf-sidenav-top">
          <div className="sf-sidenav-header">{header}</div>
          {!narrow && (
          <button type="button" className="sf-sidenav-pin" aria-pressed={pinned} title={pinned ? "Let the navigation fold away" : "Keep the navigation open"} onClick={() => setPinned(!pinned)}>
            <ControlIcon icon={pinned ? "fold" : "unfold"} />
            <span className="sf-sidenav-pin-label">{pinned ? "Fold away" : "Keep open"}</span>
          </button>
          )}
          {!pinned && (
            <button type="button" className="sf-sidenav-close" aria-label={`Close ${navigationName(label)}`} onClick={close}>
              <ControlIcon icon="close" />
            </button>
          )}
        </div>
        <nav className="sf-sidenav-nav" aria-label={label}>
          {groups.map((group, g) => (
            <section key={group.label ?? g} className="sf-sidenav-group" aria-labelledby={group.label ? `${id}-group-${g}` : undefined}>
              {group.label && (
                <h2 id={`${id}-group-${g}`} className="sf-sidenav-group-label">
                  {group.label}
                </h2>
              )}
              <ul>
                {group.items.map((item) => (
                  <li key={item.id}>
                    {item.href ? (
                      <a href={item.href} aria-current={item.id === current ? "page" : undefined} onClick={() => choose(item.id)}>
                        {item.label}
                      </a>
                    ) : (
                      <button type="button" aria-current={item.id === current ? "page" : undefined} onClick={() => choose(item.id)}>
                        {item.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        {footer && <div className="sf-sidenav-footer">{footer}</div>}
      </div>
      </div>
    </div>
  );
}
