# @surfaces-ui/components

## 0.1.0

### Minor Changes

- 582569d: The components an app places itself (`AnalyticsChat`, `Chat`, `PageStudio`, `ThemePicker`, `ConnectionBuilder`, `ModelLineage`, `ChecksPanel`, `ObjectInfo`, `CertificationBadge`, `ItemControls`) are described once as data in `@surfaces-ui/components/app-components` and `@surfaces-ui/chat/app-components`: their plain-data props as JSON Schema, the parts a host supplies in code, their callbacks and an example, each prop checked against the component's props type by `describeAppComponent`. `pnpm docs:gen` writes a page for each to `docs/components`.
  
  `Chat` tells `onThreadChange` about a change of thread only, so a host that passes a new function on every render and sets state in it no longer renders in a loop.
- 582569d: Arranging a surface by hand is part of the library, not only the playground. `useArrange` (with `ArrangeToggle`, `ArrangeHelp` and `ArrangeGhost`) in `@surfaces-ui/spec/react` lets a person move components by dragging or by keyboard, put two side by side, and set heights and column widths, on any surface; the pure helpers behind it (`moveComponentMessages`, `stepComponentMessages`, `besideMessages`, `heightMessages`, `gridWidthsMessages` and others) are in `@surfaces-ui/spec`. What it sends is the same JSON an agent sends to arrange a page. `PageStudio` takes `arrange` (off by default): each arrangement is one undo step, logged by the person who made it, and told to the agent with the next instruction as a `layout.changed` note. The styles are in `@surfaces-ui/components/styles.css` as `sf-arrange-*`.
  
  `editsFromMessages` no longer removes a component that a message moves from one container to another.
- 582569d: Developer tools for agent-generated UI. `<SurfacesDevTools>` from the new `@surfaces-ui/devtools`, placed once around an app, records what the library does inside it and shows it in a drawer (a button, or Ctrl+Shift+D): every message in (as it arrived, as it was read, and what the catalog said), each component drawn, problems, state, events sent back, agent turns and service calls with their SQL and timings, with a scrubber that redraws any surface as it stood at an earlier step. It is on in a development build and absent in production unless `enabled` says otherwise, and its panel is loaded only when opened.
  
  The new `@surfaces-ui/trace` holds the recorder (`createRecorder`), wrappers for backends used outside the providers (`traceDataSource`, `traceAgent`, `traceService`), pure replay and diff (`replay`, `diffJson`, `stepDiff`) and `TraceProvider`. `DataSourceProvider`, `DiscoveryProvider`, `PipelinesProvider`, `SemanticsProvider`, `SurfaceView`, `useSurfaces` and `useChat` record themselves when a recorder is above them, and do nothing differently when none is. A trace never holds row values or credentials.
  
  `SurfaceView` now catches a component that throws while it is drawn: the usual notice is shown in its place, the rest of the surface stays, and `onProblem` is told `RENDER_FAILED`. An app made with `create-surfaces` starts with the dev tools in place.
  
  Picking a component, in the Components pane or by pressing it on the page, outlines it, narrows the lists to what it did, and lists likely causes for it by fixed rules (`componentFindings`).
- 582569d: `Explorer` and `ReportBuilder`: each shelf says which axis it is; the chart is drawn as bars, a line or an area; bars can be swapped onto their side; each measure can take its own kind and a right-hand scale, marked "left" or "right" on its pill (`ExploreState.chart`, also the `chart` prop in the catalog and kept on report tiles); pills move along a shelf by drag, touch included, or Alt+arrows; a field in use can be taken off from the field list, and a person's own field removed with Shift+Delete. `Chart` takes `horizontal`.
- 582569d: First release of Surfaces UI: components for data and analytics, agent-drawn UI (A2UI), chat with approvals, model adapters for Claude and OpenAI-compatible servers, a data server over DuckDB, DataFusion and Teradata, six sample datasets, and `create-surfaces` to start an app.
- 582569d: Gummy motion. New tokens `--sf-ease-gummy` (a damped spring) and `--sf-duration-springy`, zero under reduced motion. A press springs back when let go, the segmented thumb slides with the spring and squishes where it lands, and a control that switches on or off squishes once after a pointer or a finger changed it. The NavBar's highlight slides from page to page; tree carets turn and the rows beneath glide as a branch opens; sections open to their height; a folded workspace panel drops in when unfolded; and the chat's setup menu slides between its sections.
- 582569d: `Markdown` takes `resolveImage` (an image is drawn only where the host gives its address; its description otherwise) and `openLink` (a link the host follows in place instead of a new tab). A numbered list split by a code block keeps its own numbers, and a wide table is a focusable region that a keyboard can scroll.
- e6fb0a5: Three things an app built on the catalog needs.
  
  - `NodeGraph`: things and the links between them as a graph (ECharts' graph series), with the same things listed beside it so it works without a pointer. A group takes a colour; a level is how full a node is drawn. In the catalog as `NodeGraph`.
  - `extendCatalog(base, { id, title, description, components })`: one catalog that draws everything the base does plus an app's own components.
  - A person's own layout of a shipped page, kept as edits and replayed over it (`layoutEdits`, `personalisePage`, `parsePersonalLayout`). A component marked with the `surfaces_locked` extension stays on the page: Arrange can move and size it but not remove it.
- 5812a44: State is held one way across the library.
  
  - The plain filter form (`FilterSpec`, `filtersFromSpec`, `toggleValueFilter` and the rest) lives in `@surfaces-ui/data`; `@surfaces-ui/components` still exports it. New: `parseFilterSpecs`, `parseSortSpecs`, `chosenValues`, `selectValues`.
  - `createViewState` holds `{ filters: FilterSpec[], sorts: SortSpec[] }`, the form page filters and agents use, and gains `setFilters`. `parseViewState` still reads the older `{ selections, ranges }`.
  - A second click on a bar adds its value to the filter (`in`) and a click on a chosen bar takes it out, in hand-built dashboards, reports and agent-drawn pages alike.
  - One storage interface: `StateStorage`, `memoryStorage` and `browserStorage` are in `@surfaces-ui/data` (and still in `@surfaces-ui/state`); `LibraryStorage` is gone. `ThemeProvider` takes `storage` and `storageKey` in place of `store`, and `SurfacesDevTools` takes `storage`.
  - `persist` puts a part saved with `select` back without losing the rest (or through `restore`), and a change made while the saved value loads is no longer overwritten. The same holds for the theme.
  - `ReadableStore` names what `derive` returns and `useStore` reads.
- 582569d: Five presets replace the ten: Ink (the new default), Aurora (the demo theme), Sand, Berry and Mono. A theme that names an old preset is refused by `applyThemeRequest` with the list of new names; a saved theme document still loads through `parseTheme`.
  
  Twelve new hues built in OKLCH replace the eight, with series orders Classic, Aurora, Sand, Ink and Berry, each tested for red-green colour blindness and for 3:1 on every preset's panes.
  
  Colours now come in ranges generated by the contrast each level must reach (`stepByContrast`, `mixOklab`): `--sf-color-bg-1..4`, `--sf-color-label-1..4`, `--sf-color-fill-1..4`, `--sf-color-gray-1..6`, `--sf-color-divider` and `--sf-color-accent-hover` / `-pressed`. Glass for floating controls (`--sf-glass-regular`, `-thick`, `-clear`, `-filter`, `-edge`, `-highlight`, `-shadow`, `--sf-glass-muted`) is tested against the worst thing behind it, and turns solid under reduced transparency, increased contrast and forced colours. A type scale adds `--sf-font-size-xs` and title sizes, weights and line heights.
  
  Motion is timed by tokens (`--sf-duration-fast`, `--sf-duration`, `--sf-duration-slow`, `--sf-ease`, `--sf-ease-out`, `--sf-ease-spring`, `--sf-press-scale`), all stopped under reduced motion. Components follow the new look: buttons are fills that answer a press, menus, popovers, tooltips and the side navigation's drawer are glass, cards and panels lose their outlines, and a box inside a box gives up its fill. `NavBar` is new in `@surfaces-ui/components`: sections across the top on glass, the current section's pages beneath, and a full-screen menu on a narrow screen.

### Patch Changes

- 582569d: Accessibility fixes found by axe in a real browser. Status colours and accent text now reach 4.5:1 on every surface they are drawn on, including the soft accent fill. Explorer pills and pipeline graph nodes say their visible name first, then the rest as hidden text, so "Channel (attribute, in use)" rather than a label that differs from what is shown. Tables that scroll on their own take focus and are named regions. The chat's conversation log holds articles rather than list items without a list, and stream metric sparklines sit inside their definition. A new `.sf-visually-hidden` class is pinned so hidden text never widens a page from inside a scroll box.
- 2d542c5: A link drawn as a button (`<a class="sf-button">`) is laid out like one. `.sf-button` set a height, which an inline `a` ignores, so its words sat at the top of the box; an `a.sf-button` is now an inline flex box with its words centred and no underline. Buttons are unchanged.
- 582569d: Chart tooltips write each value in full and rounded, in the measure's own format (6.1% rather than 0.0612345, $1,234.50 rather than 1234.5).
- 582569d: Density now changes the controls: a new token, `--sf-control-size` (32px comfortable, 24px compact), sizes every button, field, segment and icon button, never under the target minimum (44px on a touch screen). Icon buttons draw their icon with `ControlIcon` (a new `close` icon) instead of ×, ✎, ↑ and ↓ characters, centred at any size. On a touch screen a tile's controls sit in one row with no box left behind after a tap.
  
  `SideNav` folded away no longer keeps a strip beside the page: a menu button floats at the top left, and the navigation slides in from the left as a modal dialog: a drawer over a dimmed page on a wide screen, the whole screen under 40rem (focus inside, closed by Escape, its close button, a press outside or choosing a page). It no longer opens on hover. Under 40rem it is always folded and offers no pin (`SIDENAV_NARROW`).
- 582569d: A High contrast preset, and `Theme.contrast: "more"` for any theme. With it, edges reach 3:1, tertiary labels 7:1 and quaternary 4.5:1, dividers are stronger, glass is solid, and every pane and control draws its edge through the new `--sf-color-edge` token (transparent otherwise, and turned on by `prefers-contrast: more` too). Sand's accent is now a burnt orange with some brown in it, and its charts follow a new orange-led order.
- 582569d: A `Chart` with `xBins` over a DECIMAL column now sizes its bins from the real range. The lowest and highest values were read as plain numbers, so a DECIMAL's unscaled digits widened the range a hundredfold or more and every value fell in one bin. They are now read with `numericValue` (`rangeBinWidth`).
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [5812a44]
- Updated dependencies [582569d]
  - @surfaces-ui/tokens@0.1.0
  - @surfaces-ui/trace@0.1.0
  - @surfaces-ui/data@0.1.0
  - @surfaces-ui/proto@0.1.0
