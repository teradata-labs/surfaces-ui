# @surfaces-ui/chat

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

### Patch Changes

- 582569d: Accessibility fixes found by axe in a real browser. Status colours and accent text now reach 4.5:1 on every surface they are drawn on, including the soft accent fill. Explorer pills and pipeline graph nodes say their visible name first, then the rest as hidden text, so "Channel (attribute, in use)" rather than a label that differs from what is shown. Tables that scroll on their own take focus and are named regions. The chat's conversation log holds articles rather than list items without a list, and stream metric sparklines sit inside their definition. A new `.sf-visually-hidden` class is pinned so hidden text never widens a page from inside a scroll box.
- 582569d: Gummy motion. New tokens `--sf-ease-gummy` (a damped spring) and `--sf-duration-springy`, zero under reduced motion. A press springs back when let go, the segmented thumb slides with the spring and squishes where it lands, and a control that switches on or off squishes once after a pointer or a finger changed it. The NavBar's highlight slides from page to page; tree carets turn and the rows beneath glide as a branch opens; sections open to their height; a folded workspace panel drops in when unfolded; and the chat's setup menu slides between its sections.
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
  - @surfaces-ui/state@0.1.0
  - @surfaces-ui/agent@0.1.0
  - @surfaces-ui/proto@0.1.0
