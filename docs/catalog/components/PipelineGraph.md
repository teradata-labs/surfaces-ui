# PipelineGraph

A pipeline as a graph of sources, tables, views and sinks with the flows between them and each one's latest status. You supply the nodes and edges as the pipeline engine reported them. The event is sent with `id` and `name` when a node is chosen.

## Props

- `nodes`: array
- `edges`: array
- `height` (optional): integer
- `action` (optional): value or binding

## Events

Sent through the component's `action`; the event name is the one in the action.

- **select**: When a node is chosen. Adds `id` (node id), `name` (node name).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.PipelineGraph
  nodes={[{ id: "files", name: "landing files", kind: "source" }, { id: "raw", name: "orders_raw", kind: "streamingTable", layer: "bronze", status: "completed", rowsWritten: 12000 }, { id: "daily", name: "daily_revenue", kind: "materializedView", layer: "gold", status: "running" }]}
  edges={[{ from: "files", to: "raw", mode: "streaming" }, { from: "raw", to: "daily" }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "pipeline",
  "component": "PipelineGraph",
  "nodes": [
    {
      "id": "files",
      "name": "landing files",
      "kind": "source"
    },
    {
      "id": "raw",
      "name": "orders_raw",
      "kind": "streamingTable",
      "layer": "bronze",
      "status": "completed",
      "rowsWritten": 12000
    },
    {
      "id": "daily",
      "name": "daily_revenue",
      "kind": "materializedView",
      "layer": "gold",
      "status": "running"
    }
  ],
  "edges": [
    {
      "from": "files",
      "to": "raw",
      "mode": "streaming"
    },
    {
      "from": "raw",
      "to": "daily"
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "pipeline",
  "elements": {
    "pipeline": {
      "type": "PipelineGraph",
      "props": {
        "nodes": [
          {
            "id": "files",
            "name": "landing files",
            "kind": "source"
          },
          {
            "id": "raw",
            "name": "orders_raw",
            "kind": "streamingTable",
            "layer": "bronze",
            "status": "completed",
            "rowsWritten": 12000
          },
          {
            "id": "daily",
            "name": "daily_revenue",
            "kind": "materializedView",
            "layer": "gold",
            "status": "running"
          }
        ],
        "edges": [
          {
            "from": "files",
            "to": "raw",
            "mode": "streaming"
          },
          {
            "from": "raw",
            "to": "daily"
          }
        ]
      }
    }
  }
}
```
