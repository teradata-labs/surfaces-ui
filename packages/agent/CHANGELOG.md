# @surfaces-ui/agent

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

### Minor Changes

- caab7c1: Fixes and catalog additions from the Surfaces Studio pressure tests.
  
  - `extractSurfaces` reads an A2UI message written over several lines, and a list of messages; a block holding text that is not a message ends in one `error` event (`UNREAD_SURFACE`) instead of losing the change in silence.
  - The catalog prompt writes every prop's shape (`array of { column: string, desc?: boolean }`; `shapeText`), lists each function's arguments, and shows both forms of a control's `action`. A value that fits no form of a union is refused with the problems of the closest form, never a bare "Invalid input".
  - `formatString` takes `${path|words}` for a value that is not there yet.
  - New catalog components: `RowList` (one component drawn per row of a query, with the row's key in a Button's event; `RowList` in `@surfaces-ui/components`) and `Message` (one turn of a conversation).
  - Every catalog component takes `visibleWhen: { path, equals }` (or `in`). `TextField`, `NumberField`, `ChoicePicker`, `CheckBox` and `DateTimeInput` take `required` (`TextField` also `pattern`) and say what is wrong beside the field once it has been left.
  - Charts: a row with no x is left off a time or number axis and no longer sizes the y axis, and the chart says so; axis titles are placed from their tick labels and no longer clipped.
  - Series colours: every named order is rearranged so any two of its first five colours can be told apart, not only neighbours (blue and indigo no longer both lead). `checkSeries` reports such pairs. A saved theme holding an earlier order is moved to the current one when read.
  - `SideNav`: the menu button of a folded navigation sits in its own container (sticky), not fixed to the window, and tells what follows it the room to leave (`--sf-sidenav-inset`); its accessible name no longer says "navigation" twice.
  - `KeyValue` rows are no wider than 36rem, so a label and its value stay a pair on a wide page.
  - Seeds: a seed number above 22018 no longer overflows a 32-bit integer in DuckDB.

### Patch Changes

- Updated dependencies [7343db7]
  - @surfaces-ui/data@0.2.0
  - @surfaces-ui/proto@0.2.0

## 0.1.0

### Patch Changes

- Updated dependencies [5812a44]
  - @surfaces-ui/data@0.1.0
  - @surfaces-ui/proto@0.1.0
