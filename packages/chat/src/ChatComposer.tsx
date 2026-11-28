import { type DataRef, addDataRefs, dataRefLabel, hasDataRefs, readDataRefs, safeImageAddress, sameDataRef } from "@surfaces-ui/components";
import type { AgentInfo, ToolConnector } from "@surfaces-ui/proto";
import { type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent, type ReactNode, type Ref, type RefObject, useEffect, useImperativeHandle, useRef, useState } from "react";
import { DataPanel, type DataPanelProps } from "./DataPanel.js";
import { MenuButton, MenuGroup, MenuItem } from "./Menu.js";
import { ChatIcon } from "./icons.js";
import { type ChatPanel, type ChatProvider, ModelMenu, SetupMenu } from "./selectors.js";
import type { SpeechAdapter } from "./speech.js";
import type { ChatAttachment } from "./thread.js";
import type { ChatSettings } from "./useChat.js";
import { type VoiceReply, useVoice } from "./voice.js";

/**
 * What became of one file a person attached. Exactly one of `ref`, `attachment` and `taken` says it was used; a result
 * with none of them (and no `error`) reads as failed, "This file cannot be used as data."
 */
export interface AttachResult {
  file: File;
  /** The table or file of data it became, by name. */
  ref?: DataRef;
  /**
   * It was attached as something other than data, such as a picture: the composer shows a chip with a thumbnail (when
   * `preview` is an image address) and gives the attachment to `onSend`.
   */
  attachment?: ChatAttachment;
  /** The host took the file and handled it elsewhere: no chip and no error. */
  taken?: boolean;
  /** Why it could not be used. */
  error?: string;
}

/** What a host can do with a mounted composer, through `handleRef`. */
export interface ComposerHandle {
  /** Hands files in from outside the composer, as if they were dropped on it: they get "Reading…" chips and go through `attachFiles`. Resolves once the host has answered. */
  attach(files: File[]): Promise<void>;
  /** Puts the cursor in the box. */
  focus(): void;
}

export interface ComposerProps {
  /** Called with the message, the data attached to it and, only when there are some, its attachments (`AttachResult.attachment`). */
  onSend(text: string, references: DataRef[], attachments?: ChatAttachment[]): void;
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

  /**
   * Pictures and other files attached to the message being written that are not data. Give it with `onAttachmentsChange`
   * to hold them yourself; otherwise the composer keeps them.
   */
  attachments?: ChatAttachment[];
  onAttachmentsChange?(attachments: ChatAttachment[]): void;

  /** Turns files from the person's computer into data the agent can name. Without it there is no upload. Any file is offered (see `accept`); the host says which it can use. */
  attachFiles?(files: File[]): Promise<AttachResult[]>;
  /** What the file picker offers, as an `<input type="file">` `accept` ("image/*,.csv"). It does not limit what is dropped or pasted. Default: any file. */
  accept?: string;
  /** Replaces the line under "Upload files…" in the + menu. Default: "Any file; those that can be read become tables". */
  uploadDetail?: ReactNode;
  /**
   * Widens where files can be dropped from the composer's own form to this element (a panel around the chat), given as
   * the element or a ref to it. Files and tables dropped on it are handled as if dropped on the composer, and the composer
   * is highlighted while they are over it.
   */
  dropTarget?: HTMLElement | RefObject<HTMLElement | null> | null;
  /** Gives the host `attach(files)` and `focus()`, to hand in files from anywhere (its own drop handling, a paste elsewhere). */
  handleRef?: Ref<ComposerHandle>;
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
  /** What the message is about beyond attached data, as chips before the attached tables and files. */
  context?: ComposerContext[];
  /** Choices for the next message, as checkboxes under the box. */
  toggles?: ComposerToggle[];
}

/**
 * A choice that goes with the next message, drawn as a checkbox under the
 * box ("Try three ways"). The host keeps `checked`, and clears it after a send
 * when it holds for one message only.
 */
export interface ComposerToggle {
  id: string;
  label: string;
  /** More about it, after the label and part of its name. */
  detail?: string;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
}

/**
 * Something the message is about that is not a table or a file: the part of
 * a page a person selected ("About Chart amount-by-region"). Shown as a chip
 * beside the attached data; the host keeps it and says what it means.
 */
export interface ComposerContext {
  /** Keeps the chip steady across renders; defaults to the label. */
  id?: string;
  label: string;
  /** Shown after the label, smaller. */
  detail?: string;
  /** Given, the chip has a remove button that calls it ("Whole page instead"). */
  onClear?(): void;
  /** The remove button's name. Default "Remove " and the label. */
  clearLabel?: string;
}

/** Whether the person agreed to use voice, kept by the host. */
export interface SpeechConsent {
  given: boolean;
  onGive(): void;
}

const attachmentKey = (one: ChatAttachment) => one.id ?? one.name;

type Pending = { key: string; name: string; error?: string };

/**
 * Where the person writes. Enter sends; Shift+Enter starts a new line.
 * Everything beyond the box is optional: files from the computer (the `+`
 * menu, a drop or a paste), tables and files from a browser, the agent,
 * model, skills and connectors, and the microphone. Send is the arrow.
 */
export function ChatComposer(props: ComposerProps) {
  const { onSend, onStop, streaming, disabled, placeholder, references: given, onReferencesChange, attachFiles, browse, agents = [], settings = {}, onSettingsChange, onManage, speech, context = [], toggles = [] } = props;
  const [text, setText] = useState("");
  const [kept, setKept] = useState<DataRef[]>([]);
  const references = given ?? kept;
  const latest = useRef(references);
  latest.current = references;
  const [keptAttachments, setKeptAttachments] = useState<ChatAttachment[]>([]);
  const attachments = props.attachments ?? keptAttachments;
  const latestAttachments = useRef(attachments);
  latestAttachments.current = attachments;
  const setAttachments = (next: ChatAttachment[]) => {
    latestAttachments.current = next;
    setKeptAttachments(next);
    props.onAttachmentsChange?.(next);
  };
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
    const withThem = latestAttachments.current;
    if (withThem.length > 0) onSend(words, latest.current, withThem);
    else onSend(words, latest.current);
    setText("");
    setReferences([]);
    if (withThem.length > 0) setAttachments([]);
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
      if (!result.ref && !result.attachment && !result.taken) failed.set(keys[i]!.key, result.error || "This file cannot be used as data.");
    });
    setPending((all) => all.flatMap((p) => (keys.some((k) => k.key === p.key) ? (failed.has(p.key) ? [{ ...p, error: failed.get(p.key) }] : []) : [p])));
    const refs = results.flatMap((r) => (r.ref ? [r.ref] : []));
    if (refs.length > 0) attach(refs);
    const pictures = results.flatMap((r) => (r.attachment ? [r.attachment] : []));
    if (pictures.length > 0) {
      const have = latestAttachments.current;
      const fresh = pictures.filter((one) => !have.some((other) => attachmentKey(other) === attachmentKey(one)));
      if (fresh.length > 0) setAttachments([...have, ...fresh]);
      if (refs.length === 0) setSaid(fresh.length === 0 ? "Already attached." : `Attached ${fresh.length === 1 ? fresh[0]!.name : `${fresh.length} files`}.`);
    }
    if (failed.size > 0) setSaid(`${failed.size === 1 ? "One file" : `${failed.size} files`} could not be used.`);
  };
  // What a host's `attach(files)` and a drop outside the form call must see the latest props.
  const uploadNow = useRef(upload);
  uploadNow.current = upload;
  useImperativeHandle(props.handleRef, () => ({ attach: (files: File[]) => uploadNow.current(files), focus: () => textArea.current?.focus({ preventScroll: true }) }), []);

  // A drop on the form is also seen by `dropTarget` around it (and the other way round); each event is handled once.
  const seen = useRef(new WeakSet<Event>());
  const firstSight = (event: { nativeEvent?: Event } | Event) => {
    const native = "nativeEvent" in event && event.nativeEvent ? event.nativeEvent : (event as Event);
    if (seen.current.has(native)) return false;
    seen.current.add(native);
    return true;
  };
  type Dragged = { dataTransfer: DataTransfer | null; preventDefault(): void };
  const onDragOver = (event: Dragged) => {
    if (!event.dataTransfer) return;
    const files = attachFiles && Array.from(event.dataTransfer.types).includes("Files");
    if (disabled || (!hasDataRefs(event.dataTransfer) && !files)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setOver(true);
  };
  const onDrop = (event: Dragged) => {
    setOver(false);
    if (disabled || !event.dataTransfer) return;
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
  const around = useRef({ onDragOver, onDrop });
  around.current = { onDragOver, onDrop };
  const outside = props.dropTarget;
  useEffect(() => {
    const element = outside && "current" in outside ? outside.current : outside;
    if (!element) return;
    const over = (event: Event) => firstSight(event) && around.current.onDragOver(event as globalThis.DragEvent);
    const drop = (event: Event) => firstSight(event) && around.current.onDrop(event as globalThis.DragEvent);
    const leave = (event: Event) => {
      const into = (event as globalThis.DragEvent).relatedTarget;
      if (!(into instanceof Node) || !element.contains(into)) setOver(false);
    };
    element.addEventListener("dragover", over);
    element.addEventListener("drop", drop);
    element.addEventListener("dragleave", leave);
    return () => {
      element.removeEventListener("dragover", over);
      element.removeEventListener("drop", drop);
      element.removeEventListener("dragleave", leave);
    };
  });
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
      onDragOver={(event) => firstSight(event) && onDragOver(event)}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => firstSight(event) && onDrop(event)}
      onKeyDown={onFormKeyDown}
    >
      {(context.length > 0 || references.length > 0 || attachments.length > 0 || pending.length > 0) && (
        <ul className="sf-chat-references sf-chat-attached" aria-label="Attached to this message">
          {context.map((about) => (
            <li key={about.id ?? about.label} className="sf-chat-reference" data-kind="context">
              <ChatIcon name="about" />
              <span>{about.label}</span>
              {about.detail && <span className="sf-chat-reference-note">{about.detail}</span>}
              {about.onClear && (
                <button
                  type="button"
                  className="sf-chat-reference-remove"
                  aria-label={about.clearLabel ?? `Remove ${about.label}`}
                  title={about.clearLabel}
                  onClick={() => {
                    about.onClear?.();
                    setSaid(`Removed ${about.label}.`);
                    textArea.current?.focus({ preventScroll: true });
                  }}
                >
                  <ChatIcon name="close" />
                </button>
              )}
            </li>
          ))}
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
          {attachments.map((one) => {
            const picture = one.mediaType.startsWith("image/") ? safeImageAddress(one.preview) : undefined;
            return (
              <li key={attachmentKey(one)} className="sf-chat-reference" data-kind="attachment" data-thumbnail={picture ? true : undefined}>
                {picture ? <img className="sf-chat-thumbnail" src={picture} alt="" /> : <ChatIcon name="file" />}
                <span>{one.name}</span>
                <button
                  type="button"
                  className="sf-chat-reference-remove"
                  aria-label={`Remove ${one.name}`}
                  onClick={() => {
                    setAttachments(latestAttachments.current.filter((have) => attachmentKey(have) !== attachmentKey(one)));
                    setSaid(`Removed ${one.name}.`);
                    textArea.current?.focus({ preventScroll: true });
                  }}
                >
                  <ChatIcon name="close" />
                </button>
              </li>
            );
          })}
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
                    detail={props.uploadDetail ?? "Any file; those that can be read become tables"}
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
            accept={props.accept}
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
      {toggles.length > 0 && (
        <div className="sf-chat-options" role="group" aria-label="Options for this message">
          {toggles.map((toggle) => (
            <label key={toggle.id} className="sf-chat-option">
              <input type="checkbox" checked={toggle.checked} disabled={disabled || toggle.disabled} onChange={(e) => toggle.onChange(e.target.checked)} />
              <span>
                {toggle.label}
                {toggle.detail && <span className="sf-chat-option-detail">: {toggle.detail}</span>}
              </span>
            </label>
          ))}
        </div>
      )}
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
