# StepFlow

Where multi-step work stands: onboarding, connecting a source, a cleaning or transformation run. Give a step the status `waiting` when the work has stopped for the person, and say in `detail` what you need from them.

## Props

- `label`: string | binding | call
- `steps`: array of { id: string, title: string, detail?: string, status: "done" | "current" | "waiting" | "pending" | "failed" | "skipped" }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.StepFlow
  label="Connect the sales lake"
  steps={[{ id: "find", title: "Find the tables", status: "done" }, { id: "secret", title: "Add the credential on the server", detail: "Set LAKE_KEY_ID and LAKE_SECRET, then tell me.", status: "waiting" }, { id: "test", title: "Test the connection", status: "pending" }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "flow",
  "component": "StepFlow",
  "label": "Connect the sales lake",
  "steps": [
    {
      "id": "find",
      "title": "Find the tables",
      "status": "done"
    },
    {
      "id": "secret",
      "title": "Add the credential on the server",
      "detail": "Set LAKE_KEY_ID and LAKE_SECRET, then tell me.",
      "status": "waiting"
    },
    {
      "id": "test",
      "title": "Test the connection",
      "status": "pending"
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "flow",
  "elements": {
    "flow": {
      "type": "StepFlow",
      "props": {
        "label": "Connect the sales lake",
        "steps": [
          {
            "id": "find",
            "title": "Find the tables",
            "status": "done"
          },
          {
            "id": "secret",
            "title": "Add the credential on the server",
            "detail": "Set LAKE_KEY_ID and LAKE_SECRET, then tell me.",
            "status": "waiting"
          },
          {
            "id": "test",
            "title": "Test the connection",
            "status": "pending"
          }
        ]
      }
    }
  }
}
```
