---
name: dashboard-design
description: Use when composing, editing or reviewing a dashboard, page or view made of several Surfaces UI components (a PageDocument or an A2UI surface). Applies Stephen Few's dashboard principles: one screen, the most important thing first, dense but quiet. Triggers on "dashboard", "build a page", "overview page", "KPI page", "lay out", "review this dashboard".
---

# Dashboard design (after Few)

A dashboard is what someone needs to see at a glance to know whether anything needs their attention. It is not a report and not a place to explore; link to those.

## Method

1. **Name the reader and their question.** "A sales lead, each morning: are we on track this quarter, and where not?" Everything on the page answers it or goes.
2. **List the measures**, at most about seven. For each, write what it is compared with (target, last period, forecast). A number with nothing to compare against is not information.
3. **Choose the smallest display** for each (see the chart-standards skill): `Metric` + `Sparkline`, `BulletGraph`, a short table, then a `Chart`.
4. **Lay out by importance.** Top left is read first. Headline figures in a `Grid` across the top, the main trend below, breakdowns after, detail table last.
5. **Fit one screen** at the reader's usual size. If it scrolls, cut or move detail to a linked page.
6. **Check it** with the list at the end.

## Rules

- **One screen, no scrolling**, for the monitoring view. Detail lives a click away (`onRowClick`, a link, a second page).
- **Context for every number**: target, prior period or a band. Prefer `BulletGraph` to a bare figure when a target exists.
- **No gauges, dials, traffic lights or 3D.** They spend most of their space on decoration. A bullet graph says the same in a line.
- **Quiet by default, loud only for exceptions.** Chrome is near-neutral; colour belongs to data; an alert colour appears only where something needs attention, always with a word or symbol too.
- **Consistent across the page**: the same measure has the same name, format, colour (`slot`) and time grain everywhere.
- **Group related things** by placing them together with space between groups, not with boxes around everything.
- **Do not repeat**: one legend for charts that share series; one filter bar for the page (`createViewState` for cross-filtering).
- **Enough precision, no more**: `format="compact"` or `currency` for headline figures; full precision in the table.
- **State freshness**: show when the data is as of.
- **Every view of one run shares `notBefore`**, so the page is one consistent moment and the backend runs each query once.

## In this library

- A page is a `PageDocument` (`@surfaces-ui/spec`); validate with `validatePage`, edit with `editPage`. Examples: `apps/playground/src/examples.ts`.
- Layout: `Column`, `Row`, `Grid` (`columns`), `Card`, `Tabs`. `Grid` drops to fewer columns in a narrow space by itself.
- A dashboard built by an agent goes through the same catalog: nothing outside it is drawn.

## Checklist

- [ ] The reader and their question are written down, and every element serves it.
- [ ] Seven measures or fewer; each has something to compare against.
- [ ] Most important at top left; fits one screen.
- [ ] No gauge, dial, pie with many slices, or decoration.
- [ ] Alert colour only on exceptions, never colour alone.
- [ ] Names, formats, colours and grains are consistent.
- [ ] Data time is shown. Works at phone width and with a keyboard (see responsive-accessible-ui).
