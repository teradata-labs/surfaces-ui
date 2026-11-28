# Conversation

A whole chat in one component: the turns so far, replies to pick, and a box to write in. Sending adds the person's turn to the thread at once and sends `send` with what they wrote. Give `messages` the turns, oldest first, or a data path holding them. Keep the thread there: answer `send` by adding the person's turn and yours to the list, and each is drawn once. For a prototype with no agent, `replies` answer in order, one for each turn the person sends. For one turn on its own, or a thread laid out by hand among other components, use Message.

## Props

- `label`: string — What the conversation is, for assistive technology: "Support chat".
- `messages`: array of { speaker: string, text: string, side?: "start" | "end", time?: string } | binding — The turns so far, oldest first, or a data path holding them. An empty list starts with only the box.
- `you` (optional): string — Who the person is on their own turns. Defaults to "You".
- `suggestions` (optional): array of string — Replies offered under the thread until the person sends something; a press sends one.
- `replies` (optional): array of { speaker: string, text: string } — Scripted answers for a prototype with no agent: the first answers the person's first turn, and so on. Leave it out when an agent answers.
- `placeholder` (optional): string — What the box says while it is empty. Defaults to "Write a message".
- `action` (optional): { event: { name: string, userMessage?: string | binding | call, context?: { [name]: string | number | boolean | array | binding | call } } } | { functionCall: call }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **send**: When a person sends a turn, typed or picked from the suggestions. It is already in the thread. Adds `text` (what they wrote).

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Conversation
  label="Support chat"
  messages={[{ speaker: "Assistant", text: "Hi! What can I help you with today?", time: "10:41" }, { speaker: "You", text: "My last order hasn't arrived.", side: "end", time: "10:42" }, { speaker: "Assistant", text: "Sorry about that. Which order is it?", time: "10:42" }]}
  suggestions={["The one from Monday", "Show my orders"]}
  replies={[{ speaker: "Assistant", text: "Thanks. It left the warehouse yesterday and arrives **tomorrow**." }]}
  action={{ event: { name: "send" } }}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "support",
  "component": "Conversation",
  "label": "Support chat",
  "messages": [
    {
      "speaker": "Assistant",
      "text": "Hi! What can I help you with today?",
      "time": "10:41"
    },
    {
      "speaker": "You",
      "text": "My last order hasn't arrived.",
      "side": "end",
      "time": "10:42"
    },
    {
      "speaker": "Assistant",
      "text": "Sorry about that. Which order is it?",
      "time": "10:42"
    }
  ],
  "suggestions": [
    "The one from Monday",
    "Show my orders"
  ],
  "replies": [
    {
      "speaker": "Assistant",
      "text": "Thanks. It left the warehouse yesterday and arrives **tomorrow**."
    }
  ],
  "action": {
    "event": {
      "name": "send"
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "support",
  "elements": {
    "support": {
      "type": "Conversation",
      "props": {
        "label": "Support chat",
        "messages": [
          {
            "speaker": "Assistant",
            "text": "Hi! What can I help you with today?",
            "time": "10:41"
          },
          {
            "speaker": "You",
            "text": "My last order hasn't arrived.",
            "side": "end",
            "time": "10:42"
          },
          {
            "speaker": "Assistant",
            "text": "Sorry about that. Which order is it?",
            "time": "10:42"
          }
        ],
        "suggestions": [
          "The one from Monday",
          "Show my orders"
        ],
        "replies": [
          {
            "speaker": "Assistant",
            "text": "Thanks. It left the warehouse yesterday and arrives **tomorrow**."
          }
        ],
        "action": {
          "event": {
            "name": "send"
          }
        }
      }
    }
  }
}
```
