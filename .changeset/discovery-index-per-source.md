---
"@surfaces-ui/discovery": patch
---

The search index is built one source at a time. A table detail, its related tables or a search scoped to one source now waits only for that source, not for every source the server has. Before this, a large catalog (a Teradata system can take minutes) held up every discovery request after a server start, and those waiting requests used up the browser's connections to the server, so other queries on the page waited too. A search across every source still waits for all of them.
