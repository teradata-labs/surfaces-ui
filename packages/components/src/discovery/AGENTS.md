# `packages/components/src/discovery`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

The discovery rules are in [packages/discovery/AGENTS.md](../../../discovery/AGENTS.md).

| Component | Use it for | Key props |
|---|---|---|
| `DiscoveryProvider` / `useDiscovery` | Supplying the discovery backend | `discovery` |
| `DataSearch` | Finding tables and columns by words or meaning | `onOpen`, `renderActions`, `sourceIds` |
| `ObjectDetail` / `ColumnProfile` | One table's description, certification, column statistics and related tables | `objectRef`, `onOpen`, `renderActions`, `showSampleRows`, `certifier` |
| `CertificationBadge` | Marking certified or deprecated data anywhere an object is shown | `certification` |
| `RelationshipGraph` | Walking joins and look-alike tables | `objectRef`, `onOpen` |
| `ContextBuilder` | Assembling and previewing the context an agent receives | `value`, `onChange`, `tokenBudget`, `onSaved` (helpers: `addToContext`, `toContextPack`) |
| `AskData` | A question over the catalog with cited tables | `onOpen`, `onUseSql`, `contextPackId` |

## Rules

- `DataSearch` takes `height`: with it the results scroll inside and the list can be focused; without it the list is as long as its results.
- A catalog surface navigates on its own: `DataSearch`, `ObjectBrowser`, `ObjectDetail` and `RelationshipGraph` take `opened: { "@path": … }` and write the opened table there; bind `ObjectDetail` and `RelationshipGraph` `table` to the same path. The event is still sent. Saved catalog pages and seed starters use `/table`.
