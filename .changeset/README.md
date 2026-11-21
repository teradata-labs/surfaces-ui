# Changesets

Every change that a consumer of a published package would notice gets a changeset:

```bash
pnpm changeset
```

All `@surfaces-ui/*` packages and `create-surfaces` share one version (the `fixed` group in `config.json`), so an app never mixes releases. The playground is not published.

Cutting a release, and how the Release workflow reaches npm, is in [docs/releasing.md](../docs/releasing.md).

`check-release.mjs` refuses to publish while any package is `UNLICENSED`, has no `repository` pointing at this repository (npm checks provenance against it), or sits outside the `fixed` group. Every package is Apache-2.0 (`LICENSE` at the root).
