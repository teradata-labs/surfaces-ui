# `apps/recipes`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Path | What it is |
|---|---|
| `apps/recipes` | Recipes: each folder is `recipe.md`, the source it shows and a test. `pnpm docs:gen` writes `docs/recipes`, splicing the tested source in at each `{{file: x}}` line. A recipe is not done until its test passes. |
