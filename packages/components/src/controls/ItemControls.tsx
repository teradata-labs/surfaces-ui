import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";

const PATHS = {
  edit: "M4 20h4L19 9l-4-4L4 16z M14 6l4 4",
  chart: "M4 4v16h16 M8 16v-5 M12 16V8 M16 16v-9",
  table: "M3 5h18v14H3z M3 10h18 M3 15h18 M9 5v14",
  wider: "M3 12h18 M7 8l-4 4 4 4 M17 8l4 4-4 4",
  narrower: "M3 12h6 M21 12h-6 M5 8l4 4-4 4 M19 8l-4 4 4 4",
  earlier: "M19 12H5 M11 6l-6 6 6 6",
  later: "M5 12h14 M13 6l6 6-6 6",
  up: "M12 19V5 M6 11l6-6 6 6",
  down: "M12 5v14 M6 13l6 6 6-6",
  duplicate: "M8 8h11v11H8z M5 16V5h11",
  remove: "M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13 M10 11v6 M14 11v6",
  add: "M12 5v14 M5 12h14",
  close: "M6 6l12 12 M18 6L6 18",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  fold: "M4 4v16 M20 12H9 M14 7l-5 5 5 5",
  unfold: "M20 4v16 M4 12h11 M10 7l5 5-5 5",
  confirm: "M5 12l5 5 9-10",
} as const;

/** The drawings the shared controls use. One set, so the same action looks the same wherever it appears. */
export type ControlIconName = keyof typeof PATHS;
export const CONTROL_ICONS = Object.keys(PATHS) as ControlIconName[];

export function ControlIcon({ icon }: { icon: ControlIconName | ReactNode }) {
  if (typeof icon === "string" && icon in PATHS) {
    return (
      <svg className="sf-item-control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d={PATHS[icon as ControlIconName]} />
      </svg>
    );
  }
  return <span className="sf-item-control-icon">{icon}</span>;
}

/** One control on an item: an icon, and its name for assistive technology and the tooltip. */
export interface ItemControl {
  /** What it does, as a word: "edit", "remove". Put on the button as `data-control`. */
  id: string;
  /** The button's full name, said by a screen reader and shown at once on hover and focus: "Remove Refund rate by category". */
  label: string;
  icon: ControlIconName | ReactNode;
  onSelect(): void;
  /** Shown but cannot be used: the first item cannot move earlier. It can still be focused, so its name can be read. */
  disabled?: boolean;
  /** For a control that removes or destroys. Marked by more than colour: it comes last, after a gap. */
  danger?: boolean;
  /** For a control that switches something on and off. */
  pressed?: boolean;
  /**
   * Stays visible when the rest are quiet: for the one action a person
   * must be able to find without pointing at the item first (a report's
   * "Add to report"). Use it sparingly, and not on a control that cannot
   * be used right now.
   */
  pinned?: boolean;
}

export interface ItemControlsProps {
  /** Names the group: "Refund rate by category controls". */
  label: string;
  controls: ItemControl[];
  /**
   * "hover" (the default) shows the controls when the pointer is over the
   * item they belong to, or focus is inside it; give that item the class
   * `sf-controls-host`. On a touch screen, which has no hover, they are
   * always shown. "always" keeps them shown.
   */
  show?: "hover" | "always";
  /**
   * Whether an outer layer of controls can hide these (see `CONTROLS_QUIET`).
   * True by default; the outer layer's own controls pass false.
   */
  quietable?: boolean;
  className?: string;
}

/**
 * Put this class on a region to hide the item controls inside it, so that
 * two layers of controls are never on screen at once: an editor that frames
 * each component with its own controls (move, remove, resize) quiets the
 * controls of what it frames while it is arranging.
 */
export const CONTROLS_QUIET = "sf-controls-quiet";
/** Put this class on the item a set of hover controls belongs to. */
export const CONTROLS_HOST = "sf-controls-host";

/**
 * The controls of one item (a tile, a card, a framed component) as a row of
 * icons: quiet until the item is pointed at or focused, each named at once
 * in a tooltip, and one stop in the tab order with the arrow keys moving
 * between them. Every part of the library that lets a person change, move,
 * resize or remove an item uses this, with `standardControls` for the
 * actions they share, so the same action has the same icon, name and place
 * everywhere.
 */
export function ItemControls({ label, controls, show = "hover", quietable = true, className }: ItemControlsProps) {
  const bar = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [tip, setTip] = useState<number | undefined>();
  const at = Math.min(current, Math.max(0, controls.length - 1));

  const focus = (index: number) => {
    const next = (index + controls.length) % controls.length;
    setCurrent(next);
    bar.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") focus(at + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") focus(at - 1);
    else if (event.key === "Home") focus(0);
    else if (event.key === "End") focus(controls.length - 1);
    else if (event.key === "Escape" && tip !== undefined) setTip(undefined);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  if (controls.length === 0) return null;
  return (
    <div ref={bar} className={["sf-item-controls", className].filter(Boolean).join(" ")} role="toolbar" aria-label={label} data-show={show} data-quietable={quietable || undefined} onKeyDown={onKeyDown}>
      {controls.map((control, index) => (
        <button
          key={control.id}
          type="button"
          className="sf-item-control"
          data-control={control.id}
          data-danger={control.danger || undefined}
          data-pinned={(control.pinned && !control.disabled) || undefined}
          aria-label={control.label}
          aria-pressed={control.pressed}
          // Not `disabled`, which would take it out of reach of the keyboard and leave its name unread.
          aria-disabled={control.disabled || undefined}
          tabIndex={index === at ? 0 : -1}
          onClick={() => !control.disabled && control.onSelect()}
          onFocus={() => {
            setCurrent(index);
            setTip(index);
          }}
          onBlur={() => setTip((now) => (now === index ? undefined : now))}
          onPointerEnter={() => setTip(index)}
          onPointerLeave={() => setTip((now) => (now === index ? undefined : now))}
        >
          <ControlIcon icon={control.icon} />
          {/* The button carries its name for assistive technology; this is the same words for the eye, shown at once. */}
          {tip === index && (
            <span className="sf-item-tip" aria-hidden="true">
              {control.label}
              {control.disabled ? " (not available here)" : ""}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** What an item can have done to it. A handler left out leaves the control out; `false` shows it greyed, for an action that makes no sense right now. */
export interface StandardActions {
  edit?: (() => void) | false;
  /** Switch between a chart and a table. `now` is what is showing. */
  view?: { now: "chart" | "table"; toggle(): void };
  wider?: (() => void) | false;
  narrower?: (() => void) | false;
  /** Earlier and later in reading order, for items laid out across. */
  earlier?: (() => void) | false;
  later?: (() => void) | false;
  /** Up and down, for items stacked. */
  up?: (() => void) | false;
  down?: (() => void) | false;
  duplicate?: (() => void) | false;
  remove?: (() => void) | false;
}

/**
 * The controls an item shares with every other kind of item, in one order
 * and with one wording: change, chart or table, wider, narrower, move,
 * duplicate, remove. `name` is what the item is called ("Refund rate by
 * category", "Chart revenue"), and goes into each control's name.
 */
export function standardControls(name: string, actions: StandardActions): ItemControl[] {
  const out: ItemControl[] = [];
  const add = (id: string, label: string, icon: ControlIconName, handler: (() => void) | false | undefined, extra: Partial<ItemControl> = {}) => {
    if (handler === undefined) return;
    out.push({ id, label, icon, onSelect: handler || (() => undefined), ...(handler === false ? { disabled: true } : {}), ...extra });
  };
  add("edit", `Change ${name}`, "edit", actions.edit);
  if (actions.view) add("view", actions.view.now === "chart" ? `Show ${name} as a table` : `Show ${name} as a chart`, actions.view.now === "chart" ? "table" : "chart", actions.view.toggle);
  add("wider", `Make ${name} wider`, "wider", actions.wider);
  add("narrower", `Make ${name} narrower`, "narrower", actions.narrower);
  add("earlier", `Move ${name} earlier`, "earlier", actions.earlier);
  add("later", `Move ${name} later`, "later", actions.later);
  add("up", `Move ${name} up`, "up", actions.up);
  add("down", `Move ${name} down`, "down", actions.down);
  add("duplicate", `Duplicate ${name}`, "duplicate", actions.duplicate);
  add("remove", `Remove ${name}`, "remove", actions.remove, { danger: true });
  return out;
}
