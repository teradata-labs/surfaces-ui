# CertificationBadge

`import { CertificationBadge } from "@surfaces-ui/components";`

Marks certified or deprecated data wherever an object is shown, with a symbol and words as well as colour. Who certified it, when and why show on hover and focus.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `certification` | object |  | The verdict a person recorded with `setCertification`; none draws nothing. |

## Example

```tsx
<CertificationBadge
  certification={{"status":1,"setBy":"Ada Lovelace","setAt":"2026-11-01T10:00:00Z","note":"Reconciled with finance."}}
/>
```
