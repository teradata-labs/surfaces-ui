import { type KeyboardEvent, type MouseEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface MenuItem {
  /** Leave out, with `separator: true`, for a dividing line. */
  label?: string;
  onSelect?(): void;
  disabled?: boolean;
  separator?: boolean;
  /** A short note on the right, such as a keyboard shortcut. */
  hint?: string;
}

interface OpenMenu {
  x: number;
  y: number;
  label: string;
  items: MenuItem[];
  /** Where focus goes back to when the menu closes. */
  from: HTMLElement | null;
}

export interface ContextMenu {
  /**
   * Opens the menu for a `contextmenu` event. That event comes from a right
   * click, a long press on a touch screen, the Menu key and Shift+F10, so one
   * handler covers them all. With no pointer position (a keyboard opening)
   * the menu appears at the element itself.
   */
  open(event: MouseEvent<HTMLElement>, label: string, items: MenuItem[]): void;
  close(): void;
  /** Render this once, anywhere in the component. */
  element: ReactNode;
}

/** Copies text, saying whether it worked. Clipboard access can be refused by the browser. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * A menu of actions for the thing under the pointer or the keyboard focus.
 * Arrow keys move, Home and End jump, Enter or Space chooses, Escape or a
 * click elsewhere closes, and focus returns to where it came from. Anything
 * offered here must also be reachable another way; a menu is a shortcut.
 */
export function useContextMenu(): ContextMenu {
  const [menu, setMenu] = useState<OpenMenu | undefined>();
  const list = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setMenu((current) => {
      current?.from?.focus?.();
      return undefined;
    });
  }, []);

  const open = useCallback((event: MouseEvent<HTMLElement>, label: string, items: MenuItem[]) => {
    if (items.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    const box = target.getBoundingClientRect();
    const keyboard = event.clientX === 0 && event.clientY === 0;
    setMenu({ x: keyboard ? box.left + 12 : event.clientX, y: keyboard ? box.bottom : event.clientY, label, items, from: document.activeElement instanceof HTMLElement ? document.activeElement : target });
  }, []);

  const enabled = () => [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];

  // Keep the menu inside the window, then put focus on its first item.
  useLayoutEffect(() => {
    const element = list.current;
    if (!menu || !element) return;
    const box = element.getBoundingClientRect();
    const left = Math.max(4, Math.min(menu.x, window.innerWidth - box.width - 4));
    const top = Math.max(4, Math.min(menu.y, window.innerHeight - box.height - 4));
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    enabled()[0]?.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const away = (event: globalThis.MouseEvent) => {
      if (!list.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [menu, close]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = enabled();
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const go = (index: number) => {
      event.preventDefault();
      event.stopPropagation();
      items[(index + items.length) % items.length]?.focus();
    };
    if (event.key === "ArrowDown") return go(at + 1);
    if (event.key === "ArrowUp") return go(at - 1);
    if (event.key === "Home") return go(0);
    if (event.key === "End") return go(items.length - 1);
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const element = menu ? (
    <div ref={list} className="sf-menu" role="menu" aria-label={menu.label} style={{ left: menu.x, top: menu.y }} onKeyDown={onKeyDown} onContextMenu={(event) => event.preventDefault()}>
      {menu.items.map((item, i) =>
        item.separator ? (
          <div key={i} className="sf-menu-separator" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className="sf-menu-item"
            disabled={item.disabled}
            onClick={() => {
              close();
              item.onSelect?.();
            }}
          >
            <span>{item.label}</span>
            {item.hint && <span className="sf-menu-hint">{item.hint}</span>}
          </button>
        ),
      )}
    </div>
  ) : null;

  return { open, close, element };
}
