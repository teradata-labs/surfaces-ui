# Ask a person before a query runs

An agent that wants to run SQL shows it to a person first. The person can allow it, deny it, or edit it and allow their version. Only what they allowed runs, and only after the agent has checked the answer.

How it works:

- A tool with an `approval` function pauses the turn: the agent sends an `approval` event with the SQL, a subject and a digest of both, and stops.
- `Chat` shows it as an approval card. When the person decides, the card sends who decided, when, why, any edit, and the digest of exactly what they saw.
- On the next turn the agent calls `checkApproval`. It refuses an answer whose digest does not match, one that has expired, one missing a required reason, or one from someone `mayDecide` rejects. Only then does it call `run` with `approved.sql`, which is the person's version if they edited it.
- A refusal or a failed check goes back to the model as the tool's result, so the model can explain it or try something else. Nothing runs.

The tool:

{{file: tools.ts}}

On the server, give it to Claude:

{{file: agent.ts}}

In the browser nothing special is needed. `Chat` draws the card, and `user` says who is deciding:

```tsx
<Chat agent={connectAgent({ baseUrl: "http://localhost:5220" })} user={{ id: session.userId, name: session.name }} />
```

For changes that cannot be undone, set `risk: ApprovalRisk.IRREVERSIBLE`: the card then asks the person to type "confirm". Set `approvalsRequired: 2` to need two different people, and `reasonRequired: true` to make each of them say why. Then report what ran with an `ActionReceipt`.

The test drives the real `Chat` against a stand-in model and the in-memory data source:

{{file: approval.test.tsx}}
