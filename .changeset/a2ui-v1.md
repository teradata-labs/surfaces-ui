---
"@surfaces-ui/spec": minor
---

Surfaces now speaks A2UI v1.0, the current version of the protocol, and still reads v0.9.

What changes in what the library writes and accepts:

- A binding is `{ "@path": "/a" }` and a function call `{ "@call": "name", "args": {} }`.
- A component's `accessibility` is `@accessibility`, and a component may name its catalog with `@catalogId`.
- `createSurface` is sent once for a surface, may carry its first `components` and `dataModel`, and no longer takes `theme`. A surface's theme and its reply contracts are the `surfaces_theme` and `surfaces_expects` extensions in `createSurface.metadata`.
- `updateDataModel` needs a `value`; `null` removes what is at the path.
- Metadata that is never drawn travels in A2UI's `extensions`: `@metadata` on a component, `metadata` on a surface and an action, and `metadata` on a json-render element and spec.

Nothing saved breaks: a v0.9 message, page, surface or conversation is turned into v1.0 when it is read (`upgradeMessage`, `upgradePage`, `upgradeSurface`). Code that builds components by hand needs `{ "@path": … }` where it wrote `{ path: … }`; `binding("/a")` writes one.

Not taken up from v1.0 yet: functions called across the wire, several catalogs in one surface, `allowedParents`, `@checks` and `@index`.
