# StatusBadge

`import { StatusBadge } from "@surfaces-ui/components";`

A short status beside the thing it describes: an account on or turned off, a job running or failed, an invitation waiting. Its words carry the meaning; the tone backs them up with a colour and a shape (a ring, a dot, a diamond, a square), so it reads the same without colour. For data that is certified or deprecated use `CertificationBadge`.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `label` | string | yes | The status in a word or two: "Turned off". |
| `tone` | "neutral" \| "info" \| "success" \| "warning" \| "danger" |  | How it should strike a person. Defaults to neutral. |
| `description` | string |  | A sentence more, shown on hover and read after the label: "by Ana on 3 May". |

## Example

```tsx
<StatusBadge label="Turned off" tone="danger" description="by Ana on 3 May" />
```
