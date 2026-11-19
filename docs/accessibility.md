# Accessibility and responsive design

The standard is **WCAG 2.2, level AA**. This page maps the criteria that matter for a data UI to how the library meets them, and says what is checked by a test and what is not.

## How it is enforced

| Check | Where |
|---|---|
| Text, accent, border and status contrast for every preset, light and dark | `packages/tokens/src/tokens.test.ts` |
| Series colours told apart by neighbours, including under red-green colour blindness | `checkSeries`, same test file and live in `ThemePicker` |
| Smallest pressable size | `TARGET_MIN` (24) and `TARGET_MIN_TOUCH` (44) in `packages/tokens/src/css.ts`, emitted as `--sf-target-min` |
| Controls found by role and name, status and errors announced | each component's `*.test.tsx` |
| Human-in-the-loop surfaces are valid and end in a decision | `packages/spec/src/patterns.test.ts` |
| Every axe check tagged WCAG 2.0, 2.1 and 2.2 A and AA, on eight playground areas at desktop and phone size | `apps/e2e/tests/accessibility.spec.ts` (`pnpm e2e`; CI job `browser`) |
| No sideways page scroll at phone width (1.4.10) on seven areas | `apps/e2e/tests/layout.spec.ts` |
| Keyboard paths in a real browser: running SQL, sorting, pills put on shelves and taken off, panels moved from their menu | `apps/e2e/tests/*.spec.ts` |

The browser tests run the playground against DuckDB in the page, in Chromium only, and in the default theme only. axe's target-size rule is not run inside a pan and zoom canvas, where a diagram fitted to a phone draws its cards small until the person zooms in (every card there is also reached from the keyboard, and in `ModelDiagram` from the list beneath). Not automated yet: other browsers, screenshot tests per theme, and screen reader runs. Those are done by hand; do not assume them.

## Criteria

| Criterion | How it is met |
|---|---|
| 1.1.1 Non-text content | Charts are `role="img"` with a label that states the finding; `Sparkline` and `BulletGraph` write their reading in words; `QueryResult` offers the table behind a chart. |
| 1.3.1 Info and relationships | Native `table`, `th scope`, lists, `label`; step lists are `ol`. |
| 1.4.1 Use of colour | Status, risk, certification, flags and pipeline check results (✓ Passed, ! Failed, ! Warning) carry a word and a symbol. Series are labelled. |
| 1.4.3 / 1.4.11 Contrast | Tokens are derived to 4.5:1 for text and 3:1 for controls and marks, and tested per preset. Status colours (success, warning, danger, info) are text colours, 4.5:1 on the background and on surfaces; accent text is 4.5:1 on the soft accent fill as well, since a selected item draws one on the other. |
| 1.4.4 / 1.4.12 Resize and spacing | Sizes are tokens; text containers have no fixed height. |
| 1.4.10 Reflow | Components respond to their container (`.sf-container`, `@container sf`); nothing scrolls the page sideways at 320px. Grids, charts and diagrams scroll inside their own box. |
| 1.4.13 Content on hover or focus | Nothing is available on hover only. |
| 2.1.1 / 2.1.2 Keyboard | Every action has a keyboard path; no traps. A box that scrolls on its own (a table of columns, checks or runs) takes focus and is a named region, so it can be scrolled by keys. |
| 2.3.3 Animation | `prefers-reduced-motion` stops transitions and chart animation. |
| 2.4.7 Focus visible | A 2px focus ring from `--sf-color-focus` on every control. |
| 2.4.11 Focus not obscured (new in 2.2) | Scroll regions with sticky headers set `scroll-padding`. |
| 2.5.7 Dragging movements (new in 2.2) | `ModelDiagram` joins, removals and table adds all work from its list and form; each line has a button. Panning and zooming `ModelDiagram` and `PipelineGraph` also work from buttons and keys. |
| 2.5.3 Label in name | A control's spoken name begins with its visible text. Where more is said than shown (a pill's kind, a pipeline node's status), it follows the visible name as hidden text (`.sf-visually-hidden`) instead of replacing it with `aria-label`. |
| 2.5.8 Target size (new in 2.2) | Controls have `min-height: var(--sf-target-min)`: 24px, and 44px under `pointer: coarse`. |
| 3.2.6 Consistent help (new in 2.2) | A host concern; the library adds none of its own. |
| 3.3.1 / 3.3.3 Errors | Errors are text beside what failed, `role="alert"`, with the reason and, for SQL, the line and column. |
| 3.3.4 Error prevention | Destructive steps start unticked in `PlanReview`; full refresh needs confirmation on the server too. `DatasetReview` saves only after the person names themselves and approves, shows what changed from the saved version first, and a stale or altered proposal is refused with the reason. |
| 3.3.7 Redundant entry (new in 2.2) | Flows carry earlier answers forward; a decision made in a card is not asked again. |
| 3.3.8 Accessible authentication (new in 2.2) | The library has no sign-in and no field for a credential. |
| 4.1.2 Name, role, value | Native elements first; state through `aria-busy`, `aria-pressed`, `aria-current`, `aria-expanded`. |
| 4.1.3 Status messages | Outcomes use `role="status"` or `aria-live="polite"`. |

Also supported: Windows forced-colours mode (marks and focus take system colours), light and dark, and themes checked for contrast when a person edits them. A person who asks their system for more contrast (`prefers-contrast: more`), or picks the High contrast preset (`contrast: "more"`), gets solid glass, every pane and control outlined at 3:1 or more, and the quieter labels a level darker.

## Keyboard

Everything a pointer can do has a key. A right-click menu opens with the Menu key or Shift+F10 and is never the only way to do something.

| Where | Keys | What they do |
|---|---|---|
| Any menu | ↑ ↓, Home, End | Move between items |
| | Enter or Space | Choose |
| | Escape or Tab | Close; focus returns to where it was |
| Data grid (cells) | ← ↑ → ↓ | Move the active cell |
| | Home, End | First or last column of the row |
| | Ctrl/⌘ Home, Ctrl/⌘ End | First or last row |
| | Page Up, Page Down | A screen of rows |
| | Ctrl/⌘ C | Copy the cell |
| | Enter | Open the row (when the host handles row clicks) |
| | Menu key, Shift+F10 | Cell menu: copy, copy row, filter to or leave out the value |
| Data grid (a column header) | Enter or Space | Sort; with Shift, add to the sort |
| | Alt ← , Alt → | Move the column |
| | Shift ←, Shift → | Narrower or wider |
| | Menu key, Shift+F10 | Column menu: sort, move, hide, reset, generate SQL |
| Object browser | ↑ ↓, Home, End | Move |
| | → ← | Open or close; step in or out |
| | Enter | Open or select |
| | Insert | Put the name, or a join's JOIN clause, in the editor |
| | Ctrl/⌘ C | Copy the name |
| | Alt Enter, Ctrl/⌘ I | Details of the database, schema or table |
| | Menu key, Shift+F10 | Item menu: details, generate SQL, copy, insert |
| Object browser (selecting) | Space | Select or unselect the row the keyboard is on; Ctrl or ⌘ click and Shift click do the same with a pointer |
| | Shift Enter | Hand the selection (or the row, with nothing selected) to the chat or whatever the host attached; also "Add to chat" in the row's menu. This is the keyboard and touch form of dragging it there |
| | Escape | Clear the selection |
| File browser | ↑ ↓, Home, End | Move |
| File browser | → ← | Open or close a folder; ← on a file goes to its folder |
| File browser | Enter | Open or close a folder; open a file (what that does is the host's) |
| File browser | Space | Select or unselect the row; Ctrl or ⌘ click and Shift click do the same with a pointer; Escape clears |
| File browser | Shift+Enter | Hand the selection, or the row, to a chat ("Add to chat"); the keyboard and touch form of dragging |
| File browser | Ctrl or ⌘ + C | Copy the path |
| Chat composer | Enter | Send; Shift+Enter starts a new line |
| | Escape | Close an open menu (focus goes back to its button); end a spoken conversation |
| | Tab | Move through a menu's choices; each is a radio or a checkbox with its state announced |
| Agent setup menu | Enter or → | Open a section (Agent, Skills, Connectors) in place |
| | ← or Escape | Back to the sections, on the one just left; Escape there closes the menu |
| | (buttons) | Dictate, Talk, Add files or data, Add data, Model, Agent setup: every one is a button; files can also be chosen with the file dialog instead of dropped |
| Dev tools (`SurfacesDevTools`) | Ctrl+Shift+D (⌘⇧D on a Mac) | Open or close the panel; focus moves into it, and back to its button when it closes. The button does the same |
| | ← → on the Step slider; the Step back, Step forward and Live buttons | Time travel: show every surface as it stood at a step |
| | "Pick a component on the page" (a pointer), or a row of the Components list (keyboard) | Outline a component on the page and narrow the lists to it; Escape gives up picking, and the "Only …" button in each list clears it |
| | ↑ ↓ Home End Page Up Page Down in a list | Move the selection through the timeline, messages, components, events, services or turns; the list is one tab stop |
| | ↑ ↓ (docked to the bottom) or ← → (docked to the side) on the divider | Resize the panel |
| Conversation list | ↑ ↓ | Move between conversations |
| | Enter | Open |
| | F2 | Rename |
| | P | Pin or unpin |
| | Delete | Delete, after asking |
| | Menu key, Shift+F10 | The row's menu; every item in it has a key above |
| File browser | Menu key, Shift+F10 | The row's menu; every item in it has a key above |
| Explorer (a pill) | Enter | Put it on its shelf: an attribute breaks the view down, a metric or calculation is measured. On a shelf, Enter opens it for editing |
| Explorer (a pill) | S | Split by this attribute |
| Explorer (a pill) | E, D | Edit; duplicate |
| Explorer (a pill) | M | Add it to the semantic model, or update the model's definition (when the explorer has a `model`) |
| Explorer (a pill) | Delete, Backspace | Take it off the shelf it is on; each shelf pill also has a × button, and so does a field-list pill that is in use |
| Explorer (a pill) | Shift+Delete | Remove a field the person made (also on the pill's menu) |
| Explorer (a pill on a shelf) | Alt+←, Alt+→ | Move it earlier or later along its shelf; the measures' order is the order of the series. Also on the menu, greyed at either end |
| Semantic model editor | Tab, Space | Every part is a native control: the key is a list of checkboxes, "Check the key" says the engine's answer in a status or an alert, and the rows are a `ModelDiagram` whose joins are added, confirmed and removed from the list and form beneath it; where the rows come from and each join's kind are menus in that list (the menu on a line is for a pointer and is out of the tab order, named apart for a screen reader), and whether a join can repeat rows is said in words, not only by colour |
| Explorer (a pill) | Menu key, Shift+F10 | The pill's menu; every item has a key above. Dragging is never the only way |
| Explorer (a pill), touch | Tap; hold, then drag | A tap does what Enter does. A finger that holds a pill for a moment drags it, onto a shelf or along one; one that moves at once scrolls the page |
| Item controls (a report tile, a framed component in the Playground) | Tab | One stop for the whole row of controls; they appear when focus is inside the item |
| Item controls | ← → (or ↑ ↓), Home, End | Move between the controls; each is named at once in a tooltip |
| Item controls | Enter, Space | Use the control: change, chart or table, wider, narrower, move earlier or later, remove. Nothing about an item needs dragging or hovering |
| Item controls | Escape | Hide the tooltip |
| Chat (message box) | Tab to a chip's ✕, then Enter | Take an attached table or column off the message |
| SQL editor | Ctrl/⌘ Enter | Run |
| | Ctrl/⌘ Z, Shift Ctrl/⌘ Z | Undo, redo |
| | Ctrl Space | Suggest tables and columns |
| | Tab, Shift Tab | Indent, outdent |
| Playground composer (the instruction box) | Ctrl/⌘ Enter | Send the instruction to the agent (also the Apply button) |
| Workspace (a panel's heading) | The "⋯" button, then ↑ ↓ and Enter: Move left, right, up, down, to a new column, Hide. Shift+F10 or the Menu key on the heading opens the same menu | Everything a drag does: move the panel between columns, within a stack, to a column of its own, or off the workspace. Where it went is announced |
| Arrange (`useArrange`, `PageStudio` with `arrange`, the Playground), a resize handle | ↑ ↓ on the handle under a component; ← → on the handle at its right edge in a grid or row | Make the component 20 pixels shorter or taller, or move the line between it and its neighbour; focus stays on the handle. Handles show for the component under the pointer or with focus, and always on a touch screen |
| Arrange (`useArrange`, `PageStudio` with `arrange`, the Playground) | The arrow controls on a component's bar (one tab stop, ← → between them), or Up and Down in the Playground's Components panel | Move the component one place earlier or later in its container, as dragging it does; focus stays on the control. Remove takes it off. Escape stops a drag |
| Workspace (a divider) | ← → between columns, ↑ ↓ between stacked panels | Resize the two sides of the divider (also drag it) |
| Workspace (the rail) | Tab to a panel's button, then Enter or Space | Show or hide that panel. The button's name is the panel's full title, whatever short name the rail shows |
| Workspace (the rail) | Focus a button | Its name shows beside it at once, as it does on hover; Escape hides it |
| Workspace (the rail's foot) | "Show panel names on the rail" button, Enter or Space | Names under the icons, or icons only (the default) for a narrower rail |
| Workspace (a panel sharing a column) | The fold button before its title, Enter or Space | Fold the panel to its heading, or open it again; opening one folds the others when more than two would be open |
| Side navigation (folded away) | Enter or Space on its menu button, at the page's top left | Open the navigation as a dialog: a drawer on a wide screen, the whole screen on a narrow one; focus goes to its close button |
| | Tab, Shift+Tab | Stay inside the navigation while it is open |
| | Escape, its close button, or choosing a page | Close it; focus returns to the menu button |
| Side navigation | "Fold away" / "Keep open" button | Fold the navigation away to its menu button, or keep it beside the page. Not offered under 40rem, where it is always folded |
| Data model | Tab to a line's ×, then Enter | Remove that join |
| Data model and pipeline graph (the canvas focused) | + or =, - | Zoom in, zoom out (also buttons above the canvas) |
| | 0 | Fit the whole diagram to view (also "Fit to view"; "100%" resets) |
| | ← ↑ → ↓ | Pan |
| | Ctrl/⌘ + wheel, pinch | Zoom about the pointer; a plain wheel or two-finger scroll pans, and drag the background to pan |
| Pipeline graph (a node) | ← ↑ → ↓ | Move between nodes; the view pans to the focused one |
| Details panel | Escape | Close |
| Approval card | Tab, Shift Tab | Move between Allow, Deny, "Edit before allowing" and the reason field |
| | Enter in the confirmation field | Allow, once "confirm" is typed (irreversible requests only) |
| Form inputs | Native keys: arrows move a slider and a choice, Space ticks a check box, Enter in a field submits | Errors are announced (`role="alert"`) beside the field |
| Action receipt | Tab to Undo, then Enter | Ask to undo; the agent then asks to confirm it |

## Responsive rules

1. **Measure the container, not the window.** The same component sits in a page, a chat reply, a side panel and an MCP frame. `SurfaceView` and `QueryResult` are containers; a host marks any other region with `.sf-container`.
2. **Three widths**: narrow up to 480px, medium 481 to 840px, wide above. Design narrow first.
3. **Fluid first**: `repeat(auto-fit, minmax(min(100%, 16em), 1fr))`, `flex-wrap` and `minmax(0, 1fr)` before any breakpoint.
4. **What changes when narrow**: `Grid` and `Row` stack; review cards put actions on their own lines; a table that cannot fit restacks with each cell under its heading or scrolls in its own region.
5. **Touch**: targets grow to 44px; nothing depends on hover (the remove button on a join line is always shown where there is no hover).
6. **Density** is a theme choice (`comfortable`, `compact`), separate from width.

## Known gaps

- No screenshot tests, and the browser tests run in Chromium and one theme only.
- `DataGrid` has not been reviewed against the ARIA grid pattern with a screen reader.
- ECharts canvases have a text label but no keyboard path through data points; the table view is the alternative.
