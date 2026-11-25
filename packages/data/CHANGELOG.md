# @surfaces-ui/data

## 0.3.0

### Patch Changes

- 5f620c2: A view filtered on a column its own rows lack now draws without that filter and says so, instead of failing. A page-wide `FilterBar` by region over a total with no region column used to stop the total drawing ("could not be loaded"). When the engine reports an unknown column, the engine service reads the base query's columns (`columnsQuery`, no rows), drops the filters on missing columns (`withoutMissingFilters`, names compared without regard to case), runs the view again, and adds a `FILTER_COLUMN_MISSING` notice: "Not filtered by region: its rows have no region column." Any other unknown column still fails as before. `memoryDataSource` does the same. `Chart`, `Sparkline`, `BulletGraph`, `Metric`, `PivotTable`, `RowList` and `DataGrid` show the notice under the view in words (`DataNotes`, `role="note"`); `QueryResult` already lists notices with its SQL.
- @surfaces-ui/proto@0.3.0

## 0.2.0

### Minor Changes

- 7343db7: The rest of three issues from the Surfaces Studio pressure tests.
  
  - Series colours can be told apart with red-green colour blindness: any two of an order's first five now differ for those readers too, because the series hues no longer share one lightness (on light surfaces red is a crimson and green a forest green, pink and magenta are deeper; on dark surfaces green and teal are brighter). `HUES` holds the new steps and `RETIRED_HUES` the old; a saved theme using a named order is moved to them when read (`currentSeries`, `currentHue`). `checkSeries` warns about two of the first five that only colour blindness brings together.
  - A `Button` waits for loose inputs it names in `requires`: while one is missing or wrong it is marked unavailable, and a press sends nothing, says what is wrong beside each and moves to the first (`useInputCheck`, `useRequiredInputs` for your own renderers).
  - A `Form` field takes `visibleWhen: { field, equals }` (or `in`): it is asked for only while another field holds that value, and is not required and stored as null otherwise. `FormField.visible_when` in the contract, `fieldAsked` in `@surfaces-ui/data`, checked the same way by `checkSubmission`.
  - A folded `SideNav` keeps a slim strip for its menu button instead of floating over the page, so nothing needs to step aside for it (`--sf-sidenav-inset` is gone). Its drawer opens over the surface it is drawn in, not the window, when it is inside one, and it folds for a narrow surface as it does for a narrow window.

### Patch Changes

- Updated dependencies [7343db7]
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

- @surfaces-ui/proto@0.1.0
