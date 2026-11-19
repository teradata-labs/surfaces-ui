# SemanticModelEditor

A semantic model, to create, read and change: what one row is (the grain) and the columns that make it unique, where the rows come from (tables and joins, or a written query), and its dimensions (ways to break rows down), measures (a column summarised) and metrics (arithmetic over measures), each with who defined it. Every Explorer and ReportBuilder given this `model` takes its fields from it, so a change here changes every report on it. To propose a change, send `proposed` with the fields to add or replace (in the pill form: an attribute is a dimension, a metric a measure, a derived metric a metric), the names to remove and any change to the rows, and `proposedBy` with your name; read the model with describe_semantic_model first. To propose a new model, send `create` with its label and source and `proposed` with its rows and fields; read the tables with describe_table first and join from the table whose rows the model counts to tables that add one row of detail each. Either way it is shown as a draft, marked part by part and checked as it is made, and a person can change the joins, the grain, the key and every field before saving; nothing is kept until they save. What the person changes comes back as `proposed` in this component's controls. Give `action` to receive the `save` event, and the `ask` event with `text` when the person asks for something in words.

## Props

- `model`: string — The semantic model to show, or with `create` the name of the one to make.
- `create` (optional): object — Propose a new model named `model`. Its rows and fields go in `proposed`. When a model of that name exists, the proposal is shown as a change to it instead.
- `proposed` (optional): object — A change you propose, or a new model's rows and fields. Shown as a draft for a person to read, change and save, or drop.
- `proposedBy` (optional): string — Who proposed it: your name. Shown above the changes.
- `action` (optional): value or binding
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **save**: When a person saves the draft as the model's next version, or a new model as version 1. Every report on the model now uses it. Adds `model` (the model's name), `version` (the version saved), `changes` (each changed field's name and whether it was added, changed or removed; a part of the rows appears as (grain), (primaryKey), (joins), (sql) or (dataset)).
- **ask**: When a person asks for a change, or for a new model, in words. Answer by updating this component's `proposed` (and `create`). Adds `text` (what they asked for).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.SemanticModelEditor
  model="sales_lines"
  proposed={{ add: [{ id: "cost_share", kind: "derived", label: "Cost share", expression: "cost / revenue", format: "percent", description: "Cost as a share of revenue." }], remove: ["brand"] }}
  proposedBy="the analytics agent"
  action={{ event: { name: "model.saved" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "model",
  "component": "SemanticModelEditor",
  "model": "sales_lines",
  "proposed": {
    "add": [
      {
        "id": "cost_share",
        "kind": "derived",
        "label": "Cost share",
        "expression": "cost / revenue",
        "format": "percent",
        "description": "Cost as a share of revenue."
      }
    ],
    "remove": [
      "brand"
    ]
  },
  "proposedBy": "the analytics agent",
  "action": {
    "event": {
      "name": "model.saved"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "model",
  "elements": {
    "model": {
      "type": "SemanticModelEditor",
      "props": {
        "model": "sales_lines",
        "proposed": {
          "add": [
            {
              "id": "cost_share",
              "kind": "derived",
              "label": "Cost share",
              "expression": "cost / revenue",
              "format": "percent",
              "description": "Cost as a share of revenue."
            }
          ],
          "remove": [
            "brand"
          ]
        },
        "proposedBy": "the analytics agent",
        "action": {
          "event": {
            "name": "model.saved"
          }
        }
      }
    }
  }
}
```
