---
"@surfaces-ui/components": minor
"@surfaces-ui/chat": minor
---

The components an app places itself (`AnalyticsChat`, `Chat`, `PageStudio`, `ThemePicker`, `ConnectionBuilder`, `ModelLineage`, `ChecksPanel`, `ObjectInfo`, `CertificationBadge`, `ItemControls`) are described once as data in `@surfaces-ui/components/app-components` and `@surfaces-ui/chat/app-components`: their plain-data props as JSON Schema, the parts a host supplies in code, their callbacks and an example, each prop checked against the component's props type by `describeAppComponent`. `pnpm docs:gen` writes a page for each to `docs/components`.

`Chat` tells `onThreadChange` about a change of thread only, so a host that passes a new function on every render and sets state in it no longer renders in a loop.
