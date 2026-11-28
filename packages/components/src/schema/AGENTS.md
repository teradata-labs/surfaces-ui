# `packages/components/src/schema`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `ObjectInfo` | What the backend knows about a database, schema or table: kind, format, size, columns and keys | `sourceId`, `catalog`, `schema`, `table`, `onClose` |
| `SchemaExplorer` | A flat list of tables and their columns | `sourceId`, `onSelect`, `onInsert`, `renderActions` |
| `ObjectBrowser` | A tree of catalogs, schemas, tables and columns, with the joins under each table to walk across the model | `sourceId`, `onSelect`, `onInsert` (a join inserts its `JOIN … ON …`), `onUseSql` (SQL generated from an item's menu), `onAttach` / `attachLabel` (hand tables and columns to a chat), `onShowInfo`, `renderActions`, `pageSize`, `discovery` (drag helpers: `DataRef`, `writeDataRefs`, `readDataRefs`, `hasDataRefs`, `addDataRefs`, `dataRefLabel`) |

## Rules

- **Tables, columns and files are handed between components as `DataRef`s**: `{ sourceId, kind, catalog?, schema?, table, column?, path? }`, names only, never values or file contents. `ObjectBrowser` selects several (Ctrl or ⌘ click, Shift click, Space on the row the keyboard is on; Escape clears) and carries the whole selection when one of them is dragged or attached, or the one item otherwise. A drag writes the list (`DATA_REFS_MIME`), the first item in the older single form (`SCHEMA_REF_MIME`) and the names as plain text. Dragging between components uses the browser's drag and drop, which does not work by touch or keyboard, so the same hand-over is always on a row's menu and on Shift+Enter (`onAttach`). With one catalog and one schema the tree starts at tables, and a reference then names the table alone.
- A browser's status line (`.sf-schema-note`) keeps one fixed line. Do not let it grow or collapse: the list above would change height and rows would move under a pointer between two clicks.
