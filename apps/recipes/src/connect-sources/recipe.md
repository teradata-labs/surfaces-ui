# Connect Postgres, Teradata and S3

One `surfaces.config.ts` that reads a Postgres database, a Delta table in S3 and a Teradata system, all read-only, with every credential named by a secret and read from the server's environment. A source that cannot be reached does not stop the server; `testSource` says what is wrong.

The config names three sources. None of them holds a password, key or token: each `secret` is a name, and the dev server looks the values up in its own environment when it opens the source.

{{file: surfaces.config.ts}}

What each source needs:

- **Postgres** is attached to DuckDB read-only. Its tables are named `shop.<schema>.<table>`. The `uri` says where to connect and as whom, never the password; a `uri` with `password=` in it is refused. Give it a role that can only read.
- **S3** is a connection with a `scope`. Only paths under the scope can be read, and the Delta table's path must sit inside it. For MinIO or R2, add `endpoint`. Keys that Delta files do not hold go in `model`.
- **Teradata** goes through Teradata Query Service over HTTPS. Teradata has no read-only session, so the user must hold SELECT rights only. The session is set to UTC, and pages are cut with `TOP` and `QUALIFY ROW_NUMBER()`, never `LIMIT` or `OFFSET`.

Set these on the machine that runs the server, never in the repo. Names only; this is what goes in `.env.example`:

```bash
# Postgres (secret "PG")
PG_PASSWORD=
# S3 (secret "LAKE")
LAKE_KEY_ID=
LAKE_SECRET=
# LAKE_SESSION_TOKEN=        # only for temporary credentials
# Teradata (secret "TD")
TD_PASSWORD=
# TD_TOKEN=                  # a JWT instead of a password
```

To read secrets from a vault instead, open the sources yourself and pass a resolver: `openSources(config, dir, (name) => vault.read(name))`. On a cloud machine with a role, `ambientCredentials: true` on the S3 connection uses that role and needs no secret.

Then run `pnpm serve` (or `npx surfaces-dev`) next to the config. To see which sources answer, ask the server to test each one:

{{file: check-sources.ts}}

A database that is down is reported in that list and the other sources keep working. A client is told the secret's name, never its value: `listSources` shows `credentialsSecret: "TD"`. When something between the server and Teradata echoes the sign-in in an error, the Teradata adapter replaces it with `***` before the message leaves the server.

The test checks the config, then runs the Teradata source through the real dev server and a Connect client, with Teradata Query Service played by a stand-in `fetch`:

{{file: sources.test.ts}}

What has not been run:

- **Real S3.** Opening the `lake` source makes DuckDB install its `httpfs` and `delta` extensions, which downloads them, so the test does not open it. `packages/engine-duckdb` tests only the secret DuckDB is given for a connection; no object store has been read, real or stand-in.
- **A hosted Postgres over TLS.** Postgres has been run only against Postgres 17 in a local container (`packages/dev-server/src/postgres.test.ts`, when `SURFACES_TEST_POSTGRES` is set).
- **A real Teradata system.** The Query Service requests follow Teradata's published specification; nothing here has run against one. `packages/dev-server/src/teradata.test.ts` runs live when `SURFACES_TEST_TERADATA` is set.
- When a system cannot be reached at all, `testSource` returns `ok: false` with the reason, instead of failing the call. `checkSources` still catches errors, for when the data server itself is down.
