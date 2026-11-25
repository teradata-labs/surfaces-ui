# @surfaces-ui/components

## 0.3.0

### Minor Changes

- f5a2c37: `chartAdvice` flags three more shapes, so a Chart says so with no model: bars over more than 24 time points or numbers in order (`bars-over-time`: a line reads the trend; a histogram's bins are left alone), a pie over ordered values (`pie-in-order`), and a legend asked for one series (`one-series-legend`). `ChartShape` gains `binned` and `legend`, and `drawnShape` takes `legend` and `histogram`.
- 1999320: A host can add its own named themes beside the built-in presets: `ThemeProvider` takes `themes`, and a page's `theme`, an agent surface's `surfaces_theme` and `ThemePicker` choose them by name. `applyThemeRequest`, `editPage` and `presetByName` take the same list as an option. A built-in name always means the built-in preset.

### Patch Changes

- 5f620c2: A view filtered on a column its own rows lack now draws without that filter and says so, instead of failing. A page-wide `FilterBar` by region over a total with no region column used to stop the total drawing ("could not be loaded"). When the engine reports an unknown column, the engine service reads the base query's columns (`columnsQuery`, no rows), drops the filters on missing columns (`withoutMissingFilters`, names compared without regard to case), runs the view again, and adds a `FILTER_COLUMN_MISSING` notice: "Not filtered by region: its rows have no region column." Any other unknown column still fails as before. `memoryDataSource` does the same. `Chart`, `Sparkline`, `BulletGraph`, `Metric`, `PivotTable`, `RowList` and `DataGrid` show the notice under the view in words (`DataNotes`, `role="note"`); `QueryResult` already lists notices with its SQL.
- 51de362: Every package's README links to the guides on surfaces-ui.com and says to install all Surfaces UI packages at the same version.
- 2d99b9f: Every SQL statement is highlighted, read-only or not. `QueryResult`'s SQL sent, `ModelDiagram`'s SQL for the model and `AskData`'s proposed SQL are `CodeBlock`s (with Copy) instead of plain text, and the two places a person edits SQL use `SqlEditor`: the query a semantic model is written as (`SemanticModelEditor`) and the SQL in an editable approval (`ApprovalCard`).
- 1c60f3a: Conversations on a phone. A `Workspace` panel can be marked `fill` for content that scrolls inside itself; stacked in a narrow container it is given about a screenful instead of its content's height, and `AnalyticsChat` marks its conversation so. The analytics conversation no longer draws its suggestions and composer over the thread when space is short, suggestions are one row that scrolls sideways in a narrow place, and the composer's Send is a touch target rather than 1.34 of one, so its tools stay on one row on a phone.
- e0d5679: A plain mouse wheel or two-finger scroll over a `Chart` with a zoom bar, or over a `NodeGraph`, now scrolls the page instead of zooming. Ctrl/⌘ + wheel or a pinch zooms, as it does on pan-zoom diagrams.
- Updated dependencies [5f620c2]
- Updated dependencies [1999320]
  - @surfaces-ui/data@0.3.0
  - @surfaces-ui/tokens@0.3.0
  - @surfaces-ui/trace@0.3.0
  - @surfaces-ui/proto@0.3.0

## 0.2.0

### Minor Changes

- febcda0: Analytics components say what their numbers are:
  
  - `PivotTable` heads its totals "Total" only when every measure adds up (sum, count, count distinct); otherwise "All" (`pivot.all`), since a maximum or an average over everything is not a total.
  - `formatMetric` writes money one way: cents under a thousand, whole units to a hundred thousand, then compact. A `Sparkline` beside a `Metric` reads "$1,904" and "$498.2K", not "$1,904.00".
  - `DataGrid` takes `columns.labels`, headers to show in place of column names ("Starts" for `starts_at`); sorting, filters and the layout keep the names. The catalog's `DataGrid` takes it too.
  - `exploreChart` keeps the split when several measures are shown: each measure for each of the split's values, as `Chart` draws it ("North · Revenue"). A second attribute on the rows still splits one measure only. A chart on a page with a split and several measures now opens in Explore and goes back unchanged.
- 62a8fce: Components for the rows an app holds, so an admin or settings page needs no table of its own:
  
  - `DataTable`: a table of the host's rows with sortable headings (it asks; the host sorts), check boxes for rows and the page, each row's `ItemControls` and a right-click menu, and columns that give way as the table narrows. It sorts, filters and pages nothing itself.
  - `SelectionBar`: the count, the actions for the chosen rows (one that takes away last), Clear, and "Select all N that match" past the page.
  - `Pagination`: "51–100 of 126" with Previous and Next.
  - `ConfirmDialog` and `useConfirm()`: a modal dialog that asks before an action that is hard to undo; `await confirm({ ... })` is true or false.
  - `StatusBadge`: a short status in words with a tone's colour and shape.
  - `Combobox`: a text box with suggestions the host searches for (the ARIA 1.2 combobox).
  
  `ItemControls` has three more icons for a row's own actions: `power`, `sign-out` and `more`. New labels (`table.*`, `selection.*`, `pages.*`, `confirm.*`, `combobox.*`) can be replaced with `setLabels`.
- cc51d18: Arranging, Tab stops once on each component: at its controls, which select it. Its size handles join the order only while it is selected, as its gap and padding handles already did. `ResizeHandle` takes `tabbable` (default true) for this; viewing, with no controls, keeps every handle in order.
- 9b07da7: Layout props for the basic containers, so a page can be laid out like frames with auto layout while staying on the theme's spacing:
  
  - `gap` on Row, Column and Grid, and `padding` on Row, Column and Card: a step of the spacing scale, `"none" | 1 | 2 | 3 | 4 | 6 | 8` (`--sf-space-<step>`). Gap defaults to 4; padding to "none", and to 4 on a Card.
  - `wrap` on Row (default true): false keeps the children on one line, even in a narrow container.
  - `sizes` on Row: one per child, `"hug"`, `"fill"` or `{ fixed: px }` (24 to 1600). It wins over `widths` when both have one entry per child; with neither, the children share the width as before. Resizing a Row's children by hand gives them `widths` and takes `sizes` off.
  - A page that uses none of them is drawn exactly as before: the props add `data-gap`, `data-padding`, `data-wrap` and `data-sizes` only when they are set.
  - `spaceStep`, `spaceVar`, `spaceName`, `nextSpaceStep`, `rowSizes`, `spaceMessages`, `spaceProps` and `spaceDefault` read and set them.
  
  Arrange (`useArrange`): a drag shows a line in the gap where the component will land and outlines the container that takes it, in place of a shadow on the neighbour. Clicking a frame, or reaching its bar by keyboard, selects it (`selected`, `select`, and the `selected` and `onSelect` options for a host with its own selection); a selected Row, Column or Grid shows a handle in its gap and at its padding (a Card at its padding) that drags, or steps by arrow key, from one token to the next, labelled "16 px · space-4", and sends the change through `apply` like any other arrangement. The root is wrapped in `.sf-arrange-root` while arranging so it can be selected and outlined.
  
  Icons: `bell` and `person` for a workspace's rail (and the Workspace panel `icon` enum, which now also lists `people`); `more` and `bell` for ChatIcon, so `<MenuButton iconOnly icon="more" label="More for …">` is an overflow menu.
- 432f0fc: A model in `ChatProvider.models` can carry a `level` (`{ value, of, label }`). The Model menu draws it beside the model's name as bars rising left to right, filled up to `value` in the accent colour, with the level's word ("Everyday"). The word is what a screen reader reads; the bars are hidden from it. `ModelLevelBars` draws the same anywhere.
  
  A chat menu's popover now floats fixed to the window, placed beside its button and kept inside the window, so a panel that scrolls or clips does not cut it off; a menu of models is as wide as its longest line, so each model's name and level share one line.
- d118da4: `Popover`: a button that opens a small panel of controls beneath it, such as a view's width, zoom and data state behind one View button. A non-modal dialog opened by a disclosure button (`aria-expanded`, `aria-controls`): focus moves into the panel, Escape closes it and gives focus back to the button, a press or focus outside closes it. Placed below the button at its start or end edge and kept inside the window; controlled (`open`, `onOpenChange`) or not.
- caab7c1: Fixes and catalog additions from the Surfaces Studio pressure tests.
  
  - `extractSurfaces` reads an A2UI message written over several lines, and a list of messages; a block holding text that is not a message ends in one `error` event (`UNREAD_SURFACE`) instead of losing the change in silence.
  - The catalog prompt writes every prop's shape (`array of { column: string, desc?: boolean }`; `shapeText`), lists each function's arguments, and shows both forms of a control's `action`. A value that fits no form of a union is refused with the problems of the closest form, never a bare "Invalid input".
  - `formatString` takes `${path|words}` for a value that is not there yet.
  - New catalog components: `RowList` (one component drawn per row of a query, with the row's key in a Button's event; `RowList` in `@surfaces-ui/components`) and `Message` (one turn of a conversation).
  - Every catalog component takes `visibleWhen: { path, equals }` (or `in`). `TextField`, `NumberField`, `ChoicePicker`, `CheckBox` and `DateTimeInput` take `required` (`TextField` also `pattern`) and say what is wrong beside the field once it has been left.
  - Charts: a row with no x is left off a time or number axis and no longer sizes the y axis, and the chart says so; axis titles are placed from their tick labels and no longer clipped.
  - Series colours: every named order is rearranged so any two of its first five colours can be told apart, not only neighbours (blue and indigo no longer both lead). `checkSeries` reports such pairs. A saved theme holding an earlier order is moved to the current one when read.
  - `SideNav`: the menu button of a folded navigation sits in its own container (sticky), not fixed to the window, and tells what follows it the room to leave (`--sf-sidenav-inset`); its accessible name no longer says "navigation" twice.
  - `KeyValue` rows are no wider than 36rem, so a label and its value stay a pair on a wide page.
  - Seeds: a seed number above 22018 no longer overflows a 32-bit integer in DuckDB.
- 7343db7: The rest of three issues from the Surfaces Studio pressure tests.
  
  - Series colours can be told apart with red-green colour blindness: any two of an order's first five now differ for those readers too, because the series hues no longer share one lightness (on light surfaces red is a crimson and green a forest green, pink and magenta are deeper; on dark surfaces green and teal are brighter). `HUES` holds the new steps and `RETIRED_HUES` the old; a saved theme using a named order is moved to them when read (`currentSeries`, `currentHue`). `checkSeries` warns about two of the first five that only colour blindness brings together.
  - A `Button` waits for loose inputs it names in `requires`: while one is missing or wrong it is marked unavailable, and a press sends nothing, says what is wrong beside each and moves to the first (`useInputCheck`, `useRequiredInputs` for your own renderers).
  - A `Form` field takes `visibleWhen: { field, equals }` (or `in`): it is asked for only while another field holds that value, and is not required and stored as null otherwise. `FormField.visible_when` in the contract, `fieldAsked` in `@surfaces-ui/data`, checked the same way by `checkSubmission`.
  - A folded `SideNav` keeps a slim strip for its menu button instead of floating over the page, so nothing needs to step aside for it (`--sf-sidenav-inset` is gone). Its drawer opens over the surface it is drawn in, not the window, when it is inside one, and it folds for a narrow surface as it does for a narrow window.
- bbb0b52: One resize handle, for Arrange and for apps.
  
  - `ResizeHandle` (`@surfaces-ui/components`): a handle on the right or bottom edge of a positioned parent that sizes a width or a height. A focusable `separator` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`; dragged with pointer events, so a mouse, a pen and a finger all work; arrows (Shift for five steps), Home and End move it, Enter or a double click resets it, Escape gives up a drag, and so does the handle going away mid-drag. Props: `edge`, `value`, `min`, `max`, `snap`, `step`, `unitPixels`, `startFrom`, `onChange`, `onChangeEnd`, `onReset`, `label`, `valueText`, `always`. Its maths are plain functions: `clampResize`, `dragResize`, `keyResize`, `defaultResizeStep`. Described as an app component, with a demo in the playground.
  - Arrange draws its height and width handles with `ResizeHandle`. Each press target is now at least `--sf-target-min` across, and Enter or a double click puts a size back (the widths and height the page shipped with when `useArrange` is given `shipped`; equal widths and the height the component chooses otherwise).
  - `useArrange({ resizeWhileViewing: true })` keeps the width handles between a `Grid`'s or `Row`'s columns, and the height handle under a component with a height of its own (a chart or a table, say) or one whose height is set, while nobody is arranging. A drag sends the same messages Arrange sends, as one step. Pass the new `arrange.surfaceFrame` to `SurfaceView` as `frame`; `arrange.shown(surface)` is the surface itself when nothing is being sized, so it can be drawn always.
  - `PageStudio` takes `resizeWhileViewing` beside `arrange`.
- f481687: `SegmentedControl`: a few equal choices as one bar with a sliding thumb (a radio group: one tab stop, arrow keys move the choice). `ReportBuilder` switches between Build and View with it; its Build and View are now radios named "Build" and "View", no longer buttons. A `.sf-segment` that is a `<button>` no longer shows the browser's own border and fill.
- c3481a2: Add the site catalog: `siteCatalog` (the basic components plus Hero, Section, FeatureGrid, DeviceFrame, PromptReveal, Showcase, NavBar, Footer, Media, Quote, Callout, PostCard and PostList), `siteRenderers`, `siteMarkup`, `siteLink` and `MediaPolicyProvider`, with the components themselves in `@surfaces-ui/components` and their `sf-site-*` styles. A Media loads only an address the page gives or an origin it allows. `catalogDocs` takes a `markup` name.

### Patch Changes

- 32556a0: Surfaces UI's own elements size with `box-sizing: border-box` (at no specificity), as the playground draws them, so a full-width part with padding (NavBar's menu items, filter chips, SideNav buttons) no longer runs past its row in an app without its own border-box reset.
- 2e1d220: A host can offer buttons under a reply and choices in the composer. A new `actions` part (`ChatActions`, drawn by `ActionsCard`) holds a row of buttons, or several alternatives one row each with buttons for the whole set after them; a press reaches `MessageList`'s new `onPartAction(partId, actionId, choiceId?)`, a disabled button stays reachable by keyboard with its reason read, and `outcome` replaces the buttons once handled. `ChatComposer` takes `context` (`ComposerContext`: chips for what a message is about that is not data, removable through `onClear`) and `toggles` (`ComposerToggle`: checkboxes for the next message). Nothing changes without them.
- 695a82a: DataTable: a ticked row is a faint neutral fill with an accent edge at its start (a highlight border under forced colours), and a neutral StatusBadge in it keeps its outline.
- a07ca52: `DeviceFrame`'s phone keeps its screen inside the bezel in Safari: the screen is placed by inset rather than `height: 100%`, which Safari resolved against the whole frame, padding included, so the screen ran over the rounded bottom corners. On the phone, content that scrolls up now fades out toward the island instead of being cut along a line.
- 6384252: A Form stretched taller than its fields keeps them together at the top, instead of spreading the fields, and each field's label and control, down its height. Grid takes `align` (`start`, `center`, `end`, `stretch`; default `stretch`) so each child can keep its own height in a row of mixed content.
- b4b5fb0: NavBar marks the page shown with its name in the text colour and a straight accent line under it (the full-screen menu fills the row, as it does the section), not an accent-tinted pill whose underline curved with the pill. SelectionBar takes a light accent tint, not the full one.
- Updated dependencies [caab7c1]
- Updated dependencies [7343db7]
  - @surfaces-ui/tokens@0.2.0
  - @surfaces-ui/data@0.2.0
  - @surfaces-ui/proto@0.2.0
  - @surfaces-ui/trace@0.2.0

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
