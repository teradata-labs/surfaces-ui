# `packages/sql`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/sql` | `rewriteQuery` / `countQuery`: turns a `ViewQuery` into dialect SQL with bound parameters (DuckDB `LIMIT/OFFSET`, Teradata `TOP` / `QUALIFY ROW_NUMBER()`), plus read-only checks. `columnsQuery` (a base query's columns, no rows) and `withoutMissingFilters` (drops filters on columns a view's rows lack, with a `FILTER_COLUMN_MISSING` notice). Parser: `@polyglot-sql/sdk`, used only here. |
