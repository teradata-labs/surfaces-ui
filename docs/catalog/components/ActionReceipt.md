# ActionReceipt

What happened after a person approved something: the outcome, who approved it and why, what ran, what changed, and whether it can be undone. Send one after every approved action that changed something, including a failed one. Give `undo` only when undoing is really possible, with `until` when it stops being; leave it out and the receipt says it cannot be undone. The `undo` event is a request: confirm it with the person before acting.

## Props

- `title`: value or binding
- `outcome`: "done" | "partial" | "failed"
- `summary` (optional): value or binding
- `ranAt` (optional): string — ISO time it ran.
- `ranBy` (optional): string — What ran it: you, a pipeline, a service.
- `approvedBy` (optional): array
- `sql` (optional): string — What ran, for the record. Never run from the receipt.
- `changes` (optional): array
- `undo` (optional): object
- `action` (optional): value or binding
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **undo**: When a person asks to undo what ran. Ask again before undoing; this is a request, not an approval.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.ActionReceipt
  title="Rebuilt orders_clean"
  outcome="done"
  summary="58,000 rows replaced with 57,963 after removing repeated order IDs."
  ranAt="2026-11-13T10:04:00Z"
  ranBy="sales pipeline"
  approvedBy={[{ by: "Ada", at: "2026-11-13T10:02:00Z", reason: "Counts checked against finance" }]}
  changes={[{ label: "Rows", before: "58,000", after: "57,963" }]}
  undo={{ label: "Restore the previous version", description: "Restores the table as it was at 10:03. Rows added since then are lost.", until: "2026-11-20T10:04:00Z" }}
  action={{ event: { name: "undo_requested" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "receipt",
  "component": "ActionReceipt",
  "title": "Rebuilt orders_clean",
  "outcome": "done",
  "summary": "58,000 rows replaced with 57,963 after removing repeated order IDs.",
  "ranAt": "2026-11-13T10:04:00Z",
  "ranBy": "sales pipeline",
  "approvedBy": [
    {
      "by": "Ada",
      "at": "2026-11-13T10:02:00Z",
      "reason": "Counts checked against finance"
    }
  ],
  "changes": [
    {
      "label": "Rows",
      "before": "58,000",
      "after": "57,963"
    }
  ],
  "undo": {
    "label": "Restore the previous version",
    "description": "Restores the table as it was at 10:03. Rows added since then are lost.",
    "until": "2026-11-20T10:04:00Z"
  },
  "action": {
    "event": {
      "name": "undo_requested"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "receipt",
  "elements": {
    "receipt": {
      "type": "ActionReceipt",
      "props": {
        "title": "Rebuilt orders_clean",
        "outcome": "done",
        "summary": "58,000 rows replaced with 57,963 after removing repeated order IDs.",
        "ranAt": "2026-11-13T10:04:00Z",
        "ranBy": "sales pipeline",
        "approvedBy": [
          {
            "by": "Ada",
            "at": "2026-11-13T10:02:00Z",
            "reason": "Counts checked against finance"
          }
        ],
        "changes": [
          {
            "label": "Rows",
            "before": "58,000",
            "after": "57,963"
          }
        ],
        "undo": {
          "label": "Restore the previous version",
          "description": "Restores the table as it was at 10:03. Rows added since then are lost.",
          "until": "2026-11-20T10:04:00Z"
        },
        "action": {
          "event": {
            "name": "undo_requested"
          }
        }
      }
    }
  }
}
```
