# `packages/components/src/graph`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `NodeGraph` | Things and the links between them (concepts, systems, anything that is not tables and joins) as a graph, with the same things listed beside it; a group takes a colour, a level is how full a node is drawn; display only, it reads no data | `label`, `nodes` (`id`, `label`, `description`, `group`, `level`), `links` (`source`, `target`, `label`), `selected`, `onSelect`, `groups`, `levels`, `noun`, `height`, `limit` (helpers: `buildGraphOption`, `graphWindow`, `graphNeighbours`, `graphGroups`, `linkCounts`) |

## Rules

- `NodeGraph` is drawn with ECharts' graph series, the same ECharts `Chart` uses, and is never the only way in: every node is listed beside the canvas, and the list opens a node and walks to its neighbours, so it works with a keyboard and where no canvas can be drawn. Its layout settles and stops, and under reduced motion it is placed without moving. Past `limit` (300) it draws what is within two links of the open node, or of the most linked one, and says how many it left out; it never draws a hairball. Colour says what kind of thing a node is (`group`, a series colour each, named in the legend); how far along it is (`level`) is how full the node is drawn in that colour, since another hue would say "a different thing". Test `buildGraphOption` and `graphWindow`, not pixels. For tables and joins use `ModelDiagram`; for a pipeline, `PipelineGraph`.
