# NavBar

`import { NavBar } from "@surfaces-ui/components";`

Navigation across the top of a site, after Apple's: the sections on a glass bar that stays at the top, and beneath it the current section's name and its pages. Content scrolls under both and an edge appears once it does. On a narrow screen the sections fold into a menu that covers the screen as a dialog. It takes the same groups as `SideNav`, so a site can move between the two.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `label` | string | yes | What the navigation is for, for assistive technology: "Surfaces UI". |
| `groups` | object[] | yes | The sections, each with its pages. A section goes to its first page. |
| `current` | string |  | The id of the page being shown. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `brand`: **Brand.** A name or mark at the bar's start.
- `actions`: **Actions.** A status or a picker at the bar's end; it moves into the menu on a narrow screen.

## Callbacks

- `onSelect`: The id of the page a person chose.

## Example

```tsx
<NavBar
  label="Acme analytics"
  current="revenue"
  groups={[{"label":"Reports","items":[{"id":"revenue","label":"Revenue"},{"id":"refunds","label":"Refunds"},{"id":"stores","label":"Stores"}]},{"label":"Data","items":[{"id":"tables","label":"Tables"},{"id":"models","label":"Models"}]},{"label":"Settings","items":[{"id":"people","label":"People"}]}]}
  brand={brand}
  onSelect={…}
/>
```
