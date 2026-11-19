# PageStudio

`import { PageStudio } from "@surfaces-ui/chat";`

A page beside an instruction box: a person says what to change, an agent answers with A2UI, and its reply becomes page edits checked against the catalog. Each instruction is one undo step and the log says who made each change. With `arrange`, a person can also lay the page out by hand (drag, side by side, heights and widths, all by keyboard too): each arrangement is one undo step, logged by them, and told to the agent with the next instruction.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `starters` | string[] |  | Offered as one-press examples before anything is said. |
| `arrange` | boolean |  | Offer Arrange beside Undo and Redo. |
| `user` | object |  | Who is using it, from the host's sign-in: recorded on approvals, events and arrangements. |
| `settings` | object |  | What the person chose: agent, model, provider, skills, connectors and source. Sent with each turn; the backend refuses what it did not offer. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `agent` (required): **Agent.** Any `AgentBackend`. On the page, the scripted demo agent that edits dashboards.
- `page` (required): **Page.** The `PageDocument` to start from: a dashboard from the gallery.
- `providers`: **Model providers.** Where models run: the Model menu groups them by provider.

## Callbacks

- `onChange`: The page after each change, to save it.
- `onSettingsChange`: A person changed the model.

## Example

```tsx
<PageStudio
  arrange
  user={{"id":"you","name":"you"}}
  agent={agent}
  page={page}
  onChange={…}
  onSettingsChange={…}
/>
```
