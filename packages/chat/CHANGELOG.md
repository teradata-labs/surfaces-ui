# @surfaces-ui/chat

## 0.2.0

### Minor Changes

- 2e1d220: A host can offer buttons under a reply and choices in the composer. A new `actions` part (`ChatActions`, drawn by `ActionsCard`) holds a row of buttons, or several alternatives one row each with buttons for the whole set after them; a press reaches `MessageList`'s new `onPartAction(partId, actionId, choiceId?)`, a disabled button stays reachable by keyboard with its reason read, and `outcome` replaces the buttons once handled. `ChatComposer` takes `context` (`ComposerContext`: chips for what a message is about that is not data, removable through `onClear`) and `toggles` (`ComposerToggle`: checkboxes for the next message). Nothing changes without them.
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
- bbb0b52: One resize handle, for Arrange and for apps.
  
  - `ResizeHandle` (`@surfaces-ui/components`): a handle on the right or bottom edge of a positioned parent that sizes a width or a height. A focusable `separator` with `aria-valuenow`, `aria-valuemin` and `aria-valuemax`; dragged with pointer events, so a mouse, a pen and a finger all work; arrows (Shift for five steps), Home and End move it, Enter or a double click resets it, Escape gives up a drag, and so does the handle going away mid-drag. Props: `edge`, `value`, `min`, `max`, `snap`, `step`, `unitPixels`, `startFrom`, `onChange`, `onChangeEnd`, `onReset`, `label`, `valueText`, `always`. Its maths are plain functions: `clampResize`, `dragResize`, `keyResize`, `defaultResizeStep`. Described as an app component, with a demo in the playground.
  - Arrange draws its height and width handles with `ResizeHandle`. Each press target is now at least `--sf-target-min` across, and Enter or a double click puts a size back (the widths and height the page shipped with when `useArrange` is given `shipped`; equal widths and the height the component chooses otherwise).
  - `useArrange({ resizeWhileViewing: true })` keeps the width handles between a `Grid`'s or `Row`'s columns, and the height handle under a component with a height of its own (a chart or a table, say) or one whose height is set, while nobody is arranging. A drag sends the same messages Arrange sends, as one step. Pass the new `arrange.surfaceFrame` to `SurfaceView` as `frame`; `arrange.shown(surface)` is the surface itself when nothing is being sized, so it can be drawn always.
  - `PageStudio` takes `resizeWhileViewing` beside `arrange`.

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
  - @surfaces-ui/agent@0.2.0
  - @surfaces-ui/proto@0.2.0
  - @surfaces-ui/trace@0.2.0
  - @surfaces-ui/state@0.2.0

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
