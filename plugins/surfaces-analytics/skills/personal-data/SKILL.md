---
name: personal-data
description: Use before a table is shared, exported, charted for a wider audience, joined to another source, or has its values sent to a model - and whenever columns look like they hold personal or sensitive data (names, emails, phones, addresses, IDs, card numbers, birth dates, IPs, health). Gives the review pattern and the treatments, in any tool, drawn with Surfaces UI where it is available. Triggers on "PII", "personal data", "sensitive", "mask", "anonymise", "redact", "GDPR", "HIPAA", "can I share this".
---

# Personal data

The agent flags; a person decides. Use the `review-personal-data` pattern and the `PiiReview` component. This skill is a working method, not legal advice: the person deciding answers for their organisation's rules.

## Method

1. **Flag from names first.** `piiHints(columns)` (`@surfaces-ui/components`) guesses from column names only, so it is safe on any source. It will miss a badly named column; say so.
2. **Scan values only where allowed.** A source must be listed in `allowSampleValues` before any value is read, profiled, embedded or put in context. If it is not, do not sample "just to check".
3. **Show a `PiiReview`** listing every column, flagged or not, with `basis` (`name`, `values` or `person`) and the proposed treatment.
4. **Propose the cautious treatment.** The person may loosen it; you may not.
5. **Wait for the recorded decision** (`confirmed: true`). Apply it exactly.
6. **Build the treated dataset** as a pipeline view beside the original, and point sharing, dashboards and model context at that view.
7. **Keep the decision with the dataset**: who, when, which treatment per column.

## Kinds and default treatment

| Kind | Examples | Default |
|---|---|---|
| Credential | password, token, API key | Leave out |
| Government ID | SSN, passport, tax ID | Leave out |
| Card or account | card number, IBAN | Leave out |
| Health, sensitive traits | diagnosis, religion, ethnicity | Leave out |
| Postal address | street, postcode | Leave out (or generalise to region) |
| Email | email | Hash |
| IP or device ID | ip_address, device_id | Hash |
| Name | first_name, full_name | Mask |
| Phone | phone, mobile | Mask |
| Date of birth | dob, birth_date | Generalise (year or age band) |
| Precise location | latitude, longitude | Generalise (round) |

## Treatments

- **Leave out**: do not select the column. The safest, and the default when in doubt.
- **Mask**: show part (`j***@example.com`, last four digits). For display only; not safe for joining.
- **Hash**: a keyed hash, so joins and distinct counts still work. The key is a secret on the server, referenced by name. An unkeyed hash of an email or phone can be reversed by guessing.
- **Generalise**: a coarser value (birth year, first half of a postcode, rounded coordinates, a band).
- **Keep**: only with a person's decision on record. `PiiReview` calls out every flagged column kept as is.

## Rules

- **Small groups identify people.** Do not show a breakdown whose cells count fewer than about ten people; combine categories or drop the split. Postcode, birth date and gender together identify most people even with the name removed.
- **Free text hides personal data.** Treat notes and comments columns as flagged.
- **Never put values in a prompt, an embedding or an agent context pack** for a source that is not listed.
- **Exports carry everything.** `exportCsv` streams the whole result: review before offering it.
- **Errors and logs**: never echo row values.
- **A certification mark is not a privacy review.**
- **Engine-side masking functions are not built yet** in this library: write the treatment as SQL in the dataset definition, in the source's dialect, and have a person review it.

## Done when

- [ ] Every column was listed; flags show how they were arrived at.
- [ ] A person confirmed the decision, and it was applied exactly.
- [ ] Sharing, dashboards and model context read the treated view.
- [ ] No small cells; no values sent where they are not allowed.
