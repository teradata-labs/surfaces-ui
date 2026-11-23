---
"@surfaces-ui/tokens": minor
"@surfaces-ui/components": minor
"@surfaces-ui/spec": minor
---

A host can add its own named themes beside the built-in presets: `ThemeProvider` takes `themes`, and a page's `theme`, an agent surface's `surfaces_theme` and `ThemePicker` choose them by name. `applyThemeRequest`, `editPage` and `presetByName` take the same list as an option. A built-in name always means the built-in preset.
