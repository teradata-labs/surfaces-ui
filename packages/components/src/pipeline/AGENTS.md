# `packages/components/src/pipeline`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

The pipeline rules are in [packages/pipelines/AGENTS.md](../../../pipelines/AGENTS.md).

| Component | Use it for | Key props |
|---|---|---|
| `PipelineGraph` | A pipeline's datasets and flows with status; highlights upstream and downstream; pans and zooms | `nodes`, `edges`, `selected`, `onSelect` (helpers: `layoutPipeline`, `lineageOf`) |
| `PipelinesProvider` / `PipelineView` | A pipeline the backend runs, live: graph, runs, each dataset's query, grain, key, columns, row rules and checks with results, with run, check, rebuild, cancel and a confirmed full refresh | `pipelineId`, `onOpenTable`, `onOpenSql`, `onRun` (`started`, `finished`), `onContext`, `fullRefresh`, `pollMs` (helpers: `pipelineGraph`, `checkOutcomes`, `runEvent`) |
| `DatasetReview` | A proposed or changed pipeline dataset for a person to approve: query, what it reads, grain, key, columns, checks and what changed from the saved version; the person edits the grain, descriptions and checks, names themselves, and approving saves through `savePipeline` with the digest of what is shown | `pipeline` (`PipelineDraft`), `dataset`, `expectedVersion`, `digest`, `proposedBy`, `approver`, `onDecide`, `onContext` (helpers: `checkText`, `datasetChanges`) |
| `ChecksPanel` | A dataset's checks with the latest results, failures first; display only | `checks` (`CheckOutcome[]`), `onOpenFailing` |
| `IngestWizard` | Bringing new files in: inspect, map columns, get config to review | `sourceId`, `value`, `onChange` (helper: `ingestPlan`) |
| `RunHistory` / `ExpectationsPanel` / `SchemaDiff` / `StreamMetrics` | Pipeline runs, data quality rules, schema changes and streaming progress | `runs`; `expectations`, `onOpenFailing`; `changes`, `rescuedCount`, `mode`; `progress` |

## Rules

- `PipelineGraph`, `RunHistory`, `ExpectationsPanel`, `SchemaDiff` and `StreamMetrics` are display only: they draw what an engine reported and take plain data props. `PipelineView` and `IngestWizard` talk to a `Pipelines` backend. Neither kind computes the graph, rates or quality counts in the browser.
