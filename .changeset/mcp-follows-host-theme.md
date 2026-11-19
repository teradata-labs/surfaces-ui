---
"@surfaces-ui/tokens": minor
"@surfaces-ui/mcp": minor
---

The MCP app page follows the host's colours as well as its light or dark mode. It reads `hostContext.styles.variables` and takes the nearest preset with the host's own accent and corner radius (`themeFromHostStyles`); a host that shares no colours leaves it on the default theme. `hostStyleVariables(theme, mode)` writes a theme as those variables for a host that embeds the page.
