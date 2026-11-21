# @surfaces-ui/trace

## 0.1.0

### Minor Changes

- 582569d: Developer tools for agent-generated UI. `<SurfacesDevTools>` from the new `@surfaces-ui/devtools`, placed once around an app, records what the library does inside it and shows it in a drawer (a button, or Ctrl+Shift+D): every message in (as it arrived, as it was read, and what the catalog said), each component drawn, problems, state, events sent back, agent turns and service calls with their SQL and timings, with a scrubber that redraws any surface as it stood at an earlier step. It is on in a development build and absent in production unless `enabled` says otherwise, and its panel is loaded only when opened.
  
  The new `@surfaces-ui/trace` holds the recorder (`createRecorder`), wrappers for backends used outside the providers (`traceDataSource`, `traceAgent`, `traceService`), pure replay and diff (`replay`, `diffJson`, `stepDiff`) and `TraceProvider`. `DataSourceProvider`, `DiscoveryProvider`, `PipelinesProvider`, `SemanticsProvider`, `SurfaceView`, `useSurfaces` and `useChat` record themselves when a recorder is above them, and do nothing differently when none is. A trace never holds row values or credentials.
  
  `SurfaceView` now catches a component that throws while it is drawn: the usual notice is shown in its place, the rest of the surface stays, and `onProblem` is told `RENDER_FAILED`. An app made with `create-surfaces` starts with the dev tools in place.
  
  Picking a component, in the Components pane or by pressing it on the page, outlines it, narrows the lists to what it did, and lists likely causes for it by fixed rules (`componentFindings`).
