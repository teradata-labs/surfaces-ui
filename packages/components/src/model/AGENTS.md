# `packages/components/src/model`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `ModelDiagram` | A relationship diagram: tables as cards with PK and FK marks and column descriptions, lines between joined columns; foreign keys a table declares become "Declared" joins; drag a column onto another to join, drop tables from `ObjectBrowser`; each join has a kind (only matching rows, every row of one side, every row of both) set on its line or in the list; with `rowsFrom` the first table is where the rows come from and the rest are laid out as its detail, each join says whether it adds one row or can repeat rows (from declared keys, or counted by the engine on request), and each column shows its name in the result; pans and zooms | `sourceId`, `tables`, `joins` (`type`), `onChange(model, query)`, `onUseSql`, `suggestJoins` (`suggest` in the catalog), `rowsFrom`, `usedColumns` (helpers: `modelSql`, `outputColumns`, `joinShape`, `joinDepths`, `flipJoin`, `joinFrom`, `kindText`, `joinText`) |

## Rules

- `ModelDiagram` refuses joins that cannot work (`checkJoin`: a table to itself, a missing column, nested or binary keys, keys of different kinds such as a number against text) and says why in an alert. The form offers only columns that could match. A join that turns out not to work (a suggestion, or a column that has gone) stays visible, is marked, and is left out of the generated SQL, as is a table that could not be read (with "Try again"). Every line has its own remove button; a join that closes a loop is allowed with a warning.
- `ModelDiagram` must stay usable without a pointer: every join can be added, confirmed and removed from the list and form beneath the canvas. Joins it suggests stay "Inferred" until a person confirms or draws them.
