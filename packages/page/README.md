<!-- own readme -->
# @surfaces-ui/page

Surfaces UI pages for plain HTML: one script and one stylesheet, no build
step, no npm in the page. For hosts that load their scripts with
`<script src>` from their own files (an app's web view, a static site).

```html
<link rel="stylesheet" href="surfaces-page.css">
<script src="echarts.js"></script>          <!-- the full ECharts build, your own copy -->
<script src="surfaces-page.js"></script>    <!-- defines window.surfaces -->
<div id="app"></div>
<script>
  const page = {
    id: "bills", title: "Bills", catalogId: "urn:surfaces:catalog:analytics:v1",
    components: [
      { id: "root", component: "Column", children: ["title", "chart"] },
      { id: "title", component: "Text", text: "Monthly bills", variant: "h1" },
      { id: "chart", component: "Chart", sourceId: "page", sql: "SELECT * FROM bills",
        type: "line", x: "due", xGrain: "month", y: [{ column: "amount", aggregate: "sum" }] },
    ],
    data: { tables: { bills: [{ due: "2026-01-05", amount: 80 }, { due: "2026-02-05", amount: 95 }] } },
  };
  const view = surfaces.mountPage(document.getElementById("app"), page, { theme: "Berry" });
  // view.update(nextPage) redraws in place; view.unmount() removes it.
</script>
```

- **Data.** Components read the page's own rows, `data.tables`, as source
  `"page"` (`pageDataSource` from `@surfaces-ui/data`): missing keys are null
  and columns of ISO dates are dates. Pass `dataSource` to read elsewhere.
- **Theme.** `theme` is a preset's name or a whole theme; `mode` is
  `"light"`, `"dark"` or `"system"`.
- **ECharts is not inside.** Charts use the page's `window.echarts`, so a
  host that already ships ECharts does not carry a second copy. Load the
  full build (every chart registered) before this script. A page without
  charts does not need it.
- **React is inside**, so the page needs nothing else.

Build with `pnpm --filter @surfaces-ui/page build`; the files are in `dist/`.
