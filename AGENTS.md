# Surfaces UI — guide for agents

Guides for people and agents using the library in their own projects: [docs/getting-started.md](docs/getting-started.md), [docs/agent-integration.md](docs/agent-integration.md), [llms.txt](llms.txt). Keep them current when an exported API changes. [docs/packages.md](docs/packages.md) and each package's README are written from its `package.json` by `scripts/package-readmes.mjs` (`--check` in `pnpm check:release`); a new package goes into one of its `GROUPS`.

Surfaces UI is a UI library for data and analytics users: exploring schemas, querying, charting, tables at scale, chat, and composing pages and apps. The approved plan with the full architecture and phases is in [docs/plan.md](docs/plan.md). Read it before adding a package.

## Status

What is built, and what has and has not been run against real systems: [docs/status.md](docs/status.md). Only what is listed there and in the notes below is built; everything else in the plan is not yet.

## Where things are

This file holds what is true everywhere: the commands, the rules and the conventions. Everything about one package or one component is in an `AGENTS.md` beside its code, with a `CLAUDE.md` that imports it. A new package or component folder gets a note and a line here (`pnpm check:notes` fails without them).

**The notes are not optional reading.** Before you change a file, or use a component or package from somewhere else, the notes that cover it must be in your context: the `AGENTS.md` of its folder and of every folder above it, up to this file. Never skip one. If a note is already in your context, do not read it again; after your context has been compacted or cleared it is gone, so read it again then. Claude Code loads a folder's notes when you read, write or edit a file there, and a hook (`notes-guard.mjs` in `plugins/agent-notes`, wired in `.claude/settings.json`) refuses a write to a folder whose notes are not in context and names them; in any other tool, read them yourself. Searching a folder loads nothing. When you learn something about a folder, write it into that folder's note, not into this file.

**Contracts**

| Notes | What it is |
|---|---|
| [`proto`](proto/AGENTS.md) | The contracts (`.proto`): the source of truth for anything crossing a process boundary. |
| [`packages/proto`](packages/proto/AGENTS.md) | Generated protobuf contracts for Surfaces UI |

**UI layer (must work with the data layer removed)**

| Notes | What it is |
|---|---|
| [`packages/tokens`](packages/tokens/AGENTS.md) | Theme contract, presets and CSS variable output for Surfaces UI. Also: using the theme. |
| [`packages/data`](packages/data/AGENTS.md) | DataSource interface, Arrow result helpers and an in-memory source. Also: querying data. |
| [`packages/components`](packages/components/AGENTS.md) | React components for Surfaces UI. Also: the rules every component follows, and the index of components. |
| [`packages/spec`](packages/spec/AGENTS.md) | Component catalog, A2UI surface model and React renderer for agent-generated UI. Also: agent-generated UI (A2UI), pages, the catalog rules. |
| [`packages/chat`](packages/chat/AGENTS.md) | Chat thread components for Surfaces UI: streaming replies, tool steps, approvals and inline agent-drawn components. Also: chat in a thread. |
| [`packages/agent`](packages/agent/AGENTS.md) | AgentBackend interface, event helpers and stream adapters for Surfaces UI chat |
| [`packages/agent-anthropic`](packages/agent-anthropic/AGENTS.md) | An AgentBackend over Claude through the Anthropic SDK, for Surfaces UI chat |
| [`packages/agent-loom`](packages/agent-loom/AGENTS.md) | Loom adapter for Surfaces UI chat: talks to a Loom server over its HTTP gateway |
| [`packages/agent-openai`](packages/agent-openai/AGENTS.md) | An AgentBackend over any OpenAI-compatible chat completions endpoint (OpenAI, Ollama, vLLM, LM Studio), for Surfaces UI chat |
| [`packages/state`](packages/state/AGENTS.md) | Reusable state services for Surfaces UI: stores, persistence, URL sync, undo, shared view state and query runs |
| [`packages/trace`](packages/trace/AGENTS.md) | Tracing for Surfaces UI: a bounded recorder of messages, problems, state, events, agent turns and service calls, with replay for time travel. Never holds row values or credentials |
| [`packages/devtools`](packages/devtools/AGENTS.md) | Developer tools for Surfaces UI: one component that records and shows the messages, components, problems, state, events, agent turns and service calls of agent-generated UI, with time travel |
| [`packages/create-surfaces`](packages/create-surfaces/AGENTS.md) | Creates a Surfaces UI app: a dashboard, a chat that draws live components, and a data server with six sample datasets |

**Data layer (optional; one implementation of `DataSource`)**

| Notes | What it is |
|---|---|
| [`packages/sql`](packages/sql/AGENTS.md) | Dialect-aware SQL rewriting for sort, filter and paging |
| [`packages/engine`](packages/engine/AGENTS.md) | Engine adapter interface for Surfaces UI servers |
| [`packages/engine-duckdb`](packages/engine-duckdb/AGENTS.md) | DuckDB engine adapter (Node, ADBC). Also: connections. |
| [`packages/engine-teradata`](packages/engine-teradata/AGENTS.md) | Teradata engine adapter for Surfaces UI: Teradata Query Service over HTTP, or a driver connection the consumer supplies |
| [`packages/engine-datafusion`](packages/engine-datafusion/AGENTS.md) | DataFusion engine adapter for Surfaces UI: talks to a DataFusion server over HTTP and reads Arrow |
| [`packages/engine-service`](packages/engine-service/AGENTS.md) | QueryService, CatalogService and SourceService over engine adapters, in Node or a browser |
| [`packages/dev-server`](packages/dev-server/AGENTS.md) | Local Connect server for Surfaces UI data sources |
| [`packages/client-connect`](packages/client-connect/AGENTS.md) | Connect client that implements DataSource |
| [`packages/datasource-duckdb-wasm`](packages/datasource-duckdb-wasm/AGENTS.md) | A DataSource that runs DuckDB in the browser (WebAssembly): real SQL over Parquet with no server |
| [`packages/discovery`](packages/discovery/AGENTS.md) | Reference discovery backend: search, profiles, relations and context packs over any DataSource. Also: discovery rules and agent context. |
| [`packages/embedder-local`](packages/embedder-local/AGENTS.md) | Local embedding model for semantic search; the model is downloaded on first use to a cache outside the repo |
| [`packages/seeds`](packages/seeds/AGENTS.md) | Six synthetic industry data models (retail, healthcare, fraud, telco churn, transportation, manufacturing): generator SQL, descriptions, keys, forms, pipelines and starter surfaces |
| [`fixtures/lake`](fixtures/lake/AGENTS.md) | Sample Parquet, Delta and Iceberg tables. |

**Pipelines (optional; the one part of the library that changes data)**

| Notes | What it is |
|---|---|
| [`packages/pipelines`](packages/pipelines/AGENTS.md) | Reference pipeline runner for Surfaces UI: builds datasets from one another on an Engine, with data quality rules |
| [`packages/pipelines-dbt`](packages/pipelines-dbt/AGENTS.md) | A dbt project as a Surfaces UI pipeline: datasets, tests, runs and semantic models read from dbt's artifacts, with dbt build only on a person's approval |

**Delivery**

| Notes | What it is |
|---|---|
| [`packages/mcp`](packages/mcp/AGENTS.md) | MCP Apps delivery for Surfaces UI: tools, ui:// resources and a stdio server. Also: MCP Apps. |
| [`packages/page`](packages/page/AGENTS.md) | Surfaces UI pages as one script and one stylesheet, for plain HTML pages with no build step |
| [`packages/next`](packages/next/AGENTS.md) | Serve Surfaces UI pages from a Next.js app: routes, metadata and server-rendered pages, with Next.js doing the routing, building and hosting |

**Plugins**

| Notes | What it is |
|---|---|
| [`plugins`](plugins/AGENTS.md) | The plugins people install into Claude Code and other agents: `surfaces-analytics` (skills and the MCP server) and `agent-notes` (the notes kept beside the code). |

**Apps**

| Notes | What it is |
|---|---|
| [`apps/playground`](apps/playground/AGENTS.md) | The playground and docs app. |
| [`apps/e2e`](apps/e2e/AGENTS.md) | Browser tests: the playground in a real browser, against DuckDB in the page |
| [`apps/recipes`](apps/recipes/AGENTS.md) | Runnable recipes: each is source, a test, and the prose in docs/recipes generated from them |

Components are one level further down: each folder under `packages/components/src` has its own note (`chart`, `grid`, `explore`, `workspace` and the rest), listed in [packages/components/AGENTS.md](packages/components/AGENTS.md).

## Commands

```bash
pnpm install
pnpm gen         # buf lint + regenerate packages/proto/src/gen
pnpm build       # all packages, in dependency order
pnpm test
pnpm typecheck
pnpm serve       # data dev server on http://localhost:5220 (reads surfaces.config.ts, and secrets from a git-ignored
                 # .env.local beside it, which never overrides the shell; its agent comes from
                 # ANTHROPIC_API_KEY, OPENAI_API_KEY (+ OPENAI_BASE_URL, OPENAI_MODEL) or
                 # SURFACES_LOCAL_MODEL_URL + SURFACES_LOCAL_MODEL; SURFACES_AGENT picks one;
                 # ANTHROPIC_MODEL overrides claude-sonnet-5-5; SURFACES_TEST_LOOM_CONFIG lets the
                 # Models page change the test Loom's model)
pnpm dev         # docs playground on http://localhost:5210
pnpm check:boundaries   # UI packages (trace and devtools among them) must not import the data layer
pnpm check:notes        # every package, app and component folder has its AGENTS.md and CLAUDE.md, listed and linked
pnpm check:plugins      # the plugins pass what a Claude directory submission is refused for, and the MCP pin is current
pnpm e2e         # browser tests (apps/e2e, Playwright): the playground in Chromium at desktop and phone size,
                 # against DuckDB in the page; axe WCAG 2.2 AA checks included. First run:
                 # pnpm --filter @surfaces-ui/e2e e2e:install
SURFACES_TEST_NEXT=1 pnpm --filter @surfaces-ui/recipes exec vitest run src/nextjs-site
                 # a real `next build` of the nextjs-site recipe (static export), as CI's `nextjs` job runs it;
                 # build the packages first (pnpm exec turbo run build --filter=@surfaces-ui/recipes^...)
pnpm docs:gen    # docs/catalog and docs/recipes; CI fails if either is stale
pnpm changeset   # describe a change for the next release
pnpm check:release      # what stops a publish (license, descriptions, files, access, repository, one version);
                        # cutting a release: docs/releasing.md
scripts/s3-sim.sh       # a local stand-in for S3 with the retail sample in a bucket; then
                        # SURFACES_S3_ENDPOINT=127.0.0.1:9100 pnpm serve adds the source "s3"
```

## Rules

1. **Contracts first.** A new cross-process call or stored document starts as a change in `proto/`, then `pnpm gen`. Do not hand-write types that mirror a proto message. Keep `buf lint` clean and do not make breaking changes to published messages.
2. **Sort, filter and page in SQL, never in the browser.** Grid and chart state is a `ViewQuery`; the engine side rewrites the base SQL in the source's dialect. Loading rows and filtering them in memory is a bug, not a shortcut.
3. **Every engine implements the same services.** DuckDB, Teradata and DataFusion are adapters behind `QueryService`/`CatalogService`. Nothing in `components` may know which engine it is talking to. Teradata is a first-class target: any SQL the library generates must have a Teradata form (no `LIMIT/OFFSET` there).
   **The data layer is removable.** UI packages (`tokens`, `components`, `chat`, `spec`, `app`) depend only on the `DataSource` interface and must never import an engine, driver, Connect client, `sql`, or the dev server. A consumer with their own backend implements `DataSource` and installs no data-layer package. Every component must run against an in-memory `DataSource`. See "Boundary" in [docs/plan.md](docs/plan.md).
4. **Colours and sizes come from `--sf-*` variables only.** No hex values, no fixed px for spacing or radius in component code or CSS. Need a new token? Add it in `packages/tokens/src/derive.ts` and `css.ts`, with a contrast test.
5. **One definition, generated everywhere.** Theme lives in `packages/tokens`; component catalogs (phase 4) will be defined once and generate types, validation, the agent prompt and docs. Do not copy constants between packages.
6. **MCP is one delivery channel.** Components must work as a plain React import. MCP Apps, A2UI-in-chat, embeds and standalone builds wrap the same components.
7. **Loom is an optional agent backend and is never vendored.** No Loom source, protos or binaries are committed here. `@surfaces-ui/agent-loom` (`loomAgent({ baseUrl, token })`) only calls a running Loom server's HTTP gateway and reads its JSON events. It reports Loom's agents and models (`describeAgents`, from `/v1/agents` and `/v1/models`, a model named `provider/model`) and, when a turn names a model the session is not on, switches the session first (`:switch-model`, keeping the conversation); tested on recorded calls, not yet against a live Loom.
8. **Do not copy code from loom-mobile.** It is the reference design only; implementations here are written fresh in TypeScript.
   The DuckDB engine refuses functions that hand a string of SQL to an attached database (`postgres_query`, `postgres_execute` and their MySQL and SQLite equivalents), because the read-only check cannot see inside the string. Keep that list current when attaching a new kind of database. Dates and times are handled in UTC whatever the server's own time zone.
9. **Read-only by default.** Query paths accept a single `SELECT`/`WITH` statement over a read-only connection. Credentials are referenced by secret name and resolved server-side; they never appear in protos, configs committed to a repo, or the browser. On the dev server, keys come from its environment or a git-ignored `.env.local` (`loadEnvFile`, which reports names, never values); there is no UI field for a key.
10. **Accessibility is part of done.** The standard is WCAG 2.2 level AA; [docs/accessibility.md](docs/accessibility.md) maps each criterion to how it is met and what is tested. Contrast is tested for presets; controls are keyboard reachable, labelled, with visible focus and at least `--sf-target-min` (24px, 44px for touch) to press; motion stops under `prefers-reduced-motion`.
11. **Respond to the container, not the window.** The same component is drawn in a page, a chat reply, a side panel and an MCP frame. Use `@container sf (...)` inside a `.sf-container` region (surfaces and query results already are), fluid grids before breakpoints, and no fixed widths.
12. **Charts follow Tufte and Few.** Bars start at zero, one y scale, sorted bars, no decoration, a text reading and a table for every chart. Run `chartAdvice` on a new chart shape. The full rules are in `plugins/surfaces-analytics/skills/chart-standards`.

## Conventions

- ESM, TypeScript strict, relative imports end in `.js`.
- Tests sit next to the code as `*.test.ts(x)` and run with Vitest; component tests start with `// @vitest-environment jsdom`.
- Packages export from `dist`; run `pnpm build` (or rely on Turbo's `^build`) before testing a package that depends on another.
- Sentence case in UI text. No decorative shadows.
