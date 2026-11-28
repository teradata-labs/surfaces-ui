---
name: responsive-accessible-ui
description: Use when building, changing or reviewing any page, dashboard, component, theme or agent-drawn surface, built with Surfaces UI or not, to keep it responsive and meeting WCAG 2.2 level AA. Covers container-based layout, target size, focus, contrast, motion, charts and tables for assistive technology, and the tests that enforce them. Triggers on "responsive", "mobile", "narrow", "accessibility", "a11y", "WCAG", "keyboard", "screen reader", "contrast", "focus", "touch target".
---

# Responsive and accessible UI

The standard is WCAG 2.2 level AA. The full mapping of criteria to how this library meets them is in `docs/accessibility.md`. The same component is drawn in a page, a chat reply, a side panel and an MCP frame, so both topics start from one rule: **respond to the space you are given, and never rely on one sense or one input.**

## Responsive rules

1. **Container queries, not window queries.** A region marked `.sf-container` (surfaces and query results already are) is what components measure: `@container sf (max-width: 480px)`. Use `@media` only for the page shell.
2. **Three widths**: narrow (up to 480px: a phone, a chat column), medium (481 to 840px), wide. Design narrow first.
3. **Fluid before breakpoints.** Prefer `repeat(auto-fit, minmax(min(100%, 16em), 1fr))`, `flex-wrap`, and `minmax(0, 1fr)` over fixed columns. Every grid child needs `min-width: 0`.
4. **Nothing scrolls sideways at 320px wide** (WCAG 1.4.10 Reflow), except a data grid, a wide chart or a diagram, which scroll inside their own box.
5. **Sizes come from tokens**: `--sf-space-*`, `--sf-font-size*`, `--sf-control-height`, `--sf-row-height`, `--sf-target-min`. No fixed px for spacing or radius.
6. **Tables that do not fit** either scroll in a labelled region or restack with each cell under its heading (see `.sf-pii-table`).
7. **Text grows.** Layout must survive 200% zoom and larger text spacing (1.4.4, 1.4.12): no fixed heights on text containers, no truncation without a way to read the whole.
8. **Charts take `height` and fill the width.** Reduce series, not font size, when space is short.
9. **Touch**: under `pointer: coarse`, `--sf-target-min` becomes 44px. Do not put hover-only behaviour on anything.

## Accessibility rules (WCAG 2.2 AA)

**Perceive**
- Text contrast 4.5:1, large text and UI parts 3:1 (1.4.3, 1.4.11). Presets are tested; a new token needs a contrast test.
- Never colour alone (1.4.1): status has a word and a symbol; series have labels; risk has text.
- Every chart has a text reading (`role="img"` with a label that states the finding) and a table view (1.1.1).
- Works in forced-colours mode and in light and dark.

**Operate**
- Everything by keyboard, in a sensible order, with no trap (2.1.1, 2.1.2). Drag has a non-drag way: `ModelDiagram` has its list and form (2.5.7).
- Focus is always visible (2.4.7) and is not hidden behind sticky headers (2.4.11).
- Targets are at least 24 by 24 CSS px (2.5.8); 44 for touch. Use `min-height: var(--sf-target-min)`.
- Motion stops under `prefers-reduced-motion` (2.3.3); nothing flashes; nothing times out without warning.

**Understand**
- Every control has a visible label or an `aria-label`; hints sit outside the label (3.3.2).
- Errors say what is wrong and where, in text, next to the field, with `role="alert"` (3.3.1, 3.3.3). SQL errors carry line and column.
- Destructive actions are confirmed and say whether they can be undone (3.3.4).
- Do not ask for the same information twice in one flow (3.3.7).
- Sentence case, plain words, no jargon the reader did not bring.

**Robust**
- Native elements first (`button`, `select`, `table`, `details`). ARIA only where there is no element.
- State is exposed: `aria-busy`, `aria-pressed`, `aria-current="step"`, `aria-expanded`.
- Changes are announced: `role="status"` for outcomes, `role="alert"` for errors (4.1.3).
- Text from a model or a database is rendered as text, never as HTML.

## How to check

- `pnpm test`: contrast for every preset, series colours under colour blindness, target-size tokens, and each component's labels and roles.
- By hand, for anything new: tab through it; use it at 320px wide; zoom to 200%; turn on reduced motion; try forced colours; read it with a screen reader.
- Not yet automated here: axe checks and screenshot tests per theme. Say so in a review rather than assuming.

## Checklist for a new component

- [ ] Works with `memoryDataSource` in a test that finds controls by role and name.
- [ ] Colours and sizes from `--sf-*` only.
- [ ] Usable at 320px inside `.sf-container`; no sideways page scroll.
- [ ] Keyboard path for every action; visible focus; targets at least `--sf-target-min`.
- [ ] Status and errors announced, with words and symbols as well as colour.
- [ ] Has a catalog entry and renderer, so it can appear in a chat thread.
