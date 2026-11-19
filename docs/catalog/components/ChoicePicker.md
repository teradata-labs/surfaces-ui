# ChoicePicker

Pick one of a few options: radio buttons for four or fewer, a list for more. The value is written to the data model at `value.path` as the person types, so other components (a Button's event context, a Text) can bind to it. Nothing is sent until a control sends an event.

## Props

- `label`: value or binding
- `value`: object — A value read from the data model at this path.
- `options`: array
- `help` (optional): value or binding
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.ChoicePicker
  label="Region"
  value={{ "@path": "/region" }}
  options={["Europe", "Americas", "Asia"]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "region",
  "component": "ChoicePicker",
  "label": "Region",
  "value": {
    "@path": "/region"
  },
  "options": [
    "Europe",
    "Americas",
    "Asia"
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "region",
  "elements": {
    "region": {
      "type": "ChoicePicker",
      "props": {
        "label": "Region",
        "value": {
          "$state": "/region"
        },
        "options": [
          "Europe",
          "Americas",
          "Asia"
        ]
      }
    }
  }
}
```
