# PipelineView

A pipeline the backend runs, live: its datasets and how they feed one another, its runs, and for each dataset its query, grain, key, columns, row rules and checks with the latest results, with buttons to run, check or rebuild it. Give `action` to hear when a person's run starts and ends (`started`, `finished`). Use PipelineGraph instead when you only have a description of a pipeline to draw.

## Props

- `pipelineId`: string | binding | call
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **started**: When a person starts a run here. Adds `event` (started), `runId` (the run), `state` (running, or how it already ended).
- **finished**: When a run a person started here ends. Adds `event` (finished), `runId` (the run), `state` (completed, failed or cancelled), `built` (datasets built), `failed` (datasets that failed), `failedChecks` (checks that failed, as dataset.check).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.PipelineView pipelineId="sales" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "sales-pipeline",
  "component": "PipelineView",
  "pipelineId": "sales"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "sales-pipeline",
  "elements": {
    "sales-pipeline": {
      "type": "PipelineView",
      "props": {
        "pipelineId": "sales"
      }
    }
  }
}
```
