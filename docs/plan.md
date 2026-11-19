# Surfaces UI: enterprise data & analytics UI library

## Context

Data and analytics users need one library for exploring and visualizing data: schema explorer, ECharts charts, scalable tables whose sort/filter/pagination rewrite the underlying SQL, code editing, chat, and the ability to compose dynamic pages, views and full apps — usable by people and by agents, and installable into other repos as MCP Apps.

The proof of concept is loom-mobile's mini-apps (Weaver). What exploration found:

- **Worth abstracting (as design, not code):** an A2UI v0.9.1 catalog with analytics parts (Table, Stat, KeyValue, Chart, Progress, Timeline, Chips, DecisionCard); page parts (stat-cards, heatmap, tabs, section) carrying `source`/`asOf` provenance; the theme contract (`contracts/miniapp-theme.json`: light/dark palettes, radius, font, presets Weaver/Ocean/Meadow/Sunset, accent→readable-text derivation) and its picker (`LookAndFeelView.swift`, `starters/theme/index.html`); ECharts theme built from CSS variables (`mothership.charts.theme()`); the sandboxed bridge with capability grants and ask-before-acting (`server/miniapps/bridge.go`); read-only SQL guard (`server/knowledge/query.go` `checkQuery`); versioning (20 versions) and snapshot/replay for sharing (`server/miniapps/answers.go`); chat patterns (`Weaver/Views/Chat/*`, `desktop/frontend/src/Chat.tsx`: streaming reply, tool steps, inline cards, asks queue, usage gauge, suggestions).
- **Absent, must be built:** analytical engine, SQL rewriting, typed/columnar results, cursors/streaming, virtual scroll, data grid, SQL editor, schema tree, panel layout/drag-drop, protobuf contracts, MCP Apps (`ui://`), a dev server. Hard caps today are 200 rows / 6×100 tables.
- **Weaknesses to avoid:** rules hand-copied in Swift, Go and JS; theme defined in ~6 places with four token vocabularies; a 4,129-line no-types renderer.

Decisions confirmed: **greenfield in this empty repo**; **standalone tokens on headless primitives** (Spark mapping as an optional preset later); **re-implement in TypeScript**, copying no loom-mobile source (it is personally owned). Read loom-mobile from branch `library-redesign` (`git show library-redesign:<path>`); the checkout itself is stale.

## A2UI vs json-render — recommendation

| | A2UI (v0.9.1 stable, v1.0 RC) | json-render (Vercel Labs) |
|---|---|---|
| What it is | Transport-agnostic protocol: `createSurface` / `updateComponents` / `updateDataModel` / `deleteSurface`, catalogs negotiated by ID | Library: Zod `defineCatalog`, generated system prompt, JSONL patch streaming, React/RN/Vue renderers |
| Strength | Interop across agents and native renderers (loom-mobile already draws it in SwiftUI); data model separate from components; custom catalogs | Best authoring ergonomics; one catalog definition yields types, validation and the agent prompt |
| Weakness | No authoring toolkit; you write renderer and validation | App-coupled, not a wire standard; pre-1.0 churn |

**Use A2UI as the wire format, with a json-render-style authoring layer we own.** One catalog definition (Zod) generates: the A2UI catalog JSON, TypeScript prop types, validation, the agent prompt, and the docs page. Ship a small adapter that accepts json-render `root/elements/state` specs so the old `show_dashboard` tool shape keeps working.

## Delivery channels (MCP is one of several)

The same components, catalog and documents ship through every channel; none is privileged:

1. **npm React library** — `@surfaces-ui/*` imported into any React app (primary).
2. **A2UI in chat** — an agent streams A2UI messages over any transport (SSE, NDJSON, Connect stream, AG-UI, Loom's `/v1/weave:stream`) and `@surfaces-ui/chat` renders them inline in the thread.
3. **Standalone apps** — `surfaces build` produces a deployable web app from a page/app document.
4. **Embeds** — sandboxed iframe + postMessage bridge and a web-component wrapper for non-React hosts.
5. **MCP Apps** — single-file `ui://` resources plus tools, installable into other repos.
6. **Static snapshots** — a frozen view exported as self-contained HTML/PDF.

## Boundary: the data layer is removable

The library is two layers, and the UI layer must work with the data layer deleted.

- **UI layer (the product):** `tokens`, `components`, `chat`, `spec`, `app`. These depend only on a small TypeScript interface, `DataSource` (run a `ViewQuery` and get Arrow batches back; list catalogs, schemas, tables, snapshots; cancel, explain, count). They never import an engine, a driver, Connect, or the dev server.
- **Data layer (optional, replaceable):** `sql`, `data`, `engine-*`, `dev-server`, any gateway. This is one implementation of `DataSource`. A consumer with their own backend (Loom, an existing Teradata service, a company query API) implements `DataSource` directly, or serves the protobuf contract, and installs none of these packages.

Rules that keep it removable:
1. No UI-layer package lists a data-layer package as a dependency. CI enforces this with an import check.
2. `ViewQuery` is the whole interface for sort, filter and paging. Whoever implements `DataSource` decides how to honour it; `@surfaces-ui/sql` is offered as a library they may use, not a requirement.
3. Every component is documented and tested against an in-memory `DataSource`, proving it runs with no engine present.
4. The data layer ships as separate npm packages with their own versions, so it can be dropped or swapped without a UI release.
5. A production gateway is out of scope unless a consumer needs one. The default is: this repo defines the contract and ships a dev server; production serving belongs to the consumer's own systems.

## Spike results (2026-11-12)

Run before phase 2 to decide how much data layer to build. Throwaway code; not in the repo.

**1. Teradata SQL rewriting — works with `@polyglot-sql/sdk`; no second option.**
- Of the candidates, only polyglot (0.14.1, Rust/WASM, 36 dialects) knows Teradata. `sqlglot-ts` and `node-sql-parser` have no Teradata dialect.
- 25 Teradata queries (TOP, WITH TIES, QUALIFY, SAMPLE, recursive CTE, LOCKING, FORMAT casts, set operations, DBC views): 23 parsed; 20 round-tripped identically and 3 with harmless normalisation. The 2 failures are PERIOD functions (`BEGIN/END/CONTAINS`) and attribute syntax (`col (FORMAT '...') (TITLE '...')`).
- A prototype rewriter produced sort + filter + page SQL for all 23: it hoists `WITH` out of the derived table, drops a trailing `ORDER BY` (kept when `TOP` is present), keeps a `LOCKING` prefix, pages with `TOP n` for the first page and `QUALIFY ROW_NUMBER() ... BETWEEN` after it. The same code emits `LIMIT/OFFSET` for DuckDB. Non-queries and multi-statement input are rejected from the parse tree.
- The 2 unparseable queries fall back to text wrapping, which is reported as `REWRITE_MODE_WRAPPED`.
- **Not verified:** nothing was executed on a real Teradata system. "Valid" here means the output re-parses as Teradata.
- Risk: polyglot is pre-1.0 with a single maintainer, and there is no alternative. Keep it behind `@surfaces-ui/sql`'s own interface.

**2. Arrow streaming through Node — use ADBC.**
- `@apache-arrow/adbc-driver-manager` (0.25.0) with DuckDB's own library as the driver streamed 5M rows × 6 columns in 0.5 s (about 10M rows/s) as Arrow batches with types intact (decimal, timestamp, nulls). Bound parameters work.
- DuckDB's native Node API plus conversion to Arrow in JavaScript managed 0.34M rows/s and lost types. Do not use that path for results.
- So the engine adapter is thin: ADBC in, Arrow IPC out. Hand-written per-engine result conversion is not needed for DuckDB, and should not be for DataFusion (Flight SQL / ADBC).
- Caveats: the ADBC Node binding is labelled alpha and needs Node 22+. Batches arrive at 2,048 rows, so the server should re-chunk to `batch_rows`.
- **Not verified:** Teradata. The `teradatasql` Node driver exists (20.0.75) but was not exercised, and whether a Teradata ADBC driver exists was not established. Cancel through ADBC was not tested.

**3. Iceberg and Delta in DuckDB 2.0 — works, including time travel.**
- Delta: `delta_scan(path)`, `delta_scan(path, version => n)`, and `ATTACH ... (TYPE delta)` with `AT (VERSION => n)` all returned the right rows for each of three versions.
- Iceberg: `iceberg_scan`, `iceberg_snapshots`, `snapshot_from_id` and `snapshot_from_timestamp` all worked on a table with four snapshots.
- A rewritten, parameterised, paged query over a Delta table at an old version ran end to end through ADBC.
- **Not verified:** remote catalogs (REST, Glue, Unity) and object storage; only local files were tested. Iceberg snapshot IDs exceed JavaScript's safe integer range, which confirms they must stay strings in the contract.

**Contract changes made as a result** (`proto/surfaces/v1`):
- `ResultHeader` now carries `rewrite_mode`, `notices`, per-column `native_type` / `sortable` / `filterable`, and `query_id`.
- `Notice` (e.g. `UNSTABLE_PAGE_ORDER` when paging without a total order, which matters most on Teradata).
- `QueryErrorDetail` with line and column so an editor can mark the error.
- `Capabilities` on `Source`, so the UI hides what an engine cannot do (cancel, time travel, keyset paging, exact counts, row limits).
- Arrow framing is now specified: schema message plus batch messages concatenate to a valid IPC stream.

**Decision:** build the data layer as planned, but thin: polyglot behind `@surfaces-ui/sql`, ADBC behind the engine adapters, DuckDB for lake tables. A Teradata system is needed before any Teradata claim is final.

## Architecture

pnpm + Turborepo monorepo, React 19, TypeScript strict, Vite, Vitest, Playwright, Changesets. npm scope `@surfaces-ui/*`.

```
proto/surfaces/v1/        query.proto catalog.proto source.proto view.proto chat.proto   (buf)
packages/
  proto        generated protobuf-es + connect-es clients/servers
  tokens       theme contract (JSON Schema), presets, accent derivation, CSS-var emitter, ECharts theme
  sql          dialect-aware AST rewriting: sort / filter / paginate / count / profile
  data         QueryClient: engine adapters, Arrow result store, cursor + windowed cache
  engine-duckdb-wasm   in-browser adapter
  components   primitives + analytics components (below)
  chat         chat components + transport-agnostic stream reducer
  spec         catalog definition, A2UI renderer, json-render adapter, prompt/doc generation
  app          page/view/app model, panel layout, drag-drop, snapshots, versions
  engine-teradata      Teradata adapter (server-side)
  agent        AgentBackend interface + generic SSE/AG-UI backend
  agent-loom   Loom adapter (generated from Loom's published protos; no Loom source in repo)
  mcp          MCP Apps host bridge, tool registration helpers, single-file HTML bundler
  dev-server   `surfaces dev`: Connect server over DuckDB (node), source catalog, HMR
  cli          `surfaces init | add | dev | build | mcp install`
apps/
  docs         docs site + live playground (also emits llms.txt and per-component .md)
  gallery      reference apps: SQL workbench, dashboard, schema browser, chat analyst
skills/        agent skills shipped with the package
```

### 1. Contracts (protobuf + TypeScript)
`buf` with `protobuf-es` and `connect-es`; Connect protocol so browsers call it without a proxy.
- `QueryService`: `Execute` (server-streaming Arrow IPC record batches + typed schema), `Cancel`, `Explain`, `Count`.
- `CatalogService`: `ListCatalogs/Schemas/Tables`, `DescribeTable` (columns, types, partitions, stats), `ListSnapshots` (Iceberg snapshots / Delta versions) — schema explorer and time travel read from this.
- `SourceService`: register/test/list sources (files, object stores, Iceberg REST/Glue catalogs, Delta tables, Postgres, Teradata via MCP).
- `ViewService`: save/load page, view and snapshot documents.
Every engine implements these same services, so the UI never knows which one it is talking to.

### 2. Engines
- **DuckDB** first: `duckdb-wasm` in the browser (zero-install demos, MCP Apps offline), `@duckdb/node-api` in the dev server with `iceberg`, `delta`, `httpfs`, `postgres` extensions.
- **Teradata** as a first-class engine from phase 2, not a late add-on: a server-side adapter implementing the same `QueryService`/`CatalogService` (driver: `teradatasql` Node driver; alternative path through `teradata-mcp-server`, which loom-mobile's connector catalog already uses). Catalog mapping from DBC views (databases, tables, columns, PIs, stats); `Explain` returns Teradata EXPLAIN text for the visual-explain view; paging via `TOP`/`QUALIFY ROW_NUMBER()` since Teradata has no `LIMIT/OFFSET`; results converted to Arrow batches in the server. Teradata is a required dialect in `@surfaces-ui/sql` golden tests. Needs a Teradata test instance (ClearScape/Vantage dev) for CI.
- **DataFusion**: a Rust sidecar (`datafusion` + `iceberg-rust` + `delta-rs`) serving the same Connect services; `~/repos/weaver-sandbox/datafusion-poc` is the starting reference. Conformance test suite runs against both.
- Read-only by default: adopt the guard approach from `checkQuery` (single statement, SELECT/WITH only) but enforced on the parsed AST plus a read-only connection.

### 3. SQL manipulation (`@surfaces-ui/sql`)
Table/chart state (sort, filters, page, grouping) is a declarative `ViewQuery`; the package rewrites the user's base SQL rather than filtering in the browser: wrap base query as a CTE, then apply `WHERE` / `ORDER BY` / `LIMIT…OFFSET` or keyset pagination, `COUNT(*)`, and column-profile queries. Parser: `@polyglot-sql/sdk` (see spike results), kept behind this package's own interface; statements it cannot parse fall back to text wrapping and are flagged. The generated SQL is always visible and editable in the editor ("show SQL"), and edits round-trip back into table state where possible.

### 4. Components (`@surfaces-ui/components`)
Headless Radix primitives + CSS variables only. Analytics set:
- **DataGrid** — TanStack Table + TanStack Virtual (row and column virtualization), server-driven sort/filter/pagination via `ViewQuery`, infinite and paged modes, column resize/reorder/pin, typed cell renderers from Arrow types, copy/export.
- **Chart** — ECharts 6 wrapper: theme from tokens, dataset bound to a query, chart-type picker, brush/dataZoom emitting filters back into `ViewQuery`, large-data mode (sampling/aggregation pushed to SQL).
- **SchemaExplorer** — virtualized lazy tree over `CatalogService`, search, column stats, Iceberg/Delta snapshot picker, drag a table/column into the editor.
- **SqlEditor / CodeEditor** — CodeMirror 6, dialect modes, schema-aware autocomplete, run selection, explain view, diff.
- **FilterBar, QueryResult (grid ⇄ chart), StatCard, KeyValue, Heatmap, Timeline, Progress, Badges, Tabs, Section** (the loom-mobile part set, kept with `source`/`asOf` provenance).
- **ThemePicker** — presets, accent color, radius, font, light/dark, live preview; persists through a pluggable store (host bridge in MCP Apps, storage on web).

### 5. Chat (`@surfaces-ui/chat`)
MessageList (virtualized), Composer (attachments, slash commands, mentions of tables), StreamingMessage, ToolSteps (collapsible), ApprovalQueue (allow/deny), Suggestions, UsageGauge.

**A2UI inside chat is a core requirement**, matching loom-mobile's `show_widget` cards (`docs/widgets.md`, `Widgets.swift`, `WidgetView.swift`). A message can carry A2UI surfaces that render inline and update as the stream continues. The chat catalog (`surfaces/chat/v1`) covers the A2UI basic set (Text, Icon, Image, Row, Column, List, Card, Tabs, Divider, Modal, Button, CheckBox, TextField, DateTimeInput, ChoicePicker, Slider) plus:
- **DecisionCard** (options, recommendation, confirm/deny → action back to agent)
- **Chart** (ECharts, themed), **Table** (compact; "open in grid" promotes it to a full DataGrid bound to its query)
- **Markdown** (GFM, streaming-safe), **CodeBlock** (highlighting, copy, "run" for SQL → result card)
- **Stat, KeyValue, Progress, Checklist, Timeline, Chips, Rating, Link, Person**
- **QueryResult** (live, paged) and **SqlProposal** (agent-proposed SQL → approve → run)

User interactions return to the agent as A2UI action events (loom-mobile's `<widget_action>` pattern). Catalog functions: formatting, `openUrl`, `openPage`, `copy`, `share`, `runQuery`. Phone-sized caps from loom-mobile (6×100 tables, 5 series) are lifted by binding to queries instead of inlining rows.

A stream reducer accepts SSE/NDJSON/AG-UI/Connect events so chat is not tied to one backend. Pattern docs: chat + side canvas, chat-in-dashboard, agent proposes SQL → user approves → result card, decision flow.

### 5b. Agent backends and Loom (`@surfaces-ui/agent`, `@surfaces-ui/agent-loom`)
- `AgentBackend` interface: sessions, send/stream, tool steps, approvals, A2UI surfaces, usage. A generic SSE/AG-UI implementation ships by default.
- **Loom is supported but never vendored.** `@surfaces-ui/agent-loom` is generated from Loom's published protos (`loom/v1/*.proto` pulled as a buf dependency by git ref/BSR at build time) and talks to Loom's gateway (`/v1/weave:stream`, `/v1/apps`). No Loom source or binary is committed here.
- **Packaging Loom in:** `surfaces.config.ts` takes `agent: { kind: "loom", ... }`; `surfaces dev` can start an installed `looms` as a sidecar, and `surfaces build --with-loom` bundles a user-supplied Loom binary/image and agent YAMLs into the distributable (app bundle or container) for agent workflows. Loom in turn reaches our tools through the MCP server and renders our `ui://` apps as its Pages.
- Agent workflow surfaces: workflow/DAG progress view, step approvals, and results as A2UI surfaces.

### 6. Pages, views, apps (`@surfaces-ui/app`)
- Document model (proto `view.proto`): App → Pages → Views → Panels, each panel bound to a query and a catalog component.
- Panel layout with resize and drag-drop via `dnd-kit` (grid/dock; drop on edge creates a column, per the existing drag-drop-panel-layout pattern); drag fields from SchemaExplorer onto charts/grids.
- **Snapshots**: freeze a view = document + Arrow result (Parquet) + engine/table snapshot ID, so it replays without the source (the `answers.go` idea). Versions with compare and go-back.
- Same document renders by hand-written React, by A2UI stream from an agent, or as an MCP App.

### 7. MCP Apps (`@surfaces-ui/mcp`) — one delivery channel
- Targets the stable MCP Apps extension (`io.modelcontextprotocol/ui`, `@modelcontextprotocol/ext-apps`); each app builds to a single-file HTML `ui://` resource.
- `registerSurfacesApps(server, {...})` adds tools: `show_data_grid`, `show_chart`, `show_dashboard`, `open_sql_editor`, `show_schema_explorer`, `render_surface` (A2UI). Apps call back to server tools for queries, so data stays server-side and paged.
- **Install elsewhere:** `npx surfaces mcp install` writes the server entry into a repo's `.mcp.json`; the package also exports the pieces for embedding in an existing MCP server.

### 8. Dev server & CLI
`surfaces dev` starts the Connect server on DuckDB, reads `surfaces.config.ts` (sources: local Parquet/CSV, S3/GCS, Iceberg catalogs, Delta paths, Postgres), exposes the mapped catalog to the schema explorer, serves apps with HMR, and runs the MCP server in the same process for local agent testing. Ships sample datasets including an Iceberg and a Delta table fixture.

### 9. Docs and skills for agents (first-class deliverable)
- Docs are generated from the catalog definition so they cannot drift: per-component `.md` (props, examples, do/don't), `llms.txt` / `llms-full.txt`, JSON catalog, and the generated agent prompt. An MCP tool `get_component_docs` serves the same content.
- `AGENTS.md`/`CLAUDE.md` in the repo and a template for consumer repos.
- Skills in `skills/`: `surfaces-scaffold-app`, `surfaces-dashboard`, `surfaces-sql-workbench`, `surfaces-schema-explorer`, `surfaces-chat-analyst`, `surfaces-mcp-app`, `surfaces-connect-source` (Iceberg/Delta/DuckDB config), `surfaces-theme`. Each has a runnable template and a verification step.

## Data discovery and agent context (added 2026-11-12)

Requirement: traverse data objects with semantic search and LLMs, and build context for agents, with UI components for all of it. The schema explorer is only a browse tree; this is a separate area.

Same boundary rule as data: the UI depends on a small `Discovery` interface. Embeddings, vector indexes and LLM calls live behind it (in Loom, a catalog service, or a reference implementation), never in the components.

Contract (`proto/surfaces/v1/discovery.proto`, to be written):
- `DiscoveryService.Search`: natural-language or keyword query over tables, columns, saved queries and docs; returns ranked `DataObject`s with a score, the matched text and why it matched. Filters by source, kind, tags, owner.
- `DiscoveryService.GetObject`: one object's full profile: description (human or generated, labelled which), columns with stats and sample values, freshness, row count, popularity, owners, tags.
- `DiscoveryService.GetRelated`: joins, lineage (upstream/downstream), similar objects, and queries that use it.
- `DiscoveryService.Describe`: LLM-written description or column annotations for an object, returned as a proposal a person accepts or edits.
- `DiscoveryService.Ask` (streaming): a question answered over the catalog, citing the objects used.
- `ContextService`: create, read, update `ContextPack`s — a named, versioned selection of objects, columns, join paths, sample rows, definitions and notes, with a token estimate — and `Render` one as agent-ready text or JSON.

Components:
- `DataSearch`: search box with semantic and keyword modes, facets, ranked results with match reasons.
- `ObjectCard` / `ObjectDetail`: profile, columns with distribution sparklines, sample rows (a `DataGrid`), freshness, owners, generated description with accept/edit.
- `RelationshipGraph`: joins and lineage as a navigable graph.
- `ColumnProfile`: distribution, null rate, top values, computed through `ViewQuery` aggregates.
- `ContextBuilder`: a basket of selected objects and columns with reorder, notes, token budget meter, and preview of exactly what the agent will receive.
- `ContextPreview` / export: copy, save as a pack, or hand to an agent backend.
- `AskData`: a chat-style question over the catalog whose answers cite objects that can be opened or added to the context.

Delivery: every one of these is also a catalog component for A2UI and an MCP App, and `ContextService.Render` is exposed as an MCP resource so agents in other repos can read a pack.

Open decisions: where the index lives (Loom, the dev server, or a consumer's catalog); which embedding model; whether sample values may be embedded or sent to an LLM at all (a governance question for sensitive data).

## Persona review (2026-11-12)

A review of what is built from three seats: data engineer, data scientist, business analyst. Each item was checked against the code.

### Wrong today, not just missing

1. **Every sort, page and filter re-runs the user's whole query.** The grid wraps the base SQL and executes it again per block. On a warehouse query that takes minutes, scrolling re-runs it repeatedly. Needs result materialisation: run once into a temporary result (or cached snapshot), then page and sort that. Largest architectural gap.
2. **Row counts and profiles are expensive by default.** Every grid load runs `COUNT(*)`; `QueryResult` runs a probe, a count and a first block (three queries per run); the table profile runs `COUNT(DISTINCT)` on every column in one statement. Counts should be deferred or estimated, and profiling should be explicit, sampled and approximate.
3. **Raw-row charts are biased.** A scatter or "each row" chart plots the first 5,000 rows, not a sample. It says so, but the picture is still misleading. Needs sampling pushed to the engine.
4. **Time series do not bucket.** Grouping by a timestamp groups by the exact value, so a line chart over `ordered_at` gets one point per timestamp. `ViewQuery` has no time grain (day, week, month) and no numeric binning, so there are no histograms either.
5. **Errors are not positioned.** The editor can underline a line and column, and the contract carries them, but the server never fills them in; the first line is underlined instead.
6. **Deep paging is offset-based.** Scrolling to row 5,000,000 makes the engine skip that many rows. Keyset paging is in the contract and not implemented.

### Missing, by who needs it

| Gap | Engineer | Scientist | Analyst |
|---|---|---|---|
| Time grain and numeric binning in `ViewQuery` (histograms, time series) | ● | ● | ● |
| Export and copy (CSV, Parquet, clipboard, "copy as SQL") | ● | ● | ● |
| Query plan viewer, cancel button, timeouts, cost or bytes scanned, query history | ● | ○ | |
| Catalog and schema levels in the explorer (the contract has them; the tree is flat) | ● | ○ | |
| Lineage, freshness, snapshot diff, schema drift, data quality checks | ● | ○ | ○ |
| Source connection screen (add and test a source) | ● | | |
| More aggregates: median, percentiles, standard deviation; a describe() summary | ○ | ● | ○ |
| Distribution views: histogram, box plot, correlation heatmap, missingness | | ● | |
| Query cells that build on each other, parameters and variables | ○ | ● | |
| Saved queries, tabs | ● | ● | ○ |
| Filters people can pick: value lists, date range, relative dates, OR groups | | ○ | ● |
| Pivot tables, totals and subtotals, top-N with "other" | | ○ | ● |
| Cross-filtering and drill-down between charts and tables | | ○ | ● |
| Governed metrics and a glossary, so analysts do not write SQL | ○ | | ● |
| Number, currency, percent and date formatting per column; conditional formatting | | | ● |
| "As of" and source on every tile; period-over-period comparison | ○ | | ● |
| Pages with layout, sharing, scheduled delivery, alerts (pages are phase 6) | | | ● |
| Grid: pin and reorder columns, row detail for nested values, column search | ● | ● | ○ |

● core to that role, ○ useful.

### Where the three disagree, and the position taken

- **SQL-first or no SQL.** Engineers want raw SQL; analysts want none. Position: `ViewQuery` is the shared grammar. Add a builder (measures, dimensions, filters) that emits it, and a metrics layer above that. SQL stays available and visible.
- **Withholding data values.** The scientist cannot profile without distributions; governance wants values hidden. Position: three tiers per source, not two: metadata only, aggregates allowed (binned histograms, counts), values allowed.
- **Inferred joins.** Helpful to analysts, dangerous to engineers (name matches can fan out). Position: keep them labelled, prefer keys declared by the catalog, and verify uniqueness and overlap with a query before offering a join for use.
- **Default aggregation in charts.** Analysts want a sensible chart at once; scientists want raw points; engineers fear expensive scans. Position: aggregate by default, sample for raw points, and show an estimate before running anything large.
- **Agent-drawn UI.** Analysts like it; engineers worry about cost; scientists about reproducibility. Position: every agent-drawn data component records its SQL and snapshot, and runs under the same cost guard.

### What holds up

Sort, filter and paging in the engine; typed Arrow results; Iceberg and Delta time travel; "show SQL" on every result; read-only by default; context packs with a previewed, budgeted render; values withheld by default; agent UI limited to a validated catalog; a removable data layer.

### Done since the review (2026-11-12)

Query foundations:
- **Run-once results.** The server keeps a non-trivial query's result in an engine-side temporary table (`Engine.store`, DuckDB implemented) and serves every sort, filter, page, count, chart and pivot from it. `ResultHeader.stored` reports it and the time the data is as of; `not_before` re-runs on demand. Plain table scans stay live; results over 250,000 rows fall back to live queries.
- **Cheaper counts and profiles.** The grid skips the count when a kept result or a short first block already gives it. Profiles use approximate distinct counts, labelled as estimates.
- **Time grain and binning.** `ViewQuery.buckets`, with DuckDB (`DATE_TRUNC`) and Teradata (`TRUNC`, `TO_CHAR`) forms.
- **Sampling.** `ViewQuery.sample`; raw-row charts plot a random sample.
- **More aggregates.** Median, standard deviation, variance, percentile, approximate distinct.
- **Positioned errors.** The server plans the base query alone to find the engine's position and returns line and column; the editor underlines the place.
- **Deep paging.** Solved for kept results (they are small and ordered). Keyset paging for live scans of very large tables is still not built.

Components asked for after the review:
- **Charts:** one series per measure, per-series type and y axis (compound charts, two scales), stacking, legend placement, axis titles.
- **PivotTable:** rows, columns, measures, date grains, and totals computed by the engine.
- **ObjectBrowser:** catalog, schema, table and column tree with joins under each table that can be walked onward; paged loading and windowed rendering (tested with 20,000 tables).
- **Certified data:** `Certification` on every object, `SetCertification`, ranking in search, a "certified only" filter, the mark in search, detail, browser and agent context.

Added next (2026-11-12):
- **ModelDiagram:** a relationship diagram with table cards, lines between joined columns, drag a column onto a column to join, drop tables from the object browser, suggested joins labelled Inferred, a keyboard path for every action, and SQL for the model.
- **Chat (`@surfaces-ui/chat`):** thread reducer, `useChat`, `Chat`, message list, composer, tool steps, approvals, suggestions and usage. Replies render Markdown and any catalog component inline.
- **Everything in the catalog:** the modelling, discovery and editor components and new conversation components (Markdown, CodeBlock, Table, Link, Checklist, Chips, DecisionCard, SqlProposal), each with a renderer; controls report what the person did back to the agent.
- Docs app: a data model page and a chat page with a scripted demo agent.

Added after that (2026-11-12):
- **Loom adapter** (`@surfaces-ui/agent-loom`): turns over Loom's HTTP gateway (`/v1/weave:stream`, `/v1/clarifications/{session}/answer`), mapping replies, tool calls, questions and usage. Tested against recorded events only.
- **Connections:** object stores (S3 and compatible, GCS, Azure, https) and attached catalogs (Iceberg REST, DuckDB file) for the DuckDB engine, with named secrets resolved from the server environment, access limited to each connection's scope, and per-table reachability checks. `SourceList` and `ConnectionBuilder` in the UI. Remote stores and REST catalogs are not verified against real services.
- **State services** (`@surfaces-ui/state`): store, derive, undo, persistence, URL sync, shared view state for cross-filtering, query runs.
- **Pages by instruction:** `PageDocument`, `editPage`, `PageStudio`; `Grid` and `Metric`; four example pages and a hand-built cross-filter dashboard in the docs app. The docs agent is a script, not a model.
- **Pipeline components** from a review of Spark Structured Streaming, Spark Declarative Pipelines and Databricks pipelines: `PipelineGraph`, `RunHistory`, `StreamMetrics`, `ExpectationsPanel`, `SchemaDiff`. Display only.

From that review, not built: an ingest wizard with source-to-target column mapping, an event log viewer, a checkpoint and watermark status card, a query plan graph, a job and stage timeline, table maintenance (compact, expire snapshots, roll back), a change feed view, a pipeline spec editor, and above all a `PipelineService` / `IngestService` contract and a backend for any of it. Open-source Spark Declarative Pipelines does not document expectations, an event log schema or a graph API; those shapes follow Databricks and a Spark backend would have to map into them.

Everyday needs (2026-11-12): CSV export of the whole result streamed from the backend, copy SQL, cancel a running query, a query plan viewer (tree for DuckDB and Postgres JSON, text for any engine), filter values picked from a list the engine supplies, date pickers and quick date ranges, and per-column formats (currency, percent, short numbers, dates). Not done: Parquet or Excel export, copying selected cells, relative ranges that move with time (a quick range is fixed at the date it was chosen), OR groups in filters, conditional formatting, query history UI (the `createQueryRuns` service exists), and a timeout setting.

Pipelines and ingest (2026-11-12): `pipeline.proto` (`PipelineService`, `IngestService`), the `Pipelines` interface, a reference runner on DuckDB (`@surfaces-ui/pipelines`) with data quality rules, server routes and config, `PipelineView` and `IngestWizard`, and a sample pipeline in `surfaces.config.ts`. Not done: any Spark backend (Structured Streaming progress, Declarative Pipelines, Auto Loader, Auto CDC), incremental or streaming processing, schedules, persisted run history, an event log, registering an ingested table at run time (the wizard writes config instead), schema drift detection against an existing table, and table maintenance.

Postgres (2026-11-12): attached read-only through DuckDB's Postgres extension as a catalog kind, tested end to end against Postgres 17 in a container: catalog and types, paging and sorting pushed to the database, kept results for joins, time buckets, bins, statistics, sampling, error positions, discovery and a pipeline reading from it. Two fixes came out of it: time buckets now use UTC instead of the server's time zone, and pass-through SQL functions are refused. Not done: a hosted database over TLS (Supabase), a native Postgres engine adapter (everything goes through DuckDB today), Postgres in the connection builder UI, and tables with the same name in two schemas, which discovery cannot tell apart.

Loom, live (2026-11-12): `@surfaces-ui/agent-loom` was run against a separate Loom server on this machine (sign-in off, no tools, a local model). Replies streamed, the session carried across turns, usage and the model name came through, and a chart the model wrote as an `a2ui` block was drawn in the docs chat page over DuckDB data. The wire format matched what the adapter assumed (snake_case fields, numeric stages, heartbeat comments). One fix: a finished stream is now closed, not aborted. Not exercised live: tool steps, questions that pause a turn, and a server that requires sign-in. The docs chat page offers a local Loom server as an agent when one answers at `VITE_LOOM_URL` (default `http://127.0.0.1:5028`).

DataFusion (2026-11-12): the rewriter now writes numbered placeholders for DataFusion and Postgres, with golden tests that parse in the DataFusion dialect for paging, filters, buckets, bins, statistics and sampling. `@surfaces-ui/engine-datafusion` then ran the whole stack on Apache DataFusion 47, served by ROAPI in a container over its HTTP SQL endpoint: catalog, typed Arrow results, sorting, filtering and paging with numbered placeholders, counts, time buckets, bins, median, percentile, standard deviation, sampling, plans, error codes, discovery, and refusal of writes. Found along the way: DataFusion's `approx_distinct` rejects floats and timestamps, so the rewriter counts exactly there; the server's catalog and schema names cannot be listed, so its tables are reported unqualified; ROAPI's `latest` image crashes at start-up and its Delta reader rejected the sample Delta table, so only Parquet was tested, on v0.12.6. The HTTP endpoint has no bound parameters, so values are written into the statement by `literal()`, with text sent as hexadecimal; a test confirms hostile values stay data. Not done: Arrow Flight SQL with real bound parameters (loading Apache's ADBC Flight SQL driver was not permitted here), the Rust sidecar, kept results and pipelines on DataFusion, error positions.

Theme and chart colours (2026-11-12): chart colours became part of the theme (`theme.charts`: series, a magnitude hue, two poles), with CSS variables, the ECharts theme and the picker following. Series colours are no longer rotated from the accent: they are eight tested hues in named orders, with a checker for look-alike neighbours (including red-green colour blindness) and faint colours. The presets were redrawn as Paper (default), Graphite, Lagoon, Orchard, Ember, Dusk and Terminal: quieter chrome, each with charts that open on its accent's hue. Charts can pin a measure or a split value to a colour slot. Not done: a texture fill for print and forced-colours, heatmap and other components that would use the magnitude and two-sided ramps, folding series beyond the palette into "Other" (the chart only says so), and direct labels on lines.

Still open in phase 5: the Loom adapter (`@surfaces-ui/agent-loom`), a Connect client and server for `AgentService`, Loom packaging, attachments and table mentions in the composer, and a windowed message list (long threads rely on `content-visibility` today). In the diagram: join lines can pass behind a card that sits between two tables, and there is no zoom or auto-layout.

Not verified: the Teradata forms of buckets, sampling and percentiles parse but have not run on a Teradata system. `Engine.store` has no Teradata implementation (it would use volatile tables). Certification has no permission check in the dev server.

Still open from the tables above: export and copy, plan viewer and cancel button, query history, lineage and quality, source connection screen, distribution views (box plot, correlation), query cells, saved queries, pickable value and date filters, cross-filtering, metrics layer, per-column formatting, period comparison, grid column pinning, three-tier value policy, verified (not just inferred) joins.

### Order of work recommended

1. Query foundations: result materialisation, deferred or estimated counts, time grain and binning, sampling, more aggregates, positioned errors, keyset paging.
2. Everyday needs: export and copy, plan viewer and cancel, value and date filters, per-column formatting.
3. Then chat (phase 5) and pages (phase 6), which build on 1 and 2.
4. Later: lineage and quality, metrics layer, pivot, query cells, sharing and alerts.

## Phases

Status: phases 1–3 done. Phase 2 covers DuckDB only (the Teradata adapter is waiting on a Teradata system; in-browser DuckDB is deferred as a cache). Phase 3 delivered DataGrid, Chart, SqlEditor, SchemaExplorer, FilterBar, QueryResult and the SQL workbench; not yet done there: column reorder and pinning, copy/export, chart brushing back into filters, editor diff view, and the Teradata-backed workbench. TanStack Table and Virtual were not used: the grid needs proportional scrolling past the browser's element-height limit, which they do not provide. Discovery and agent context (phase 7) was built ahead of phases 4–6: contract, `Discovery` interface, reference backend with a local embedding model, file-backed context packs, and the DataSearch, ObjectDetail, ColumnProfile, RelationshipGraph, ContextBuilder and AskData components. Decisions taken: local embedding model (never committed), no language model yet (pluggable; placeholder answers are labelled), data values withheld by default. Loom has embeddings, agent memory and artifact full-text search but no catalog discovery service, so it is a candidate production backend behind the same interface. Not built: lineage, saved queries and documents as objects, tags and owners, packs as an MCP resource. Phase 4 is mostly done: catalog definition with generated JSON Schema, agent prompt and docs; A2UI v0.9 surface model and React renderer; json-render adapter; MCP Apps (tools, single-file app page, data channel, stdio server, install command). Not done in phase 4: standalone app builds and embeds (iframe and web component), which wait on the app document model in phase 6, and a single `surfaces` CLI. The MCP SDK is now split into v2 packages, which the Apps SDK requires. The app page has not been run in a desktop host.

1. **Foundation** — monorepo, CI, `proto` + buf codegen, `tokens` + ThemePicker, docs site shell, `AGENTS.md`.
2. **Data core** — `QueryService`/`CatalogService`, DuckDB wasm + node adapters, **Teradata adapter**, `dev-server` with Parquet + Iceberg + Delta fixtures, `sql` rewriting (DuckDB + Teradata dialects), Arrow result store.
3. **Core components** — DataGrid (virtual + server paging), Chart, SqlEditor, SchemaExplorer, FilterBar, QueryResult; gallery SQL workbench running on both DuckDB and Teradata.
4. **Spec + delivery** — catalog, A2UI renderer, json-render adapter, prompt/doc generation; standalone build, embed, and MCP Apps bundle + install CLI.
5. **Chat + agents** — chat components, A2UI chat catalog (DecisionCard, Chart, Table, Markdown, CodeBlock…), stream reducer, `AgentBackend`, `agent-loom` adapter and Loom packaging, chat-analyst reference app.
6. **Apps** — page/view model, panel layout + drag-drop, snapshots, versions, `ViewService`.
7. **Discovery and agent context** — `discovery.proto`, the `Discovery` interface, the components above, and a reference index in the dev server.
8. **Scale-out** — DataFusion sidecar + conformance suite, Postgres source, Spark token preset, skills finalized, 1.0 API freeze.

Phases 1–3 are sequential; 4, 5 and 6 can run in parallel after 3.

## Verification

- **Unit:** Vitest for `sql` (golden rewrite cases per dialect, round-trip), `tokens` (contrast/derivation), `spec` (catalog validation, A2UI message conformance against the published v0.9.1 schema).
- **Engine conformance:** one suite run against duckdb-wasm, duckdb-node and DataFusion — types, paging, cancel, Iceberg/Delta snapshot reads.
- **Teradata:** the conformance suite and the SQL workbench end-to-end run against a Teradata dev instance — schema browse from DBC, sort/filter/paging issue Teradata-valid SQL, EXPLAIN view renders.
- **A2UI chat:** replay recorded A2UI streams (including loom-mobile's widget examples re-expressed in our catalog) and assert each component renders, streams incrementally, and returns actions; DecisionCard confirm reaches the agent.
- **Loom:** with a locally installed `looms`, `surfaces dev` with `agent.kind = "loom"` streams a reply containing an A2UI surface into the chat; `surfaces build --with-loom` produces a bundle that runs an agent workflow; a repo check confirms no Loom source is committed.
- **Scale:** Playwright perf test — 10M-row Parquet through DataGrid: scroll stays ≥ 50 fps, memory bounded by the window cache, sort/filter issue new SQL (assert via captured queries, never client-side sort).
- **Visual/a11y:** Playwright screenshots per theme preset × light/dark; axe checks (WCAG AA).
- **MCP:** build the apps, run `surfaces mcp install` into a scratch repo, call each tool with the MCP inspector / Claude Desktop, and confirm the `ui://` app renders and pages data.
- **Agent docs:** eval where a fresh agent, given only `llms.txt` + a skill, scaffolds a dashboard that builds and passes its template's check.
- **End to end:** `surfaces dev` against the Iceberg + Delta fixtures → browse schema → write SQL → grid → chart → save view → snapshot → reopen snapshot with the dev server stopped.

## Open risks

- SQL parser choice for Teradata dialect coverage (spike in phase 2); CTE-wrapping fallback must itself be Teradata-valid.
- Teradata CI needs a reachable test instance and credentials.
- Loom's proto/gateway surface for A2UI events must be confirmed against `~/repos/loom/proto/loom/v1` before the adapter is designed; how Loom is distributed (binary vs image) decides the `--with-loom` packaging shape.
- A2UI v1.0 is now current. The library writes v1.0 and reads v0.9 and v0.9.1 (`upgradeMessage` in `spec`); what it has not taken up from v1.0 is listed in [agent-integration.md](agent-integration.md).
- duckdb-wasm Iceberg/Delta support is narrower than native; the browser path may be Parquet-only with catalogs served by the dev server.
- Old surfaces-ui tool names/skills (`pt-surfaces-ui`, `pt-mcp-app-recipes`) describe a different codebase; they need updating once the new tools exist.
