---
"@surfaces-ui/engine-mcp": minor
"@surfaces-ui/dev-server": minor
---

A database can be reached through its own MCP server. A source with `engine: "mcp"` names the server (a command to start, or an address) and the database behind it (`dialect`: `postgres`, `duckdb` or `teradata`); every sort, filter, page and total is then SQL sent through that server's query tool, so the components and the MCP app work over data another MCP server holds, and its rows never pass through a model. Run live against Postgres 16 (the reference Postgres MCP server) and DuckDB (the MotherDuck server); the Teradata MCP server's tool list was read from the real server, and its answers are tested against a stand-in.
