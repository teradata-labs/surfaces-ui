---
name: data-transformations
description: Use when designing or changing datasets with Surfaces UI - joins, aggregate tables, reshaped or derived views, pipeline datasets and their data quality rules. Design at a stated grain, review as a plan, build through a pipeline, verify with counts. Triggers on "transform", "join these", "build a table", "aggregate", "pipeline", "derived dataset", "model the data", "materialize", "dbt-style".
---

# Data transformations

A transformation is a new dataset defined by one read-only query. It is proposed, reviewed and approved by a person, saved on the server, and then run. Use the `review-a-transformation` pattern.

## Method

1. **State the grain** of the result: "one row per day and region". Every design mistake shows up as a grain mistake.
2. **Find the inputs and how they join.** Use `ObjectBrowser` joins and `ModelDiagram`. Inferred joins are guesses from names and types: confirm the key is unique on the "one" side with a query before relying on it.
3. **Write each dataset as a single `SELECT`**, in the source's dialect. Small steps that each do one thing (clean, join, aggregate) are easier to review than one large query.
4. **Declare the key and the checks.** A primary key is checked unique and never empty after every build; that is what catches a join that repeats rows. Add `relationships` for every column that must be found in another table, `accepted_values` for codes, `row_count` for a size you expect. Row rules (expectations) still decide per record whether to warn, drop or fail before the build.
5. **Propose** with `propose_dataset` (query, `depends`, grain, key, columns, checks), then draw a `DatasetReview` with what it returns, beside a `StepFlow`. With no pipeline tools, propose a `PlanReview` and a person adds the definition to `pipelines` in `surfaces.config.ts`.
6. **After approval**, the person's `DatasetReview` saves it; nothing is built yet. Check with `check_pipeline`, then build with `run_pipeline`, which asks the person again. A person can also use `PipelineView`, or `surfaces-pipelines run <id> --select +name` headless.
7. **Verify**: row counts in and out, totals reconciled to the source, every check passed. Report a failed check with its count and offer its `failingRowsSql`.

## Rules

- **A pipeline runs only what a person approved and the server checked.** You propose; you never save. The save carries the digest of what the person saw and the version it was based on, so a changed or stale proposal is refused.
- **Each dataset is one read-only statement** (`assertReadOnly`). The engine wraps it to build the table or view.
- **Joins**: check for fan-out. If the row count grows after a join you expected to be one-to-one, stop and say so. Never add `DISTINCT` to hide it.
- **Aggregates**: sums add up; averages, medians, distinct counts and percentiles do not. Recompute them at each grain instead of averaging averages.
- **Time**: bucket with a grain (`DATE_TRUNC`, or `TRUNC` on Teradata). Everything is UTC.
- **Dialects**: no `LIMIT/OFFSET` on Teradata (`TOP`, `QUALIFY ROW_NUMBER()`); DataFusion and Postgres use numbered placeholders. If SQL must run on more than one engine, test it on each.
- **Full refresh destroys data**: it is irreversible in `run_pipeline`'s approval, and the server refuses it without `confirm_full_refresh`. Ask for one only when the person asked.
- **This runner recomputes whole datasets** on every run: no incremental loads, checkpoints, schedules or streaming. Say so when asked for those (`Pipeline.recompute_only`).
- **Personal data** flows downstream: a join can bring a flagged column into a clean table. Re-run the personal-data review on the result.
- **Name things for readers**: `daily_revenue`, not `tmp2`. Describe each dataset in a sentence; that text is what search and agents see.

## Dataset shape (server config)

```ts
pipelines: [{ id: "sales", sourceId: "lake", datasets: [
  { name: "orders_clean", kind: "view", sql: "SELECT ... FROM orders_raw", depends: ["orders_raw"],
    grain: "one row per order", primaryKey: ["order_id"],
    expectations: [{ name: "has_status", constraint: "status IS NOT NULL", action: "drop" }],
    checks: [{ kind: "relationships", columns: ["customer_id"], to: { table: "customers", column: "customer_id" } }] },
  { name: "daily_revenue", kind: "table", depends: ["orders_clean"],
    sql: "SELECT CAST(order_date AS DATE) AS day, region, SUM(amount) AS revenue FROM orders_clean GROUP BY 1, 2",
    grain: "one row per day and region", primaryKey: ["day", "region"],
    checks: [{ kind: "accepted_values", columns: ["region"], values: ["EU", "NA", "APAC"], severity: "warn" }] } ] }]
```

## Done when

- [ ] The grain and key of every dataset are written down, and the key's checks passed.
- [ ] No unexplained change in row count across a join.
- [ ] Totals reconcile to the source.
- [ ] Checks exist for keys, references and codes, and passed.
- [ ] A person approved the dataset in a `DatasetReview` (or added it to config).
