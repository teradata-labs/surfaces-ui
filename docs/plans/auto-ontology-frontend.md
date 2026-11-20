# A Surfaces frontend for NVIDIA Auto Ontology

A plan for a new repository that replaces the web UI of [NVIDIA Auto Ontology](https://github.com/NVIDIA/auto-ontology) (read at v1.3.0, commit `7dac5ff`) with one built from Surfaces UI, keeping Auto Ontology's backend. Every view is a json-render page a person can rearrange for themselves. Two kinds of people use it: those who certify the ontology and those who rely on it. It has to end in reports, dashboards and outcomes, and one of its readers is the CTO of Teradata.

Nothing here is built. Auto Ontology's code was read, not run; what could not be checked is listed under "Not verified".

## Decisions already made

| Decision | Choice |
|---|---|
| Where the frontend lives | A new repository, separate from Auto Ontology and from Surfaces UI |
| What is kept from Auto Ontology | Its backend, used as shipped |
| Source database to start | DuckDB. Teradata is a later phase, not a blocker |
| Page format | json-render (`{ root, elements, state }`) for every view |
| Layout | Each person can personalise each view |

## What Auto Ontology is, in one screen

It builds an ontology from database metadata (terms with synonyms, column attributes that map terms to columns, SQL attributes that hold reviewed calculations, relationships between terms), lets experts certify it, and answers questions from it with a text-to-SQL agent that returns the SQL and the steps with every answer.

| Part | What it does | Port |
|---|---|---|
| Next.js app | The web UI, and also sign-in, roles, API tokens, the MCP sign-in, conversation storage and the public API (87 operations) | 3000 |
| FastAPI backend | The agent, catalog and ontology APIs. Trusts the user id it is sent in a header | 3001, private |
| Ingestion service | Ingest and semantic compilation. No authentication of its own | 3002, private |
| MCP server | Nine read-only tools over the public API | 3003 |
| Postgres with pgvector | Catalog, ontology, embeddings, and the Next.js app's own tables | 5432 |

Its screens today: Chat, Discovery (search and tagging rules), Terms (glossary and certification), Analysis (curated SQL and PQL examples for the agent), Exploration (a graph of tables or terms), Data (catalog tree), Analytics (a 30-day usage log, admins only), API tokens, and eleven Settings pages.

## Architecture

The browser cannot call the Python services: they trust an unverified `x-auto-ontology-user-id` header and must stay on a private network. The Next.js app is what makes that header. It also owns users, sessions, invitations, API tokens, SSO, the MCP OAuth tables, conversations, the usage log, custom prompts, acronyms and five settings.

So the Next.js app keeps running, with its pages unused, as the gateway. The new repository holds two things:

```
browser
  └─ ontology-ui (new repo)
       ├─ web        Vite + React + Surfaces UI. Every view a json-render page.
       └─ server     One origin for the browser. Three jobs:
            ├─ /api/*      passed through to Auto Ontology's gateway (cookie or token forwarded)
            ├─ /views/*    view documents, per-person layouts, shares, the certification record
            └─ /surfaces/* a Surfaces engine service (read-only) for grids, charts and reports
                              │
Auto Ontology (unchanged)     ├─ source database (DuckDB now, Teradata later)
  gateway :3000 → backend :3001, ingestion :3002 → Postgres
```

Why a server and not a static app:

- **No cross-origin access.** No gateway route sends CORS headers, and FastAPI allows only `localhost:3000`. One origin in front avoids changing Auto Ontology at all.
- **New storage.** Per-person layouts, shared pages and a certification record exist nowhere upstream.
- **Rows.** The public API has no "run this query" call. Chat returns the rows of one answer (the MCP tool caps them at 100). A grid that sorts and pages in SQL, a chart that aggregates in the engine and a report with filters all need a `DataSource`, so the server runs Surfaces' own engine service against the same source, read-only.

That third point is the largest architectural edge: **two things read the source database**, Auto Ontology's connector (to ingest and to answer) and Surfaces' engine (to draw). Credentials are configured twice, and a person's rights in Auto Ontology (owners, groups) are not applied by the Surfaces engine. For DuckDB this is acceptable. Before Teradata it needs an answer: either a query endpoint contributed upstream so there is one path, or the server restricting the Surfaces engine to what the signed-in person may read.

Replacing the gateway outright (sign-in, SSO, tokens, MCP OAuth, conversations) is possible later and is not planned: it is the most work for the least visible gain, and it would make every upstream release a merge.

## Who uses it

Auto Ontology has two roles, `admin` and `viewer`, plus owner groups: a viewer in a group that has the admin role and owns a term or table may edit and certify that one thing. That is enough to carry four kinds of people without changing upstream.

| Person | In Auto Ontology | What they do here | Opens on |
|---|---|---|---|
| Steward | A viewer in an owner group with the admin role, or an admin | Reviews drafts, tests them with real questions, edits names, descriptions and SQL attributes, certifies | Certification queue |
| Consumer (analyst, business user) | Viewer | Asks questions, reads the glossary, walks the graph, builds reports and dashboards from certified meaning, flags what looks wrong | Ask |
| Administrator | Admin | Connections, compilation, people, SSO, zones, import and export | Readiness |
| Executive | Viewer | Reads outcomes: how much is certified, what can be answered, what is used | Outcomes |

Rules that follow:

- **Upstream decides who may do what.** The server asks the gateway and passes its refusals on. The frontend hides a control a person cannot use, but hiding is never the check.
- **Certifying is a person's act**, as Surfaces already requires. An agent may propose a description or a SQL attribute; only a named person's save certifies it.
- **A consumer sees trust everywhere.** Every term, attribute and answer carries its certification mark (text and symbol, not colour alone). Reports offer certified fields first and mark the rest.
- **A consumer can ask for a review.** Upstream has no such thing. A "this looks wrong" note on a term or an answer goes into the steward's queue. This is the "learn" loop upstream describes but gives no screen.

## Views are json-render pages

### The document

A view is stored as one document: a json-render spec with what json-render does not carry around it.

```json
{
  "id": "terms",
  "title": "Glossary",
  "catalogId": "ontology",
  "version": 3,
  "spec": {
    "root": "page",
    "elements": {
      "page": { "type": "Workspace", "props": { "layout": { "$state": "/layout" } }, "children": ["list", "detail"] },
      "list": { "type": "TermList", "props": { "opened": { "$state": "/term" } } },
      "detail": { "type": "TermDetail", "props": { "term": { "$state": "/term" } } }
    },
    "state": { "term": null, "layout": { "columns": [["list"], ["detail"]] } }
  }
}
```

It is drawn through the path Surfaces already has: `fromJsonRender` to A2UI messages, into a `PageDocument`, checked against the catalog, drawn by `SurfaceView`. Edits go the other way through `editPage` and `toJsonRender`. Nothing outside the catalog is drawn, so a view document from storage is as safe as one from an agent.

### Personalising a layout

Three layers, applied in order:

1. **Base.** Shipped in the repository, one per view, reviewed like code.
2. **Role default.** An optional variant an administrator publishes for a role ("stewards see the queue first").
3. **Mine.** A person's own changes, kept as an ordered list of edits against a named base version, not as a copy.

Keeping edits and not a copy is what lets a base improve without wiping what people arranged: on load the edits are replayed with `editPage`; one that no longer applies is dropped and the person is told. "Reset to default" deletes the list. What a person can change:

- Move, resize and put side by side (`useArrange`, which already works by pointer, touch and keyboard).
- Show, hide and fold panels (`Workspace` layout, already plain data).
- Add a component from a palette and remove one they added.
- Keep their filters, sorts and column choices (already catalog props).

What they cannot: remove or reorder an element marked locked in its metadata (the certification status on a term, the "answered by" line on an answer), or add a component their role may not use.

### Where json-render in Surfaces stops

| Gap | Effect | Plan |
|---|---|---|
| Only `type`, `props`, `children` are read. `visible`, `repeat`, `on`, `watch` and `slots` are ignored, and any `$` form in props other than `$state` (`$cond`, `$item`, `$index`, `$template`, `$computed`, `$bindState`) fails validation | A spec written for upstream json-render may not draw | Decide the dialect (see "Open decisions"). At least: add `visible`, and refuse an unsupported key with a notice, never silently |
| A repeated child (A2UI template children) is dropped by `toJsonRender` | A page with a repeated list does not round-trip | Add `repeat` both ways, with a test |
| No `id`, `title`, `catalogId`, `theme` in a spec | Needs the wrapper above | Wrapper in the new repo; consider `JsonRenderPage` in `@surfaces-ui/spec` |
| No place for metadata. json-render has no standard for it; A2UI v1.0 does (`@metadata.extensions`), and Surfaces is on v0.9, which has none | Locks, roles, who added a tile, the question behind it and its certification have nowhere to travel | Take A2UI v1.0's `Extensions` as an optional key: see "Metadata" below |
| No `@json-render/*` dependency and no pinned version | "json-render" here means Surfaces' reading of the shape | State the supported subset in `docs/`, with a conformance test |
| Round trip is tested only for plain trees with `$state` | Unknown behaviour elsewhere | Extend the round-trip test to every ontology view |

### Metadata

Metadata follows A2UI's own standard, so nothing here is invented. A2UI v1.0 (the current version; read in its specification at commit `0d3ebdc`) defines an `Extensions` map for exactly this, "non-visual metadata (such as access constraints, audit tags, and telemetry identifiers)", in five places. The three this plan uses:

| Scope | A2UI v1.0 | Used for |
|---|---|---|
| Component | `@metadata.extensions` beside `id` | Locked, roles, who added a tile, the question and SQL attribute behind it |
| Surface | `createSurface.metadata.extensions` | The view's base version, its roles, how it is shared |
| Action sent back | `action.metadata.extensions` | Who pressed, for the certification record |

```json
{
  "id": "tile-3",
  "component": "Chart",
  "sql": "…",
  "@metadata": {
    "extensions": {
      "surfaces_locked": false,
      "surfaces_roles": ["viewer", "admin"],
      "surfaces_added_by": "person:ana",
      "ontology_source": { "question": "Revenue by state", "sqlAttribute": "attr-41", "certified": "partial" }
    }
  }
}
```

The standard's rules, all kept:

- **Names are prefixed by their owner.** Keys must be identifiers; `a2ui_` is reserved for official extensions; anyone else prefixes with their product (`surfaces_`, `ontology_`). There is no registry.
- **A renderer must not reject an extension it does not know, and must ignore it.** So adding one never needs a change to Surfaces.
- **Optional everywhere.** Left out, it costs nothing.
- **An update replaces a component whole, its `@metadata` included**, and leaving it out clears it. Every edit Surfaces makes to a component (`editPage`, the Arrange messages) therefore has to carry it forward.
- **Nothing else is allowed beside it.** `@metadata` holds `extensions` only.

**In Surfaces.** Done with the move to A2UI v1.0: `@metadata` is a reserved key on every component in `defineCatalog`, with `metadata` on `createSurface` and on an action, checked against the v1.0 `Extensions` shape and limited in size. A component never receives it as a prop, the catalog does not look inside a value, and nothing in it is ever run.

**In json-render.** json-render has no metadata standard of its own (its core types give an element `type`, `props`, `children`, `slots`, `visible`, `on`, `repeat`, `watch`), so the same thing is written under the name json-render's own app formats use: `metadata.extensions` on an element and on the spec. It maps one to one onto A2UI's component and surface scopes. json-render does not mind the extra key, as read in its source at commit `9301e64` (core 0.23.1), not run:

- Its spec validator has no check for an unknown key on an element, and its React renderer ignores what it does not know.
- Its catalog validation accepts an unknown key but leaves it out of the validated copy it returns, so a tool that saved that copy would lose it. This plan never saves through it.
- The strict JSON Schema it can hand a model allows no extra keys. Agents here write A2UI, so this does not arise.

**SQL is a prop, never metadata.** A data component's `sourceId` and `sql` stay props, checked by the catalog and run only through the read-only `DataSource`. Metadata holds where the SQL came from.

**A tile is certified only while it still matches.** A tile keeps a copy of its SQL. When a view loads, the server compares each tile that names a SQL attribute with that attribute as it now stands. If the query has changed or the attribute is no longer certified, the tile says so and offers to take the current query.

**Surfaces moved to A2UI v1.0 first.** A2UI's own version list marks v1.0 current and v0.9 previous, and Surfaces spoke v0.9. The move was a breaking one and is done on this branch; what it changed, from A2UI's evolution guide:

| v1.0 change | What it touches in Surfaces |
|---|---|
| A binding is `{ "@path": … }` and a function call `{ "@call": … }`, not `path` and `call` | Every binding in every stored page, pattern, seed, example and saved conversation |
| `accessibility` and `checks` on a component become `@accessibility` and `@checks` | `defineCatalog` and every renderer that reads them |
| `theme` is removed from `createSurface` | Surfaces' per-surface theme, which moves to `metadata.extensions` |
| A surface may mix catalogs, a component naming its own with `@catalogId` | Replaces the `extendCatalog` this plan would otherwise add |
| `createSurface` may carry components and data; a second `createSurface` for a live id is an error | `applyMessage`, and replies that reuse the id `main` |
| `updateDataModel` must carry `value`; `null` deletes | The data model reducer |
| Messages carry `version: "1.0"`; client and server are renamed renderer and agent | Envelopes, the generated prompt and docs |

It was cheapest before the new repository stored anything: nothing was published, and every view, personal layout and saved conversation kept later would have needed converting.

How it stays safe: Surfaces reads both versions and writes only v1.0, with one `upgradeMessage` that turns a v0.9 message into v1.0 for anything already saved in a browser or a library. A blanket find-and-replace of `path` and `call` would be wrong, since a child template's `path` and the `updateDataModel` envelope's `path` keep their names, so the conversion walks the shape. v1.0 became current very recently; the upgrade function is also what would absorb a late change to it. Not taken up yet: functions called across the wire, catalogs mixed in one surface, `allowedParents`, `@checks` and `@index`.

## The ontology catalog

One catalog, `ontology`: everything in `analyticsCatalog` plus the components below, each with a description, zod props, a valid example, a renderer, a test against an in-memory backend, and a `reportControls` and `onContext` path like every Surfaces component.

| Component | For | Built from |
|---|---|---|
| `TermList` | The glossary: search, filter by tag, owner and certification; windowed | New, over `Ontology.listTerms` |
| `TermDetail` | A term: description, synonyms, owner, tags, column attributes, SQL attributes, each with its mark and, for a steward, its certify control | New; reuses `Markdown`, `CodeBlock` |
| `CertificationMark` / `CertificationControl` | Certified, partial, pending, shown the same everywhere; the control records a note | Extends the idea of `CertificationBadge`, which knows only certified and deprecated |
| `CertificationQueue` | What awaits a steward, most used first, with "certify these" for several | New |
| `CertificationHistory` | Who certified or uncertified what, when and why | New, over the record the server keeps |
| `SqlAttributeEditor` | Write or change a calculation: validate, ask for a description, save | `SqlEditor` plus the upstream validate and suggestion calls |
| `ConceptGraph` | The graph of tables or of terms, up to hundreds of nodes | New, on the ECharts graph series: see "The graph" |
| `AnswerCard` | An answer with its SQL, its steps, its rows and a chart, and "add to a dashboard" | `Markdown`, `CodeBlock`, `Chart`, `DataGrid`, `ToolSteps` |
| `CoverageCheck` | "Can this be answered?" before asking: the grade and the terms found | New, over `question-entity-coverage` |
| `CatalogTree` | Databases, schemas, tables, columns with editable, certifiable descriptions | `ObjectBrowser` with a custom `discovery`, plus `ObjectDetail` |
| `UsageLog` | Questions asked, by whom, with the SQL | `DataGrid` over the outcomes source |
| `ReadinessCard` | Is a source connected, is compilation done, are models reachable | New |
| Settings forms | Connections, zones, tags, rules, people, groups, SSO, prompts, acronyms, import and export, agent settings | Surfaces forms and `PlanReview`; `ConnectionBuilder` does not fit, since upstream owns connections |

Edges in Surfaces for a custom catalog:

- Extending `analyticsCatalog` works by spreading its components and renderers into a new catalog, but it is neither documented nor tested. Add `extendCatalog` with a test.
- `withMinHeight` is private, so a new component does not get `minHeight` and cannot be given room in Arrange. Export it or apply it in `extendCatalog`.
- A page's `theme` can name only the eight built-in presets. A branded deployment needs a page to be able to name a host-registered preset.

## The backend interface

Surfaces components never call a transport. The new repo defines one interface, `Ontology`, with two implementations: `connectOntology({ baseUrl })` over the public API, with types generated from `docs/openapi/auto-ontology-api.json`, and `memoryOntology()` for tests and demos. Alongside it:

| Surfaces interface | Implemented over |
|---|---|
| `DataSource` | The Surfaces engine service in the server (DuckDB now) |
| `Discovery` | Upstream global search, catalog nodes and descriptions; `setCertification` mapped to `description_certified` |
| `AgentBackend` | `POST /api/chat/completions` (server-sent events), `watch` and `cancel` |
| `ChatSessions` | `/api/conversations` |
| `Semantics` | A term and its attributes read as a semantic model (see "Reports and dashboards") |
| `SurfaceLibrary` | The new server's view store |

### The chat adapter

`ontologyAgent()` turns Auto Ontology's events into Surfaces':

| Upstream event | Becomes |
|---|---|
| `step` (`node`, `label`, `phase`, `thought`) | A step, running then done |
| `sql` | The step's detail, shown as code |
| `result` (`response`, `sql_code`, rows) | Text, then an `AnswerCard` surface |
| `charts` (a fenced `chart` block: type, x, series, data, KPIs) | A catalog `Chart` or `Metric` row over the answer's SQL |
| `error`, a 409, a stream ended by cancel | An error or a stopped turn, in words |

Edges:

- **The chart is drawn from the SQL, not from the rows upstream sent.** Surfaces charts aggregate in the engine and need a `DataSource`. So the answer's SQL runs a second time through the Surfaces engine. That costs a query and can differ from the first run on changing data; the card says when the data is as of. The alternative, an in-memory source over the returned rows, is limited to what upstream sends (at most 60 rows in a chart).
- **Upstream's chart plan is a model's guess.** It is passed through `chartAdvice` like any other chart, so a misleading shape says so.
- **A reply always says who answered** ("Answered by Auto Ontology, with …"), and a follow-up needs a conversation id or upstream returns no chart.
- Upstream sends no approval events and no usage counts, so `ApprovalCard` and the usage gauge stay unused in chat.

## Certification

What upstream stores is thin, and this is where the two audiences meet.

| Upstream has | Upstream lacks |
|---|---|
| A boolean per thing: a term's name and description, each column attribute, each SQL attribute, each catalog description | Who certified and when |
| A term's roll-up: certified, partial or pending | Any history |
| Each change saved at once, one call per field | A review queue, bulk certify, a note, a second approver |
| | Certification in a model export |

Plan:

1. **A record in the new server.** Every certify and uncertify made through this frontend is written first to a ledger (what, field, from, to, who, when, note, and the test questions that were run), then sent upstream. The ledger is the history, the queue's "done" list and the source of every trend on the outcomes page.
2. **Reconcile.** Changes can also arrive through upstream's API or a recompile. The server compares upstream's flags with the ledger on a timer and records a difference as "changed outside", never guessing who.
3. **The queue.** Everything not certified, ordered by how often questions touch it, with a consumer's review requests on top.
4. **Certify with evidence.** Before certifying a term or a SQL attribute, the steward runs real questions against it (`CoverageCheck`, then the answer with its SQL). The questions and whether the steward accepted the answers are kept with the decision.
5. **An edit to something certified is a decision too.** Upstream keeps the flag when a name, a description or a SQL attribute's fields change (its update statements carry the old flag forward unless a new one is sent), so certified text can change and stay marked certified. Here, saving a change to a certified item asks the person to certify it again or leave it uncertified, and the ledger records which.
6. **Offer the gaps upstream.** `certified_by`, `certified_at` and a history table belong in Auto Ontology, as does certification in export. Proposed as contributions; the ledger stays until they land.

Surfaces' own certification is narrower still: tables only in the UI, one latest record, keyed by table name without its database, and no check of who may certify. None of it is reused for terms. The `Discovery` adapter maps it only for catalog descriptions.

## The graph

Upstream draws its graph with WebGL (sigma, graphology, a running force layout) and returns up to 500 nodes, or every node of one database with no cap. Surfaces has nothing for this: `RelationshipGraph` is one centre and eight neighbours, `ModelDiagram` is a grid of table cards, `PipelineGraph` is a layered DAG of DOM nodes, and none is a general node-link graph.

`ConceptGraph` is new and belongs in Surfaces, drawn with ECharts' graph series. ECharts 6 is already what `Chart` draws with, on canvas, themed by `echartsTheme`, so this adds no dependency: only `GraphChart` registered beside the four chart types `Chart` registers today, loaded when a graph first draws. The graph series brings a force layout that settles, a circular layout, pan and zoom, categories, and highlighting a node's neighbours. `Chart` itself cannot draw it, since a chart is rows from one query and a graph is nodes and links, so it is a component of its own with its own catalog entry:

- Colours from the theme's series tokens, one per kind of node, with the kind also written in the list so colour is never the only sign.
- A layout that settles and stops (and does not run under reduced motion), not a simulation that never rests.
- Both layers: tables with foreign keys and query-derived joins; terms with represents, has-attribute and semantic-key links. Expanding a node, and the hop path behind a term-to-term link.
- **A list beside the canvas that does everything the canvas does**: find a node, open it, walk to a neighbour. A canvas cannot be the only way; this is the accessibility requirement that the upstream graph does not meet.
- Past a few hundred nodes it shows a neighbourhood and says how many are not drawn, never a hairball. Upstream's cap of 500 is within what a canvas graph series draws; an uncapped single database may not be, and that size has not been tried.

## Reports, dashboards and outcomes

Upstream has none of this: "Analytics" is a usage log, "Analysis" is examples for the agent, and nothing is saved but conversations.

### From an answer to a dashboard

- **Add to a dashboard.** An `AnswerCard` puts its chart or number on a page as a tile over the answer's SQL, labelled with the question, who asked and the terms it resolved to.
- **Reports from certified meaning.** A term's column attributes become the dimensions and plain measures of a Surfaces semantic model, each marked certified or not, so `Explorer` and `ReportBuilder` draw pills from the ontology. **A SQL attribute does not become a pill.** Upstream defines it as a whole query (`SELECT <expression> FROM <tables>` for a calculation, or `SELECT * FROM <tables> WHERE <condition>` for a filter), while a Surfaces measure is one aggregate over one column and a metric is arithmetic over measures. So a calculation is offered as a headline number or a tile over its own query, and a filter as the rows a report starts from. Breaking a certified calculation down by any dimension would need it restated as measures, which is a person's decision and is not automatic.
- **Dashboards are view documents**, so they are json-render, personalised and shared the same way as every other view, and `PageStudio` edits them from plain-language instructions.

### Outcomes

A page the executive opens on, drawn from an `outcomes` source: the server's ledger and snapshots plus upstream's usage log, read through the Surfaces engine like any other data. Headline numbers each sit beside a trend, as the chart rules require.

| Question | Measure |
|---|---|
| How much can be trusted? | Share of terms, column attributes and SQL attributes certified, over time |
| Is certification keeping up? | Queue size and age; certified per week; time from draft to certified |
| Can people get answers? | Questions asked; share answered; share answered only from certified meaning |
| What is missing? | Questions that could not be answered, grouped by the words nothing covered |
| What is used? | Most used terms and calculations, and which of those are uncertified |
| Who is involved? | Active stewards and consumers; review requests raised and closed |

Edges: upstream keeps 30 days of usage, readable by admins only, and it holds people's questions in full. The server copies daily counts into its own tables (no question text for non-admins) so trends outlive 30 days.

### What Surfaces lacks for outcomes

| Missing | Plan |
|---|---|
| Sharing and permissions on a saved page (the library is one shared store; "saved by" is a label) | Per-view visibility in the new server: mine, a role, everyone |
| Print and PDF (no print styles; snapshot calls are unbuilt) | A print stylesheet in Surfaces and a static snapshot through `@surfaces-ui/page`, for a briefing |
| Drill-through from one page to another with its filters | A link action carrying filters, in Surfaces |
| Scheduled delivery and alerts | Deferred; listed so nobody assumes them |
| Annotations on a chart | Deferred |
| Excel or Parquet export | CSV only today; deferred |

## Screen by screen

| Upstream screen | New view | Surfaces parts | Gap |
|---|---|---|---|
| Chat | Ask | `AnalyticsChat`, `AnswerCard`, `CoverageCheck` | Chat adapter; chart translation |
| Terms | Glossary | `TermList`, `TermDetail`, `Workspace` | New components |
| (none) | Certification queue | `CertificationQueue`, `CertificationHistory` | New, and the ledger |
| Exploration | Graph | `ConceptGraph` | New component on ECharts |
| Discovery | Search | `DataSearch` over the adapter; rules as a form | Rule editor |
| Data | Catalog | `CatalogTree`, `ObjectDetail` | Certification per description |
| Analysis | Examples | `SqlEditor`, a list | Small |
| Analytics | Outcomes, Usage | `Metric`, `Sparkline`, `Chart`, `DataGrid` | Outcomes source |
| (none) | Reports and dashboards | `ReportBuilder`, `Explorer`, `PageStudio` | Sharing, print, drill-through |
| Settings (eleven pages) | Settings | Forms, `PlanReview`, `StepFlow` | Volume, not difficulty |
| Login, invite, OAuth consent, API tokens | Same | Plain forms over the gateway's auth routes | Must keep MCP sign-in working |

## DuckDB now, Teradata later

**Now.** Auto Ontology reads DuckDB through a connection string (it is not offered in its connections screen). The demo data is Surfaces' retail seed built into one DuckDB file with declared primary and foreign keys, so compilation has real keys to find and both readers see the same tables. Both open the file read-only (Auto Ontology's DuckDB connector does so by default), since DuckDB allows one writer; the file is built once, before either starts.

**Teradata.** Three separate pieces of work, in this order:

1. **A connector in Auto Ontology.** There is none, and the word does not appear in its repository. A connector implements one class (`execute`, tables, columns, views, keys, query history, a dialect name) and registers a connection-string scheme. sqlglot, which Auto Ontology uses to check SQL, has a Teradata dialect. The query-history hook maps naturally to Teradata's query log, which is a real advantage for an ontology built from how data is used. Its agent prompts carry dialect rules for four engines only; Teradata needs its own (`TOP` and `QUALIFY`, no `LIMIT`).
2. **The Surfaces engine.** `@surfaces-ui/engine-teradata` has run against Teradata 20.00 through the driver. On it there are no kept results (each view runs its query again), no pipelines, and a result over 250,000 rows is an error. The Query Service transport is unverified.
3. **One path for rows.** The two-readers question above, settled before a shared Teradata system is involved.

Until then the plan keeps every generated query in a form Surfaces already writes for both engines, so nothing drawn on DuckDB is a dead end.

## Work, by repository

**Surfaces UI (this repository)**

- json-render: `visible`, `repeat` both ways, refusal of unsupported keys, a stated subset and a conformance test.
- Metadata: carried (done). Still to do: `surfaces_locked` and `surfaces_roles` honoured by `useArrange` and the editor.
- A2UI v1.0: done. Surfaces writes v1.0 and reads v0.9 (`upgradeMessage`, `upgradePage`, `upgradeSurface`); metadata is A2UI's `extensions`. Still to take from v1.0: mixed catalogs in one surface, which is what would replace `extendCatalog`, so that helper is still needed for now.
- Layout overlays: done (`personal.ts`: `layoutEdits`, `personalisePage`, `parsePersonalLayout`), with `surfaces_locked` honoured by Arrange. `surfaces_roles` is still the host's to enforce.
- `extendCatalog`, with `minHeight` applied, documented and tested: done.
- A graph on the ECharts graph series, with its list: done, as the catalog's `NodeGraph`. The ontology app feeds it terms and links.
- A page theme that can name a host preset.
- Print styles; a drill-through link action.
- Publish the packages. Every package is at 0.0.0 with the first release still pending; until then the new repo vendors them with `create-surfaces --from-repo`, which is workable and awkward.
- Housekeeping found on the way: `AGENTS.md` and `scripts/check-boundaries.mjs` name a `packages/app` that does not exist, and `packages/page` exists but is not listed.

**The new repository**

- The server: pass-through, view store, overlays, shares, ledger, snapshots, the engine service.
- `Ontology` and its two implementations; the adapters in the table above.
- The `ontology` catalog and its renderers; the base views for four roles.
- Tests: every component against `memoryOntology`; the chat adapter against recorded event streams; the generated API types checked against the pinned upstream spec; Playwright with axe at desktop and phone width.

**Auto Ontology (offered upstream, none required to start)**

- Who and when on certification, a history, and certification in export.
- A Teradata connector and dialect rules.
- A read-only query endpoint, so rows have one path.

## Phases

Each phase ends in something a person can use. Sizes are relative, not dates.

| Phase | Delivers | Done when | Size |
|---|---|---|---|
| 0a. A2UI v1.0 in Surfaces (done) | Surfaces reads v0.9 and v1.0 and writes v1.0; saved pages, surfaces and conversations upgraded on load; `@metadata` carried through pages, Arrange and json-render | Done on this branch: every unit test that touches A2UI passes on v1.0 and a v0.9 page still opens. Left for later from v1.0: functions across the wire, mixed catalogs, `allowedParents`, `@checks`, `@index` | Done |
| 0. Stand up | Auto Ontology running on the DuckDB retail file; the new repo with its server passing calls through; sign-in working; the open decisions below answered | A question asked through the new origin returns an answer | Small |
| 1. Read and ask | `Ontology` and the adapters; Ask, Glossary (read-only), Catalog, Search as json-render views; certification marks everywhere | A consumer can ask, read an answer's SQL and steps, and look up any term | Large |
| 2. Certify | Term and attribute editing, SQL attribute editor, the ledger, the queue, history, review requests, certify with test questions | A steward can clear a queue and every decision shows who, when and why | Large |
| 3. Personalise | Base, role default and personal layers; Arrange on every view; reset; locked parts; the json-render gaps closed | Two people see the same view arranged differently, and a base update keeps both | Medium |
| 4. Graph | `ConceptGraph` with both layers, expansion, paths and its list | The term graph is usable with a keyboard alone | Medium |
| 5. Reports and outcomes | Add to a dashboard, reports from certified fields, the outcomes source and page, sharing, print | The executive view opens on live numbers and prints as a briefing | Large |
| 6. Administer | The settings pages, readiness, import and export | Upstream's own UI is no longer needed for any task | Medium |
| 7. Teradata | The upstream connector, the Surfaces engine wired in, one path for rows | The phase 1 to 5 demo runs on a Teradata system | Large, mostly upstream |

Phases 3 and 4 depend only on phase 1 and can run beside phase 2. For a first showing to the CTO, phases 0 to 2 plus the outcomes page from phase 5 are the shortest path that shows both audiences and a result, on DuckDB, with the Teradata plan stated plainly.

## Risks

- **Upstream moves.** It is at 1.3.0 and changing weekly. Pin a version, generate the client from its OpenAPI file, and fail the build when the spec changes shape.
- **Two readers of one source** (above): duplicated credentials and unequal permissions.
- **The ledger can drift** from upstream's flags when someone certifies elsewhere. Reconciliation shows it; only an upstream change removes it.
- **Usage data is sensitive.** Questions and SQL are people's work. Outcomes use counts; text stays with admins.
- **Model output shapes the page.** Chart plans and descriptions come from a model. They are checked (catalog, `chartAdvice`) and labelled, and never certify anything.
- **Prediction sends tables to a hosted service** when upstream's KumoRFM setting is on. The frontend does not send the `prediction` flag until someone decides it should.

## Not verified

- Auto Ontology was not run. Everything about its behaviour is from its code, its docs and its OpenAPI file.
- Two processes reading one DuckDB file at once. The connector's code opens it read-only; the pairing was not run.
- That an edit keeps a certified flag was read in the data layer's update statements for terms, column attributes and SQL attributes; the full replace of a SQL attribute's query was not traced end to end.
- json-render's keys were read from its core types and README on GitHub (0.23.1 on main); its documentation site could not be reached, and which version is released on npm was not checked.
- Whether any Surfaces package is on npm; the versions suggest none is.

## Open decisions

1. **json-render dialect.** Stay with Surfaces' subset plus `visible` and `repeat` (recommended: one checked catalog, no handlers in a document), or aim to draw any upstream json-render spec, which means adopting its handlers and conditions and tracking its releases.
2. **Where the new server's data lives.** A schema of its own in Auto Ontology's Postgres (recommended: one database to run and back up), or a separate store.
3. **Steward as a role.** Keep to upstream's owner groups (recommended to start), or ask upstream for a steward role.
4. **Second run of an answer's SQL** for its chart (recommended), or draw only from the rows upstream returned.
5. **Name and home of the new repository**, and whether it is public. It is Apache-2.0-compatible either way; no NVIDIA frontend code is carried over.
6. **Branding.** Whose name and theme the CTO sees: a neutral Surfaces preset, or a Teradata-coloured one, which needs the page-theme gap closed first.
