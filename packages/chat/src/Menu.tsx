import { type CSSProperties, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChatIcon, type ChatIconName } from "./icons.js";

export interface MenuButtonProps {
  /** The button's accessible name, e.g. "Model: Large". */
  label: string;
  /** What the button shows; defaults to the label. */
  text?: ReactNode;
  icon?: ChatIconName;
  /** Show only the icon, with the label as its name and tooltip. */
  iconOnly?: boolean;
  /** The popover's content. Given `close` to close it after a choice. */
  children(close: () => void): ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * A button that opens a small popover above it, or below when there is more
 * room there, kept inside the window: a list of choices, a
 * checklist. Escape and a press outside close it, and focus goes back to the
 * button. It is a dialog rather than an ARIA menu because it holds checkboxes
 * and links as well as commands; Tab moves through them.
 */
export function MenuButton({ label, text, icon, iconOnly, children, disabled, className }: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  // Which side has room, measured when it opens; the popover scrolls within that room.
  const [place, setPlace] = useState<{ below: boolean; end: boolean; room: number }>({ below: false, end: false, room: 0 });
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const at = button.current.getBoundingClientRect();
    const height = window.innerHeight || document.documentElement.clientHeight;
    const width = window.innerWidth || document.documentElement.clientWidth;
    const above = at.top;
    const below = height - at.bottom;
    const wide = panel.current?.offsetWidth ?? 0;
    setPlace({ below: below > above, end: at.left + wide > width && at.right - wide >= 0, room: Math.max(below, above) });
  }, [open]);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const first = panel.current?.querySelector<HTMLElement>("input, button, a[href], [tabindex='0']");
    first?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <span className={["sf-chat-menu", className].filter(Boolean).join(" ")}>
      <button
        ref={button}
        type="button"
        className="sf-chat-tool"
        data-icon-only={iconOnly || undefined}
        aria-label={label}
        title={iconOnly ? label : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {icon && <ChatIcon name={icon} />}
        {!iconOnly && <span className="sf-chat-tool-text">{text ?? label}</span>}
        {!iconOnly && <ChatIcon name="chevron" />}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          className="sf-chat-popover"
          data-below={place.below || undefined}
          data-end={place.end || undefined}
          style={place.room > 0 ? ({ "--sf-chat-popover-room": `${Math.floor(place.room)}px` } as CSSProperties) : undefined}
          role="dialog"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          {children(close)}
        </div>
      )}
    </span>
  );
}

/** One choice in a popover: a command, or with `checked` a toggle. */
export function MenuItem({ children, detail, onSelect, checked, disabled, role }: { children: ReactNode; detail?: ReactNode; onSelect(): void; checked?: boolean; disabled?: boolean; role?: "radio" | "checkbox" }) {
  return (
    <button type="button" className="sf-chat-menu-item" role={role} aria-checked={role ? !!checked : undefined} disabled={disabled} onClick={onSelect}>
      <span className="sf-chat-menu-mark">{role && checked ? <ChatIcon name="check" /> : null}</span>
      <span className="sf-chat-menu-text">
        {children}
        {detail && <span className="sf-chat-menu-detail">{detail}</span>}
      </span>
    </button>
  );
}

export function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="sf-chat-menu-group" role="group" aria-labelledby={id}>
      <p id={id} className="sf-chat-menu-heading">
        {label}
      </p>
      {children}
    </div>
  );
}
