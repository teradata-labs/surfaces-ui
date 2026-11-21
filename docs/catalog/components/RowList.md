# RowList

One component drawn once for each row of a SQL query: a feed of posts, a list of cards, rows that each carry their own buttons. `child` is the component drawn per row, usually a Card. Inside it, and in everything it holds, a relative path reads the row's column of that name (`{ "@path": "author" }`; `formatString` with `${author}` too), and a Button's event carries the row's key the same way (`"context": { "post_id": { "@path": "post_id" } }`), so you learn which row was acted on. Absolute paths still read the surface's data model. The database sorts, filters and pages; a person asks for more rows, up to 200. An input inside a row must bind an absolute path. For plain rows in columns use DataGrid.

## Props

- `sourceId`: string | binding | call
- `sql`: string | binding | call — A single read-only SELECT statement. One row of it is one item.
- `child`: string — ID of the component drawn for each row.
- `label`: string — What the items are, for assistive technology: "Posts".
- `sorts` (optional): array of { column: string, desc?: boolean } — Sort order, most important first. An empty list clears it.
- `filters` (optional): array of { column: string, op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since", values?: array } | binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `pageSize` (optional): integer — Rows fetched at a time. Defaults to 20.
- `rowKey` (optional): string — A column that tells rows apart, such as the key.
- `layout` (optional): "list" | "grid" — "list" stacks the rows; "grid" lays them out as cards, as many across as fit.
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.RowList
  sourceId="lake"
  sql="SELECT * FROM orders"
  label="Orders"
  sorts={[{ column: "ordered_at", desc: true }]}
  rowKey="order_id"
  pageSize={10}
>
  {/* order-card is not in the surface */}
</Ui.RowList>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "feed",
  "component": "RowList",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders",
  "child": "order-card",
  "label": "Orders",
  "sorts": [
    {
      "column": "ordered_at",
      "desc": true
    }
  ],
  "rowKey": "order_id",
  "pageSize": 10
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "feed",
  "elements": {
    "feed": {
      "type": "RowList",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders",
        "label": "Orders",
        "sorts": [
          {
            "column": "ordered_at",
            "desc": true
          }
        ],
        "rowKey": "order_id",
        "pageSize": 10
      },
      "children": [
        "order-card"
      ]
    }
  }
}
```
