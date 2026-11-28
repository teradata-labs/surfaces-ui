---
"@surfaces-ui/engine-mcp": minor
"@surfaces-ui/dev-server": minor
"@surfaces-ui/sql": minor
"@surfaces-ui/proto": minor
"@surfaces-ui/components": patch
---

A database can be reached through its own MCP server. A source with `engine: "mcp"` names the server (a command to start, or an address) and the database behind it (`dialect`: `postgres`, `mysql`, `duckdb` or `teradata`); every sort, filter, page and total is then SQL sent through that server's query tool, so the components and the MCP app work over data another MCP server holds, and its rows never pass through a model. MySQL and MariaDB are a new SQL dialect (`SqlDialect.MYSQL`): names in backticks, no `NULLS LAST`, months without `DATE_TRUNC`, and no median or percentile. SQL Server, Snowflake, BigQuery, Databricks and Oracle are dialects too, checked to parse and not yet run on a real system or reached by an engine. Run live against Postgres 16 (the reference Postgres MCP server), MariaDB 10.11 (a MySQL MCP server) and DuckDB (the MotherDuck server); the Teradata MCP server's tool list was read from the real server, and its answers are tested against a stand-in.
