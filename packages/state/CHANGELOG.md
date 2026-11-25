# @surfaces-ui/state

## 0.3.0

### Patch Changes

- Updated dependencies [5f620c2]
  - @surfaces-ui/data@0.3.0
  - @surfaces-ui/proto@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [7343db7]
  - @surfaces-ui/data@0.2.0
  - @surfaces-ui/proto@0.2.0

## 0.1.0

### Minor Changes

- 5812a44: State is held one way across the library.
  
  - The plain filter form (`FilterSpec`, `filtersFromSpec`, `toggleValueFilter` and the rest) lives in `@surfaces-ui/data`; `@surfaces-ui/components` still exports it. New: `parseFilterSpecs`, `parseSortSpecs`, `chosenValues`, `selectValues`.
  - `createViewState` holds `{ filters: FilterSpec[], sorts: SortSpec[] }`, the form page filters and agents use, and gains `setFilters`. `parseViewState` still reads the older `{ selections, ranges }`.
  - A second click on a bar adds its value to the filter (`in`) and a click on a chosen bar takes it out, in hand-built dashboards, reports and agent-drawn pages alike.
  - One storage interface: `StateStorage`, `memoryStorage` and `browserStorage` are in `@surfaces-ui/data` (and still in `@surfaces-ui/state`); `LibraryStorage` is gone. `ThemeProvider` takes `storage` and `storageKey` in place of `store`, and `SurfacesDevTools` takes `storage`.
  - `persist` puts a part saved with `select` back without losing the rest (or through `restore`), and a change made while the saved value loads is no longer overwritten. The same holds for the theme.
  - `ReadableStore` names what `derive` returns and `useStore` reads.

### Patch Changes

- Updated dependencies [5812a44]
  - @surfaces-ui/data@0.1.0
  - @surfaces-ui/proto@0.1.0
