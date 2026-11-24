---
"@surfaces-ui/datasource-duckdb-wasm": patch
---

`openBrowserDuckDb` fails when its worker stops (it cannot be loaded, or the browser ends it) instead of waiting for ever, so a host can fall back.
