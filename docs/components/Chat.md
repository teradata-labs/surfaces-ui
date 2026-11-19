# Chat

`import { Chat } from "@surfaces-ui/chat";`

A conversation with any agent, on its own: replies hold Markdown, tool steps, approvals and any catalog component drawn inline. Use it inside your own layout; use `AnalyticsChat` for the whole workspace. A thread is a document: open on one with `initialThread` and save every change from `onThreadChange`.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `starters` | string[] |  | Offered as one-press examples before anything is said. |
| `placeholder` | string |  | The message box's placeholder. |
| `empty` | string |  | Shown before anything is said. |
| `height` | integer |  | Height of the whole chat in px. Default 640. |
| `agentId` | string |  | The agent to talk to when the backend has several. |
| `contextPackId` | string |  | Limit the agent to the data in this saved context pack. |
| `storageKey` | string |  |  |
| `user` | object |  | Who is using it, from the host's sign-in: recorded on approvals, events and arrangements. |
| `settings` | object |  | What the person chose: agent, model, provider, skills, connectors and source. Sent with each turn; the backend refuses what it did not offer. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `agent` (required): **Agent.** Any `AgentBackend`. On the page, the scripted demo agent.
- `storage`: **Keep across reloads.** Where to keep the thread (`browserStorage()` from `@surfaces-ui/state`, or your own); checked when it loads.
- `agents`: **Agent menus.** What the backend offers, for the composer's Setup menu. Needs `onSettingsChange`.
- `providers`: **Model providers.** Where models run: the Model menu groups them by provider.

## Callbacks

- `onThreadChange`: The thread after every change, to save it or build from what was drawn.
- `onSettingsChange`: A person changed the agent, model, skills or connectors.
- `onContext`: What a person does in a drawn component.
- `onReferencesChange`: Tables and columns attached to the message being written, when the host holds them.

## Example

```tsx
<Chat
  starters={["Show the data model"]}
  height={560}
  agent={agent}
  onThreadChange={…}
  onSettingsChange={…}
  onContext={…}
  onReferencesChange={…}
/>
```
