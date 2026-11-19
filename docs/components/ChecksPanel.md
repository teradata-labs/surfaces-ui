# ChecksPanel

`import { ChecksPanel } from "@surfaces-ui/components";`

A dataset's checks (unique, not null, relationships, accepted values, row count) with their latest results, failures first. Display only: the counts come from the engine.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `checks` | object[] | yes | Each check with its latest outcome. |

## Callbacks

- `onOpenFailing`: Look at what breaks a check. Nothing runs unless the host runs it.

## Example

```tsx
<ChecksPanel
  checks={[{"name":"order_id_unique","description":"order_id never repeats","severity":"fail","failedRecords":0,"fromKey":true},{"name":"status_values","description":"status is one of placed, shipped, returned","severity":"warn","failedRecords":12,"summary":"12 rows have another status."}]}
  onOpenFailing={…}
/>
```
