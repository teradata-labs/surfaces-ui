# A chat for analytics users

`AnalyticsChat` is a chat for people who work with data. The conversation is always there; everything else appears only when you pass its prop:

- `sessions`: saved conversations, listed in a Conversations panel to search, filter, sort and group, and each conversation saved as it goes.
- `attachFiles`: a `+` button, and files dropped or pasted on the box. Any file is offered (`accept` narrows the picker); your function says which became data (a `DataRef`), which is a picture to show as a thumbnail (`attachment`), which it handled itself (`taken`) and why the others did not.
- `browse`: an "Add data" button and a Data panel with tables (`ObjectBrowser`) and files (`FileBrowser`). Names go to the agent, never values.
- `agents`: a Model menu, and one Agent setup menu whose sections (Agent, Skills, Connectors) open in place, filled from `DescribeAgents`. Short lists are menus in the composer; each ends in "View all…" or "Manage…", which opens its panel on the rail to the right.
- `speech`: a microphone that dictates, and a Talk button for a spoken conversation that sends after a pause, reads the reply and listens again. It stops when a reply needs a decision.

Send is a round arrow. With none of these props it is a plain conversation with no workspace.

The agent says what a person may choose. `offer` on `toolCallingAgent` lists the models, skills (text added to the system prompt while on) and connectors (sets of tools, on or off). The backend refuses anything it did not list:

{{file: agent.ts}}

The page asks the agent what it offers and keeps conversations in a surface library, so they also show in a Library as saved surfaces of kind conversation. With your server, `connectAgent({ baseUrl })` from `@surfaces-ui/client-connect` has both `send` and `describeAgents`:

{{file: App.tsx}}

Voice listens only once the person agrees: pass `speechConsent` and the microphone's first press asks, saying where audio goes; or pass `speech` only after they turned it on. `browserSpeech()` uses the browser's own speech service; in Chrome that sends audio to Google, and its `label` says so. Pass your own `SpeechAdapter` to use another service.

The test picks a model from the menu, sends a question, sees that the turn ran on that model, and finds the conversation in the library:

{{file: analytics-chat.test.tsx}}

Not verified here: speech in a real browser (the chat package tests the loop with a fake adapter), and a live model.
