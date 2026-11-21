# Releasing

Every `@surfaces-ui/*` package and `create-surfaces` is published together at one version (the `fixed` group in `.changeset/config.json`). The apps (`apps/playground`, `apps/e2e`, `apps/recipes`) are private and never published.

## Each change

A change a consumer would notice gets a changeset in its pull request:

```bash
pnpm changeset
```

CI runs `pnpm check:release` on every pull request, before and after a trial `changeset version`, so anything that would stop a publish (a missing license, description, `files`, `repository` or public access, or a package outside the shared version) fails there and not on release day.

## Cutting a release

1. On GitHub, open Actions, choose **Release** and run it on `main`. With changesets pending it opens a "Version packages" pull request: versions, changelogs and the lockfile.
2. Review and merge that pull request.
3. Run **Release** on `main` again. It builds, tests, runs `scripts/check-release.mjs` and publishes every package whose version is not on npm yet, with provenance.

By hand, the same is `pnpm version-packages`, then `pnpm release` (provenance needs CI, so publish from the workflow).

## How the workflow reaches npm

- **First release: a token.** Make a granular access token on npmjs.com with read and write access to the `@surfaces-ui` scope and to `create-surfaces` (it is a new package, so give it "all packages" for the first run), allowed to publish without a one-time code, with a short expiry. Save it as the repository secret `NPM_TOKEN`. Delete the secret and the token once the release is out.
- **Every release after: trusted publishing.** On npmjs.com, in each package's settings, add a trusted publisher: GitHub Actions, organisation `teradata-labs`, repository `surfaces-ui`, workflow `release.yml`. The workflow then signs in with its own short-lived identity and keeps no secret. A package added later must be published once with a token before it can trust the workflow.

The repository setting "Allow GitHub Actions to create and approve pull requests" (Settings, Actions, General) must be on for step 1.
