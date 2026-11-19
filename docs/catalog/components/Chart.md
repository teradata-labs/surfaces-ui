# Chart

A chart over a SQL query. Give each measure an aggregate so the database summarises the data; without one the chart plots a random sample of rows. Each entry in y is a series; give series their own type and axis for a compound chart. Choose the form from the comparison: bars for amounts across categories (they are sorted largest first and start at zero), a line with xGrain for change over time, xBins for a distribution, scatter for two measures. Avoid a pie beyond five slices, more than five lines, and a second y scale (use two charts on the same x instead); the chart shows advice when its shape is hard to read.

## Props

- `sourceId`: value or binding
- `sql`: value or binding — A single read-only SELECT statement.
- `filters` (optional): value or binding — Filters applied by the database. Send the whole list each time; an empty list clears them. Or a binding (`{ "@path": "/filters" }`) to read a list kept in the surface's data model: give every view on a page the same path, with a FilterBar writing to it, and they all follow one set of filters.
- `type`: "bar" | "line" | "area" | "scatter" | "pie"
- `x`: string — Column for the x axis, or the slices of a pie.
- `xGrain` (optional): "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year" — Group a date or time x column into buckets of this size. Use it for every time series.
- `xBins` (optional): integer — Group a numeric x column into about this many bins, for a histogram.
- `y`: array — One entry per series.
- `splitBy` (optional): string — Column whose values become separate series.
- `stacked` (optional): boolean
- `select` (optional): object — Makes the chart a filter: the path of a shared filter list (the one its `filters` and a FilterBar use). A click on a bar filters the page to that x value, a click on it again clears it, and this chart ignores filters on its own x column so the bars a person clicks stay. Only for a category x (no xGrain or xBins).
- `sort` (optional): "value" | "x" — Order of bars. Bars over categories are sorted largest first unless you say "x". Dates, bins and numbers keep their own order.
- `legend` (optional): "top" | "bottom" | "right" | "none" — Leave out: up to four lines are labelled at their ends, and one series needs no legend.
- `xTitle` (optional): string
- `yTitle` (optional): string
- `yRightTitle` (optional): string
- `yFormat` (optional): "number" | "compact" | "currency" | "percent" — How the left axis writes its numbers: "percent" for a rate (6%, not 0.06), "currency" for money. Labels only.
- `height` (optional): integer
- `action` (optional): value or binding
- `label` (optional): string — Accessible description of what the chart shows.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **select**: When a person clicks a bar or point. Adds `column` (the x column), `value` (the clicked x value), `series` (the series clicked).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Chart
  sourceId="lake"
  sql="SELECT * FROM orders"
  type="bar"
  x="region"
  y={[{ column: "amount", aggregate: "sum", label: "Revenue" }]}
  yTitle="Revenue"
  label="Revenue by region, largest first"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "chart",
  "component": "Chart",
  "sourceId": "lake",
  "sql": "SELECT * FROM orders",
  "type": "bar",
  "x": "region",
  "y": [
    {
      "column": "amount",
      "aggregate": "sum",
      "label": "Revenue"
    }
  ],
  "yTitle": "Revenue",
  "label": "Revenue by region, largest first"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "chart",
  "elements": {
    "chart": {
      "type": "Chart",
      "props": {
        "sourceId": "lake",
        "sql": "SELECT * FROM orders",
        "type": "bar",
        "x": "region",
        "y": [
          {
            "column": "amount",
            "aggregate": "sum",
            "label": "Revenue"
          }
        ],
        "yTitle": "Revenue",
        "label": "Revenue by region, largest first"
      }
    }
  }
}
```
