# @surfaces-ui/devtools

## 0.2.0

### Patch Changes

- Updated dependencies [febcda0]
- Updated dependencies [62a8fce]
- Updated dependencies [05b01f6]
- Updated dependencies [cc51d18]
- Updated dependencies [7edc469]
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
- Updated dependencies [0487cde]
- Updated dependencies [bbb0b52]
- Updated dependencies [f481687]
- Updated dependencies [c3481a2]
  - @surfaces-ui/components@0.2.0
  - @surfaces-ui/spec@0.2.0
  - @surfaces-ui/data@0.2.0
  - @surfaces-ui/trace@0.2.0

## 0.1.0

### Minor Changes

- 582569d: Developer tools for agent-generated UI. `<SurfacesDevTools>` from the new `@surfaces-ui/devtools`, placed once around an app, records what the library does inside it and shows it in a drawer (a button, or Ctrl+Shift+D): every message in (as it arrived, as it was read, and what the catalog said), each component drawn, problems, state, events sent back, agent turns and service calls with their SQL and timings, with a scrubber that redraws any surface as it stood at an earlier step. It is on in a development build and absent in production unless `enabled` says otherwise, and its panel is loaded only when opened.
  
  The new `@surfaces-ui/trace` holds the recorder (`createRecorder`), wrappers for backends used outside the providers (`traceDataSource`, `traceAgent`, `traceService`), pure replay and diff (`replay`, `diffJson`, `stepDiff`) and `TraceProvider`. `DataSourceProvider`, `DiscoveryProvider`, `PipelinesProvider`, `SemanticsProvider`, `SurfaceView`, `useSurfaces` and `useChat` record themselves when a recorder is above them, and do nothing differently when none is. A trace never holds row values or credentials.
  
  `SurfaceView` now catches a component that throws while it is drawn: the usual notice is shown in its place, the rest of the surface stays, and `onProblem` is told `RENDER_FAILED`. An app made with `create-surfaces` starts with the dev tools in place.
  
  Picking a component, in the Components pane or by pressing it on the page, outlines it, narrows the lists to what it did, and lists likely causes for it by fixed rules (`componentFindings`).
- 5812a44: State is held one way across the library.
  
  - The plain filter form (`FilterSpec`, `filtersFromSpec`, `toggleValueFilter` and the rest) lives in `@surfaces-ui/data`; `@surfaces-ui/components` still exports it. New: `parseFilterSpecs`, `parseSortSpecs`, `chosenValues`, `selectValues`.
  - `createViewState` holds `{ filters: FilterSpec[], sorts: SortSpec[] }`, the form page filters and agents use, and gains `setFilters`. `parseViewState` still reads the older `{ selections, ranges }`.
  - A second click on a bar adds its value to the filter (`in`) and a click on a chosen bar takes it out, in hand-built dashboards, reports and agent-drawn pages alike.
  - One storage interface: `StateStorage`, `memoryStorage` and `browserStorage` are in `@surfaces-ui/data` (and still in `@surfaces-ui/state`); `LibraryStorage` is gone. `ThemeProvider` takes `storage` and `storageKey` in place of `store`, and `SurfacesDevTools` takes `storage`.
  - `persist` puts a part saved with `select` back without losing the rest (or through `restore`), and a change made while the saved value loads is no longer overwritten. The same holds for the theme.
  - `ReadableStore` names what `derive` returns and `useStore` reads.

### Patch Changes

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
- Updated dependencies [e6fb0a5]
- Updated dependencies [5812a44]
- Updated dependencies [582569d]
  - @surfaces-ui/spec@0.1.0
  - @surfaces-ui/components@0.1.0
  - @surfaces-ui/trace@0.1.0
  - @surfaces-ui/data@0.1.0
