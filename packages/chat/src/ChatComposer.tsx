import { type DataRef, addDataRefs, dataRefLabel, hasDataRefs, readDataRefs, sameDataRef } from "@surfaces-ui/components";
import type { AgentInfo, ToolConnector } from "@surfaces-ui/proto";
import { type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { DataPanel, type DataPanelProps } from "./DataPanel.js";
import { MenuButton, MenuGroup, MenuItem } from "./Menu.js";
import { ChatIcon } from "./icons.js";
import { type ChatPanel, type ChatProvider, ModelMenu, SetupMenu } from "./selectors.js";
import type { SpeechAdapter } from "./speech.js";
import type { ChatSettings } from "./useChat.js";
import { type VoiceReply, useVoice } from "./voice.js";

/** What became of one file a person attached. */
export interface AttachResult {
  file: File;
  /** The table or file it became, by name. */
  ref?: DataRef;
  /** Why it could not be used. */
  error?: string;
}

export interface ComposerProps {
  onSend(text: string, references: DataRef[]): void;
  /** Shown in place of Send while a reply is streaming. */
  onStop?(): void;
  streaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** The box's name for assistive technology. Default "Message". */
  label?: string;
  /**
   * Tables and columns attached to the message being written. Give it with
   * `onReferencesChange` to hold them yourself, so something beside the chat
   * (a browser's "Add to chat") can add to them; otherwise the composer keeps
   * them. Either way they can be dropped onto the composer.
   */
  references?: DataRef[];
  onReferencesChange?(references: DataRef[]): void;

  /** Turns files from the person's computer into data the agent can name. Without it there is no upload. Any file is offered; the host says which it can use. */
  attachFiles?(files: File[]): Promise<AttachResult[]>;
  /** Browsing tables and files from the composer ("Add data"). Without `onManage`, it opens in a popover. */
  browse?: Omit<DataPanelProps, "onAttach">;
  /** Agents with their models, skills and connectors (`DescribeAgents`). Each menu shows only when there is something to choose. */
  agents?: AgentInfo[];
  settings?: ChatSettings;
  onSettingsChange?(settings: ChatSettings): void;
  /** Data connections for the Connectors menu's Data group. */
  sources?: { id: string; label: string }[];
  onAddConnection?(): void;
  onConnect?(connector: ToolConnector): void;
  /** Opens a panel with the whole list ("View all…", "Manage…", "Add data"). */
  onManage?(panel: ChatPanel): void;
  /** The panels `onManage` can open. Default: all of them. */
  managed?: ChatPanel[];
  /** Items a menu lists before "View all…". Default 5. */
  menuLimit?: number;
  /** Where models run, when the host can reach several: the Model menu groups models by provider. */
  providers?: ChatProvider[];
  /** "Manage providers…" at the foot of the Model menu. */
  onManageProviders?(): void;
  /** Talking instead of typing. The microphone shows only where the adapter is supported. */
  speech?: SpeechAdapter;
  /** The latest reply, for a spoken conversation to read and to know when to listen again. */
  voiceReply?: VoiceReply;
  /**
   * Ask before the microphone is first used. The microphone shows, and its
   * first press says where audio goes (`speech.label`) with "Use voice" and
   * "Not now"; nothing listens until the person agrees. The host keeps the
   * answer (`given`) so it is asked once. Without it, passing `speech` is the consent.
   */
  speechConsent?: SpeechConsent;
}

/** Whether the person agreed to use voice, kept by the host. */
export interface SpeechConsent {
  given: boolean;
  onGive(): void;
}

type Pending = { key: string; name: string; error?: string };

/**
 * Where the person writes. Enter sends; Shift+Enter starts a new line.
 * Everything beyond the box is optional: files from the computer (the `+`
 * menu, a drop or a paste), tables and files from a browser, the agent,
 * model, skills and connectors, and the microphone. Send is the arrow.
 */
export function ChatComposer(props: ComposerProps) {
  const { onSend, onStop, streaming, disabled, placeholder, references: given, onReferencesChange, attachFiles, browse, agents = [], settings = {}, onSettingsChange, onManage, speech } = props;
  const [text, setText] = useState("");
  const [kept, setKept] = useState<DataRef[]>([]);
  const references = given ?? kept;
  const latest = useRef(references);
  latest.current = references;
  const setReferences = (next: DataRef[]) => {
    latest.current = next;
    setKept(next);
    onReferencesChange?.(next);
  };
  const [pending, setPending] = useState<Pending[]>([]);
  const [over, setOver] = useState(false);
  const [said, setSaid] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  // A narrow composer shows its menus as icons, so the row stays one or two lines.
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = form.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(([entry]) => setCompact((entry?.contentRect.width ?? 999) < 420));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const textArea = useRef<HTMLTextAreaElement>(null);

  const send = (words: string) => {
    if (streaming || disabled || !words.trim()) return;
    onSend(words, latest.current);
    setText("");
    setReferences([]);
    setPending((all) => all.filter((p) => !p.error));
    setSaid("");
  };
  const voice = useVoice({ speech, onText: setText, onSend: send, reply: props.voiceReply });
  // A press before consent asks first, then starts what was pressed.
  const [asking, setAsking] = useState<"dictate" | "converse" | null>(null);
  const consent = props.speechConsent;
  const start = (mode: "dictate" | "converse") => {
    if (consent && !consent.given) return setAsking(mode);
    if (mode === "dictate") voice.dictate();
    else voice.converse();
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    send(text);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  };

  const attach = (refs: DataRef[]) => {
    const next = addDataRefs(latest.current, refs);
    const added = next.length - latest.current.length;
    const fresh = refs.find((ref) => !latest.current.some((have) => sameDataRef(have, ref))) ?? refs[0];
    setReferences(next);
    setSaid(added === 0 ? "Already attached." : `Attached ${added === 1 && fresh ? dataRefLabel(fresh) : `${added} items`}.`);
  };

  const upload = async (files: File[]) => {
    if (!attachFiles || files.length === 0) return;
    const keys = files.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name }));
    setPending((all) => [...all, ...keys]);
    setSaid(`Reading ${files.length === 1 ? files[0]!.name : `${files.length} files`}…`);
    let results: AttachResult[];
    try {
      results = await attachFiles(files);
    } catch (error) {
      results = files.map((file) => ({ file, error: error instanceof Error ? error.message : String(error) }));
    }
    const failed = new Map<string, string>();
    results.forEach((result, i) => {
      if (!result.ref) failed.set(keys[i]!.key, result.error || "This file cannot be used as data.");
    });
    setPending((all) => all.flatMap((p) => (keys.some((k) => k.key === p.key) ? (failed.has(p.key) ? [{ ...p, error: failed.get(p.key) }] : []) : [p])));
    const refs = results.flatMap((r) => (r.ref ? [r.ref] : []));
    if (refs.length > 0) attach(refs);
    if (failed.size > 0) setSaid(`${failed.size === 1 ? "One file" : `${failed.size} files`} could not be used.`);
  };

  const onDragOver = (event: DragEvent) => {
    const files = attachFiles && Array.from(event.dataTransfer.types).includes("Files");
    if (disabled || (!hasDataRefs(event.dataTransfer) && !files)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setOver(true);
  };
  const onDrop = (event: DragEvent) => {
    setOver(false);
    if (disabled) return;
    const dropped = readDataRefs(event.dataTransfer);
    if (dropped.length > 0) {
      // The names would otherwise be typed into the box as text as well.
      event.preventDefault();
      attach(dropped);
      return;
    }
    const files = Array.from(event.dataTransfer.files ?? []);
    if (attachFiles && files.length > 0) {
      event.preventDefault();
      void upload(files);
    }
  };
  const onPaste = (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!attachFiles || files.length === 0) return;
    event.preventDefault();
    void upload(files);
  };

  // Escape stops a spoken conversation from anywhere in the composer.
  const onFormKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && voice.state !== "off") {
      event.stopPropagation();
      voice.stop("Stopped.");
    }
  };
  useEffect(() => {
    if (voice.state === "off") textArea.current?.focus({ preventScroll: true });
  }, [voice.state]);

  const manages = (panel: ChatPanel) => !!onManage && (!props.managed || props.managed.includes(panel));
  const canBrowse = !!browse || manages("data");
  const selectorProps = { agents, settings, onSettingsChange: onSettingsChange ?? (() => {}), limit: props.menuLimit, compact };
  const manageIf = (panel: ChatPanel) => (manages(panel) ? onManage : undefined);
  const chooses = !!onSettingsChange && (agents.length > 0 || (props.providers?.length ?? 0) > 0);
  const talking = voice.state !== "off" && voice.state !== "dictating";
  const empty = !text.trim();

  return (
    <form
      ref={form}
      className="sf-chat-composer"
      data-compact={compact || undefined}
      data-rich={attachFiles || canBrowse || chooses || voice.supported || undefined}
      data-over={over || undefined}
      onSubmit={submit}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onKeyDown={onFormKeyDown}
    >
      {(references.length > 0 || pending.length > 0) && (
        <ul className="sf-chat-references sf-chat-attached" aria-label="Attached to this message">
          {references.map((ref) => (
            <li key={`${ref.sourceId}/${ref.kind}/${dataRefLabel(ref)}`} className="sf-chat-reference" data-kind={ref.kind}>
              <ChatIcon name={ref.kind === "file" ? "file" : "data"} />
              <span>{dataRefLabel(ref)}</span>
              <button
                type="button"
                className="sf-chat-reference-remove"
                aria-label={`Remove ${dataRefLabel(ref)}`}
                onClick={() => {
                  setReferences(latest.current.filter((have) => !sameDataRef(have, ref)));
                  setSaid(`Removed ${dataRefLabel(ref)}.`);
                }}
              >
                <ChatIcon name="close" />
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="sf-chat-reference" data-kind="file" data-state={p.error ? "failed" : "reading"}>
              <ChatIcon name="file" />
              <span>{p.name}</span>
              <span className="sf-chat-reference-note">{p.error ?? "Reading…"}</span>
              {p.error && (
                <button type="button" className="sf-chat-reference-remove" aria-label={`Remove ${p.name}`} onClick={() => setPending((all) => all.filter((x) => x.key !== p.key))}>
                  <ChatIcon name="close" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={textArea}
        className="sf-input"
        rows={2}
        aria-label={props.label ?? "Message"}
        placeholder={placeholder ?? "Ask about your data"}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      <div className="sf-chat-toolbar">
        {(attachFiles || manages("data")) && (
          <MenuButton label="Add files or data" icon="plus" iconOnly disabled={disabled}>
            {(close) => (
              <MenuGroup label="Add">
                {attachFiles && (
                  <MenuItem
                    detail="Any file; those that can be read become tables"
                    onSelect={() => {
                      close();
                      fileInput.current?.click();
                    }}
                  >
                    Upload files…
                  </MenuItem>
                )}
                {manages("data") && (
                  <MenuItem
                    detail="Tables, columns and files from a connection"
                    onSelect={() => {
                      close();
                      onManage?.("data");
                    }}
                  >
                    Add tables and files…
                  </MenuItem>
                )}
              </MenuGroup>
            )}
          </MenuButton>
        )}
        {attachFiles && (
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void upload(files);
            }}
          />
        )}
        {canBrowse &&
          (manages("data") ? (
            <button type="button" className="sf-chat-tool" data-icon-only={compact || undefined} aria-label={compact ? "Add data" : undefined} title={compact ? "Add data" : undefined} disabled={disabled} onClick={() => onManage?.("data")}>
              <ChatIcon name="data" />
              {!compact && <span className="sf-chat-tool-text">Add data</span>}
            </button>
          ) : (
            <MenuButton label="Add data" text="Add data" icon="data" iconOnly={compact} disabled={disabled} className="sf-chat-data-menu">
              {() => <DataPanel {...browse} onAttach={attach} />}
            </MenuButton>
          ))}
        {chooses && (
          <div className="sf-chat-selectors">
            <ModelMenu {...selectorProps} onManage={manageIf("setup")} providers={props.providers} onManageProviders={props.onManageProviders} />
            <SetupMenu {...selectorProps} onManage={manageIf("setup")} sources={props.sources} onAddConnection={props.onAddConnection} onConnect={props.onConnect} />
          </div>
        )}
        <span className="sf-chat-toolbar-end">
          {voice.supported && (
            <>
              <button
                type="button"
                className="sf-chat-tool"
                data-icon-only
                aria-pressed={voice.state === "dictating"}
                aria-label={voice.state === "dictating" ? "Stop dictating" : "Dictate"}
                title={voice.state === "dictating" ? "Stop dictating" : `Dictate. ${speech!.label}`}
                disabled={disabled || talking}
                onClick={() => (voice.state === "dictating" ? voice.stop() : start("dictate"))}
              >
                <ChatIcon name="mic" />
              </button>
              <button
                type="button"
                className="sf-chat-tool"
                data-icon-only
                data-live={talking || undefined}
                aria-pressed={talking}
                aria-label={talking ? "End conversation" : "Talk"}
                title={talking ? "End conversation (Escape)" : `Talk back and forth. ${speech!.label}`}
                disabled={disabled}
                onClick={() => (talking ? voice.stop("Conversation ended.") : start("converse"))}
              >
                <ChatIcon name="talk" />
              </button>
            </>
          )}
          {streaming && onStop ? (
            <button type="button" className="sf-chat-send" aria-label="Stop" title="Stop" onClick={onStop}>
              <ChatIcon name="stop" />
            </button>
          ) : (
            <button type="submit" className="sf-chat-send" aria-label="Send" title="Send (Enter)" disabled={disabled || empty}>
              <ChatIcon name="send" />
            </button>
          )}
        </span>
      </div>
      {voice.supported && asking && (
        <div className="sf-chat-voice-consent" role="group" aria-label="Use voice?">
          <p>
            {asking === "dictate" ? "Dictate instead of typing?" : "Talk back and forth instead of typing?"} {speech!.label}
          </p>
          <span className="sf-chat-voice-consent-actions">
            <button
              type="button"
              className="sf-button"
              data-variant="primary"
              // biome-ignore lint/a11y/noAutofocus: the person just pressed the microphone; the question is what they answer next.
              autoFocus
              onClick={() => {
                const mode = asking;
                setAsking(null);
                consent?.onGive();
                if (mode === "dictate") voice.dictate();
                else voice.converse();
              }}
            >
              Use voice
            </button>
            <button type="button" className="sf-button" onClick={() => setAsking(null)}>
              Not now
            </button>
          </span>
        </div>
      )}
      {voice.supported && voice.status && (
        <p className="sf-chat-voice" role="status" data-state={voice.state}>
          {voice.status}
        </p>
      )}
      <p className="sf-a2-visually-hidden" role="status">
        {said}
      </p>
    </form>
  );
}

/** The composer. Kept under its first name; everything added since is optional. */
export const Composer = ChatComposer;
