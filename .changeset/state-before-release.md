---
"@surfaces-ui/data": minor
"@surfaces-ui/state": minor
"@surfaces-ui/components": minor
"@surfaces-ui/spec": minor
"@surfaces-ui/devtools": minor
---

State is held one way across the library.

- The plain filter form (`FilterSpec`, `filtersFromSpec`, `toggleValueFilter` and the rest) lives in `@surfaces-ui/data`; `@surfaces-ui/components` still exports it. New: `parseFilterSpecs`, `parseSortSpecs`, `chosenValues`, `selectValues`.
- `createViewState` holds `{ filters: FilterSpec[], sorts: SortSpec[] }`, the form page filters and agents use, and gains `setFilters`. `parseViewState` still reads the older `{ selections, ranges }`.
- A second click on a bar adds its value to the filter (`in`) and a click on a chosen bar takes it out, in hand-built dashboards, reports and agent-drawn pages alike.
- One storage interface: `StateStorage`, `memoryStorage` and `browserStorage` are in `@surfaces-ui/data` (and still in `@surfaces-ui/state`); `LibraryStorage` is gone. `ThemeProvider` takes `storage` and `storageKey` in place of `store`, and `SurfacesDevTools` takes `storage`.
- `persist` puts a part saved with `select` back without losing the rest (or through `restore`), and a change made while the saved value loads is no longer overwritten. The same holds for the theme.
- `ReadableStore` names what `derive` returns and `useStore` reads.
