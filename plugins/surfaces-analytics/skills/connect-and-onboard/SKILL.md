---
name: connect-and-onboard
description: Use when a person wants to connect data (Parquet, Delta or Iceberg on S3, GCS, Azure or disk; an Iceberg REST catalog; Postgres; DataFusion; or a database that has its own MCP server, such as Teradata, Postgres, MySQL or DuckDB) to Surfaces UI or its MCP server, or is new to a source and needs a guided start. Covers the connection plan, credentials by secret name, testing, and a first tour. Triggers on "connect", "add a source", "connector", "onboard", "get started with this data", "set up the lake", "add Postgres", "use my Teradata", "chart the data from my database server".
---

# Connect a source and onboard a person

Connecting is a human-in-the-loop flow: the agent plans, the person approves and adds the credential, the agent tests and reports. Use the `connect-a-source` and `onboard-to-a-dataset` patterns (`docs/catalog/patterns.md`).

## The flow

1. **Ask what, not how.** Where is the data (a path or a database) and what should be reachable? Offer `Chips` for the common kinds.
2. **Propose a plan** as a `PlanReview`: the connection (kind, scope, region), each table to register, and the secret's name. Show a `StepFlow` beside it.
3. **Stop for the credential.** Mark that step `waiting`. Tell the person which environment variables to set on the server. You never see the value.
4. **Write the config for review** (`ConnectionBuilder` and `connectionPlan` produce it). The person adds it to `surfaces.config.ts`; nothing is registered from chat.
5. **Test** with `SourceList` / `testSource`, and report per table: reachable or not, and why.
6. **Tour** (onboarding): the data model (`ModelDiagram`), what is certified (`CertificationBadge`), a profile of the main table (`ObjectDetail`), then offer first questions as `Chips`.
7. **Flag personal data** found by name (`piiHints`) and schedule a `PiiReview` before anything is shared.

## Rules

- **Read-only.** Ask for a login that can only read. Postgres is attached `READ_ONLY`.
- **Least reach.** Scope a connection to the folder needed (`scope: "s3://bucket/sales"`), not the bucket.
- **Credentials by name only.** `secret: "LAKE"` means the server reads `LAKE_KEY_ID`, `LAKE_SECRET`, `LAKE_SESSION_TOKEN`, `LAKE_CONNECTION_STRING`, `LAKE_TOKEN` or `LAKE_PASSWORD`. Never put a credential in config, chat, a log or an error. There is no UI field for one; do not add one.
- **A database address never contains the password.**
- **A table that cannot be reached is reported, not fatal.** Say which and why; carry on with the rest.
- **Data values are withheld by default.** Only names, types and counts are profiled until a source is listed in `allowSampleValues`. Say so when a person asks for samples.
- **Say what is not verified.** See docs/status.md for what has run against real services.

## Config shapes

```ts
{ id: "lake", engine: "duckdb",
  connections: [{ name: "sales", kind: "s3", scope: "s3://acme-lake/sales", secret: "LAKE", region: "eu-west-1" }],
  tables: [{ name: "orders", format: "delta", path: "s3://acme-lake/sales/orders" }],
  catalogs: [
    { name: "catalog", kind: "iceberg-rest", uri: "https://catalog.example.com/api", warehouse: "analytics", secret: "LAKE" },
    { name: "pg", kind: "postgres", uri: "host=db.example.com port=5432 dbname=shop user=reader sslmode=require", secret: "PG" } ] }
```

`kind` is `s3` (MinIO and R2 with `endpoint`), `gcs`, `azure` or `http`. DataFusion: `{ id, engine: "datafusion", baseUrl }`.

## A database that already has its own MCP server

When the person's database is reached through an MCP server of its own (the Teradata MCP server, a Postgres, MySQL or DuckDB one), the Surfaces server connects to that server itself and sends its SQL through it. This is the only way its data reaches a chart or a grid: the host holds a connection to each server and one cannot call the other, so rows a model read from the data server cannot be handed to a Surfaces view. Do not copy rows into a surface to get round it; connect the source.

- **In a desktop app, with no project folder:** the person fills in this plugin's settings: the database type, how the database's MCP server is started (its command, or its address), and the connection string or token that server needs. The value is entered there, by them, and is never typed into the chat.
- **In a project:** a source in `surfaces.config.ts`, with the connection string in the environment (or the git-ignored `.env.local`), named and never written out:

```ts
{ id: "warehouse", engine: "mcp", dialect: "teradata",
  server: { command: "uvx", args: ["teradata-mcp-server"], env: ["DATABASE_URI"] } }
```

`dialect` is `teradata`, `postgres`, `mysql` or `duckdb`. A remote server is `server: { url, secret }`, its token read from `<SECRET>_TOKEN`. The query tool is found from the server's own tool list.

Say these limits before the person meets them: the source is read-only; a result the data server cuts short is reported as an error, never drawn as if whole, so a very large export may need that server's row limit raised; and MySQL has no median or percentile, so a view that asks for one is refused with the reason.

## When it fails

| Symptom | Likely cause | Say |
|---|---|---|
| Access denied | Wrong role, or scope narrower than the path | Which path, and that the secret's role needs read on it |
| Not found | Path or region wrong | The path tried and the region used |
| Secret missing | Variables not set where the server runs | The exact variable names |
| Times out | Network or endpoint | That the server, not the browser, must reach it |
| The data server could not be reached | Its command is not installed, or its address or connection string is wrong | That the settings name the command or address, and to check it starts on its own |
| No tool that takes SQL | The server reads entities, not SQL | The tools it does list, and that this source needs a server with a query tool |

Offer retry, change the plan, or stop, as a `DecisionCard`.

## Done when

- [ ] The plan was approved by a person, and only approved tables were added.
- [ ] No credential appeared anywhere a person or a model could read it.
- [ ] Every table was tested and its result reported.
- [ ] The person has seen the model, what is certified, and a next step.
