# @surfaces-ui/spec

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
