/** A box on screen, in CSS pixels from the window's top left. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PlacementInput {
  /** Where the button that opens the panel is. */
  trigger: Box;
  /** The panel's own size (its border box, before any height is taken away). */
  panel: { width: number; height: number };
  /** The window's size, without its scroll bars. */
  viewport: { width: number; height: number };
  /** The gap between the panel and the button, which is also the least room kept between the panel and the window's edge. */
  gap: number;
  /** Line the panel up with the button's start edge or its end edge. */
  align: "start" | "end";
  /** Right to left, where the start edge is the right one. */
  rtl?: boolean;
}

export interface Placement {
  /** The panel's left edge. */
  left: number;
  /** The panel's top edge. */
  top: number;
  /** The most height it has room for; it scrolls inside beyond that. */
  maxHeight: number;
  /** Below the button, or above it when there was more room there and not enough below. */
  side: "below" | "above";
}

/**
 * Where a panel opened from a button goes: below it, lined up with its start or end edge, moved along so it stays
 * inside the window, and above the button only when it does not fit below and there is more room above. On a phone
 * the panel may be as wide as the window less a gap each side, never wider.
 */
export function placePanel({ trigger, panel, viewport, gap, align, rtl = false }: PlacementInput): Placement {
  const leftEdge = (align === "start") !== rtl;
  const wanted = leftEdge ? trigger.left : trigger.right - panel.width;
  const most = viewport.width - gap - panel.width;
  const left = Math.max(gap, Math.min(wanted, most));

  const below = viewport.height - trigger.bottom - 2 * gap;
  const above = trigger.top - 2 * gap;
  const side = panel.height <= below || below >= above ? "below" : "above";
  const room = Math.max(0, side === "below" ? below : above);
  const height = Math.min(panel.height, room);
  const top = side === "below" ? trigger.bottom + gap : trigger.top - gap - height;
  return { left, top, maxHeight: room, side };
}
