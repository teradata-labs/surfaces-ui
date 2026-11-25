# @surfaces-ui/spec

## 0.3.0

### Minor Changes

- 1999320: A host can add its own named themes beside the built-in presets: `ThemeProvider` takes `themes`, and a page's `theme`, an agent surface's `surfaces_theme` and `ThemePicker` choose them by name. `applyThemeRequest`, `editPage` and `presetByName` take the same list as an option. A built-in name always means the built-in preset.

### Patch Changes

- 5f620c2: A view filtered on a column its own rows lack now draws without that filter and says so, instead of failing. A page-wide `FilterBar` by region over a total with no region column used to stop the total drawing ("could not be loaded"). When the engine reports an unknown column, the engine service reads the base query's columns (`columnsQuery`, no rows), drops the filters on missing columns (`withoutMissingFilters`, names compared without regard to case), runs the view again, and adds a `FILTER_COLUMN_MISSING` notice: "Not filtered by region: its rows have no region column." Any other unknown column still fails as before. `memoryDataSource` does the same. `Chart`, `Sparkline`, `BulletGraph`, `Metric`, `PivotTable`, `RowList` and `DataGrid` show the notice under the view in words (`DataNotes`, `role="note"`); `QueryResult` already lists notices with its SQL.
- Updated dependencies [f5a2c37]
- Updated dependencies [5f620c2]
- Updated dependencies [1999320]
- Updated dependencies [51de362]
- Updated dependencies [2d99b9f]
- Updated dependencies [1c60f3a]
- Updated dependencies [e0d5679]
  - @surfaces-ui/components@0.3.0
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
- 05b01f6: `useArrange` takes `kindName(kind)`, so a host can name a kind of component in its own words on the arrange bar and in the controls' labels ("Stack across" for a Row, say). Without it, the catalog's names are used as before.
- cc51d18: Arranging, Tab stops once on each component: at its controls, which select it. Its size handles join the order only while it is selected, as its gap and padding handles already did. `ResizeHandle` takes `tabbable` (default true) for this; viewing, with no controls, keeps every handle in order.
- 7edc469: `basicsCatalog`: the components every catalog shares (layout, text, links, buttons, inputs and forms, navigation and the theme switch) as a catalog of their own, with `basicComponents` and `basicsRenderers`. The analytics catalog is built on the same definitions and is unchanged. A catalog that needs no data components can now be built with `extendCatalog(basicsCatalog, …)`.
- 9b07da7: Layout props for the basic containers, so a page can be laid out like frames with auto layout while staying on the theme's spacing:
  
  - `gap` on Row, Column and Grid, and `padding` on Row, Column and Card: a step of the spacing scale, `"none" | 1 | 2 | 3 | 4 | 6 | 8` (`--sf-space-<step>`). Gap defaults to 4; padding to "none", and to 4 on a Card.
  - `wrap` on Row (default true): false keeps the children on one line, even in a narrow container.
  - `sizes` on Row: one per child, `"hug"`, `"fill"` or `{ fixed: px }` (24 to 1600). It wins over `widths` when both have one entry per child; with neither, the children share the width as before. Resizing a Row's children by hand gives them `widths` and takes `sizes` off.
  - A page that uses none of them is drawn exactly as before: the props add `data-gap`, `data-padding`, `data-wrap` and `data-sizes` only when they are set.
  - `spaceStep`, `spaceVar`, `spaceName`, `nextSpaceStep`, `rowSizes`, `spaceMessages`, `spaceProps` and `spaceDefault` read and set them.
  
  Arrange (`useArrange`): a drag shows a line in the gap where the component will land and outlines the container that takes it, in place of a shadow on the neighbour. Clicking a frame, or reaching its bar by keyboard, selects it (`selected`, `select`, and the `selected` and `onSelect` options for a host with its own selection); a selected Row, Column or Grid shows a handle in its gap and at its padding (a Card at its padding) that drags, or steps by arrow key, from one token to the next, labelled "16 px · space-4", and sends the change through `apply` like any other arrangement. The root is wrapped in `.sf-arrange-root` while arranging so it can be selected and outlined.
  
  Icons: `bell` and `person` for a workspace's rail (and the Workspace panel `icon` enum, which now also lists `people`); `more` and `bell` for ChatIcon, so `<MenuButton iconOnly icon="more" label="More for …">` is an overflow menu.
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
- c3481a2: Add the site catalog: `siteCatalog` (the basic components plus Hero, Section, FeatureGrid, DeviceFrame, PromptReveal, Showcase, NavBar, Footer, Media, Quote, Callout, PostCard and PostList), `siteRenderers`, `siteMarkup`, `siteLink` and `MediaPolicyProvider`, with the components themselves in `@surfaces-ui/components` and their `sf-site-*` styles. A Media loads only an address the page gives or an origin it allows. `catalogDocs` takes a `markup` name.

### Patch Changes

- 6384252: A Form stretched taller than its fields keeps them together at the top, instead of spreading the fields, and each field's label and control, down its height. Grid takes `align` (`start`, `center`, `end`, `stretch`; default `stretch`) so each child can keep its own height in a row of mixed content.
- 0487cde: `SurfaceView` no longer records two trace events with one id. A component drawn under an id that another kind of component held before (or drawn again after a frame was put around it) reused the first one's span, so the dev tools Timeline held rows with the same key and React warned about it. A scope now belongs to a component's place, id and kind, is recorded once, and is let go when the component is gone.
- Updated dependencies [febcda0]
- Updated dependencies [62a8fce]
- Updated dependencies [cc51d18]
- Updated dependencies [32556a0]
- Updated dependencies [2e1d220]
- Updated dependencies [695a82a]
- Updated dependencies [a07ca52]
- Updated dependencies [6384252]
- Updated dependencies [9b07da7]
- Updated dependencies [432f0fc]
- Updated dependencies [b4b5fb0]
- Updated dependencies [d118da4]
- Updated dependencies [caab7c1]
- Updated dependencies [7343db7]
- Updated dependencies [bbb0b52]
- Updated dependencies [f481687]
- Updated dependencies [c3481a2]
  - @surfaces-ui/components@0.2.0
  - @surfaces-ui/tokens@0.2.0
  - @surfaces-ui/data@0.2.0
  - @surfaces-ui/proto@0.2.0
  - @surfaces-ui/trace@0.2.0

## 0.1.0

### Minor Changes

- 582569d: Surfaces now speaks A2UI v1.0, the current version of the protocol, and still reads v0.9.
  
  What changes in what the library writes and accepts:
  
  - A binding is `{ "@path": "/a" }` and a function call `{ "@call": "name", "args": {} }`.
  - A component's `accessibility` is `@accessibility`, and a component may name its catalog with `@catalogId`.
  - `createSurface` is sent once for a surface, may carry its first `components` and `dataModel`, and no longer takes `theme`. A surface's theme and its reply contracts are the `surfaces_theme` and `surfaces_expects` extensions in `createSurface.metadata`.
  - `updateDataModel` needs a `value`; `null` removes what is at the path.
  - Metadata that is never drawn travels in A2UI's `extensions`: `@metadata` on a component, `metadata` on a surface and an action, and `metadata` on a json-render element and spec.
  
  Nothing saved breaks: a v0.9 message, page, surface or conversation is turned into v1.0 when it is read (`upgradeMessage`, `upgradePage`, `upgradeSurface`). Code that builds components by hand needs `{ "@path": … }` where it wrote `{ path: … }`; `binding("/a")` writes one.
  
  Not taken up from v1.0 yet: functions called across the wire, several catalogs in one surface, `allowedParents`, `@checks` and `@index`.
- 582569d: Arranging a surface by hand is part of the library, not only the playground. `useArrange` (with `ArrangeToggle`, `ArrangeHelp` and `ArrangeGhost`) in `@surfaces-ui/spec/react` lets a person move components by dragging or by keyboard, put two side by side, and set heights and column widths, on any surface; the pure helpers behind it (`moveComponentMessages`, `stepComponentMessages`, `besideMessages`, `heightMessages`, `gridWidthsMessages` and others) are in `@surfaces-ui/spec`. What it sends is the same JSON an agent sends to arrange a page. `PageStudio` takes `arrange` (off by default): each arrangement is one undo step, logged by the person who made it, and told to the agent with the next instruction as a `layout.changed` note. The styles are in `@surfaces-ui/components/styles.css` as `sf-arrange-*`.
  
  `editsFromMessages` no longer removes a component that a message moves from one container to another.
- 582569d: Developer tools for agent-generated UI. `<SurfacesDevTools>` from the new `@surfaces-ui/devtools`, placed once around an app, records what the library does inside it and shows it in a drawer (a button, or Ctrl+Shift+D): every message in (as it arrived, as it was read, and what the catalog said), each component drawn, problems, state, events sent back, agent turns and service calls with their SQL and timings, with a scrubber that redraws any surface as it stood at an earlier step. It is on in a development build and absent in production unless `enabled` says otherwise, and its panel is loaded only when opened.
  
  The new `@surfaces-ui/trace` holds the recorder (`createRecorder`), wrappers for backends used outside the providers (`traceDataSource`, `traceAgent`, `traceService`), pure replay and diff (`replay`, `diffJson`, `stepDiff`) and `TraceProvider`. `DataSourceProvider`, `DiscoveryProvider`, `PipelinesProvider`, `SemanticsProvider`, `SurfaceView`, `useSurfaces` and `useChat` record themselves when a recorder is above them, and do nothing differently when none is. A trace never holds row values or credentials.
  
  `SurfaceView` now catches a component that throws while it is drawn: the usual notice is shown in its place, the rest of the surface stays, and `onProblem` is told `RENDER_FAILED`. An app made with `create-surfaces` starts with the dev tools in place.
  
  Picking a component, in the Components pane or by pressing it on the page, outlines it, narrows the lists to what it did, and lists likely causes for it by fixed rules (`componentFindings`).
- 582569d: `Explorer` and `ReportBuilder`: each shelf says which axis it is; the chart is drawn as bars, a line or an area; bars can be swapped onto their side; each measure can take its own kind and a right-hand scale, marked "left" or "right" on its pill (`ExploreState.chart`, also the `chart` prop in the catalog and kept on report tiles); pills move along a shelf by drag, touch included, or Alt+arrows; a field in use can be taken off from the field list, and a person's own field removed with Shift+Delete. `Chart` takes `horizontal`.
- 582569d: Write a surface three ways. `analyticsMarkup` (from `@surfaces-ui/spec/react`) draws catalog components written as JSX (`<Ui.Metric … />`), `toMarkup` and `toJsonRender` write components back as JSX or a json-render spec, and `markupComponents` reads JSX into components. `fromJsonRender` now takes any type that names a catalog component as that component (an explicit `typeMap` still wins, and a `Table` with `sql` is still a `DataGrid`). `defineCatalog` adds `names`, the catalog's component names, typed. The generated component pages show each example as JSX, A2UI and json-render.
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

### Patch Changes

- 582569d: `analyticsMarkup` draws with the renderers loaded on first use, so a page written with a few `Ui.*` elements no longer loads every chart, editor and grid up front. Use `createMarkup(analyticsCatalog, analyticsRenderers)` for the renderers loaded at once.
- 582569d: Five presets replace the ten: Ink (the new default), Aurora (the demo theme), Sand, Berry and Mono. A theme that names an old preset is refused by `applyThemeRequest` with the list of new names; a saved theme document still loads through `parseTheme`.
  
  Twelve new hues built in OKLCH replace the eight, with series orders Classic, Aurora, Sand, Ink and Berry, each tested for red-green colour blindness and for 3:1 on every preset's panes.
  
  Colours now come in ranges generated by the contrast each level must reach (`stepByContrast`, `mixOklab`): `--sf-color-bg-1..4`, `--sf-color-label-1..4`, `--sf-color-fill-1..4`, `--sf-color-gray-1..6`, `--sf-color-divider` and `--sf-color-accent-hover` / `-pressed`. Glass for floating controls (`--sf-glass-regular`, `-thick`, `-clear`, `-filter`, `-edge`, `-highlight`, `-shadow`, `--sf-glass-muted`) is tested against the worst thing behind it, and turns solid under reduced transparency, increased contrast and forced colours. A type scale adds `--sf-font-size-xs` and title sizes, weights and line heights.
  
  Motion is timed by tokens (`--sf-duration-fast`, `--sf-duration`, `--sf-duration-slow`, `--sf-ease`, `--sf-ease-out`, `--sf-ease-spring`, `--sf-press-scale`), all stopped under reduced motion. Components follow the new look: buttons are fills that answer a press, menus, popovers, tooltips and the side navigation's drawer are glass, cards and panels lose their outlines, and a box inside a box gives up its fill. `NavBar` is new in `@surfaces-ui/components`: sections across the top on glass, the current section's pages beneath, and a full-screen menu on a narrow screen.
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [2d542c5]
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
- Updated dependencies [e6fb0a5]
- Updated dependencies [582569d]
- Updated dependencies [582569d]
- Updated dependencies [5812a44]
- Updated dependencies [582569d]
  - @surfaces-ui/tokens@0.1.0
  - @surfaces-ui/components@0.1.0
  - @surfaces-ui/trace@0.1.0
  - @surfaces-ui/data@0.1.0
  - @surfaces-ui/proto@0.1.0
