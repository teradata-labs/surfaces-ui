# `packages/data`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/data` | The `DataSource`, `Discovery` and `Pipelines` interfaces every component uses, Arrow IPC framing (`encodeBatch`, `decodeStream`), `collect`, and `memoryDataSource` for tests and demos. `ModelSettings` (`modelSettings` over backend handles, `memoryModelSettings`): which model each agent backend runs, and the choice of another, with no key in it. `Semantics` (`semantic.ts`): semantic models, a query with dimensions, measures and metrics, each saying who defined it, versioned (`memorySemantics`, `semanticModelProblems`, `semanticModelDataProblems`, `semanticModelJson` / `semanticModelFromJson`, `StaleSemanticModelError`, `SemanticModelError`). A model on a pipeline dataset (`semantic-pipeline.ts`): `semanticModelFromDataset`, `datasetStanding`, `semanticDatasetProblems`, `datasetSql`. |

- **A derived measure is arithmetic over aggregates, done by the engine.** `ViewQuery.derived` (`alias`, `expression`) names this query's aggregate aliases with numbers, + - * / and parentheses, and nothing else. One parser (`parseMeasureExpression` in `@surfaces-ui/data`) is used by the form that checks what a person typed, by `@surfaces-ui/sql` (which writes each name out as its aggregate, divides in floating point because Teradata would divide whole numbers as whole numbers, and guards a division by zero with `NULLIF`), and by `memoryDataSource`. The expression is parsed, never pasted into SQL. A chart measure takes `expression` with `terms`. Never work a rate out per row in SQL and average it, and never divide summarised cells in the browser.

## Querying data

```ts
import { collect, toRows } from "@surfaces-ui/data";
import { connectDataSource } from "@surfaces-ui/client-connect"; // or memoryDataSource, or your own DataSource

const data = connectDataSource({ baseUrl: "http://localhost:5220" });
const result = await collect(
  data.execute({
    sourceId: "lake",
    query: {
      baseSql: "SELECT * FROM orders",                       // the user's SQL, untouched
      sorts: [{ column: "amount", direction: SortDirection.DESC }],
      filters: [{ column: "region", operator: FilterOperator.EQ, values: [{ kind: { case: "stringValue", value: "Europe" } }] }],
      page: { limit: 50, offset: 0n },
    },
  }),
);
result.table;               // Arrow table holding only this page
result.header.executedSql;  // what the engine ran, for "show SQL"
result.header.notices;      // e.g. UNSTABLE_PAGE_ORDER
```

- Components take a `DataSource` prop or context; they never construct a client themselves.
- Change sort, filter or page by sending a new `ViewQuery`. Never sort or filter `result.table` in the browser unless it is the complete result.
- `ViewQuery` also carries `group_by`, `aggregates` (sum, avg, count, distinct, min, max, median, stddev, variance, percentile, approximate distinct), `buckets` (time grain or bin width) and `sample`. Each has a DuckDB and a Teradata form in `@surfaces-ui/sql`; add both, with golden tests, when extending it.
- **Kept results.** When an engine implements `store`, the server runs a non-trivial base query once into a temporary table and serves sorts, filters, pages, counts and charts from it (`ResultHeader.stored` says so and gives the time the data is as of). Plain `SELECT * FROM table` is never kept; results over `storedResults.maxRows` (250,000) fall back to live queries. Kept results are shared by everyone who can reach the server, so a multi-user server must add the user to the key.
- Filter values go in `Filter.values` and are always bound as parameters. Never build SQL by concatenating user input.
- Time travel: `timeTravel: { at: { case: "snapshotId", value }, table }` with an ID from `listSnapshots`.
