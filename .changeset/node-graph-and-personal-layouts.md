---
"@surfaces-ui/spec": minor
"@surfaces-ui/components": minor
---

Three things an app built on the catalog needs.

- `NodeGraph`: things and the links between them as a graph (ECharts' graph series), with the same things listed beside it so it works without a pointer. A group takes a colour; a level is how full a node is drawn. In the catalog as `NodeGraph`.
- `extendCatalog(base, { id, title, description, components })`: one catalog that draws everything the base does plus an app's own components.
- A person's own layout of a shipped page, kept as edits and replayed over it (`layoutEdits`, `personalisePage`, `parsePersonalLayout`). A component marked with the `surfaces_locked` extension stays on the page: Arrange can move and size it but not remove it.
