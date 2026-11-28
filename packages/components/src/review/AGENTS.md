# `packages/components/src/review`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `ActionReceipt` | What ran after an approval: outcome, who approved it and when, the SQL, before and after, and whether and until when it can be undone | `title`, `outcome`, `summary`, `ranAt`, `ranBy`, `approvedBy`, `sql`, `changes`, `undo`, `onUndo` |
| `PlanReview` | A proposed plan (cleaning, transformations, a connection) a person approves step by step; high-risk steps start unticked | `title`, `steps`, `proposedBy`, `onDecide`, `decided` |
| `PiiReview` / `piiHints` | A column-by-column personal data review with a treatment per column; `piiHints` guesses from names only | `table`, `columns`, `purpose`, `onDecide` |
| `StepFlow` | Where multi-step work stands and where it is paused for a person | `label`, `steps` (status `waiting` for a pause) |

## Rules

- `PlanReview`, `PiiReview` and `StepFlow` only report a decision or show a status. Nothing in them runs SQL, registers a table or changes data; whatever acts on a decision is the host or the agent, through the usual read-only and pipeline paths.
- `piiHints` reads column names only. Scanning values for personal data is allowed only on a source in `allowSampleValues`. Engine-side masking functions are not built: a treatment is written as SQL in a pipeline dataset and reviewed by a person.
