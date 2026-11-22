---
"@surfaces-ui/components": minor
---

Components for the rows an app holds, so an admin or settings page needs no table of its own:

- `DataTable`: a table of the host's rows with sortable headings (it asks; the host sorts), check boxes for rows and the page, each row's `ItemControls` and a right-click menu, and columns that give way as the table narrows. It sorts, filters and pages nothing itself.
- `SelectionBar`: the count, the actions for the chosen rows (one that takes away last), Clear, and "Select all N that match" past the page.
- `Pagination`: "51–100 of 126" with Previous and Next.
- `ConfirmDialog` and `useConfirm()`: a modal dialog that asks before an action that is hard to undo; `await confirm({ ... })` is true or false.
- `StatusBadge`: a short status in words with a tone's colour and shape.
- `Combobox`: a text box with suggestions the host searches for (the ARIA 1.2 combobox).

`ItemControls` has three more icons for a row's own actions: `power`, `sign-out` and `more`. New labels (`table.*`, `selection.*`, `pages.*`, `confirm.*`, `combobox.*`) can be replaced with `setLabels`.
