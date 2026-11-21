# Agent integration

How an agent builds UI with Surfaces, what it gets back, and how to connect an agent runtime. Written for people wiring an agent in, and for agents reading it directly.

The contracts are in `proto/surfaces/v1/agent.proto`. Everything below is that file in practice.

## The loop

```
person ──types──▶ SendRequest{text}            ──▶ agent
agent  ──draws──▶ SendResponse{surface: A2UI}  ──▶ client checks it against the catalog, draws it
person ──acts───▶ SendRequest{action, surfaces, surface_errors} ──▶ agent
```

One `Send` is one turn. The agent streams `SendResponse` events: `text` (Markdown), `step` (tool work), `surface` (one A2UI message), `approval` (pause for a person), `usage`, `suggestions`, `error`, and finally `done` with `generated_by`, which is always shown to the person.

## Drawing: A2UI v1.0

The agent sends four kinds of message. The full format, every component and its props are in [catalog/agent-prompt.md](catalog/agent-prompt.md); give that file to the model as its system prompt (`catalogPrompt(analyticsCatalog)` generates it).

| Message | What it does |
|---|---|
| `createSurface` | Starts a surface, once. Options: `sendDataModel`, the first `components` and `dataModel`, and `metadata` (extensions, below) |
| `updateComponents` | A flat list of components, linked by `id` and `children`, with one `root` |
| `updateDataModel` | Sets data at a JSON pointer path (`value: null` removes it); props bind to it with `{ "@path": "/x" }` |
| `deleteSurface` | Removes a surface |

The agent can lay out anything the catalog allows:
- layouts with `Row`, `Column`, `Grid`, `Card` and `Tabs`;
- lists repeated over data (`children: { componentId, path }`);
- inputs bound to the data model;
- live data views (`DataGrid`, `Chart`, `PivotTable`, `QueryResult`, `Metric`);
- the discovery and modelling components;
- the human-in-the-loop patterns in [catalog/patterns.md](catalog/patterns.md).

Nothing outside the catalog is drawn. There are no escape hatches: no raw HTML, style or script.

### Reading v0.9

The library writes v1.0 only and still reads v0.9 and v0.9.1. A message, a saved page (`upgradePage`), a kept surface (`upgradeSurface`) or a saved conversation in the older form is turned into v1.0 on the way in (`upgradeMessage`), so an agent that has not moved and anything saved before the move keep working. What changes on the way: `{ "path" }` and `{ "call" }` become `{ "@path" }` and `{ "@call" }`; `accessibility` becomes `@accessibility`; `createSurface`'s `theme` and `expects` become the `surfaces_theme` and `surfaces_expects` extensions; an `updateDataModel` with no `value` becomes `value: null`. Sending `createSurface` again for a surface that exists is an error in v1.0; a v0.9 message still starts the surface over, as it did.

Not taken up from v1.0 yet: functions called across the wire (`callRendererFunction`, `callAgentFunction`), several catalogs mixed in one surface (a component's `@catalogId` must name the surface's catalog), `allowedParents` and `allowedChildren`, `@checks`, and `@index`.

### Metadata

A component may carry `@metadata: { extensions: { … } }`, and `createSurface` and an action `metadata` of the same shape: A2UI's own place for data that is never drawn. A name is an identifier prefixed by whose it is (`surfaces_`, `acme_`; `a2ui_` is kept for A2UI). A renderer ignores names it does not know, a component never receives its metadata as a prop, and nothing in it is resolved or run. `updateComponents` replaces a component whole, so an agent that sends a component again sends its `@metadata` again. In a json-render spec the same map is `metadata` on an element and on the spec.

Pages that last beyond one reply are `PageDocument`s. `PageStudio` edits them through the same messages, and `SurfaceLibrary` saves them with versions.

## Saying what you expect back: response contracts

In `createSurface`, the `surfaces_expects` extension maps an event name to a JSON Schema (draft 2020-12) for that event's context:

```json
{ "version": "1.0", "createSurface": {
    "surfaceId": "budget", "catalogId": "urn:surfaces:catalog:analytics:v1", "sendDataModel": true,
    "metadata": { "extensions": { "surfaces_expects": {
      "approve": {
        "type": "object",
        "properties": { "region": { "type": "string", "enum": ["Europe", "Americas"] }, "budget": { "type": "number", "minimum": 1 } },
        "required": ["region", "budget"] } } } } } }
```

- The client checks every `approve` event against this schema before sending it. One that does not match is **not sent**. The person stays on the page, and the agent receives a `CONTRACT_FAILED` surface error on the next turn. So whatever the agent hears back for `approve` always has this shape.
- A schema the client cannot use is reported on the next turn too (`INVALID_MESSAGE` at `/createSurface/metadata/extensions/surfaces_expects/<event>`).
- Components declare their own payloads as well: what `Form`, `DecisionCard`, `PlanReview` and the others add to an event is typed in the catalog and published as JSON Schema under `x-events` in [catalog/catalog.json](catalog/catalog.json). The two combine. The component's fields are always present, and the agent's `expects` constrains the whole context, including what the agent's own action declared.

The typed form of a contract is `ResponseContract { event, schema }` in `agent.proto`.

## What comes back each turn

`SendRequest` carries:

| Field | What it holds |
|---|---|
| `input.action` | `name`, `surface_id`, `source_component_id`, `timestamp`, `context` (checked against the contract), and `data_model` when the surface set `sendDataModel` |
| `surfaces` | Every surface the agent drew that is still on screen, as `SurfaceState`. Sent on **every** turn, so a stateless agent still sees the page |
| `surface_errors` | Problems since the last turn: `VALIDATION_FAILED` (a component the catalog refused), `INVALID_MESSAGE` (a message the chat could not apply), `CONTRACT_FAILED`, `UNDECLARED_EVENT` |
| `references` | Tables and columns the person attached to the message (dragged onto the message box, or added from a browser), as `ObjectRef`s: source, schema or database, table, column. Names only, never values. `turnText` writes them out for a text-only model |

Each `SurfaceState` has:
- `data_model`: the data model, including what the person typed;
- `controls`: per component ID, how the person left its controls, in the **same props the agent sets** (`sorts`, `filters`, `columns`, `view`). Sending those props back in `updateComponents` keeps or changes them.
- `expects`: the contracts still in force.

Every control a person can set, an agent can set, and the agent sees what the person set.

## Connecting a runtime

All of these implement `AgentBackend`, the only thing `Chat` needs.

| Runtime | Use | What it does with state |
|---|---|---|
| Your service, speaking `AgentService` | Implement `send` | Receives `SendRequest` as is |
| An agent on your server, reached over Connect | `agentRoutes(agent)` (or the `agent` option of `createSurfacesServer` / `surfaces.config.ts`) from `@surfaces-ui/dev-server`; `connectAgent({ baseUrl })` from `@surfaces-ui/client-connect` in the browser | The browser sends `SendRequest`; the agent and any model key stay on the server. With no agent configured, a turn answers with an error that says so |
| Claude | `anthropicAgent({ client: new Anthropic(), system })` from `@surfaces-ui/agent-anthropic` | `toolCallingAgent` over the Messages API. Defaults: `claude-sonnet-5-5`, effort "high", streaming, the system prompt cached, and server-side refusal fallbacks on (`fallbacks: false` turns them off; not available on Bedrock, Vertex or Foundry). Claude's own content blocks are sent back unchanged each turn. A refusal, or a reply cut off inside a tool call, stops the turn with an error instead of running tools |
| OpenAI-compatible servers (OpenAI, Ollama, vLLM, LM Studio) | `openAiCompatibleAgent({ baseUrl, model, headers })` from `@surfaces-ui/agent-openai` | `toolCallingAgent` over `/chat/completions` with streaming, using `fetch` only |
| Any model with tool calls | `toolCallingAgent({ system, complete, tools })` from `@surfaces-ui/agent` | The model draws by calling `render_surface({ messages })`. Each later turn reaches it as text from `turnText(request)`: the event, each surface's state, the contracts and any problems. History is kept per session |
| Loom | `loomAgent({ baseUrl, token })` from `@surfaces-ui/agent-loom` | Sends `turnText(request)` as the query; surfaces come back from `a2ui` blocks. `describeAgents` lists Loom's agents and models; a turn naming another model switches the session first |
| A model that can only write text | Wrap its output with `extractSurfaces` | Pulls A2UI out of fenced blocks: one message per line, one written over several lines, or a list of them. A block holding text that is not a message ends in one `error` event (code `UNREAD_SURFACE`), so a change that could not be read is never lost in silence |
| MCP hosts | `registerSurfacesApps` from `@surfaces-ui/mcp` | `render_surface` draws in the host. Actions go back to the conversation as `turnText` |

`toolCallingAgent` never calls a model itself. You write `complete` for your provider:

**Giving an agent another MCP server's tools.** `mcpConnector({ id, name, transport })` from `@surfaces-ui/mcp` connects to an MCP server and returns a `connector` for `AgentOffer.connectors` and its `tools` for `toolCallingAgent`. A person turns it on in the chat's Connectors menu. Tools the server does not mark read-only ask a person first and run only the arguments they allowed. A server that cannot be reached comes back as unavailable with the reason, so the agent still starts.

```ts
import { mcpConnector, httpTransport } from "@surfaces-ui/mcp";
import { stdioTransport } from "@surfaces-ui/mcp/node";

const tickets = await mcpConnector({ id: "tickets", name: "Tickets", transport: stdioTransport("npx", ["-y", "tickets-mcp"], { env: ["TICKETS_TOKEN"] }) });
const docs = await mcpConnector({ id: "docs", name: "Docs", transport: httpTransport("https://mcp.example.com/mcp", { token: () => process.env.DOCS_TOKEN }) });
const agent = anthropicAgent({ client, tools: [...dataTools(data), ...tickets.tools, ...docs.tools], offer: { connectors: [tickets.connector, docs.connector] } });
```

```ts
import { toolCallingAgent } from "@surfaces-ui/agent";
import { analyticsCatalog, surfaceAgentPrompt } from "@surfaces-ui/spec";

const agent = toolCallingAgent({
  system: surfaceAgentPrompt(analyticsCatalog, { dialect: "DuckDB" }),
  tools: [{ name: "list_tables", description: "Tables the person can query", inputSchema: { type: "object" }, run: () => listTables() }],
  async *complete({ messages, tools, signal }) {
    // Map messages (system/user/assistant/tool, with toolCalls and toolCallId)
    // and tools (name, description, inputSchema) onto your provider's API, then
    // yield { type: "text", delta }, { type: "tool_call", call: { id, name, input } },
    // { type: "usage", inputTokens, outputTokens } and { type: "done", model } as they arrive.
  },
});
```

### The system prompt and data tools

`surfaceAgentPrompt(catalog, options)` from `@surfaces-ui/spec` is the system prompt for an agent that builds and changes surfaces over real data. It holds `catalogPrompt(catalog)` and adds how to answer (`draw: "tool"` for `render_surface`, `"fence"` for a text-only runtime such as Loom), how to change an existing surface with only the components that change, the SQL dialect, and the chart rules. `dataTools(dataSource, { sourceIds })` from `@surfaces-ui/agent` gives a tool-calling agent `list_tables` and `describe_table`, which report names, types, keys, descriptions and declared joins and never a value. Pass `dataTools: true` to the prompt when the agent has them.

```ts
import { dataTools } from "@surfaces-ui/agent";
import { anthropicAgent } from "@surfaces-ui/agent-anthropic";

const agent = anthropicAgent({
  client: new Anthropic(),
  system: surfaceAgentPrompt(analyticsCatalog, { dialect: "DuckDB", dataTools: true }),
  tools: dataTools(dataSource),
  checkSurface: (m) => analyticsCatalog.validateMessage(m),
});
```

The repository's own `surfaces.config.ts` builds its dev-server agent this way from the environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `SURFACES_LOCAL_MODEL_URL` with `SURFACES_LOCAL_MODEL`).

### What a person may choose in a chat

Give `toolCallingAgent` (and so `anthropicAgent` and `openAiCompatibleAgent`) an `offer`: the `models` it accepts and its `defaultModel`, `skills` (named text added to the system prompt while on, each `defaultOn` or not) and `connectors` (named sets of tool names, with a status, `requiresApproval` and an optional `signInUrl`). Tools no connector names are always on. `DescribeAgents` (`agent.proto`) reports it, and `AnalyticsChat`'s menus are drawn from it. Each turn carries the person's choice as `SendRequest.model`, `skill_ids` and `connector_ids`, with `choices_set` once they chose; without it the defaults apply. The backend checks the choice (`resolveChoices`) and answers anything it did not offer, or a connector that is not connected, with an error in place of a reply. `agentRouter([{ info, backend }])` serves several agents from one backend and routes each turn by `agent_id`. Loom does not take a model per turn yet.

### Choosing the model from a page

`ModelService` (`proto/surfaces/v1/models.proto`) lists the agent backends a server can run, the model each uses, and the models it offers, and lets a person choose another (`SetModel`, optionally making that backend the one that answers turns). It never carries a key: a backend says which environment variable its key is read from and whether it is set. Build it with `modelSettings({ backends, active, setActive })` from `@surfaces-ui/data`, where each backend is a `{ describe(), setModel(model) }` handle, and pass it as the `models` option of `createSurfacesServer` or `surfaces.config.ts`; reach it with `connectModelSettings({ baseUrl })`. An agent that reads the choice on each turn (as `surfaces.config.ts` does) changes model from the next turn.

Pass `checkSurface: (m) => analyticsCatalog.validateMessage(m)` to any of the tool-calling agents. Messages with problems are not drawn; the problems go back to the model as the result of `render_surface`, so it fixes them in the same turn instead of the next one. Models that cannot keep to the catalog still fail: in a test with a small local model (gemma 26B over Ollama), every `createSurface` passed and no `updateComponents` ever did.

## Approvals that pause a turn

A tool can ask a person before it runs. Give it an `approval(input)` function that returns what to show: `title`, `detail`, `sql`, a structured `subject`, `risk` (`LOW`, `HIGH`, `IRREVERSIBLE`), `editable`, `reasonRequired`, `approvalsRequired`, `expiresAt` and `basis`.

```ts
const tool: RunnableTool = {
  name: "run_query",
  description: "Run one read-only query after a person allows it",
  inputSchema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] },
  approval: (input) => ({ title: "Run this query?", sql: (input as { sql: string }).sql, editable: true }),
  run: async (_input, signal, approved) => runQuery(approved!.sql, signal), // the person's version, never the model's
};
```

What happens:

1. The agent fills in an `id` and a `digest` (`approvalDigest`: SHA-256 of the canonical JSON of the SQL and subject), sends an `approval` event and ends the turn.
2. `Chat` shows an approval card. The card recomputes the digest from what it shows and refuses to allow anything if the two differ. It also handles editing, a required reason, typing "confirm" for irreversible requests, expiry, and the decisions already made when several people must allow it.
3. The answer comes back as `ApprovalAnswer`: `allow`, `decided_by`, `decided_at`, `reason`, `digest`, and `edited_sql` or `edited_subject` when the person changed it.
4. The agent runs `checkApproval(request, answer, { mayDecide })` before acting. It refuses a wrong request, an expired one, an edit to a request that was not editable, a digest that does not match what would run, a missing required reason, a decider that `mayDecide` rejects, and the same person deciding twice. `decided_by` comes from the client, so `mayDecide` must check it against your own session.
5. If enough different people allowed it, `run` gets `approved` with the SQL and subject to run and who allowed it. If anyone refused, or the check failed, the model gets that as the tool's result and nothing runs. If the person writes a message instead of answering, the call counts as not allowed.

Report what ran with an `ActionReceipt` (who approved it, when, the SQL, before and after, and whether it can be undone). The recipe [Ask a person before a query runs](recipes/approval-before-sql.md) is this, tested end to end.

## Keeping a thread across reloads

`Chat` and `useChat` take `storage` (any `StateStorage`, such as `browserStorage()` from `@surfaces-ui/state`) and `storageKey`. The thread, each surface's state, a pending approval and the reported problems are saved as one versioned record. What is loaded is checked (`parseThread`) before it is used. A reply that was still streaming when the page closed is marked as interrupted, not resumed. `user` (`{ id, name }`) is who is deciding approvals and acting on surfaces.

### Is middleware needed?

No general middleware layer is needed. The contract lives in the protos, and each runtime gets a thin adapter. An adapter maps that runtime's own events onto `SendResponse`, and maps `SendRequest` (or its `turnText`) onto the runtime's input.

Validation, contracts and state tracking all happen in the client: `SurfaceView` and `useChat`. So every adapter gets them for free and cannot bypass them.

Not built yet:
- An AG-UI adapter.
- Resuming a reply that was cut off by a reload. It is marked as interrupted instead.

## Rules an agent must follow

- SQL is a single read-only `SELECT`. Never put text a person typed into SQL; sorting, filtering and paging are the components' job.
- Data views over large tables aggregate (`y: [{ column, aggregate }]`), and time series set a grain.
- Proposed SQL is shown and offered (`SqlProposal`); nothing runs until a person presses Run.
- Anything that removes or replaces data goes through a human-in-the-loop pattern and is marked high risk.
- Say who answered (`done.generated_by`). A scripted or placeholder agent must say that it is one.

## Conversations as documents, and written samples

A thread is plain data, so a conversation can be kept, shown to someone else and opened again:

```tsx
import { Chat, conversationDocument, conversationThread, parseConversation } from "@surfaces-ui/chat";

// Keep it: a saved surface of kind "conversation" in any SurfaceLibrary.
const document = conversationDocument(thread, { id: "refunds", title: "Which products drive refunds?" });

// Open it again. Anything loaded from storage is checked first.
const kept = parseConversation(loaded);
<Chat agent={agent} initialThread={kept && conversationThread(kept)} onThreadChange={setThread} />
```

The session and usage are not kept, and every surface in a kept thread is checked against the catalog again when it is drawn.

To show people what a thread of mixed content looks like before a model is connected, write the conversation out as a `ConversationScript` (`@surfaces-ui/spec`): turns of what a person says and the text, steps and surfaces the reply holds, plus `events` that answer a control in a drawn component (`{{sql}}` and other keys are filled from the event's context). `validateConversationScript` checks it against the catalog. `scriptThread(script, catalog)` gives the thread already played, and `scriptAgent(script, { catalog })` answers from it, so a person can carry on. `answeredBy` is shown under every reply and must say that it is not a model. The retail seed ships two and the telco seed one (`seedById("retail").conversations`); two of them go end to end, from connecting a source through cleaning, a pipeline, a semantic model and a report to a dashboard. The playground's Sample analysis page shows them.

## Semantic models

Give `dataTools` the project's models (`dataTools(dataSource, { semantics })`) and pass `semanticModels: true` to `surfaceAgentPrompt`. The agent then gets `list_semantic_models` and `describe_semantic_model` (definitions and who wrote them, never values) and draws an `Explorer` or `ReportBuilder` with `model` instead of writing its own measures.

An agent never saves a model. It draws a `SemanticModelEditor` with `proposed` and `proposedBy`; the person sees the draft, marked change by change, changes what they like, and saves it, which sends the `save` event (`model`, `version`, `changes`) back to the agent. What they type in the editor's box comes back as the `ask` event (`text`); what they leave in the draft comes back in the component's controls as `proposed`. The dev server's agent factory receives the semantics as its second argument (`AgentServices`).

When a pipeline builds the rows, the agent proposes the model on that dataset: `proposed.rows.dataset` (`pipeline`, `dataset`) with the dataset's `grain` and `primaryKey` from `describe_pipeline`. The editor shows when the dataset was last built and how its checks went, and the dev server refuses a save that does not read the dataset on its source. `surfaceAgentPrompt(…, { semanticModels: true, pipelineTools: true })` tells the model to do this.

`proposed` has three parts: `add` (fields, in the pill form), `remove` (names) and `rows`: `grain` (what one row is), `primaryKey`, and either `tables` with `joins` (the first table's rows are the model's rows; join tables that add one row of detail to each) or a written `sql`. Put the table nearer the first on each join's left: a join with no `type` keeps every row of its left table, so adding detail never drops one of the model's rows; give `"inner"`, `"right"` or `"full"` only when that is what the person wants. The editor writes the query from the tables, naming every column, so it runs on whichever engine the source is. To propose a new model, add `create: { label, description, sourceId }` and name it in `model`:

```json
{ "id": "model", "component": "SemanticModelEditor", "model": "order_lines",
  "create": { "label": "Order lines", "sourceId": "retail" },
  "proposed": {
    "rows": { "grain": "One order line.", "primaryKey": ["order_id", "line_no"],
              "tables": ["order_items", "orders"],
              "joins": [{ "left": "order_items", "right": "orders", "keys": [{ "leftColumn": "order_id", "rightColumn": "order_id" }], "type": "left" }] },
    "add": [{ "id": "revenue", "kind": "metric", "label": "Revenue", "column": "line_amount", "aggregate": "sum", "format": "currency" }] },
  "proposedBy": "Analyst agent", "action": { "event": { "name": "model_saved" } } }
```

The engine checks the key before the model is kept, so a join that repeats rows is refused with a sentence saying so. The patterns `create-a-semantic-model` and `change-a-semantic-model` (`docs/catalog/patterns.md`) hold the full shapes.

## Pipelines

Give a tool-calling agent `pipelineTools(pipelines)` from `@surfaces-ui/agent` and pass `pipelineTools: true` to `surfaceAgentPrompt`. It gets:

- `list_pipelines`, `describe_pipeline` and `get_run`: definitions (each dataset's query, what it reads, grain, key, columns, checks) and run results as counts. Never row values.
- `check_pipeline`: a dry run that builds nothing and returns the problems found.
- `run_pipeline`: pauses the turn with an approval (risk high, or irreversible for a full refresh) whose subject is the pipeline, its version, the selection and the refresh kind. On a yes it runs the approved subject, not the model's input, and refuses if the pipeline's version moved since. It waits up to a minute, then hands back the run id for `get_run`.
- `propose_dataset`: saves nothing. It returns the pipeline as it would be with the new or changed dataset, the version it was based on and the digest of the draft (`pipelineDigest`).

The agent then draws a `DatasetReview` with those values. The person can change the grain, descriptions and checks, names themselves and approves; the component works the digest out again from what is shown and calls `savePipeline`, which the server refuses for a stale version, a different digest or a definition that fails its checks. The `decide` event (`approved`, `version`, `approvedBy`, `digest`, `note`) tells the agent what happened. Saving builds nothing; offer to run it afterwards.

```json
{ "id": "review", "component": "DatasetReview", "pipeline": { "id": "sales", "sourceId": "lake", "datasets": [ ] },
  "dataset": "region_revenue", "expectedVersion": 1, "digest": "sha256:…", "proposedBy": "Analyst agent",
  "action": { "event": { "name": "dataset_decided" } } }
```

`PipelineView` with an `action` sends `started` and `finished` (`runId`, `state`, `built`, `failed`, `failedChecks`) when a person runs the pipeline themselves, and reports what they do there as context. Over MCP, `registerSurfacesApps(server, { pipelines })` registers the same tools; there `run_pipeline` is marked destructive so the host asks the person, and a full refresh is not offered. `show_pipeline` draws the pipeline in the app page, and `propose_dataset` draws the proposal as a `DatasetReview` filled in by the server (the whole pipeline, the version and the digest), so the model never copies a definition into a surface; the person's approval saves it through the page's own hidden channel and comes back to the conversation as their message. The dev server hands a configured agent its pipelines through `AgentServices`, and saves are on only with `savedPipelines: true` in `surfaces.config.ts`. For a scheduled or CI run there is no agent at all: `surfaces-pipelines run <id>` exits 1 when a build or a failing check fails.

A dbt project is one more pipeline to the agent (`@surfaces-ui/pipelines-dbt`, `dbt` in `surfaces.config.ts`). `describe_pipeline` gives its models, sources and seeds with what each reads, its key and its tests as checks, and the compiled query of each model, which is for reading: dbt builds the project, never this library. `run_pipeline` asks a person first, as for any pipeline, and then starts `dbt build` with the project's own model names, only on a server given the project's directory; otherwise the project is read only and the tool says so. `propose_dataset` does not apply: a dbt project changes in its repository. dbt's semantic models arrive as starter semantic models on the dbt datasets, so `describe_semantic_model` reports `fromPipeline` for them.

## What a person did, as context

Between an agent's turns a person works on the page: adds a view to a report, edits a field, sets a filter, clicks a bar, opens a file. The agent is told, with its next turn, both where things ended up (`SurfaceState.controls`) and what happened on the way (`SurfaceState.activity`): one entry per action, oldest first, each with the component it happened in, a `kind` (`view.added`, `field.changed`, `filter.changed`, `point.selected`, `file.opened` and so on), a `summary` in words and a `subject` as data. It is context: none of it starts a turn or asks for anything, and it is sent once.

A page arranged by hand is told the same way: `PageStudio` with `arrange` (or your own host with `useArrange`) sends a `layout.changed` note whose `subject` holds, for each component it touched, its new `children`, `widths`, `height` or `minHeight`, the same props an agent sends to arrange a page.

`Chat` and `PageStudio` collect and send it for you. With your own host, give `SurfaceView` an `onContext(componentId, note)` and put what you collect into `SendRequest.surfaces[].activity`. Outside a surface, each component takes `onContext` directly:

```tsx
<ReportBuilder sourceId="retail" sql={sql} onContext={(note) => agentContext.push(note)} />
```

`turnText(request)` writes the activity out for a model that only takes text.

## Debugging what an agent draws

`SurfacesDevTools` from `@surfaces-ui/devtools`, placed once around the app, records a turn end to end and shows it in a drawer (Ctrl+Shift+D): the request, the reply's text, steps and approvals, each A2UI message as it arrived and as it was read (a v0.9 message beside its v1.0 form), what the catalog said about it, the components it drew and their queries, every problem (`VALIDATION_FAILED`, `CONTRACT_FAILED`, `UNDECLARED_EVENT`, `RENDER_FAILED`, a message that was refused), and each event sent back with whether it passed the agent's contract. One turn is one trace: a message is a child of its turn, a component of the message that drew it, a query of its component. The scrubber redraws any surface as it stood at an earlier step.

`useChat` and `Chat` trace themselves. An agent you call yourself is wrapped once, and its messages are recorded as you apply them:

```ts
import { recordMessage, traceAgent } from "@surfaces-ui/trace";
import { useRecorder } from "@surfaces-ui/trace/react";

const recorder = useRecorder();                       // undefined when the tools are off
const traced = recorder ? traceAgent(agent, recorder) : agent;
// useSurfaces records each message it applies. With your own reducer:
if (recorder) recordMessage(recorder, { format: "a2ui", key: "main", raw: message, issues: catalog.validateMessage(message) });
```

A json-render spec is not recorded by itself (`fromJsonRender` is a plain function): the surface it becomes is recorded whole where it is drawn. To keep the spec as it arrived beside it, record it yourself with `format: "json-render"`, the spec as `raw`, the `createSurface` message it became as `message`, and `snapshot: true`. A trace holds names, SQL, counts, timings and errors, never row values or credentials. The ids are W3C trace context ids (`traceparent(scope)`), ready to be sent to a server; nothing sends them yet. See "Dev tools" in [getting-started.md](getting-started.md).
