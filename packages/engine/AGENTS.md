# `packages/engine`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/engine` | The `Engine` adapter interface. |

- Adding an engine: implement `Engine` from `@surfaces-ui/engine`, add its dialect to `@surfaces-ui/sql` with golden tests, and pass it to `createSurfacesServer`.
