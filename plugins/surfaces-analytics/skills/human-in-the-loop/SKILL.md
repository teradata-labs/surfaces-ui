---
name: human-in-the-loop
description: Use whenever an agent doing data work must stop for a person - an approval, a choice between options, a credential only they can add, or anything that changes, removes, shares or costs. Gives the decision-card and review patterns for Surfaces UI chat and A2UI surfaces. Triggers on "approve", "confirm", "ask the user", "decision card", "HITL", "human in the loop", "before I run this", "which should I use".
---

# Human in the loop

An agent proposes; a person decides. The patterns are defined once in `packages/spec/src/patterns.ts`, generated to `docs/catalog/patterns.md`, and drawn live on the docs app's Patterns page. Copy the shape and fill in your content.

## When to stop and ask

| Situation | Pattern | Component |
|---|---|---|
| Two sources or definitions disagree | `choose-between-sources` | `DecisionCard` |
| Connecting or registering data | `connect-a-source` | `StepFlow` + `PlanReview` |
| A new person or a new dataset | `onboard-to-a-dataset` | `StepFlow` + `Chips` |
| Proposed fixes to data | `review-a-cleaning-plan` | `PlanReview` |
| Data that may be personal, before sharing or sending to a model | `review-personal-data` | `PiiReview` |
| New datasets or a pipeline change | `review-a-transformation` | `StepFlow` + `PlanReview` |
| Destroying, replacing or widening access | `confirm-something-irreversible` | `DecisionCard` |
| Anything that changed, after it ran | `report-what-ran` | `ActionReceipt` |
| A record a person must keep | `collect-a-decision-in-a-form` | `Form` |
| SQL you want run | (no pattern needed) | `SqlProposal` |

Do not ask when the action is read-only, cheap and what was requested: run the query, show the result, say what you did.

## Rules for every decision

1. **One decision per card.** Never join two questions with "and".
2. **Say what happens for each choice**, including what is lost and whether it can be undone.
3. **Recommend one option and put it first**, with the reason. When an action is destructive, the safe option is the recommendation.
4. **Risky starts unticked.** In a `PlanReview`, mark anything that removes or overwrites data or widens access `risk: "high"`.
5. **Show the evidence**: row counts worked out by the database, the SQL that would run, who certified a table.
6. **Wait.** An approval pauses the turn. Silence, a timeout or an earlier yes to something else is not a yes.
7. **Do exactly what was approved.** Use the event context (`choice`, `stepIds`, `columns`); do nothing that was left unticked.
8. **Record it**: who decided, when, and any note, taken from the answer (`decided_by`, `decided_at`, `reason`; `actor` on a surface event). Report the outcome afterwards in an `ActionReceipt` with the same counts.
9. **Never ask for a secret in chat.** Name the secret; the person adds it on the server.
10. **Say who is speaking.** Set `proposedBy`, and keep "Answered by" visible.

## Approvals that pause the turn

For anything that changes data, send an `ApprovalRequest` (in `agent.proto`) rather than a card. It holds the things a card cannot:

| Field | Use |
|---|---|
| `sql`, `subject` | Exactly what will run or change. `subject` is structured (a plan, a config) and shown as JSON |
| `digest` | `withDigest(request)` from `@surfaces-ui/agent`. The client refuses to offer approval if it does not match, and sends the digest of what the person approved back |
| `risk` | `HIGH` for changes; `IRREVERSIBLE` makes the person type "confirm" |
| `expires_at`, `basis` | When the ask goes stale, and what data it was based on. Ask again after it expires |
| `editable` | The person may change the SQL or subject; the answer carries their version |
| `reason_required` | The person must say why |
| `approvals_required`, `approvals` | Two-person rule: send the decisions so far with the request each time |

On your backend, before acting, call `checkApproval(request, answer)`. It refuses a wrong digest, an expired request, a missing reason, an edit to a request that was not editable and the same person twice; pass `mayDecide` for your own rule on who may approve. Run `check.sql` and `check.subject`, which are the person's version when they edited it. `decided_by` comes from the client: check it against your own session.

## Shapes

Decision:

```json
{ "id": "card", "component": "DecisionCard", "title": "Which revenue should I use?",
  "detail": "The two tables differ by 2.1% for March because one includes returns.",
  "options": [
    { "id": "ledger", "label": "Finance ledger", "description": "Certified. Net of returns.", "recommended": true },
    { "id": "orders", "label": "Orders table", "description": "Not certified. Gross." } ],
  "action": { "event": { "name": "source_chosen" } } }
```

Plan:

```json
{ "id": "plan", "component": "PlanReview", "title": "Clean the orders table", "proposedBy": "Analyst agent",
  "steps": [
    { "id": "trim", "title": "Trim spaces around region", "kind": "Clean", "affects": "412 of 58,000 rows" },
    { "id": "dedupe", "title": "Keep one row per order ID", "affects": "37 rows left out", "risk": "high" } ],
  "action": { "event": { "name": "cleaning_decided" } } }
```

Progress with a pause: a `StepFlow` step with `status: "waiting"` and a `detail` saying what you need.

## Multi-step work

- Show the whole path first (`StepFlow`), so the person knows how long it is.
- Update the same surface as steps finish; do not post a new card per step.
- One `waiting` step at a time. When the person acts, mark it `done` and move on.
- On failure, mark the step `failed`, say what went wrong in plain words, and offer the next move as a `DecisionCard` (retry, skip, stop).

## Check before sending

- [ ] Validates against the catalog (`analyticsCatalog.validateMessage`).
- [ ] Each control has an `action`, and you handle its event.
- [ ] The card still makes sense to someone who reads only the card.
- [ ] Works with a keyboard and at chat-column width (the components do; do not wrap them in fixed-width rows).
