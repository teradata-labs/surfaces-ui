# Pagination

`import { Pagination } from "@surfaces-ui/components";`

Which rows are shown, "51–100 of 126", with Previous and Next, under a `DataTable` a host pages on its server. It holds no page of its own: the host keeps `offset` and fetches the page `onChange` asks for. Nothing is drawn when every row fits on one page.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `offset` | integer | yes | Where this page starts, counting from 0. |
| `pageSize` | integer | yes | How many rows a page holds. |
| `total` | integer | yes | How many rows there are in all. |
| `label` | string |  | Names the navigation. Defaults to "Pages". |
| `busy` | boolean |  | A page is being fetched. |

## Callbacks

- `onChange`: The offset of the page a person moved to.

## Example

```tsx
<Pagination offset={50} pageSize={50} total={126} onChange={…} />
```
