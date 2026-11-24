import { ChatComposer } from "@surfaces-ui/chat";
import { CodeBlock, type DataRef, Markdown, type WorkspacePanel } from "@surfaces-ui/components";
import { type ReactNode, useEffect, useRef } from "react";
import { useProviderMenu } from "../providers.js";
import type { ComposerAgent } from "../useComposerAgent.js";

/**
 * How the conversation opens before a person has said anything: a few words
 * on where they are, and ways to start that each send the agent a full
 * instruction. Written by the playground, not a model, and labelled so.
 */
export interface Opening {
  text: string;
  choices: { label: string; instruction: string }[];
  /** Why the choices cannot be used yet (no model picked), when they cannot. */
  blocked?: string;
}

/** One entry in the composer's history, newest first. */
export interface HistoryEntry {
  id: number;
  at: string;
  kind: "agent" | "event" | "save" | "load" | "restore" | "edit";
  title: string;
  detail?: string;
  /** Agent turns: the messages text from before the turn, to restore. */
  before?: string;
}

const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * The playground's panels beside the surface: the agent conversation, the
 * surface's components, the tables in use (real sources), its JSON, its data
 * model and controls, the history, and save. They go into a `Workspace`, so
 * a person shows, hides and arranges them.
 */
export function composerPanels(props: {
  save: ReactNode;
  /** On a real source: the tables in use. */
  tables?: ReactNode;
  /** Folders and files: the source's storage and folders from this computer. */
  files?: ReactNode;
  /** The surface as JSON (A2UI messages or a json-render spec) and its message stepper. */
  json: ReactNode;
  /** The surface's components, each with its own controls. */
  components: ReactNode;
  agent: ComposerAgent;
  starters: string[];
  /** On a real source: how the conversation opens. */
  opening?: Opening;
  /** Tables and columns attached to the instruction being written: dropped on it, or added from a browser. */
  attached: DataRef[];
  onAttachedChange(attached: DataRef[]): void;
  dataModel: unknown;
  dataNote: string;
  controls: Record<string, Record<string, unknown>>;
  history: HistoryEntry[];
  onRestore(entry: HistoryEntry): void;
  onClearHistory(): void;
}): WorkspacePanel[] {
  return [
    { id: "agent", title: "Agent", icon: "agent", fill: true, content: <AgentPanel agent={props.agent} starters={props.starters} opening={props.opening} attached={props.attached} onAttachedChange={props.onAttachedChange} /> },
    { id: "components", title: "Components", shortTitle: "Parts", icon: "components", content: props.components },
    ...(props.tables ? [{ id: "tables", title: "Tables", icon: "table" as const, content: props.tables }] : []),
    ...(props.files ? [{ id: "files", title: "Files", icon: "folder" as const, content: props.files }] : []),
    { id: "json", title: "JSON", icon: "code", content: props.json },
    {
      id: "data",
      title: "Data model",
      shortTitle: "Data",
      icon: "data",
      content: (
        <div className="composer-panel-body">
          <p className="hint">{props.dataNote}</p>
          <CodeBlock bare code={pretty(props.dataModel)} language="json" label="The surface's data model" />
          <h3 className="catalog-sub">Controls</h3>
          {Object.keys(props.controls).length === 0 ? (
            <p className="hint">No control changed yet. Sorts, filters, columns and layouts a person sets in the surface appear here, in the props an agent would set.</p>
          ) : (
            <CodeBlock bare code={pretty(props.controls)} language="json" label="How the person left the surface's controls" />
          )}
        </div>
      ),
    },
    { id: "history", title: "History", icon: "history", content: <HistoryPanel history={props.history} onRestore={props.onRestore} onClear={props.onClearHistory} /> },
    { id: "save", title: "Save", icon: "save", content: props.save },
  ];
}

function AgentPanel({ agent, starters, opening, attached, onAttachedChange }: { agent: ComposerAgent; starters: string[]; opening?: Opening; attached: DataRef[]; onAttachedChange(attached: DataRef[]): void }) {
  const menu = useProviderMenu(agent.choice);
  const end = useRef<HTMLDivElement>(null);
  const { picked, transcript, busy } = agent;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on each new line.
  useEffect(() => {
    // The conversation scrolls inside its own box; the page is left where the person put it.
    const box = end.current?.parentElement;
    if (box) box.scrollTop = box.scrollHeight;
  }, [transcript]);
  const send = (value: string) => {
    if (!value.trim() || busy) return;
    void agent.instruct(value, undefined, attached);
    onAttachedChange([]);
  };

  return (
    <div className="composer-agent">
      <div className="composer-agent-pick">
        <button type="button" className="btn" onClick={agent.newConversation} disabled={transcript.length === 0 && !busy}>
          New conversation
        </button>
      </div>
      {picked && picked.kind !== "scripted" && (
        <label className="composer-check">
          <input type="checkbox" checked={agent.forwardEvents} onChange={(e) => agent.setForwardEvents(e.target.checked)} />
          <span>Send surface events to the agent</span>
        </label>
      )}

      <div className="composer-transcript" role="log" aria-label="Conversation" aria-live="polite">
        {transcript.length === 0 &&
          (opening ? (
            <div className="composer-turn composer-turn-agent composer-opening">
              <Markdown text={opening.text} />
              <div className="composer-opening-choices">
                {opening.choices.map((choice) => (
                  <button key={choice.label} type="button" className="btn primary" disabled={busy || !!opening.blocked} onClick={() => void agent.instruct(choice.instruction, choice.label)}>
                    {choice.label}
                  </button>
                ))}
              </div>
              {opening.blocked && (
                <p className="catalog-error" role="alert">
                  {opening.blocked}
                </p>
              )}
              <p className="hint">From the playground, not a model. Each choice sends the agent a full instruction; or type your own below.</p>
            </div>
          ) : (
            <p className="hint">Tell the agent what to change, for example one of the suggestions below. Its messages are added to the surface (see the JSON panel) and drawn.</p>
          ))}
        {transcript.map((entry, i) => (
          <div key={i} className={`composer-turn composer-turn-${entry.role}`}>
            {entry.role === "person" ? (
              <p>{entry.text}</p>
            ) : entry.role === "event" ? (
              <p className="hint">{entry.text}</p>
            ) : (
              <>
                {entry.text ? <Markdown text={entry.text} /> : entry.pending ? <p className="hint">Working…</p> : null}
                {entry.error && (
                  <p className="catalog-error" role="alert">
                    {entry.error}
                  </p>
                )}
                {entry.notes?.map((note, n) => (
                  <p key={n} className="hint">
                    {note}
                  </p>
                ))}
                {!entry.pending && (
                  <p className="hint">
                    {entry.added ? `Added ${entry.added} message${entry.added === 1 ? "" : "s"}.` : "No change to the surface."} {entry.generatedBy && `Answered by ${entry.generatedBy}.`}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      {starters.length > 0 && transcript.length === 0 && (
        <ul className="composer-starters" aria-label="Suggestions">
          {starters.map((s) => (
            <li key={s}>
              <button type="button" className="btn" disabled={busy} onClick={() => send(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ChatComposer
        label="Instruction"
        placeholder="Add a chart of revenue by month"
        onSend={(value, refs) => void agent.instruct(value, undefined, refs)}
        onStop={agent.stop}
        streaming={busy}
        disabled={!picked}
        references={attached}
        onReferencesChange={onAttachedChange}
        agents={[]}
        {...menu}
      />
    </div>
  );
}

function HistoryPanel({ history, onRestore, onClear }: { history: HistoryEntry[]; onRestore(entry: HistoryEntry): void; onClear(): void }) {
  if (history.length === 0) return <p className="hint">Nothing yet. Agent turns, events from the surface, saves, opens and restores are listed here, newest first.</p>;
  return (
    <>
      <div className="card-head">
        <h3 className="catalog-sub">Newest first</h3>
        <button type="button" className="btn" onClick={onClear}>
          Clear
        </button>
      </div>
      <ol className="composer-history">
        {history.map((entry) => (
          <li key={entry.id} data-kind={entry.kind}>
            <div className="composer-history-head">
              <span className="badge">{entry.kind}</span>
              <time dateTime={entry.at}>{time(entry.at)}</time>
            </div>
            <p>{entry.title}</p>
            {entry.detail && <p className="hint">{entry.detail}</p>}
            {entry.before !== undefined && (
              <button type="button" className="btn" onClick={() => onRestore(entry)}>
                Restore messages from before this
              </button>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
