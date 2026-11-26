# @surfaces-ui/discovery

## 0.4.0

### Patch Changes

- @surfaces-ui/data@0.4.0
  - @surfaces-ui/proto@0.4.0

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

### Patch Changes

- 582569d: The search index is built one source at a time. A table detail, its related tables or a search scoped to one source now waits only for that source, not for every source the server has. Before this, a large catalog (a Teradata system can take minutes) held up every discovery request after a server start, and those waiting requests used up the browser's connections to the server, so other queries on the page waited too. A search across every source still waits for all of them.
- Updated dependencies [5812a44]
  - @surfaces-ui/data@0.1.0
  - @surfaces-ui/proto@0.1.0
