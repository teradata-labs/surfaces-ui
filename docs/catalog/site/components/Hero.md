# Hero

The opening of a page: a large title that scales with the room it has, a lead of one or two sentences, and its actions (Buttons or Links; the first is the primary one) as its children. Use one per page, first; put a Media, DeviceFrame or PromptReveal after it to show the product.

## Props

- `title`: string | binding | call
- `lead` (optional): string | binding | call
- `eyebrow` (optional): string | binding | call — A short line above the title: a product name, a release.
- `children` (optional): array of string | { componentId: string, path: string } — The actions: Buttons or Links, the primary one first. One to three.
- `align` (optional): "center" | "start"
- `level` (optional): 1 | 2 | 3 | 4 — The title's heading level. Defaults to 1; use 2 when the host's page already has a title.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `siteMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Hero
  title="Surfaces UI"
  lead="Components for data work that people and agents build together."
>
  {/* start is not in the surface */}
  {/* browse is not in the surface */}
</Ui.Hero>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "hero",
  "component": "Hero",
  "title": "Surfaces UI",
  "lead": "Components for data work that people and agents build together.",
  "children": [
    "start",
    "browse"
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "hero",
  "elements": {
    "hero": {
      "type": "Hero",
      "props": {
        "title": "Surfaces UI",
        "lead": "Components for data work that people and agents build together."
      },
      "children": [
        "start",
        "browse"
      ]
    }
  }
}
```
