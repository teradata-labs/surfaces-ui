# `packages/engine-duckdb`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/engine-duckdb` | DuckDB through ADBC: Parquet/CSV/JSON files, Delta and Iceberg tables, time travel, file access locked to the registered tables. |

## Connections

- **Connections.** A DuckDB source can read tables from object stores and attach catalogs:

  ```ts
  { id: "lake", engine: "duckdb",
    connections: [{ name: "sales", kind: "s3", scope: "s3://acme-lake/sales", secret: "LAKE", region: "eu-west-1" }],
    tables: [{ name: "orders", format: "delta", path: "s3://acme-lake/sales/orders" }],
    catalogs: [{ name: "catalog", kind: "iceberg-rest", uri: "https://catalog.example.com/api", warehouse: "analytics", secret: "LAKE" }] }
  ```

  A catalog can also be a Postgres database (Supabase, Neon and RDS included), attached read-only: `catalogs: [{ name: "pg", kind: "postgres", uri: "host=db.example.com port=5432 dbname=shop user=reader sslmode=require", secret: "PG" }]`, with the password in `PG_PASSWORD`. Its tables are `pg.<schema>.<table>`. The address must not contain the password, and the login should be a role that can only read. Verified against Postgres 17 in a container (`scripts/seed-postgres.sql`, `packages/dev-server/src/postgres.test.ts`, which runs only when `SURFACES_TEST_POSTGRES` is set); not yet against a hosted database over TLS.

  `kind` is `s3` (also MinIO and R2 with `endpoint`), `gcs`, `azure` or `http`. `secret` is a name: `envSecrets` reads `LAKE_KEY_ID`, `LAKE_SECRET`, `LAKE_SESSION_TOKEN`, `LAKE_CONNECTION_STRING`, `LAKE_TOKEN` from the server's environment (pass your own `resolveSecret` for a vault). `ambientCredentials: true` uses the machine's cloud role. Only paths under a connection's `scope` can be read; a table that cannot be reached is reported by `testSource`, and does not stop the server starting. Never put a credential in config, a proto, a log or an error message, and never add a UI field for one.
- Keys and descriptions that files do not hold (Parquet has no keys) come from a table's `model` in config (`TableModel`: `primaryKey`, column descriptions, `foreignKeys`), applied by `withTableModel` and reported as `Column.primary_key`, `Column.comment` and `TableDetail.foreign_keys`. Declared foreign keys are facts; inferred joins stay labelled "Inferred".
- **Where a store is has to reach the engine even with no credentials.** A DuckDB connection with an `endpoint`, `region`, `urlStyle` or `useSsl` and no secret is still registered with the engine (`secretSql`), so public data on a store that is not AWS is read anonymously from that store. Without this the engine asks AWS for the bucket. The repo's `surfaces.config.ts` adds the source `s3` when `SURFACES_S3_ENDPOINT` or `SURFACES_S3_BUCKET` is set (`SURFACES_S3_SECRET_NAME` names its credentials; none means anonymous), and `.claude/launch.json` has `data-s3` to start the dev server on the stand-in.
