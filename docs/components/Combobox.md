# Combobox

`import { Combobox } from "@surfaces-ui/components";`

A text box that suggests as a person types: a person to hand work to, a table, a tag. Anything may be typed; a suggestion is a shortcut. The host searches (on its server, for a long list) and passes the matches back as `options`; the box filters nothing. The ARIA 1.2 combobox: Down and Up move through the suggestions with focus kept in the box, Enter chooses (and with none highlighted, leaves Enter to the form), Escape closes the list and then clears the box. How many suggestions there are is announced.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `label` | string | yes | The field's name, shown above it. |
| `value` | string | yes | The text in the box. |
| `options` | object[] | yes | The suggestions for the text as it is now, best first. |
| `loading` | boolean |  | Suggestions are being fetched. |
| `type` | "text" \| "email" \| "search" |  | The input's type. |
| `placeholder` | string |  |  |
| `required` | boolean |  |  |
| `disabled` | boolean |  |  |
| `name` | string |  | The input's name, when a form reads it. |
| `help` | string |  | A sentence under the field. |

## Callbacks

- `onChange`: Every change to the text, typed or chosen. Search with it.
- `onPick`: The suggestion a person chose.

## Example

```tsx
<Combobox
  label="Hand their work to"
  type="email"
  value=""
  placeholder="Their name or email"
  options={[{"value":"ana@example.com","label":"Ana Admin","detail":"ana@example.com"},{"value":"cleo@example.com","label":"Cleo Chen","detail":"cleo@example.com"}]}
  onChange={…}
  onPick={…}
/>
```
