---
name: chart-standards
description: Use before drawing, choosing or reviewing any chart, sparkline, table of figures or headline number, in any tool; with Surfaces UI or its MCP server it is drawn with those components. Applies the working rules of Edward Tufte and Stephen Few so a chart shows the data honestly and can be read at a glance. Triggers on "chart", "graph", "plot", "visualize", "which chart", "review this chart", "sparkline", "bullet graph", "small multiples".
---

# Chart standards (Tufte and Few)

A chart exists to let someone compare numbers. Every rule below serves that. The rules are summarised here in our own words; read the authors for the reasoning.

## Decide in this order

1. **What is being compared?** Write it as a sentence ("revenue by region this quarter against last"). If you cannot, do not draw yet.
2. **Is a chart needed?** One number is a `Metric`. Two to six numbers are a small table. A number against a goal is a `BulletGraph`. A number with its direction is a `Metric` plus a `Sparkline`.
3. **Pick the form from the comparison**, not from taste:

| Comparison | Form | Catalog |
|---|---|---|
| Amounts across categories | Bars, sorted by value | `Chart type="bar"` |
| Change over time | Line (bars only for few, separate periods) | `Chart type="line"` with `xGrain` |
| Part of a whole | Bars; a pie only for 2 to 5 slices | `Chart type="bar"` |
| Distribution | Histogram | `Chart type="bar"` with `xBins` |
| Relationship of two measures | Scatter | `Chart type="scatter"` |
| A measure against a target | Bullet graph | `BulletGraph` |
| Trend beside a figure | Sparkline | `Sparkline` |
| Two dimensions at once | Pivot table | `PivotTable` |
| Many series | Small multiples on one scale | several `Chart`s in a `Grid` |

4. **Run `chartAdvice`** (`@surfaces-ui/components`) on the shape and act on what it returns.
5. **Colour last.** Series colours come from the theme in order; pin one with `slot` when a category must keep its colour across charts.

## Rules

**Show the data honestly**
- Bars start at zero. A bar's length is its value.
- One y scale per chart. For two measures of different size, stack two charts on a shared x, or index both to a common start. `axis: "right"` exists for the rare case; `chartAdvice` flags it.
- Keep the picture in proportion to the numbers: no 3D, no perspective, no area or icon sized by a one-dimensional value.
- Say what the data is and when it is from: a title that states the measure, and the "as of" time when a kept result is shown.

**Spend ink on data**
- Remove what carries no information: borders, background fills, heavy grid lines, tick marks, redundant legends.
- Grid lines are faint and few. Axis lines are quiet. The theme does this; do not override it.
- Label directly when there are up to four series. A single series needs no legend; the title names it.
- No decoration: no gradients that encode nothing, no shadows, no pictures behind the data.

**Make comparison easy**
- Sort bars by value unless the categories have a natural order.
- Put things to be compared next to each other, on the same scale.
- Small multiples share one scale. Never let each panel choose its own.
- At most about five lines on one chart. Beyond that, small multiples, or highlight one and grey the rest.
- Stacks: only the bottom segment and the total can be compared. Keep to four or five segments; fold the rest into "Other".

**Keep it readable by everyone**
- Never rely on colour alone: label, order or shape must also carry the meaning.
- Red and green are not opposites for one person in twelve. Use the theme's two-sided scale (red to blue through grey).
- Every chart has a text reading (`Chart` sets one; `Sparkline` and `BulletGraph` write theirs out).
- Offer the table behind the chart (`QueryResult` has both views).

**Let the database do the work**
- A chart over a large table uses an aggregate (`y={[{ column, aggregate }]}`). Never chart "the first N rows".
- A time series sets `xGrain`; a histogram sets `xBins`. Never group by a raw timestamp.

## Review checklist

- [ ] The comparison is stated in the title.
- [ ] The form matches the comparison (table above).
- [ ] Bars start at zero; one y scale.
- [ ] Sorted, or in natural order.
- [ ] No more series than colours; five lines at most.
- [ ] Nothing on the chart that could be removed without losing information.
- [ ] Readable without colour, and there is a text reading and a table.
- [ ] `chartAdvice` returns nothing, or each item is a decision someone made.
