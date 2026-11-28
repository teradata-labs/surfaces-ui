# `packages/state`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `packages/state` | State services with no React or DOM dependency: `createStore`, `derive`, `withHistory` (undo), `persist` (any `StateStorage`, versioned, checked on load; `select` saves a part and `restore` puts it back; a change made while loading wins), `syncUrl`, `createViewState` (a shared plain filter list (`FilterSpec`) and sorts for cross-filtering; `viewFilters`), `createQueryRuns`. `@surfaces-ui/state/react` has `useStore` and `useHistory`. |
