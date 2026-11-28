# `packages/components/src/plan`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `QueryPlan` | How the engine will run a query, as a tree and as its own text | `sourceId`, `sql`, `filters` (helper: `parsePlan`) |

## Rules

- A plan is fetched only when a person asks for it; explaining is a call to the engine.
