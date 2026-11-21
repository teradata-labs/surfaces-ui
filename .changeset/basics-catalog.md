---
"@surfaces-ui/spec": minor
---

`basicsCatalog`: the components every catalog shares (layout, text, links, buttons, inputs and forms, navigation and the theme switch) as a catalog of their own, with `basicComponents` and `basicsRenderers`. The analytics catalog is built on the same definitions and is unchanged. A catalog that needs no data components can now be built with `extendCatalog(basicsCatalog, …)`.
