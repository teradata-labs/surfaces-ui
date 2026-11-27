import { Markdown } from "@surfaces-ui/components";
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import type { RenderProps } from "./Surface.js";

export interface ConversationTurn {
  speaker: string;
  text: string;
  side?: "start" | "end";
  time?: string;
}

/** How long a scripted reply waits, so it reads as an answer rather than an echo. */
export const REPLY_DELAY_MS = 700;

const text = (value: unknown): string => (value == null || typeof value === "object" ? "" : String(value));

function turnsOf(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item == null || typeof item !== "object") return [];
    const t = item as Record<string, unknown>;
    const turn: ConversationTurn = { speaker: text(t.speaker), text: text(t.text) };
    if (t.side === "end") turn.side = "end";
    if (text(t.time) !== "") turn.time = text(t.time);
    return [turn];
  });
}

const now = () => new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/**
 * The turns sent in this view that the given thread does not hold yet. Once the agent (or whoever keeps the thread)
 * adds a sent turn to `messages`, it is drawn from there and dropped here, so nothing shows twice.
 */
export function unheld(given: readonly ConversationTurn[], added: readonly ConversationTurn[]): ConversationTurn[] {
  const key = (t: ConversationTurn) => `${t.side === "end" ? "end" : "start"}\u0000${t.speaker}\u0000${t.text}`;
  const held = new Map<string, number>();
  for (const t of given) held.set(key(t), (held.get(key(t)) ?? 0) + 1);
  return added.filter((t) => {
    const n = held.get(key(t)) ?? 0;
    if (n === 0) return true;
    held.set(key(t), n - 1);
    return false;
  });
}

/**
 * A whole chat: the thread, suggested replies and a box to write in. A sent turn is shown at once and sent as the
 * `send` event; the agent keeps the thread by adding it, and its answer, to `messages` (a list or a data path).
 * `replies` answer in order, for a prototype with no agent. The view writes nothing into the data model: a person's
 * write there would stand over the agent's later updates to the same path.
 */
export function ConversationView({ props, component, dispatch }: RenderProps) {
  const given = turnsOf(props.messages);
  const [added, setAdded] = useState<ConversationTurn[]>([]);
  const turns = [...given, ...unheld(given, added)];
  const you = text(props.you) || "You";
  const replies = Array.isArray(props.replies) ? turnsOf(props.replies) : [];
  const [sent, setSent] = useState(0);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState<string | undefined>();
  const thread = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputId = useId();
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, waiting]);

  const add = (turn: ConversationTurn) => setAdded((list) => [...list, turn]);
  const send = (said: string) => {
    const words = said.trim();
    if (words === "") return;
    add({ speaker: you, text: words, side: "end", time: now() });
    setDraft("");
    const reply = replies[sent];
    setSent((n) => n + 1);
    dispatch(component.action, { text: words });
    if (reply) {
      setWaiting(reply.speaker);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setWaiting(undefined);
        add({ ...reply, side: "start", time: now() });
      }, REPLY_DELAY_MS);
    }
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };
  // Enter sends; Shift and Enter starts a new line.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  };
  const suggestions = sent === 0 && Array.isArray(props.suggestions) ? (props.suggestions as unknown[]).map(text).filter((s) => s !== "") : [];
  const label = text(props.label) || "Conversation";

  return (
    <section className="sf-a2-conversation" aria-label={label}>
      <div ref={thread} className="sf-a2-conversation-thread" role="log" aria-live="polite" tabIndex={0} aria-label={`${label}: messages`}>
        {turns.map((turn, i) => (
          <div key={i} className="sf-a2-message" data-side={turn.side === "end" ? "end" : "start"}>
            <p className="sf-a2-message-who">
              <b>{turn.speaker}</b>
              {turn.time && <span>{turn.time}</span>}
            </p>
            <div className="sf-a2-message-body">
              <Markdown text={turn.text} />
            </div>
          </div>
        ))}
        {waiting !== undefined && <p className="sf-a2-conversation-waiting">{waiting} is writing…</p>}
      </div>
      {suggestions.length > 0 && (
        <div className="sf-a2-chips" role="group" aria-label="Suggested replies">
          {suggestions.map((s) => (
            <button key={s} type="button" className="sf-button" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form className="sf-a2-conversation-composer" onSubmit={onSubmit}>
        <label className="sf-visually-hidden" htmlFor={inputId}>
          Message
        </label>
        <textarea
          id={inputId}
          className="sf-input"
          rows={1}
          value={draft}
          placeholder={text(props.placeholder) || "Write a message"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="sf-button" data-variant="primary" disabled={draft.trim() === ""}>
          Send
        </button>
      </form>
    </section>
  );
}
