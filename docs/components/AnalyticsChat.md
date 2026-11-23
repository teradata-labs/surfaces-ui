# AnalyticsChat

`import { AnalyticsChat } from "@surfaces-ui/chat";`

The chat for data people: the conversation always shown, with a rail of panels beside it for only what the host gives: saved conversations (`sessions`), tables and files to attach (`browse`), and the agent's setup (`agents` or `providers`). Its composer attaches files, switches the model, sets up the agent's skills and connectors, and takes voice behind consent. Every component the agent draws appears in the thread, live.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `starters` | string[] |  | Offered as one-press examples before anything is said. |
| `placeholder` | string |  | The message box's placeholder. |
| `empty` | string |  | Shown before anything is said. |
| `height` | integer |  | Height of the whole chat in px. Default 640. |
| `menuLimit` | integer |  | Items a composer menu shows before "View all…". Default 5. |
| `user` | object |  | Who is using it, from the host's sign-in: recorded on approvals, events and arrangements. |
| `settings` | object |  | What the person chose: agent, model, provider, skills, connectors and source. Sent with each turn; the backend refuses what it did not offer. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `agent` (required): **Agent.** Any `AgentBackend`. On the page, the scripted demo agent answering from a written conversation.
- `sessions`: **Saved conversations.** A Conversations panel to search, filter, sort and group them; every conversation is saved as it goes. `librarySessions(library)` or `memorySessions()`.
- `browse`: **Data panel.** Tables and files to attach to a message, over the source in `settings`.
- `agents`: **Agent setup.** What the backend offers (`DescribeAgents`): agents with their models, skills and connectors, in the Setup menu and panel.
- `providers`: **Model providers.** Where models run, each with its models: the Model menu groups them and a pick sets `provider` and `model`. A model's `level` ({ value, of, label }) is drawn as rising bars beside its word.
- `attachFiles`: **Attach files.** The + menu, drop and paste. The host decides what a file becomes; the agent is told a table or a file by name, never its contents.
- `speech`: **Voice.** Dictation and a spoken conversation, asked for once with `speechConsent` (Chrome sends audio to Google).

## Callbacks

- `onSettingsChange`: A person changed the agent, model, skills or connectors.
- `onContext`: What a person does in a drawn component, as it happens; it also goes with the next turn.
- `onLayoutChange`: Where the panels are, as plain JSON to keep.
- `onConnect`: A connector's sign-in link, for the host to open.

## Example

```tsx
<AnalyticsChat
  starters={["Show the data model","Browse the data"]}
  menuLimit={5}
  height={640}
  agent={agent}
  sessions={sessions}
  browse={browse}
  onSettingsChange={…}
  onContext={…}
  onLayoutChange={…}
  onConnect={…}
/>
```
