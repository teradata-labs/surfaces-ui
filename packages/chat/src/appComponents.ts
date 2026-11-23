import { type AppComponentDoc, type PropSchema, describeAppComponent } from "@surfaces-ui/components/app-components";
import type { AnalyticsChatProps } from "./AnalyticsChat.js";
import type { ChatProps } from "./Chat.js";
import type { PageStudioProps } from "./PageStudio.js";

/*
 * The chat package's app components, described once as data (see
 * `describeAppComponent` in @surfaces-ui/components): the playground draws a
 * page for each, and `pnpm docs:gen` writes docs/components.
 */

const CHAT = "@surfaces-ui/chat";
const words: Record<string, PropSchema> = {
  starters: { type: "array", items: { type: "string" }, description: "Offered as one-press examples before anything is said." },
  placeholder: { type: "string", description: "The message box's placeholder." },
  empty: { type: "string", description: "Shown before anything is said." },
  height: { type: "integer", minimum: 240, description: "Height of the whole chat in px. Default 640." },
};
const settings: PropSchema = {
  type: "object",
  description: "What the person chose: agent, model, provider, skills, connectors and source. Sent with each turn; the backend refuses what it did not offer.",
  properties: {
    agentId: { type: "string" },
    model: { type: "string" },
    provider: { type: "string" },
    skillIds: { type: "array", items: { type: "string" } },
    connectorIds: { type: "array", items: { type: "string" } },
    sourceId: { type: "string" },
  },
};
const user: PropSchema = {
  type: "object",
  description: "Who is using it, from the host's sign-in: recorded on approvals, events and arrangements.",
  properties: { id: { type: "string" }, name: { type: "string" } },
};

export const analyticsChatDoc = describeAppComponent<AnalyticsChatProps>()({
  name: "AnalyticsChat",
  from: CHAT,
  description:
    "The chat for data people: the conversation always shown, with a rail of panels beside it for only what the host gives: saved conversations (`sessions`), tables and files to attach (`browse`), and the agent's setup (`agents` or `providers`). Its composer attaches files, switches the model, sets up the agent's skills and connectors, and takes voice behind consent. Every component the agent draws appears in the thread, live.",
  props: {
    type: "object",
    properties: { ...words, menuLimit: { type: "integer", minimum: 1, maximum: 20, description: 'Items a composer menu shows before "View all…". Default 5.' }, user, settings },
    required: [],
  },
  parts: [
    { prop: "agent", label: "Agent", description: "Any `AgentBackend`. On the page, the scripted demo agent answering from a written conversation.", required: true },
    { prop: "sessions", label: "Saved conversations", description: "A Conversations panel to search, filter, sort and group them; every conversation is saved as it goes. `librarySessions(library)` or `memorySessions()`.", on: true },
    { prop: "browse", label: "Data panel", description: "Tables and files to attach to a message, over the source in `settings`.", on: true },
    { prop: "agents", label: "Agent setup", description: "What the backend offers (`DescribeAgents`): agents with their models, skills and connectors, in the Setup menu and panel." },
    { prop: "providers", label: "Model providers", description: "Where models run, each with its models: the Model menu groups them and a pick sets `provider` and `model`. A model's `level` ({ value, of, label }) is drawn as rising bars beside its word." },
    { prop: "attachFiles", label: "Attach files", description: "The + menu, drop and paste. The host decides what a file becomes; the agent is told a table or a file by name, never its contents." },
    { prop: "speech", label: "Voice", description: "Dictation and a spoken conversation, asked for once with `speechConsent` (Chrome sends audio to Google)." },
  ],
  callbacks: [
    { prop: "onSettingsChange", description: "A person changed the agent, model, skills or connectors." },
    { prop: "onContext", description: "What a person does in a drawn component, as it happens; it also goes with the next turn." },
    { prop: "onLayoutChange", description: "Where the panels are, as plain JSON to keep." },
    { prop: "onConnect", description: "A connector's sign-in link, for the host to open." },
  ],
  example: { starters: ["Show the data model", "Browse the data"], menuLimit: 5, height: 640 },
});

export const chatDoc = describeAppComponent<ChatProps>()({
  name: "Chat",
  from: CHAT,
  description:
    "A conversation with any agent, on its own: replies hold Markdown, tool steps, approvals and any catalog component drawn inline. Use it inside your own layout; use `AnalyticsChat` for the whole workspace. A thread is a document: open on one with `initialThread` and save every change from `onThreadChange`.",
  props: {
    type: "object",
    properties: { ...words, agentId: { type: "string", description: "The agent to talk to when the backend has several." }, contextPackId: { type: "string", description: "Limit the agent to the data in this saved context pack." }, storageKey: { type: "string" }, user, settings },
  },
  parts: [
    { prop: "agent", label: "Agent", description: "Any `AgentBackend`. On the page, the scripted demo agent.", required: true },
    { prop: "storage", label: "Keep across reloads", description: "Where to keep the thread (`browserStorage()` from `@surfaces-ui/state`, or your own); checked when it loads." },
    { prop: "agents", label: "Agent menus", description: "What the backend offers, for the composer's Setup menu. Needs `onSettingsChange`." },
    { prop: "providers", label: "Model providers", description: "Where models run: the Model menu groups them by provider." },
  ],
  callbacks: [
    { prop: "onThreadChange", description: "The thread after every change, to save it or build from what was drawn." },
    { prop: "onSettingsChange", description: "A person changed the agent, model, skills or connectors." },
    { prop: "onContext", description: "What a person does in a drawn component." },
    { prop: "onReferencesChange", description: "Tables and columns attached to the message being written, when the host holds them." },
  ],
  example: { starters: ["Show the data model"], height: 560 },
});

export const pageStudioDoc = describeAppComponent<PageStudioProps>()({
  name: "PageStudio",
  from: CHAT,
  description:
    "A page beside an instruction box: a person says what to change, an agent answers with A2UI, and its reply becomes page edits checked against the catalog. Each instruction is one undo step and the log says who made each change. With `arrange`, a person can also lay the page out by hand (drag, side by side, heights and widths, all by keyboard too): each arrangement is one undo step, logged by them, and told to the agent with the next instruction.",
  props: {
    type: "object",
    properties: { starters: words.starters, arrange: { type: "boolean", description: "Offer Arrange beside Undo and Redo." }, user, settings },
  },
  parts: [
    { prop: "agent", label: "Agent", description: "Any `AgentBackend`. On the page, the scripted demo agent that edits dashboards.", required: true },
    { prop: "page", label: "Page", description: "The `PageDocument` to start from: a dashboard from the gallery.", required: true },
    { prop: "providers", label: "Model providers", description: "Where models run: the Model menu groups them by provider." },
  ],
  callbacks: [
    { prop: "onChange", description: "The page after each change, to save it." },
    { prop: "onSettingsChange", description: "A person changed the model." },
  ],
  example: { arrange: true, user: { id: "you", name: "you" } },
});

/** Every app component of `@surfaces-ui/chat`. */
export const chatAppComponents: AppComponentDoc[] = [analyticsChatDoc, chatDoc, pageStudioDoc];
