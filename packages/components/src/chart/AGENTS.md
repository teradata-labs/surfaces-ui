# `packages/components/src/chart`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `Chart` | Bar, line, area, scatter, pie over a query; compound charts | `sourceId`, `sql`, `type`, `x`, `xGrain`, `xBins`, `y` (one entry per series: `aggregate`, `type`, `axis`), `splitBy`, `stacked`, `legend`, `xTitle`/`yTitle`/`yRightTitle`, `option`, `emptyMessage`, `errorMessage` |
| `Sparkline` | A word-sized trend line beside its latest value (Tufte) | `sourceId`, `sql`, `x`, `grain`, `column`, `aggregate`, `label`, `points`, `emptyMessage`, `errorMessage` |
| `BulletGraph` | One measure against a target and named bands, instead of a gauge (Few) | `sourceId`, `sql`, `column`, `aggregate`, `label`, `target`, `ranges`, `emptyMessage`, `errorMessage` |
| `chartAdvice` | Checks a chart's shape against Tufte's and Few's rules; returns advice, not errors | `({ type, categories, series, stacked, rightAxis, orderedX, truncatedAxis })` |

## Rules

- A chart over a large table must use an aggregated measure (`y={[{ column, aggregate: "sum" }]}`), which sends `group_by` and `aggregates` in the `ViewQuery` so the engine summarises. Without an aggregate the chart asks for a random sample (`ViewQuery.sample`), never "the first N rows".
- A time series sets `xGrain` and a histogram sets `xBins` or `xBinWidth`; both become `ViewQuery.buckets`. Never group by a raw timestamp.
- A row with no x cannot be placed on a time or number axis: it is left out of the option whole (`rowsWithoutX`), so a bucket that is not drawn never sizes the y axis, and the chart says beneath itself that rows with no x are not drawn (with what the one such row holds). A category axis draws it under "null".
- Axis titles are placed from the tick labels, not from the axis line (`nameMoveOverlap`), and the plot shrinks until labels and titles fit (`grid.outerBoundsMode: "same"`, `outerBoundsContain: "all"`). Do not go back to `containLabel` with a fixed `nameGap`: it fits one width of tick label only.
- Each `y` entry is a series. A compound chart gives a series its own `type` and puts a measure on another scale with `axis: "right"`.
- Chart defaults follow the chart-standards skill; do not undo them. Bars over categories are sorted largest first (`sort="x"` keeps the column's order); the sort is sent to the engine so a row limit keeps the largest, and a split chart is ordered by each category's total. Dates, bins and numbers keep their own order. Up to four lines whose ends are apart are named at their ends instead of in a legend. The zoom bar appears only past 60 points. A chart whose drawn shape misleads (`drawnShape` then `chartAdvice`) says so beneath itself; pass `advice={false}` only for a chart that is not there to be read, such as a colour test card.
- Examples and demo agents must pass their own advice: no pie where bars would do, no second y scale, and a comparison (a `Sparkline` or a `BulletGraph`) beside headline numbers.
- `Chart` reports clicks through `onPointClick`. For cross-filtering, keep the selection in `createViewState` and give each view `view.filters(ownColumn)`, so a chart never filters away the bars a person clicks. The view state holds the same plain filter list (`FilterSpec`, from `@surfaces-ui/data`) as page-wide filters and agents, and a click follows one rule everywhere (`toggleValueFilter`): a second value is added (`in`), a chosen one is taken out.
