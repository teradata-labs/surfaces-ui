# Form

A form that checks what a person enters and submits it. Give the fields and their rules; the form draws a labelled input for each, shows errors beside them and sends nothing while any is wrong. A field with `visibleWhen: { field, equals }` is asked for only once another field holds that value. When the page has a forms backend, values go to the form with this `formId` there (the backend decides where they are stored; you never name a table); either way your event receives them. Use it instead of loose inputs and a Button whenever values must be checked or kept.

## Props

- `formId`: string
- `title` (optional): string | binding | call
- `description` (optional): string | binding | call
- `fields`: array of { name: string, label: string, type: "text" | "longtext" | "number" | "integer" | "boolean" | "date" | "datetime" | "choice", required?: boolean, options?: array of string, min?: number, max?: number, step?: number, maxLength?: integer, pattern?: string, help?: string, placeholder?: string, visibleWhen?: { field: string, equals?: any, in?: array } }
- `values` (optional): binding — Where the entered values live in the data model, to prefill them or show them elsewhere.
- `submitLabel` (optional): string
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **submit**: After the values pass every check and, when the page has a forms backend, after it stored them. Adds `formId` (the form), `values` (the values as stored), `submissionId` (the backend's id, or empty with no backend).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Form
  formId="case-review"
  title="Review this alert"
  fields={[{ name: "decision", label: "Decision", type: "choice", options: ["Fraud", "Not fraud", "Needs more information"], required: true }, { name: "amount_at_risk", label: "Amount at risk", type: "number", min: 0 }, { name: "note", label: "Note", type: "longtext", maxLength: 500 }]}
  values={{ "@path": "/review" }}
  submitLabel="Save decision"
  action={{ event: { name: "case_reviewed" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "case-review",
  "component": "Form",
  "formId": "case-review",
  "title": "Review this alert",
  "fields": [
    {
      "name": "decision",
      "label": "Decision",
      "type": "choice",
      "options": [
        "Fraud",
        "Not fraud",
        "Needs more information"
      ],
      "required": true
    },
    {
      "name": "amount_at_risk",
      "label": "Amount at risk",
      "type": "number",
      "min": 0
    },
    {
      "name": "note",
      "label": "Note",
      "type": "longtext",
      "maxLength": 500
    }
  ],
  "values": {
    "@path": "/review"
  },
  "submitLabel": "Save decision",
  "action": {
    "event": {
      "name": "case_reviewed"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "case-review",
  "elements": {
    "case-review": {
      "type": "Form",
      "props": {
        "formId": "case-review",
        "title": "Review this alert",
        "fields": [
          {
            "name": "decision",
            "label": "Decision",
            "type": "choice",
            "options": [
              "Fraud",
              "Not fraud",
              "Needs more information"
            ],
            "required": true
          },
          {
            "name": "amount_at_risk",
            "label": "Amount at risk",
            "type": "number",
            "min": 0
          },
          {
            "name": "note",
            "label": "Note",
            "type": "longtext",
            "maxLength": 500
          }
        ],
        "values": {
          "$state": "/review"
        },
        "submitLabel": "Save decision",
        "action": {
          "event": {
            "name": "case_reviewed"
          }
        }
      }
    }
  }
}
```
