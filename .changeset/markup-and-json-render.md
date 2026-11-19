---
"@surfaces-ui/spec": minor
---

Write a surface three ways. `analyticsMarkup` (from `@surfaces-ui/spec/react`) draws catalog components written as JSX (`<Ui.Metric … />`), `toMarkup` and `toJsonRender` write components back as JSX or a json-render spec, and `markupComponents` reads JSX into components. `fromJsonRender` now takes any type that names a catalog component as that component (an explicit `typeMap` still wins, and a `Table` with `sql` is still a `DataGrid`). `defineCatalog` adds `names`, the catalog's component names, typed. The generated component pages show each example as JSX, A2UI and json-render.
