import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
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

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => narrowQuery()?.matches ?? false);
  useEffect(() => {
    const query = narrowQuery();
    if (!query) return;
    const change = () => setNarrow(query.matches);
    change();
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return narrow;
}

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Side navigation that can get out of the way. Pinned, it sits beside the page. Unpinned, it takes no room at all: a
 * menu button floats at the page's top corner, and pressing it slides the navigation in from the left over the whole
 * screen, as a dialog. Focus moves into it and stays there until it closes, on Escape, on its close button, or when an
 * item is chosen; focus then goes back to the menu button. Below `SIDENAV_NARROW` it is always folded and offers no pin.
 */
export function SideNav({ label, groups, current, onSelect, pinned: given, defaultPinned = true, onPinnedChange, header, footer, className }: SideNavProps) {
  const id = useId();
  const [kept, setKept] = useState(defaultPinned);
  const narrow = useNarrow();
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
    <div className={`sf-sidenav${className ? ` ${className}` : ""}`} data-pinned={pinned} data-open={open || undefined} onKeyDown={onKey}>
      {!pinned && (
        <button id={`${id}-open`} type="button" className="sf-sidenav-open" aria-expanded={open} aria-controls={`${id}-panel`} aria-label={`Show ${label} navigation`} onClick={() => setOpen(true)}>
          <ControlIcon icon="menu" />
        </button>
      )}
      {/* The page behind a drawer is dimmed, and a press on it closes the drawer; Escape and the close button do the same. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: a pointer's shortcut; the keyboard closes it with Escape or the close button. */}
      {taking && <div className="sf-sidenav-backdrop" aria-hidden="true" onClick={close} />}
      <div
        id={`${id}-panel`}
        ref={panel}
        className="sf-sidenav-panel"
        role={pinned ? undefined : "dialog"}
        aria-modal={taking || undefined}
        aria-label={pinned ? undefined : `${label} navigation`}
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
            <button type="button" className="sf-sidenav-close" aria-label={`Close ${label} navigation`} onClick={close}>
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
  );
}
