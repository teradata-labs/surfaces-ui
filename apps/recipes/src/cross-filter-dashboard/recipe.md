# A dashboard from SQL with cross-filtering

One query feeds headline numbers, two bar charts and a table. Clicking a bar filters every other view, each filter can be removed with a button, and every view asks the engine for its own summary, so nothing is filtered or grouped in the browser.

How it works:

- `createViewState` from `@surfaces-ui/state` holds what was picked: values per column, ranges and sorts. It holds choices only; the filtering happens in the engine.
- Each view gets `view.filters(ownColumn)`. The region chart gets every filter except the one on `region`, so the bar a person clicked does not filter the other bars away. Views that pick nothing get `view.filters()`, which is all of them.
- `Chart` reports a click through `onPointClick`, and the dashboard calls `view.toggle(column, value)`. Clicking the same bar again removes it.
- A click is never the only way. Every filter is shown as a button that removes it, and "Clear filters" removes them all. The grid's own sort is kept in the same state, through `onSortsChange` and `view.setSorts`.
- Each headline number has a comparison beside it: revenue has a `Sparkline` of the last twelve months, and the order count has a `BulletGraph` against a target. A number on its own does not say whether it is good.
- The charts follow the library's chart rules: bars over categories with an aggregated measure, sorted largest first by the engine, on one scale.

The dashboard expects a query with `region`, `status`, `amount` and `ordered_at` columns. Change the column names to fit your data.

{{file: Dashboard.tsx}}

To keep the filters in the address bar or in storage, create the view state yourself and pass it in. `syncUrl` and `persist` from `@surfaces-ui/state` work on it; the playground's hand-built dashboard does both, and adds undo with `useHistory`.

Put it on a page with a theme and a backend:

```tsx
import "@surfaces-ui/components/styles.css";
import { DataSourceProvider, ThemeProvider } from "@surfaces-ui/components";
import { connectDataSource } from "@surfaces-ui/client-connect";
import { createRoot } from "react-dom/client";
import { Dashboard } from "./Dashboard.js";

const data = connectDataSource({ baseUrl: "http://localhost:5220" });

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <DataSourceProvider dataSource={data}>
      <Dashboard sourceId="retail" sql="SELECT * FROM orders" />
    </DataSourceProvider>
  </ThemeProvider>,
);
```

The test runs the real dashboard against `memoryDataSource` and writes down every query the views send. It makes a selection the way a click on a bar would, then checks that the grid, the other chart and the headline numbers carry the filter, and that the chart that made the selection does not. It also removes filters with the buttons. jsdom has no canvas, so the test gives ECharts a stand-in 2D context; it checks the queries, not the drawn bars, and a real click on a bar is not exercised here.

{{file: dashboard.test.tsx}}
