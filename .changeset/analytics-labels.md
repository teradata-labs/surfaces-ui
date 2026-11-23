---
"@surfaces-ui/components": minor
"@surfaces-ui/spec": minor
---

Analytics components say what their numbers are:

- `PivotTable` heads its totals "Total" only when every measure adds up (sum, count, count distinct); otherwise "All" (`pivot.all`), since a maximum or an average over everything is not a total.
- `formatMetric` writes money one way: cents under a thousand, whole units to a hundred thousand, then compact. A `Sparkline` beside a `Metric` reads "$1,904" and "$498.2K", not "$1,904.00".
- `DataGrid` takes `columns.labels`, headers to show in place of column names ("Starts" for `starts_at`); sorting, filters and the layout keep the names. The catalog's `DataGrid` takes it too.
- `exploreChart` keeps the split when several measures are shown: each measure for each of the split's values, as `Chart` draws it ("North · Revenue"). A second attribute on the rows still splits one measure only. A chart on a page with a split and several measures now opens in Explore and goes back unchanged.
