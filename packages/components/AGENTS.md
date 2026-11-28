# `packages/components`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/components` | React components (see the table below) and `styles.css`. `app-components` (`appComponents.ts`): the components an app places itself, described once as data (`AppComponentDoc`: plain props as JSON Schema, `parts` that take code, `callbacks`, `example`), each checked against its props type by `describeAppComponent<Props>()`; `appComponentMarkdown` and `appComponentCode` write their docs page and JSX. `@surfaces-ui/chat/app-components` holds the chat's three and `@surfaces-ui/devtools/app-components` the dev tools. |

## Rules for every component

- **What a data component says to people is the page's to write.** `Chart`, `DataGrid`, `PivotTable`, `QueryResult`, `Metric`, `Sparkline`, `BulletGraph` and `RowList` take `emptyMessage` (in place of their own text when the query answers with no rows) and `errorMessage` (in place of the engine's error text when it fails), both `DataMessages` and both catalog props (`MESSAGES` in `analytics.ts`). The alert stays `role="alert"` and keeps the engine's text in `data-error` (and `DataGrid` in `onInfo`) for developers; people read only the message.
- Every view of one run passes the same `notBefore` (an ISO time, set when Run is pressed). A backend that keeps results runs the query once for all of them; a later `notBefore` runs it again.
- Errors: a `DataSource` may throw `QueryError` (from `@surfaces-ui/data`) with `code`, `line` and `column`; read any error with `queryErrorInfo` and pass the position to `SqlEditor`.
- SQL generated from a menu is offered (`onUseSql`) or copied; it is never run by the component.
- **What a person does is told to the agent as context.** Every component a person can change takes `onContext` and sends a `ContextNote` (`kind` such as `view.added`, `field.changed`, `filter.changed`, `point.selected`, `file.opened`; `summary`, the sentence the component showed the person; `subject`, the plain data it was about) for each thing they do. A note is not a request: it starts no turn and needs no `action`. In a surface a renderer passes `reportContext`, `SurfaceView` hands it to `onContext(componentId, note)`, and the host keeps the notes and sends them with the agent's next turn as `SurfaceState.activity`, once (`useChat`, `usePageStudio` and the Playground all do; `Chat` also takes `onContext` for a host that wants them as they happen). `turnText` writes them for a model as what the person did since its last reply, oldest first, marked as context and not requests. `reportControls` says where things ended up; a note says what happened on the way. A new interaction is not done until it sends one. Notes carry names and settings, and a value only where the person chose it (a filter's value, the bar they clicked); a file is named, never read.
- A decimal comes back from the engine as its digits without the point. Anything that shows a summarised number reads it with `numericValue(value, type)`, never `Number(value)`.
- **Every control a person can set, an agent can set.** Control state is plain JSON in the catalog: `sorts`, `filters` (`{ column, op, values }`) and `columns` on `DataGrid` and `QueryResult` (plus `view`), and `filters` on `Chart`, `PivotTable`, `Metric`, `Sparkline` and `BulletGraph`. An agent changes them by updating the component; a person can go on changing them by hand. Convert with `filtersFromSpec` and `sortsFromSpec`; filters that do not make sense are shown as a notice in place of the component, never ignored. A new control is not done until its state is a catalog prop, and until its renderer reports a person's changes through `reportControls` in that same prop form (`filtersToSpec`, `sortsToSpec`), so the agent sees them on its next turn (`SurfaceState.controls`).
- Lists that can be long (grid rows, `ObjectBrowser`, `SchemaExplorer`) render only the rows in view and fetch a page at a time. Keep it that way: no component may list a whole catalog or result in the DOM.
- Components are tested against `memoryDataSource`. A new component needs a test that way, with no server.
- **A component an app places itself is described once.** One that is not a catalog entry (it hosts the catalog, or is placed by the app rather than drawn by an agent) gets an entry in its package's `appComponents.ts` through `describeAppComponent`, and a demo in the playground's `appDemos.tsx`; `pnpm docs:gen` writes its page to `docs/components`, and the playground's Components area draws it under App components.
- jsdom has no layout: give `height` and `rowHeight` in tests, and test chart logic through `buildChartOption`.

## Components, by folder

Each folder under `src/` has its own `AGENTS.md` with its components and their rules.

| Folder | Components |
|---|---|
| [`src/chart`](src/chart/AGENTS.md) | `Chart`, `Sparkline`, `BulletGraph`, `chartAdvice` |
| [`src/controls`](src/controls/AGENTS.md) | `ResizeHandle`, `SegmentedControl`, `ConfirmDialog` / `useConfirm`, `StatusBadge`, `Combobox`, `Popover`, `ItemControls` / `standardControls` |
| [`src/data`](src/data/AGENTS.md) | `DataSourceProvider` / `useDataSource`, `useRowWindow` |
| [`src/discovery`](src/discovery/AGENTS.md) | `DiscoveryProvider` / `useDiscovery`, `DataSearch`, `ObjectDetail` / `ColumnProfile`, `CertificationBadge`, `RelationshipGraph`, `ContextBuilder`, `AskData` |
| [`src/editor`](src/editor/AGENTS.md) | `SqlEditor` / `useSqlSchema` |
| [`src/explore`](src/explore/AGENTS.md) | `Explorer`, `ReportBuilder`, `SemanticsProvider` / `useSemanticModel` / `SemanticModelEditor`, `ModelLineage`, `ExploreView` |
| [`src/form`](src/form/AGENTS.md) | `Form` |
| [`src/files`](src/files/AGENTS.md) | `FileBrowser` |
| [`src/filter`](src/filter/AGENTS.md) | `FilterBar`, `QueryFilters` |
| [`src/graph`](src/graph/AGENTS.md) | `NodeGraph` |
| [`src/grid`](src/grid/AGENTS.md) | `DataGrid` |
| [`src/locale`](src/locale/AGENTS.md) | `SurfacesText` |
| [`src/menu`](src/menu/AGENTS.md) | `useContextMenu` |
| [`src/metric`](src/metric/AGENTS.md) | `Metric` |
| [`src/model`](src/model/AGENTS.md) | `ModelDiagram` |
| [`src/panzoom`](src/panzoom/AGENTS.md) | (shared by the diagrams) |
| [`src/pipeline`](src/pipeline/AGENTS.md) | `PipelineGraph`, `PipelinesProvider` / `PipelineView`, `DatasetReview`, `ChecksPanel`, `IngestWizard`, `RunHistory` / `ExpectationsPanel` / `SchemaDiff` / `StreamMetrics` |
| [`src/pivot`](src/pivot/AGENTS.md) | `PivotTable` |
| [`src/plan`](src/plan/AGENTS.md) | `QueryPlan` |
| [`src/result`](src/result/AGENTS.md) | `QueryResult` |
| [`src/review`](src/review/AGENTS.md) | `ActionReceipt`, `PlanReview`, `PiiReview` / `piiHints`, `StepFlow` |
| [`src/rows`](src/rows/AGENTS.md) | `RowList` |
| [`src/schema`](src/schema/AGENTS.md) | `ObjectInfo`, `SchemaExplorer`, `ObjectBrowser` |
| [`src/site`](src/site/AGENTS.md) | `Hero` / `Section` / `FeatureGrid` / `DeviceFrame` / `PromptReveal` / `Showcase` / `Footer` / `Media` / `Quote` / `Callout` / `PostCard` / `PostList` |
| [`src/source`](src/source/AGENTS.md) | `SourceList`, `ConnectionBuilder` |
| [`src/table`](src/table/AGENTS.md) | `DataTable`, `SelectionBar`, `Pagination` |
| [`src/text`](src/text/AGENTS.md) | `Markdown` / `CodeBlock` / `HighlightedCode` |
| [`src/theme`](src/theme/AGENTS.md) | `ThemeProvider` / `ThemePicker` |
| [`src/workspace`](src/workspace/AGENTS.md) | `Workspace`, `SideNav`, `NavBar` |
