# NodeGraph

Things and the links between them, drawn as a graph with the same things listed beside it: concepts in a glossary, tables in a model, systems and what they feed. You give the nodes and links; it reads no data. `group` is what kind of thing a node is (each group takes a colour and is named in the legend); `level` is how far along it is (drawn as how full the node is). Give `selected` a data path to mark the open node and to write the node a person opens there. Past 300 nodes it shows what is around the open node and says how many it left out. For tables and their joins use ModelDiagram; for a pipeline use PipelineGraph.

## Props

- `label`: string — What the graph shows, for assistive technology.
- `nodes`: array
- `links`: array
- `selected` (optional): value or binding — The open node's id, or a data path that holds it and is written when a person opens a node.
- `groups` (optional): array — The order groups take colours and appear in the legend.
- `levels` (optional): object — What each level means, in words.
- `noun` (optional): string — What a node is called: "term" gives "7 terms".
- `height` (optional): integer
- `action` (optional): value or binding

## Events

Sent through the component's `action`; the event name is the one in the action.

- **select**: When a node is opened, on the graph or in the list beside it. Adds `node` (the node's id).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.NodeGraph
  label="Terms and how they are linked"
  noun="term"
  nodes={[{ id: "order", label: "Order", level: "full" }, { id: "customer", label: "Customer", level: "half" }, { id: "store", label: "Store", level: "outline" }]}
  links={[{ source: "order", target: "customer", label: "placed by" }, { source: "order", target: "store", label: "taken at" }]}
  levels={{ full: "Certified", half: "Partly certified", outline: "Not certified" }}
  selected={{ "@path": "/term" }}
  height={360}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "concepts",
  "component": "NodeGraph",
  "label": "Terms and how they are linked",
  "noun": "term",
  "nodes": [
    {
      "id": "order",
      "label": "Order",
      "level": "full"
    },
    {
      "id": "customer",
      "label": "Customer",
      "level": "half"
    },
    {
      "id": "store",
      "label": "Store",
      "level": "outline"
    }
  ],
  "links": [
    {
      "source": "order",
      "target": "customer",
      "label": "placed by"
    },
    {
      "source": "order",
      "target": "store",
      "label": "taken at"
    }
  ],
  "levels": {
    "full": "Certified",
    "half": "Partly certified",
    "outline": "Not certified"
  },
  "selected": {
    "@path": "/term"
  },
  "height": 360
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "concepts",
  "elements": {
    "concepts": {
      "type": "NodeGraph",
      "props": {
        "label": "Terms and how they are linked",
        "noun": "term",
        "nodes": [
          {
            "id": "order",
            "label": "Order",
            "level": "full"
          },
          {
            "id": "customer",
            "label": "Customer",
            "level": "half"
          },
          {
            "id": "store",
            "label": "Store",
            "level": "outline"
          }
        ],
        "links": [
          {
            "source": "order",
            "target": "customer",
            "label": "placed by"
          },
          {
            "source": "order",
            "target": "store",
            "label": "taken at"
          }
        ],
        "levels": {
          "full": "Certified",
          "half": "Partly certified",
          "outline": "Not certified"
        },
        "selected": {
          "$state": "/term"
        },
        "height": 360
      }
    }
  }
}
```
