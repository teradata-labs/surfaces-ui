import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ControlIcon } from "../controls/ItemControls.js";
import { type SideNavGroup, type SideNavItem, navigationName } from "./SideNav.js";

export interface NavBarProps {
  /** What the navigation is for, for assistive technology: "Surfaces UI". */
  label: string;
  /**
   * The sections and their pages: the same groups `SideNav` takes. Each group's label is a section in the bar; the
   * section holding the current page shows its pages in a second bar beneath. A group with no label is shown under the
   * name "More".
   */
  groups: SideNavGroup[];
  /** The id of the item for the page being shown. */
  current?: string;
  onSelect?(id: string): void;
  /** At the bar's start: a name or a mark. Pressing it is the host's to decide. */
  brand?: ReactNode;
  /** At the bar's end: a status, a picker. On a narrow screen it moves into the menu. */
  actions?: ReactNode;
  className?: string;
}

/** Below this width the sections fold into a menu that covers the screen. */
export const NAVBAR_NARROW = "(max-width: 48rem)";

const FOCUSABLE = 'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useMedia(query: string): boolean {
  const get = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query) : undefined);
  const [matches, setMatches] = useState(() => get()?.matches ?? false);
  useEffect(() => {
    const media = get();
    if (!media) return;
    const change = () => setMatches(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
    // biome-ignore lint/correctness/useExhaustiveDependencies: the query is fixed for the component's life.
  }, [query]);
  return matches;
}

/** True once the page has scrolled, so the bar can show the edge between it and the content passing beneath. */
function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setScrolled(window.scrollY > 0);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  return scrolled;
}

const sectionOf = (groups: SideNavGroup[], id?: string) => groups.findIndex((g) => g.items.some((i) => i.id === id));
const sectionLabel = (group: SideNavGroup) => group.label ?? "More";

function ItemLink({ item, current, onChoose, className }: { item: SideNavItem; current?: string; onChoose(id: string): void; className: string }) {
  const here = item.id === current ? "page" : undefined;
  if (item.href) {
    return (
      <a className={className} href={item.href} aria-current={here} onClick={() => onChoose(item.id)}>
        {item.label}
      </a>
    );
  }
  return (
    <button type="button" className={className} aria-current={here} onClick={() => onChoose(item.id)}>
      {item.label}
    </button>
  );
}

/**
 * Navigation across the top of a site, after Apple's: a bar of sections that stays at the top on glass, and beneath
 * it a second bar with the current section's name and its pages. A section goes to its first page. Content scrolls
 * under both, and an edge appears once it does. On a narrow screen the sections fold into a menu button that opens
 * every section and page over the whole screen, as a dialog: focus goes in and stays there until Escape, the close
 * button or a choice closes it, then goes back to the menu button. The second bar stays, its pages scrolling sideways.
 */
/**
 * Puts one highlight under the current item of a list, as CSS variables on the list (`--sf-indicator-x`, `-y`, `-w`,
 * `-h`), so the highlight slides from item to item instead of jumping. `group` names which set of items the list
 * holds: when it changes the items are new, and the highlight is placed without sliding. A list whose size changes
 * (a wider window, a font loading) moves it at once too.
 */
function useIndicator(list: RefObject<HTMLUListElement | null>, selector: string, current: string | undefined, group?: string) {
  const shownGroup = useRef(group);
  useLayoutEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const place = (instant: boolean) => {
      const item = ul.querySelector<HTMLElement>(selector);
      if (!item) {
        ul.removeAttribute("data-indicator");
        return;
      }
      if (instant) ul.setAttribute("data-instant", "");
      ul.style.setProperty("--sf-indicator-x", `${item.offsetLeft}px`);
      ul.style.setProperty("--sf-indicator-y", `${item.offsetTop}px`);
      ul.style.setProperty("--sf-indicator-w", `${item.offsetWidth}px`);
      ul.style.setProperty("--sf-indicator-h", `${item.offsetHeight}px`);
      ul.setAttribute("data-indicator", "");
      if (instant) requestAnimationFrame(() => ul.removeAttribute("data-instant"));
    };
    place(!ul.hasAttribute("data-indicator") || shownGroup.current !== group);
    shownGroup.current = group;
    // An observer reports once as soon as it watches; only a real change of size moves the highlight (at once).
    let size = `${ul.offsetWidth}x${ul.offsetHeight}`;
    const resized =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            const now = `${ul.offsetWidth}x${ul.offsetHeight}`;
            if (now === size) return;
            size = now;
            place(true);
          })
        : undefined;
    resized?.observe(ul);
    return () => resized?.disconnect();
  }, [list, selector, current, group]);
}

export function NavBar({ label, groups, current, onSelect, brand, actions, className }: NavBarProps) {
  const id = useId();
  const narrow = useMedia(NAVBAR_NARROW);
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const here = sectionOf(groups, current);
  const section = here >= 0 ? groups[here] : undefined;
  const menuOpen = open && narrow;

  useEffect(() => {
    if (menuOpen) sheet.current?.querySelector<HTMLElement>(".sf-navbar-close")?.focus();
  }, [menuOpen]);
  // Widening the window while the menu is open closes it: the sections are in the bar again.
  useEffect(() => {
    if (!narrow) setOpen(false);
  }, [narrow]);
  // Going to another page from inside the menu (a link among the actions, say) closes it, as choosing a page does.
  const shown = useRef(current);
  useEffect(() => {
    if (shown.current === current) return;
    shown.current = current;
    setOpen(false);
  }, [current]);
  // The current page in the second bar is kept in view when it scrolls sideways.
  const local = useRef<HTMLUListElement>(null);
  const sections = useRef<HTMLUListElement>(null);
  useIndicator(sections, ".sf-navbar-section[aria-current]", current, narrow ? "narrow" : "wide");
  useIndicator(local, '.sf-navbar-page[aria-current="page"]', current, section ? sectionLabel(section) : undefined);
  useEffect(() => {
    local.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [current]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => opener.current?.focus());
  };
  const choose = (item: string) => {
    onSelect?.(item);
    if (menuOpen) close();
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab" && sheet.current) {
      const all = [...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
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

  return (
    <>
    <header className={`sf-navbar${className ? ` ${className}` : ""}`} data-scrolled={scrolled || undefined} data-narrow={narrow || undefined}>
      <nav className="sf-navbar-global" aria-label={label}>
        <div className="sf-navbar-row">
          {brand && <div className="sf-navbar-brand">{brand}</div>}
          {!narrow && (
            <ul ref={sections} className="sf-navbar-sections">
              {groups.map((group, index) => {
                const first = group.items[0];
                if (!first) return null;
                const inSection = index === here;
                return (
                  <li key={sectionLabel(group)}>
                    {first.href ? (
                      <a className="sf-navbar-section" href={first.href} aria-current={inSection ? "true" : undefined} onClick={() => choose(first.id)}>
                        {sectionLabel(group)}
                      </a>
                    ) : (
                      <button type="button" className="sf-navbar-section" aria-current={inSection ? "true" : undefined} onClick={() => choose(first.id)}>
                        {sectionLabel(group)}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!narrow && actions && <div className="sf-navbar-actions">{actions}</div>}
          {narrow && (
            <button
              ref={opener}
              type="button"
              className="sf-navbar-menu"
              aria-expanded={menuOpen}
              aria-controls={`${id}-menu`}
              aria-label={`Show ${navigationName(label)}`}
              onClick={() => setOpen(true)}
            >
              <ControlIcon icon="menu" />
            </button>
          )}
        </div>
      </nav>
      {section && (
        <nav className="sf-navbar-local" aria-label={`${sectionLabel(section)} pages`}>
          <div className="sf-navbar-row">
            <p className="sf-navbar-title">{sectionLabel(section)}</p>
            <ul ref={local} className="sf-navbar-pages">
              {section.items.map((item) => (
                <li key={item.id}>
                  <ItemLink item={item} current={current} onChoose={choose} className="sf-navbar-page" />
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </header>
      {/* Outside the bar: the bar's backdrop blur would make it the box a fixed sheet is placed in. */}
      {menuOpen && (
        // biome-ignore lint/a11y/noStaticElementInteractions: Escape and Tab are handled here for everything inside; the controls themselves are buttons and links.
        <div id={`${id}-menu`} ref={sheet} className="sf-navbar-sheet" role="dialog" aria-modal="true" aria-label={navigationName(label)} onKeyDown={onKey}>
          <div className="sf-navbar-sheet-top">
            {brand && <div className="sf-navbar-brand">{brand}</div>}
            <button type="button" className="sf-navbar-close" aria-label="Close navigation" onClick={close}>
              <ControlIcon icon="close" />
            </button>
          </div>
          <div className="sf-navbar-sheet-body">
            {groups.map((group) => (
              <section key={sectionLabel(group)} className="sf-navbar-sheet-group" aria-label={sectionLabel(group)}>
                <h2 className="sf-navbar-sheet-label">{sectionLabel(group)}</h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <ItemLink item={item} current={current} onChoose={choose} className="sf-navbar-sheet-item" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {actions && <div className="sf-navbar-sheet-actions">{actions}</div>}
          </div>
        </div>
      )}
    </>
  );
}
