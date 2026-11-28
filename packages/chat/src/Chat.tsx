import type { AgentBackend } from "@surfaces-ui/agent";
import type { AgentInfo } from "@surfaces-ui/proto";
import { type DataRef, type ImageResolver, ImageResolverProvider, Markdown, addDataRefs, dataRefLabel, hasDataRefs, readDataRefs, safeImageAddress, sameDataRef } from "@surfaces-ui/components";
import { type Catalog, type SurfaceAction, analyticsCatalog } from "@surfaces-ui/spec";
import { type ComponentRenderer, type SurfaceNote, SurfaceView, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { type DragEvent, type FormEvent, type KeyboardEvent, type Ref, useEffect, useId, useRef, useState } from "react";
import { ApprovalCard } from "./Approval.js";
import { type AttachResult, Composer, type ComposerHandle, type ComposerProps } from "./ChatComposer.js";
import type { ChatActions, ChatActor, ChatAttachment, ChatButton, ChatMessage, ChatStep, ChatThread, ChatUsage } from "./thread.js";
import type { ChatProvider } from "./selectors.js";
import { type ChatSettings, type UseChat, type UseChatOptions, useChat } from "./useChat.js";

const count = new Intl.NumberFormat("en-US");
const STEP_MARK: Record<ChatStep["status"], string> = { running: "…", done: "✓", failed: "!" };
const STEP_WORD: Record<ChatStep["status"], string> = { running: "running", done: "done", failed: "failed" };

export interface ToolStepsProps {
  steps: ChatStep[];
}

/** The work an agent did for a reply, such as tool calls. Each step opens to show its detail. */
export function ToolSteps({ steps }: ToolStepsProps) {
  return (
    <ul className="sf-chat-steps" aria-label="Steps">
      {steps.map((step) => (
        <li key={step.id} data-status={step.status}>
          <details>
            <summary>
              <span className="sf-chat-step-mark" aria-hidden="true">
                {STEP_MARK[step.status]}
              </span>
              <span className="sf-chat-step-title">{step.title || step.tool}</span>
              <span className="sf-chat-step-meta">
                {STEP_WORD[step.status]}
                {step.durationMs > 0 ? ` · ${count.format(step.durationMs)} ms` : ""}
              </span>
            </summary>
            {step.tool && <p className="sf-chat-step-tool">Tool: {step.tool}</p>}
            {step.detail && <pre tabIndex={0}>{step.detail}</pre>}
          </details>
        </li>
      ))}
    </ul>
  );
}

export interface ActionsCardProps {
  actions: ChatActions;
  /** A press: the button's id, and the choice it belongs to when it is in one. Never called for a disabled button. */
  onPress(buttonId: string, choiceId?: string): void;
}

function ActionButtons({ buttons, label, onPress }: { buttons: ChatButton[]; label?: string; onPress(id: string): void }) {
  const uid = useId();
  if (buttons.length === 0) return null;
  return (
    <div className="sf-chat-actions-row" role={label ? "group" : undefined} aria-label={label}>
      {buttons.map((button, i) => {
        const why = button.reason ? `${uid}-${i}` : undefined;
        return (
          <span key={button.id} className="sf-chat-actions-button">
            <button
              type="button"
              className="sf-button"
              data-variant={button.variant}
              // Not `disabled`: a disabled button cannot be reached by keyboard, and then neither can its reason.
              aria-disabled={button.disabled || undefined}
              aria-label={button.ariaLabel}
              aria-describedby={why}
              title={button.reason}
              onClick={() => {
                if (!button.disabled) onPress(button.id);
              }}
            >
              {button.label}
            </button>
            {why && (
              <span id={why} className="sf-a2-visually-hidden">
                {button.reason}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * What a person can do about a reply, under it: a row of buttons, or several
 * alternatives one row each with buttons for the whole set after them. The
 * host decides what a press does and, once it is handled, replaces the
 * buttons with what became of it (`outcome`).
 */
export function ActionsCard({ actions, onPress }: ActionsCardProps) {
  const choices = actions.choices ?? [];
  return (
    <div className="sf-chat-actions" role="group" aria-label={actions.title || "Actions"} data-handled={actions.outcome !== undefined || undefined}>
      {actions.title && <p className="sf-chat-actions-title">{actions.title}</p>}
      {actions.detail && <p className="sf-chat-actions-detail">{actions.detail}</p>}
      {actions.outcome !== undefined ? (
        <p className="sf-chat-actions-outcome" role="status">
          {actions.outcome}
        </p>
      ) : (
        <>
          {choices.length > 0 && (
            <ul className="sf-chat-actions-choices" aria-label="Choices">
              {choices.map((choice) => (
                <li key={choice.id}>
                  <p className="sf-chat-actions-choice">
                    <span className="sf-chat-actions-title">{choice.title}</span>
                    {choice.detail && <span className="sf-chat-actions-detail"> · {choice.detail}</span>}
                  </p>
                  <ActionButtons buttons={choice.buttons} label={choice.title} onPress={(id) => onPress(id, choice.id)} />
                </li>
              ))}
            </ul>
          )}
          <ActionButtons buttons={actions.buttons ?? []} label={choices.length > 0 ? "All choices" : undefined} onPress={(id) => onPress(id)} />
        </>
      )}
    </div>
  );
}

export interface MessageListProps {
  thread: ChatThread;
  catalog: Catalog;
  renderers: Record<string, ComponentRenderer>;
  onAction(action: SurfaceAction): void;
  onAnswer: UseChat["answer"];
  /** Where each drawn surface stands and what went wrong with it, kept for the agent's next turn (`useChat`'s `report` and `problem`). */
  onReport?: UseChat["report"];
  onProblem?: UseChat["problem"];
  /** Told what a person does in a drawn component as they do it, with where. For a host that keeps its own context for an agent. */
  onContext?(note: SurfaceNote & { surfaceId: string; componentId: string }): void;
  /** A press on a button in an actions part (`ChatActions`): the part's id, the button's id, and its choice's id when it is in one. */
  onPartAction?(partId: string, actionId: string, choiceId?: string): void;
  /** Shown when the thread is empty. */
  empty?: string;
  /**
   * How an image an agent named is drawn, in its replies' Markdown and in any `Image` it draws: turns the name or address
   * it wrote into the address to load, or nothing (the description is shown). Without it, or a resolver given above
   * (`ImageResolverProvider`), no image an agent wrote is loaded. Not used for a person's own attachments (`ChatAttachment.preview`).
   */
  resolveImage?: ImageResolver;
}

/** Pictures and files a person attached to their message, as chips with a thumbnail where there is one. */
function AttachedChips({ attachments }: { attachments: ChatAttachment[] }) {
  return (
    <ul className="sf-chat-references sf-chat-attachments" aria-label="Attached files">
      {attachments.map((one) => {
        // The preview is the host's own (a blob it made from the file), never an address a model wrote.
        const picture = one.mediaType.startsWith("image/") ? safeImageAddress(one.preview) : undefined;
        return (
          <li key={one.id ?? one.name} className="sf-chat-reference" data-kind="attachment" data-thumbnail={picture ? true : undefined}>
            {picture ? <img className="sf-chat-thumbnail" src={picture} alt="" loading="lazy" decoding="async" /> : null}
            <span>{one.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

function MessageView({ message, thread, catalog, renderers, onAction, onAnswer, onReport, onProblem, onContext, onPartAction }: MessageListProps & { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <article className="sf-chat-message" data-role="user">
        <span className="sf-a2-visually-hidden">You said:</span>
        <p>{message.parts.map((p) => (p.kind === "text" ? p.text : "")).join("")}</p>
        {message.parts.map((p, i) =>
          p.kind === "references" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: a message's parts do not move.
            <ul key={i} className="sf-chat-references" aria-label="Attached">
              {p.references.map((ref) => (
                <li key={`${ref.sourceId}/${dataRefLabel(ref)}`} className="sf-chat-reference" data-kind={ref.kind}>
                  {dataRefLabel(ref)}
                </li>
              ))}
            </ul>
          ) : p.kind === "attachments" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: a message's parts do not move.
            <AttachedChips key={i} attachments={p.attachments} />
          ) : null,
        )}
      </article>
    );
  }
  return (
    <article className="sf-chat-message" data-role="assistant" aria-busy={message.streaming}>
      <span className="sf-a2-visually-hidden">The agent replied:</span>
      {message.parts.map((part, index) => {
        switch (part.kind) {
          case "text":
            return <Markdown key={index} text={part.text} />;
          case "steps":
            return <ToolSteps key={index} steps={part.steps} />;
          case "surface": {
            const surface = thread.surfaces[part.surfaceId];
            // Agent-drawn components are checked against the catalog before they are drawn.
            const key = part.surfaceId;
            return surface ? (
              <SurfaceView
                key={index}
                surface={surface}
                catalog={catalog}
                renderers={renderers}
                onAction={onAction}
                onDataChange={(data) => onReport?.(key, { data })}
                onControlsChange={(componentId, controls) => onReport?.(key, { componentId, controls })}
                onContext={(componentId, note) => {
                  onReport?.(key, { componentId, note });
                  onContext?.({ ...note, surfaceId: key, componentId });
                }}
                onProblem={(problem) => onProblem?.(key, problem)}
                className="sf-chat-surface"
              />
            ) : null;
          }
          case "approval":
            return <ApprovalCard key={index} approval={part.approval} onAnswer={onAnswer} />;
          case "actions":
            return <ActionsCard key={index} actions={part.actions} onPress={(actionId, choiceId) => onPartAction?.(part.actions.id, actionId, choiceId)} />;
          case "references":
          case "attachments":
            // Attachments belong to what a person sent; a reply has none.
            return null;
          default:
            return (
              <p key={index} className="sf-chat-error" role="alert">
                {part.code === "CANCELLED" ? "Stopped." : part.message}
              </p>
            );
        }
      })}
      {message.streaming && message.parts.length === 0 && <p className="sf-chat-thinking">Working…</p>}
      {!message.streaming && message.generatedBy && <p className="sf-chat-by">Answered by {message.generatedBy}</p>}
    </article>
  );
}

/**
 * The conversation so far. Replies can hold text, tool steps, approvals and
 * components the agent drew. The list follows new content while the reader
 * is at the bottom and stays put when they have scrolled up.
 */
export function MessageList(props: MessageListProps) {
  const { thread } = props;
  const list = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const element = list.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  }, [thread]);
  const list_ = (
    <div
      ref={list}
      className="sf-chat-list"
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      tabIndex={0}
      onScroll={(event) => {
        const element = event.currentTarget;
        pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
      }}
    >
      {thread.messages.length === 0 && props.empty && <div className="sf-chat-empty">{props.empty}</div>}
      {thread.messages.map((message) => (
        <MessageView key={message.id} {...props} message={message} />
      ))}
    </div>
  );
  return props.resolveImage ? <ImageResolverProvider resolve={props.resolveImage}>{list_}</ImageResolverProvider> : list_;
}

export interface SuggestionsProps {
  items: string[];
  onPick(text: string): void;
}

/** Things the person might say next, one press each. */
export function Suggestions({ items, onPick }: SuggestionsProps) {
  if (items.length === 0) return null;
  return (
    <div className="sf-chat-suggestions" role="group" aria-label="Suggestions">
      {items.map((item) => (
        <button key={item} type="button" className="sf-button" onClick={() => onPick(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}

/** How full the agent's context is, and what the conversation has cost when known. */
export function UsageGauge({ usage }: { usage: ChatUsage | undefined }) {
  if (!usage || usage.contextLimit <= 0) return null;
  const share = Math.min(1, usage.contextTokens / usage.contextLimit);
  return (
    <p className="sf-chat-usage">
      <meter min={0} max={1} high={0.8} value={share} aria-label="Context used" />
      <span>
        {Math.round(share * 100)}% of context used
        {usage.costUsd !== undefined ? ` · $${usage.costUsd.toFixed(2)}` : ""}
      </span>
    </p>
  );
}

export interface ChatProps {
  /** Any agent runtime behind the AgentBackend interface. */
  agent: AgentBackend;
  /** The catalog agent-drawn components are checked against. Defaults to the analytics catalog. */
  catalog?: Catalog;
  renderers?: Record<string, ComponentRenderer>;
  agentId?: string;
  /** Limit the agent to the data in this saved context pack. */
  contextPackId?: string;
  /** Who is using the chat, from the host's sign-in; recorded on approval answers and surface events. */
  user?: ChatActor;
  /** Where to keep the conversation across reloads (`browserStorage()` from `@surfaces-ui/state`, or your own). */
  storage?: UseChatOptions["storage"];
  storageKey?: string;
  /** Tables and columns attached to the message being written, when the host holds them (see `Composer`). */
  references?: DataRef[];
  onReferencesChange?(references: DataRef[]): void;
  /** The thread to open with: a saved or written conversation. Read once. */
  initialThread?: ChatThread;
  /** Told the thread after every change, so a host can save it or build from what was drawn. */
  onThreadChange?(thread: ChatThread): void;
  /**
   * Told what a person does in a drawn component as they do it (a view
   * added, a field changed, a filter set). The chat already keeps these and
   * gives them to the agent with its next turn; this is for a host that
   * wants them too.
   */
  onContext?: MessageListProps["onContext"];
  /** Offered before the first message. */
  starters?: string[];
  placeholder?: string;
  /** How an image an agent named is drawn; see `MessageListProps.resolveImage`. */
  resolveImage?: ImageResolver;
  /** Turns files a person drops, pastes or picks into data or attachments; see `ComposerProps.attachFiles`. Without it there is no upload. */
  attachFiles?(files: File[]): Promise<AttachResult[]>;
  /** What the file picker offers; see `ComposerProps.accept`. */
  accept?: string;
  /** Widens the drop target beyond the composer; see `ComposerProps.dropTarget`. */
  dropTarget?: ComposerProps["dropTarget"];
  /** Hands files in from outside; see `ComposerProps.handleRef`. */
  composerRef?: Ref<ComposerHandle>;
  /** The agent, model, skills and connectors a person chose, sent with each turn; with `onSettingsChange` the composer offers them. */
  settings?: ChatSettings;
  onSettingsChange?(settings: ChatSettings): void;
  /** What the agent offers (`DescribeAgents`), for the composer's menus. */
  agents?: AgentInfo[];
  /** Where models run, when the host can reach several: the Model menu groups models by provider. */
  providers?: ChatProvider[];
  onManageProviders?(): void;
  /** Shown when the thread is empty. */
  empty?: string;
  /** Height of the whole chat. A number is px. Defaults to 640. */
  height?: number | string;
  className?: string;
}

/**
 * A complete chat: the conversation, suggestions and the composer. Agent
 * replies stream in as Markdown, with tool steps, approvals and any catalog
 * component (charts, tables, pivots, model diagrams, decision cards) drawn
 * inline. Data components need a DataSourceProvider above the chat.
 */
export function Chat(props: ChatProps) {
  const catalog = props.catalog ?? analyticsCatalog;
  const renderers = props.renderers ?? lazyAnalyticsRenderers;
  const chat = useChat(props.agent, { catalog, agentId: props.agentId, contextPackId: props.contextPackId, user: props.user, storage: props.storage, storageKey: props.storageKey, initial: props.initialThread, settings: props.settings });
  const { thread } = chat;
  // Told on a change of thread only: a host passing a new function each render must not be told again (and set state in a loop).
  const onThreadChange = useRef(props.onThreadChange);
  onThreadChange.current = props.onThreadChange;
  useEffect(() => onThreadChange.current?.(thread), [thread]);
  const suggestions = thread.messages.length === 0 ? (props.starters ?? []) : thread.status === "idle" ? thread.suggestions : [];
  return (
    <section className={["sf-chat", props.className].filter(Boolean).join(" ")} style={{ height: props.height ?? 640 }} aria-label="Chat">
      <MessageList thread={thread} catalog={catalog} renderers={renderers} onAction={chat.act} onAnswer={chat.answer} onReport={chat.report} onProblem={chat.problem} onContext={props.onContext} empty={props.empty} resolveImage={props.resolveImage} />
      <Suggestions items={suggestions} onPick={(text) => chat.send(text)} />
      <Composer
        agents={props.agents}
        settings={props.settings}
        onSettingsChange={props.onSettingsChange}
        providers={props.providers}
        onManageProviders={props.onManageProviders}
        references={props.references}
        onReferencesChange={props.onReferencesChange}
        attachFiles={props.attachFiles}
        accept={props.accept}
        dropTarget={props.dropTarget}
        handleRef={props.composerRef}
        onSend={chat.send} onStop={chat.stop} streaming={thread.status === "streaming"} placeholder={thread.status === "waiting" ? "Answer above, or type to say something else" : props.placeholder} />
      <UsageGauge usage={thread.usage} />
    </section>
  );
}
