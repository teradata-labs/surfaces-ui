---
name: data-cleaning
description: Use when asked to clean, fix, tidy, deduplicate, standardise or check the quality of a table or dataset, with or without Surfaces UI. Profile first with the database, propose each fix as a reviewable step, keep the original, and report before and after. Triggers on "clean", "dedupe", "duplicates", "missing values", "nulls", "outliers", "standardise", "data quality", "fix this column".
---

# Data cleaning

Cleaning changes what the numbers say, so every fix is proposed, counted and approved. Use the `review-a-cleaning-plan` pattern.

## Method

1. **Profile, in the database.** `ObjectDetail` / `ColumnProfile` give counts, missing, distinct (estimates, shown with "~"), ranges. Use grouped queries for the rest. Never pull rows into the browser to inspect them.
2. **Find problems by type** (table below). For each, count the affected rows with a query.
3. **Propose a plan** as a `PlanReview`: one step per fix, with the count, the SQL it would run, and its risk.
4. **Wait for approval.** Apply only the ticked steps.
5. **Keep the original.** Build a cleaned view or table beside it (a pipeline dataset), never an in-place overwrite.
6. **Add a rule** so the problem is caught next time (a pipeline expectation: warn, drop or fail).
7. **Report** before and after counts, and anything that could not be fixed.

## Problems and fixes

| Problem | How to find it | Fix | Risk |
|---|---|---|---|
| Spaces, case, stray punctuation | `COUNT(*) WHERE col <> TRIM(col)`; group by `LOWER(col)` | `TRIM`, one case | low |
| Empty string used for missing | `COUNT(*) WHERE col = ''` | `NULLIF(col, '')` | medium: counts change |
| Mixed formats (dates, phones, codes) | Group by a pattern or length | Parse to one type; keep unparsed rows aside | medium |
| Wrong type (numbers as text) | `TRY_CAST` failures counted | Cast; list failures | medium |
| Exact duplicates | Group by all columns, `HAVING COUNT(*) > 1` | Keep one | high |
| Duplicate keys | Group by key, `HAVING COUNT(*) > 1` | Keep one by a stated rule (latest) | high: may be amendments |
| Missing values | `COUNT(*) - COUNT(col)` | Leave missing and say so; fill only with a stated rule | high if filled |
| Outliers | Percentiles; values beyond a stated bound | Flag in a column; do not delete | high if removed |
| Impossible values | Negative amounts, future dates | Flag; add a rule | medium |
| Broken references | Anti-join to the parent table | Report; do not invent parents | medium |
| Inconsistent categories | Group and count near-duplicates | Map to one, with the mapping shown | medium |

## Rules

- **Count before you propose.** "412 of 58,000 rows", from the database.
- **Removing or replacing is `risk: "high"`** and starts unticked.
- **Prefer flag to delete, and view to overwrite.**
- **Never fill a missing value silently.** A filled value is a guess; label it.
- **Dates and times are UTC** in this library, whatever the server's zone.
- **SQL must be valid for the source's dialect** (no `LIMIT` on Teradata: use `TOP` or `QUALIFY`). Each dataset is a single read-only `SELECT`.
- **A client never sends SQL for a pipeline to run.** Approval produces a dataset definition that a person adds to `surfaces.config.ts`.
- **Values are withheld by default.** On a source not in `allowSampleValues`, work from counts and patterns, not sample rows.

## Step shape

```json
{ "id": "blank", "title": "Treat an empty customer as missing", "kind": "Clean",
  "affects": "88 of 58,000 rows", "risk": "medium",
  "detail": "Counts of customers will drop by the rows that had an empty value.",
  "sql": "SELECT NULLIF(customer, '') AS customer FROM orders" }
```

## Done when

- [ ] Every fix was counted, shown and approved.
- [ ] The original is intact; the cleaned result is a separate dataset.
- [ ] A rule guards each fixed problem.
- [ ] Before and after counts were reported, with what remains.
