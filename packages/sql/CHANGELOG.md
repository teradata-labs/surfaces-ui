# @surfaces-ui/sql

## 0.3.0

### Patch Changes

- 5f620c2: A view filtered on a column its own rows lack now draws without that filter and says so, instead of failing. A page-wide `FilterBar` by region over a total with no region column used to stop the total drawing ("could not be loaded"). When the engine reports an unknown column, the engine service reads the base query's columns (`columnsQuery`, no rows), drops the filters on missing columns (`withoutMissingFilters`, names compared without regard to case), runs the view again, and adds a `FILTER_COLUMN_MISSING` notice: "Not filtered by region: its rows have no region column." Any other unknown column still fails as before. `memoryDataSource` does the same. `Chart`, `Sparkline`, `BulletGraph`, `Metric`, `PivotTable`, `RowList` and `DataGrid` show the notice under the view in words (`DataNotes`, `role="note"`); `QueryResult` already lists notices with its SQL.
- Updated dependencies [5f620c2]
  - @surfaces-ui/data@0.3.0
  - @surfaces-ui/proto@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [7343db7]
  - @surfaces-ui/data@0.2.0
  - @surfaces-ui/proto@0.2.0

## 0.1.0

### Patch Changes

- Updated dependencies [5812a44]
  - @surfaces-ui/data@0.1.0
  - @surfaces-ui/proto@0.1.0
