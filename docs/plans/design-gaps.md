# Design gaps after the theme refresh

The theme refresh (branch `feat/theme-refresh`) put in the foundations:
- eight presets: Ink, Aurora, Sand, Berry, Harbor, Moss, Mono and High contrast;
- thirteen tested hues;
- colour ranges made by contrast;
- glass for floating controls;
- a type scale and motion tokens;
- controls drawn as fills, with no box inside a box;
- `NavBar`;
- an appearance menu in the playground's top bar.

This page lists what is still missing, in priority order. Each section says what is there now, what is missing, and what done looks like.

## 1. Component pages: a splash page, then a page per component (most important)

**There now:**
- The playground's Catalog area (`apps/playground/src/areas/ComponentCatalog.tsx`) shows each catalog component with:
  - its description;
  - a live preview;
  - a props form or JSON;
  - the events it sent;
  - its data model;
  - a props reference;
  - the A2UI message.
- App components (`appDemos.tsx`) also show their JSX.
- `pnpm docs:gen` writes one Markdown page per component to `docs/catalog/components` (64 pages) and `docs/components`. These pages have a description and a props list, but no examples, pictures or code to copy.
- `fromJsonRender` exists in `@surfaces-ui/spec`, but only the Playground's instruction box uses it (`composerText.ts`). No component page shows a json-render spec.

**Missing:**
- **A splash page.** Nothing introduces the library on arrival: the app opens on the Playground. It needs:
  - a large title;
  - one line on what the library is for;
  - a live hero, such as a dashboard drawn by an agent;
  - entry points: build with an agent, browse components, connect data, themes;
  - the eight presets, switchable in place.
- **A component index:** every component as a tile with a small live preview, grouped as the catalog groups them, and filterable.
- **A detail page per component**, the same layout for catalog and app components:
  - **Hero:** the live preview, framed so its look is the point.
  - **Light and dark switch on the preview itself**, plus a preset picker. This uses a scoped `ThemeProvider` (`scope="scoped"`), so a person can compare without changing the site.
  - **Markup examples in tabs, each copyable, all generated from the same props:**
    - React/JSX (a plain import);
    - A2UI JSON (what an agent sends);
    - a json-render spec (`{ root, elements, state }`), round-tripped through `fromJsonRender` so it is proved, not hand-written.
  - **Several examples per component**, not one: each catalog entry gets `examples` (named, with a sentence on when to use it) alongside the single `example` it has now.
  - **Props table:** name, type, default, required, description, and whether an agent can set it. Generated from the Zod schema, as the reference is now.
  - **Events table**, with the context each event carries (already published as `x-events`).
  - **Accessibility notes:** keys, roles, and what is announced, taken from `docs/accessibility.md`.
  - **Do and don't**, for components with chart or layout rules (taken from the chart-standards skill).
- **The same pages as static docs:** `pnpm docs:gen` should write the examples (JSX, A2UI, json-render) into `docs/catalog/components/*.md`, so the GitHub docs and `llms.txt` carry markup an agent can copy.

**Done since:**
- Area changes cross-fade under a still bar (view transitions, in the playground).
- The segmented thumb slides, for every `.sf-segmented`, from CSS alone.
- `motion.test.ts` checks that every library transition and animation is timed by the tokens and stops under reduced motion.
- Component pages: code as React markup, A2UI and json-render, and the preview in its own mode and theme.

**Done when:**
- every catalog and app component has a detail page with the three markup tabs, at least two examples, and a preview that switches light and dark on its own;
- a test checks that each json-render example converts to the same surface as its A2UI example;
- the generated Markdown carries the same examples.

## 2. Motion and transitions

**There now:**
- Duration, easing, spring and press-scale tokens, all zeroed under reduced motion.
- Keyframes `sf-pop`, `sf-fade`, `sf-slide-in` and `sf-drop-in`.
- Menus, popovers, tooltips, the SideNav drawer and the NavBar sheet animate in.
- Buttons shrink when pressed.

**Missing:**
- **Exit animations.** Nothing animates out: menus, popovers, sheets and dialogs vanish at once (there is no `@starting-style`, exit keyframe or delayed unmount). Apple dismisses with the reverse of the entrance.
- **Page and area transitions.** Changing area, page or tab swaps content with no transition. Use the View Transitions API where there is one (a cross-fade, with the large title sliding), and nothing where there isn't.
- **Shared element moves:**
  - a component tile in the index growing into its detail page;
  - a report tile opening into the builder;
  - a panel moving between Workspace columns.
- **Layout changes:** in Arrange, the Explorer's shelves, report tiles and Workspace panels, items jump to their new place instead of gliding (a FLIP animation, or View Transitions with a name per item).
- **Segmented controls:** the selected segment should slide between options rather than jump.
- **Lists:**
  - rows added or removed (chat messages arriving, pills on a shelf, filters, history) should fade and slide;
  - a streaming reply should reveal smoothly rather than by line jumps.
- **Charts:** bars and lines draw in on first render and morph when data changes, timed by the motion tokens and turned off under reduced motion. ECharts animation is currently left at its own defaults rather than tied to the tokens.
- **Loading:** there is no shared loading state. Each component writes its own "Loading…" text. Add a quiet skeleton for grids, charts and lists, which does not shimmer under reduced motion.
- **Scroll edge:** the NavBar shows an edge once content scrolls under it. Apple also shrinks the large title into the bar as the page scrolls. Not done.

**Done when:**
- every element that opens also closes with motion;
- area changes cross-fade;
- reordering glides;
- the segmented thumb slides;
- charts animate on the motion tokens;
- a test checks that every animation and transition stops under `prefers-reduced-motion`. It should go through all `@keyframes` and `transition` rules, as the token tests do for durations.

## 3. Components, dialled in to feel like Apple's

**There now:**
- Buttons are fills with pressed states.
- Cards and panels have lost their outlines.
- Menus are glass.
- Inputs keep a 3:1 edge.
- Selects draw their own arrow.

**Missing, component by component:**
- **Switch.** There is no switch: on/off settings are checkboxes, 13 of them across the library, chat and spec. Add a `Switch` (`role="switch"`, sliding thumb, sized by the control tokens) and use it wherever a setting takes effect at once, keeping checkboxes for choosing several items.
- **Pop-up button for selects.** Native selects should become a button showing the value with a chevron, opening a glass menu with a checkmark on the current item, the way `ModelMenu` does already. Keep the native select on touch, where the system picker is better.
- **Search field.** A rounded fill with a magnifier icon and a clear button, used by every search box (`DataSearch`, `ObjectBrowser`, the catalog filter, the composer's menus). Today each is a plain bordered input.
- **Grouped lists (inset grouped tables).** For settings and detail pages (`ObjectDetail`, `ModelsPanel`, `AgentSetupPanel`, `SourceList`), use rows in a rounded group:
  - the label on the left and the value on the right;
  - a disclosure chevron for rows that open something;
  - dividers inset from the leading edge.
- **Icons.** One outline icon set, drawn at the weight of the text beside it, everywhere an icon appears. `ControlIcon` and `WORKSPACE_ICONS` are a start, but many places still use text characters (▸ in the object tree, ⋯, arrows).
- **Sheets and dialogs.** One shared modal sheet (rounded top corners, a grabber on a phone, swipe or Escape to close, the background dimmed and scaled back slightly) for confirmations, `ConnectionBuilder`, `IngestWizard` and the full-screen panel views. Today each is drawn in place.
- **Popovers with an arrow** pointing at what opened them (Explorer pill editing, the appearance menu, the composer menus).
- **Toolbars.** A grid's, a result's and an editor's controls should become one quiet toolbar row of icon buttons with tooltips, instead of rows of text buttons (`Download CSV`, `Copy SQL`, `Format`).
- **Tabs versus segmented controls.** Use segmented controls only for a few views of one thing (Table, Chart, Pivot), and a tab bar or the NavBar local row for switching areas. The Pages gallery's example list, a wrap of segments, should become a sidebar or index.
- **Data grid.** Lighter header (secondary label, no fill), row hover as a fill, a selected row in the accent's soft fill, numbers in tabular figures, and a sticky header on glass.
- **Charts in the style of Apple's Swift Charts:**
  - bars with rounded data ends;
  - hairline grid lines in the divider colour;
  - axis labels in tertiary text;
  - a selection rule with a value bubble on hover;
  - no axis line when the grid carries the scale.
  This must stay within the chart-standards rules (zero baseline, one scale, sorted bars).
- **Chat.**
  - The person's messages should be bubbles on the accent's soft fill; replies stay full width without a bubble.
  - The composer stays a rounded glass field with the send button inside.
  - Tool steps should fold into one line with a disclosure, rather than a box.
- **Metrics and stats:** the headline number in a large title size with tabular figures, the label in secondary text above it, the change in a status colour with an arrow symbol.
- **Empty states:** a symbol, a title and one line of help, centred, with the one action that fixes it. Today they are a sentence of muted text.
- **Focus.** The focus ring should follow the control's own radius and sit outside it (Apple's focus ring), the same on every control.

**Done when:**
- `Switch`, the pop-up button, the search field, a grouped list, a sheet and an icon set exist in `@surfaces-ui/components`, each with a page under section 1 and a test against `memoryDataSource` where it reads data;
- every place in the library that drew its own version uses the shared one;
- the browser tests and axe checks pass in every preset, light and dark.

## 4. Smaller gaps left from the refresh

- The docs images `chat.png`, `approval.png` and `composer.png` still show the old look. They need a conversation played before the capture, so they were not retaken with the others.
- The appearance menu lives in the playground. If other apps want it, it could move into `@surfaces-ui/components` as a NavBar action (`AppearanceMenu`), described in `appComponents.ts`.
- Popovers opened inside the NavBar cannot be glass: the bar is glass already, and a blur inside a blur only sees the bar's own content. The appearance menu uses a solid raised fill for this reason. A popover rendered outside the bar, in a portal, could be glass.
- Mono keeps coloured chart series (Classic), because eight greys cannot be told apart. Its magnitude ramp is grey. A chart with a single series in Mono could be drawn in the text colour; this is not done.

## Suggested order

1. The component detail page and the splash page, with markup tabs (JSX, A2UI, json-render) and the scoped light/dark switch. This is where people judge the library.
2. Exit animations, segmented thumb, area cross-fades, and the reduced-motion test.
3. `Switch`, the pop-up button, the search field and the icon set, used everywhere.
4. Grouped lists, sheets, the grid and the chart styling.
5. The remaining motion (shared elements, layout gliding, chart morphs) and the smaller gaps.
