# Changesets

Every change that a consumer of a published package would notice gets a changeset:

```bash
pnpm changeset
```

All `@surfaces-ui/*` packages and `create-surfaces` share one version (the `fixed` group in `config.json`), so an app never mixes releases. The playground is not published.

Releasing:

1. `pnpm version-packages` applies the pending changesets: versions, changelogs and the lockfile.
2. `pnpm release` builds, tests, runs `scripts/check-release.mjs` and publishes.

In CI the Release workflow does both, and only when started by hand from the Actions tab on `main` (merges do not start it). A first run opens a "Version packages" pull request, which needs the repository setting "Allow GitHub Actions to create and approve pull requests"; a run after that pull request is merged publishes, which needs the `NPM_TOKEN` secret.

`check-release.mjs` refuses to publish while any package is `UNLICENSED` or there is no `LICENSE` file. Every package is Apache-2.0 (`LICENSE` at the root).
