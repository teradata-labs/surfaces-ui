# RunHistory

The runs of a pipeline, newest first: how each ended, how long it took, what it refreshed and why it failed.

## Props

- `runs`: array of { id: string, state: "idle" | "starting" | "running" | "completed" | "failed" | "cancelled" | "skipped", startTime: string, endTime?: string, trigger?: string, refreshKind?: "default" | "refresh" | "fullRefresh", datasets?: array of string, errorMessage?: string }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.RunHistory
  runs={[{ id: "update-42", state: "completed", startTime: "2026-11-12T02:00:00Z", endTime: "2026-11-12T02:01:05Z", trigger: "schedule" }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "runs",
  "component": "RunHistory",
  "runs": [
    {
      "id": "update-42",
      "state": "completed",
      "startTime": "2026-11-12T02:00:00Z",
      "endTime": "2026-11-12T02:01:05Z",
      "trigger": "schedule"
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "runs",
  "elements": {
    "runs": {
      "type": "RunHistory",
      "props": {
        "runs": [
          {
            "id": "update-42",
            "state": "completed",
            "startTime": "2026-11-12T02:00:00Z",
            "endTime": "2026-11-12T02:01:05Z",
            "trigger": "schedule"
          }
        ]
      }
    }
  }
}
```
