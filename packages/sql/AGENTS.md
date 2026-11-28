# `packages/sql`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

**MySQL** (`SqlDialect.MYSQL`, for MySQL and MariaDB) differs in four ways, all in `rewrite.ts` and `guard.ts`. Names go in backticks: MySQL reads a name in double quotes as text unless a session setting says otherwise, and everything this library and its components write puts names in double quotes, so `mysqlNames` rewrites them, in the base query before it is parsed and in the finished statement; it follows that on a MySQL source text is written in single quotes. There is no `NULLS FIRST` or `LAST`, so a sort is preceded by one on whether the value is null. There is no `DATE_TRUNC` (`MYSQL_GRAIN`), and no median or percentile, which are refused with the reason and never approximated. A backslash in a string is an escape, so `LIKE`'s escape character is written doubled and `blankLiterals(sql, true)` reads strings MySQL's way. Run on MariaDB 10.11 through its MCP server; not on MySQL itself. Pipeline checks (`checks.ts`) have no MySQL form.

| Path | What it is |
|---|---|
| `packages/sql` | `rewriteQuery` / `countQuery`: turns a `ViewQuery` into dialect SQL with bound parameters (DuckDB `LIMIT/OFFSET`, Teradata `TOP` / `QUALIFY ROW_NUMBER()`), plus read-only checks. `columnsQuery` (a base query's columns, no rows) and `withoutMissingFilters` (drops filters on columns a view's rows lack, with a `FILTER_COLUMN_MISSING` notice). Parser: `@polyglot-sql/sdk`, used only here. |
