import type { AgentBackend } from "@surfaces-ui/agent";
import { type DataRef, type FullLayout, Workspace, type WorkspaceLayout, type WorkspacePanel, addDataRefs, expandPanel, movePanel, movePanelToNewColumn, normalizeLayout, showPanel } from "@surfaces-ui/components";
import type { AgentInfo, ToolConnector } from "@surfaces-ui/proto";
import { type Catalog, analyticsCatalog } from "@surfaces-ui/spec";
import { type ComponentRenderer, type SurfaceNote, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageList, Suggestions, UsageGauge } from "./Chat.js";
import { type AttachResult, ChatComposer, type SpeechConsent } from "./ChatComposer.js";
import { AgentSetupPanel, choosesModel } from "./ChatPanels.js";
import { DataPanel, type DataPanelProps } from "./DataPanel.js";
import { SessionList, type SessionListState } from "./SessionList.js";
import { conversationThread } from "./conversation.js";
import { ChatIcon } from "./icons.js";
import type { ChatPanel, ChatProvider } from "./selectors.js";
import type { ChatSessionSummary, ChatSessions } from "./sessions.js";
import type { SpeechAdapter } from "./speech.js";
import type { ChatActor, ChatThread } from "./thread.js";
import { type ChatSettings, useChat } from "./useChat.js";
import type { VoiceReply } from "./voice.js";

export interface AnalyticsChatProps {
  agent: AgentBackend;
  catalog?: Catalog;
  renderers?: Record<string, ComponentRenderer>;
  user?: ChatActor;
  starters?: string[];
  placeholder?: string;
  /** Shown before anything is said. */
  empty?: string;
  /** What a person does in a drawn component, as it happens (it also goes with the next turn). */
  onContext?(note: SurfaceNote & { surfaceId: string; componentId: string }): void;
  /** Height of the whole chat. Default 640. */
  height?: number | string;

  /** Saved conversations: a Sessions panel to search, filter, sort and group them, and every conversation saved as it goes. */
  sessions?: ChatSessions;
  /** Files from the person's computer, turned into data by the host. */
  attachFiles?(files: File[]): Promise<AttachResult[]>;
  /** A Data panel of tables and files to attach. `sourceId` defaults to the settings' source. */
  browse?: Omit<DataPanelProps, "onAttach">;
  /** Agents with their models, skills and connectors (`DescribeAgents`). */
  agents?: AgentInfo[];
  settings?: ChatSettings;
  defaultSettings?: ChatSettings;
  onSettingsChange?(settings: ChatSettings): void;
  /** Data connections, offered in the Connectors menu and panel. */
  sources?: { id: string; label: string; detail?: string }[];
  onAddConnection?(): void;
  onConnect?(connector: ToolConnector): void;
  speech?: SpeechAdapter;
  /** Where models run, when the host can reach several; see `ChatProvider`. */
  providers?: ChatProvider[];
  onManageProviders?(): void;
  /** Ask before the microphone is first used; see `ChatComposer`. */
  speechConsent?: SpeechConsent;
  /** Items a composer menu shows before "View all…". Default 5. */
  menuLimit?: number;
  /** Where the panels are. Plain JSON, so a host can keep it. */
  layout?: WorkspaceLayout;
  onLayoutChange?(layout: FullLayout): void;
  /** Where the session list's search, filters, sort and grouping are. */
  sessionList?: SessionListState;
  onSessionListChange?(state: SessionListState): void;
  className?: string;
}

const PANEL_TITLES: Record<ChatPanel, { title: string; shortTitle?: string; icon: ReactNode }> = {
  sessions: { title: "Conversations", icon: <ChatIcon name="sessions" /> },
  data: { title: "Data", icon: <ChatIcon name="data" /> },
  setup: { title: "Agent setup", shortTitle: "Setup", icon: <ChatIcon name="agent" /> },
};

/**
 * Shows a panel beside the conversation: in the column the other panels
 * use, or in a new one to the right, so the thread keeps its height. A
 * panel a person has put somewhere else stays there.
 */
export function placeChatPanel(layout: WorkspaceLayout, panel: string, ids: string[]): FullLayout {
  const before = normalizeLayout(layout, ids);
  const wasHidden = before.hidden.includes(panel);
  let next = showPanel(before, panel);
  const column = (id: string) => next.columns.findIndex((c) => c.includes(id));
  if (wasHidden && column(panel) === column("chat")) {
    const side = next.columns.findIndex((c) => !c.includes("chat"));
    if (side >= 0) next = movePanel(next, panel, side, 0);
    else {
      next = movePanelToNewColumn(next, panel, next.columns.length);
      const chat = column("chat");
      next = normalizeLayout({ ...next, columnWidths: next.columns.map((_, i) => (i === chat ? 0.64 : 0.36 / (next.columns.length - 1))) }, ids);
    }
  }
  return expandPanel(next, panel);
}

/** The latest reply as the voice loop needs it. */
export function voiceReplyOf(thread: ChatThread): VoiceReply | undefined {
  const last = [...thread.messages].reverse().find((m) => m.role === "assistant");
  if (!last) return undefined;
  const text = last.parts.flatMap((p) => (p.kind === "text" ? [p.text] : [])).join("\n\n");
  return { id: String(last.id), text, status: thread.status === "waiting" ? "waiting" : last.streaming || thread.status === "streaming" ? "streaming" : "idle" };
}

/**
 * A chat for people who work with data. The conversation is always there;
 * every other part comes only when its prop is given: saved conversations,
 * files and tables to attach, the agent, model, skills and connectors, and
 * the microphone. Short lists are menus in the composer; each ends in "View
 * all…" or "Manage…", which opens its panel. Panels sit in a workspace with
 * a rail of icons on the right, and a person arranges them.
 */
export function AnalyticsChat(props: AnalyticsChatProps) {
  const { sessions, agents = [], browse } = props;
  const [keptSettings, setKeptSettings] = useState<ChatSettings>(props.defaultSettings ?? {});
  const settings = props.settings ?? keptSettings;
  const setSettings = useCallback(
    (next: ChatSettings) => {
      setKeptSettings(next);
      props.onSettingsChange?.(next);
    },
    [props.onSettingsChange],
  );
  const [references, setReferences] = useState<DataRef[]>([]);

  // Which conversation is open. A new key starts a fresh thread.
  const [open, setOpen] = useState<{ key: number; id?: string; thread?: ChatThread }>({ key: 0 });
  const [list, setList] = useState<ChatSessionSummary[]>([]);
  const [listError, setListError] = useState("");
  const refresh = useCallback(async () => {
    if (!sessions) return;
    try {
      setList(await sessions.list());
      setListError("");
    } catch (error) {
      setListError(error instanceof Error ? error.message : String(error));
    }
  }, [sessions]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const run = (work: Promise<unknown>) => void work.then(refresh, (error) => setListError(error instanceof Error ? error.message : String(error)));
  const openSession = (id: string) =>
    run(
      sessions!.load(id).then((document) => {
        setOpen((o) => ({ key: o.key + 1, id, thread: conversationThread(document) }));
        setReferences([]);
      }),
    );
  const newSession = () => {
    setOpen((o) => ({ key: o.key + 1 }));
    setReferences([]);
  };

  const panelIds = useMemo(
    () => (["sessions", "data", "setup"] as ChatPanel[]).filter((p) => (p === "sessions" ? !!sessions : p === "data" ? !!browse : choosesModel(agents, props.providers) || agents.length > 1 || agents.some((a) => a.skills.length > 0 || a.connectors.length > 0) || !!props.sources?.length || !!props.onAddConnection)),
    [sessions, browse, agents, props.providers, props.sources, props.onAddConnection],
  );
  const [keptLayout, setKeptLayout] = useState<WorkspaceLayout>(() => ({ columns: [["chat"]], hidden: panelIds }));
  // A panel the layout has never placed (one that appears when an agent starts offering skills) starts hidden, on the rail.
  const given = props.layout ?? keptLayout;
  const placed = new Set([...given.columns.flat(), ...(given.hidden ?? [])]);
  const layout: WorkspaceLayout = { ...given, hidden: [...(given.hidden ?? []), ...panelIds.filter((id) => !placed.has(id))] };
  const latestLayout = useRef(layout);
  latestLayout.current = layout;
  const setLayout = (given: FullLayout) => {
    // A panel shown from the rail goes beside the conversation too, not under it.
    const before = normalizeLayout(latestLayout.current, ["chat", ...panelIds]);
    let next = given;
    for (const id of panelIds) if (before.hidden.includes(id) && !given.hidden.includes(id)) next = placeChatPanel({ ...next, columns: next.columns.map((c) => c.filter((p) => p !== id)), hidden: [...next.hidden, id] }, id, ["chat", ...panelIds]);
    latestLayout.current = next;
    setKeptLayout(next);
    props.onLayoutChange?.(next);
  };
  const manage = (panel: ChatPanel) => {
    if (!panelIds.includes(panel)) return;
    setLayout(placeChatPanel(latestLayout.current, panel, ["chat", ...panelIds]));
    // Focus the panel once it is drawn, so a keyboard user lands in it.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-chat-panel="${panel}"] input, [data-chat-panel="${panel}"] button`)?.focus());
  };

  const sourceId = settings.sourceId ?? browse?.sourceId;
  const attach = (refs: DataRef[]) => setReferences((have) => addDataRefs(have, refs));
  const content: Record<ChatPanel, () => ReactNode> = {
    sessions: () => (
      <div data-chat-panel="sessions">
        {listError && (
          <p className="sf-notice" role="alert">
            {listError}
          </p>
        )}
        <SessionList
          label="Conversation list"
          sessions={list}
          current={open.id}
          value={props.sessionList}
          onChange={props.onSessionListChange}
          onOpen={openSession}
          onNew={newSession}
          onRename={(id, title) => run(sessions!.rename(id, title))}
          onPin={(id, pinned) => run(sessions!.pin(id, pinned))}
          onRemove={(id) => {
            if (id === open.id) newSession();
            run(sessions!.remove(id));
          }}
          agentName={(id) => agents.find((a) => a.id === id)?.name ?? id}
          height={420}
        />
      </div>
    ),
    data: () => (
      <div data-chat-panel="data">
        <DataPanel {...browse} sourceId={sourceId} sourceLabel={props.sources?.find((s) => s.id === sourceId)?.label ?? browse?.sourceLabel} onAttach={attach} />
      </div>
    ),
    setup: () => (
      <div data-chat-panel="setup">
        <AgentSetupPanel agents={agents} settings={settings} onSettingsChange={setSettings} providers={props.providers} onManageProviders={props.onManageProviders} sources={props.sources} onAddConnection={props.onAddConnection} onConnect={props.onConnect} />
      </div>
    ),
  };

  const conversation = (
    <Conversation
      key={open.key}
      {...props}
      sessionId={open.id}
      initial={open.thread}
      settings={settings}
      onSettingsChange={setSettings}
      references={references}
      onReferencesChange={setReferences}
      onManage={panelIds.length > 0 ? manage : undefined}
      panels={panelIds}
      onSaved={(id) => {
        setOpen((o) => (o.id === id ? o : { ...o, id }));
        void refresh();
      }}
    />
  );

  if (panelIds.length === 0)
    return (
      <section className={["sf-analytics-chat", props.className].filter(Boolean).join(" ")} style={{ height: props.height ?? 640 }} aria-label="Chat">
        {conversation}
      </section>
    );
  const panels: WorkspacePanel[] = [{ id: "chat", title: "Chat", icon: <ChatIcon name="chat" />, fill: true, content: conversation }, ...panelIds.map((id) => ({ id, ...PANEL_TITLES[id], content: content[id]() }))];
  return (
    <div className={["sf-analytics-chat", props.className].filter(Boolean).join(" ")}>
      <Workspace label="Chat panels" panels={panels} layout={layout} onLayoutChange={setLayout} rail="right" height={props.height ?? 640} />
    </div>
  );
}

interface ConversationProps extends AnalyticsChatProps {
  sessionId?: string;
  initial?: ChatThread;
  settings: ChatSettings;
  onSettingsChange(settings: ChatSettings): void;
  references: DataRef[];
  onReferencesChange(references: DataRef[]): void;
  onManage?(panel: ChatPanel): void;
  panels: ChatPanel[];
  onSaved(id: string): void;
}

/** One conversation: the thread, the suggestions and the composer. Saved whenever a reply finishes. */
function Conversation(props: ConversationProps) {
  const catalog = props.catalog ?? analyticsCatalog;
  const renderers = props.renderers ?? lazyAnalyticsRenderers;
  const chat = useChat(props.agent, { catalog, user: props.user, initial: props.initial, settings: props.settings });
  const { thread } = chat;
  const { sessions, onSaved, settings } = props;

  // Save once a turn is over, and only when something new was said.
  const id = useRef(props.sessionId);
  const saved = useRef(props.initial?.messages.length ?? 0);
  useEffect(() => {
    if (!sessions || thread.status === "streaming" || thread.messages.length === 0 || thread.messages.length === saved.current) return;
    saved.current = thread.messages.length;
    void sessions
      .save({ ...(id.current ? { id: id.current } : {}), thread, ...(settings.agentId ? { agentId: settings.agentId } : {}), ...(settings.model ? { model: settings.model } : {}), ...(settings.sourceId ? { sources: [settings.sourceId] } : {}) })
      .then((summary) => {
        id.current = summary.id;
        onSaved(summary.id);
      })
      .catch(() => {
        // Let the next turn try again.
        saved.current = 0;
      });
  }, [thread, sessions, settings, onSaved]);

  const suggestions = thread.messages.length === 0 ? (props.starters ?? []) : thread.status === "idle" ? thread.suggestions : [];
  const onContext = props.onContext;
  return (
    <section className="sf-chat sf-analytics-conversation" aria-label="Conversation">
      <MessageList thread={thread} catalog={catalog} renderers={renderers} onAction={chat.act} onAnswer={chat.answer} onReport={chat.report} onProblem={chat.problem} onContext={onContext} empty={props.empty} />
      <Suggestions items={suggestions} onPick={(text) => chat.send(text, props.references)} />
      <ChatComposer
        onSend={(text, refs) => chat.send(text, refs)}
        onStop={chat.stop}
        streaming={thread.status === "streaming"}
        placeholder={thread.status === "waiting" ? "Answer above, or type to say something else" : props.placeholder}
        references={props.references}
        onReferencesChange={props.onReferencesChange}
        attachFiles={props.attachFiles}
        browse={props.panels.includes("data") ? undefined : props.browse}
        agents={props.agents}
        settings={settings}
        onSettingsChange={props.onSettingsChange}
        sources={props.sources}
        onAddConnection={props.onAddConnection}
        onConnect={props.onConnect}
        onManage={props.onManage}
        managed={props.panels}
        menuLimit={props.menuLimit}
        providers={props.providers}
        onManageProviders={props.onManageProviders}
        speech={props.speech}
        speechConsent={props.speechConsent}
        voiceReply={voiceReplyOf(thread)}
      />
      <UsageGauge usage={thread.usage} />
    </section>
  );
}
