# Recipes

Each folder under `src/` is one recipe: `recipe.md` (the prose), the source files it shows, and a test that runs them against in-memory backends. `pnpm docs:gen` writes `docs/recipes/<name>.md`, replacing each `{{file: name}}` line in `recipe.md` with that file's contents, so the docs show code that is tested. Never edit `docs/recipes` by hand.
