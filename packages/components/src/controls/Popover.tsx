import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { placePanel } from "./placement.js";

export interface PopoverProps {
  /** What the button says, and the panel's name for assistive technology: "View". */
  label: string;
  /** A few words after the label on the button saying what is set now: "Fit · 100% · Real data". Part of the button's name. */
  summary?: ReactNode;
  /** The panel's contents: selects, a `SegmentedControl`, check boxes. Anything a person can Tab through. */
  children: ReactNode;
  /** Line the panel up with the button's start edge (the default) or its end edge. It moves along to stay inside the window either way. */
  align?: "start" | "end";
  /** Open, when the host holds it. Leave out to let the popover hold it. */
  open?: boolean;
  /** Open at first, when the popover holds it. */
  defaultOpen?: boolean;
  /** Every change asked for: the button, Escape, a press or focus outside. */
  onOpenChange?(open: boolean): void;
  disabled?: boolean;
  /** On the outer box, which holds the button and the panel. */
  className?: string;
  /** On the panel. */
  panelClassName?: string;
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** The top layer, where the browser has it, so no clipping, transform or filter on an ancestor can move or cut the panel. */
type PopoverElement = HTMLElement & { showPopover?(): void; hidePopover?(): void };

/** Whether the panel is in the top layer now; false where the browser has no popovers. */
function shown(element: PopoverElement): boolean {
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}

/**
 * A button that shows a small panel of controls beneath it: a view's settings, a few filters. It is a non-modal
 * dialog opened by a disclosure button: the button says whether it is open (`aria-expanded`) and which panel it
 * opens (`aria-controls`); opening moves focus to the panel's first control; Tab moves through the panel and on
 * to the page after the button, which closes it; Escape closes it and puts focus back on the button; a press or
 * focus anywhere else closes it. For a list of actions use `useContextMenu`; for a decision that must be answered
 * first, `ConfirmDialog`.
 */
export function Popover(props: PopoverProps) {
  const { label, summary, children, align = "start", open: held, defaultOpen = false, onOpenChange, disabled, className, panelClassName } = props;
  const id = useId();
  const panelId = `${id}-panel`;
  const [own, setOwn] = useState(defaultOpen);
  const open = held ?? own;
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Opening moves focus into the panel; being open when first drawn does not take focus from the page.
  const wasOpen = useRef(open);

  const change = useCallback(
    (next: boolean) => {
      if (held === undefined) setOwn(next);
      onOpenChange?.(next);
    },
    [held, onOpenChange],
  );

  const place = useCallback(() => {
    const element = panel.current;
    const trigger = button.current;
    if (!element || !trigger) return;
    const style = getComputedStyle(element);
    // The panel's margin is the gap to the button and the least room kept from the window's edge.
    const gap = Number.parseFloat(style.marginTop) || 0;
    const at = placePanel({
      trigger: trigger.getBoundingClientRect(),
      // Its whole height, as if no room had been taken away yet: what it scrolls, plus its edges.
      panel: { width: element.offsetWidth, height: element.scrollHeight + element.offsetHeight - element.clientHeight },
      viewport: { width: document.documentElement.clientWidth || window.innerWidth, height: document.documentElement.clientHeight || window.innerHeight },
      gap,
      align,
      rtl: getComputedStyle(trigger).direction === "rtl",
    });
    // A fixed box is placed by its margin edge, so the margin is taken off again.
    element.style.left = `${at.left - gap}px`;
    element.style.top = `${at.top - gap}px`;
    element.style.maxHeight = `${at.maxHeight}px`;
    element.dataset.side = at.side;
  }, [align]);

  useLayoutEffect(() => {
    const element = panel.current as PopoverElement | null;
    if (!element) return;
    if (open) {
      if (typeof element.showPopover === "function" && !shown(element)) {
        element.setAttribute("popover", "manual");
        element.showPopover();
      }
      place();
      if (!wasOpen.current) (element.querySelector<HTMLElement>(FOCUSABLE) ?? element).focus();
    } else if (typeof element.hidePopover === "function" && shown(element)) {
      element.hidePopover();
    }
    wasOpen.current = open;
  });

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) => target instanceof Node && !!box.current?.contains(target);
    const away = (event: Event) => {
      if (!inside(event.target)) change(false);
    };
    // Scrolling the page moves the button, so the panel follows; scrolling the panel itself moves nothing.
    const scrolled = (event: Event) => {
      if (!(event.target instanceof Node && panel.current?.contains(event.target))) place();
    };
    document.addEventListener("pointerdown", away, true);
    document.addEventListener("focusin", away, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      document.removeEventListener("focusin", away, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", scrolled, true);
    };
  }, [open, change, place]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A control inside that used Escape itself (a combobox closing its list) keeps it.
    if (event.key !== "Escape" || !open || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    change(false);
    button.current?.focus();
  };

  return (
    <div ref={box} className={["sf-popover", className].filter(Boolean).join(" ")} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className="sf-button sf-popover-button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => change(!open)}
      >
        <span className="sf-popover-label">{label}</span>
        {summary !== undefined && summary !== null && summary !== "" && <span className="sf-popover-summary">{summary}</span>}
        <span className="sf-popover-caret" aria-hidden="true" />
      </button>
      <div ref={panel} id={panelId} role="dialog" aria-label={label} tabIndex={-1} className={["sf-popover-panel", panelClassName].filter(Boolean).join(" ")} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
