---
"@surfaces-ui/spec": patch
---

`analyticsMarkup` draws with the renderers loaded on first use, so a page written with a few `Ui.*` elements no longer loads every chart, editor and grid up front. Use `createMarkup(analyticsCatalog, analyticsRenderers)` for the renderers loaded at once.
