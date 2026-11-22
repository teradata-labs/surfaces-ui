# Section

A part of a page under its own heading, with room around it: one message per section. Its children follow the heading.

## Props

- `heading`: string | binding | call
- `eyebrow` (optional): string | binding | call
- `lead` (optional): string | binding | call — A sentence under the heading.
- `children`: array of string | { componentId: string, path: string }
- `level` (optional): 1 | 2 | 3 | 4 — The heading's level. Defaults to 2.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Section heading="Showcase" lead="Setups for the people who work with data.">
  {/* role-cards is not in the surface */}
</Ui.Section>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "roles",
  "component": "Section",
  "heading": "Showcase",
  "lead": "Setups for the people who work with data.",
  "children": [
    "role-cards"
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "roles",
  "elements": {
    "roles": {
      "type": "Section",
      "props": {
        "heading": "Showcase",
        "lead": "Setups for the people who work with data."
      },
      "children": [
        "role-cards"
      ]
    }
  }
}
```
