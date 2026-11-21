# Message

One turn of a conversation, for a page that is laid out as a chat: who spoke, what they said (Markdown), and when. Put the turns in a Column, oldest first. `side: "end"` sets the person's own turns apart from everyone else's; the speaker is always written, so the side is never the only sign. Offer replies with Chips after the last turn, and take a typed one with a TextField and a Button. It shows a conversation; it does not run one.

## Props

- `speaker`: string | binding | call — Who spoke: a name or a role.
- `text`: string | binding | call — What they said, as Markdown.
- `side` (optional): "start" | "end" — "end" for the person's own turns. Defaults to "start".
- `time` (optional): string | binding | call — When, as it should read: "10:42" or "Yesterday".
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Message speaker="Assistant" text="Which table holds the articles?" time="10:42" />
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "turn-1",
  "component": "Message",
  "speaker": "Assistant",
  "text": "Which table holds the articles?",
  "time": "10:42"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "turn-1",
  "elements": {
    "turn-1": {
      "type": "Message",
      "props": {
        "speaker": "Assistant",
        "text": "Which table holds the articles?",
        "time": "10:42"
      }
    }
  }
}
```
