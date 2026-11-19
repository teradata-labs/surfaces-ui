import { useCallback, useEffect, useRef, useState } from "react";
import { type SpeechAdapter, speakableText } from "./speech.js";

/** Where the voice controls stand. */
export type VoiceState = "off" | "dictating" | "listening" | "thinking" | "speaking";

/** The latest reply, as the voice loop needs it. */
export interface VoiceReply {
  id: string;
  text: string;
  /** "waiting": the reply asks a person to decide something, which needs their hands. */
  status: "streaming" | "idle" | "waiting";
}

export interface UseVoiceOptions {
  speech?: SpeechAdapter;
  /** Words heard so far, to show in the message box. */
  onText(text: string): void;
  /** A finished turn in a conversation, to send. */
  onSend(text: string): void;
  reply?: VoiceReply;
  /** Quiet after speech, in ms, before a conversation sends what was said. Default 1200. */
  silenceMs?: number;
  /** Quiet with nothing said, in ms, before a conversation stops listening. Default 30000. */
  idleMs?: number;
}

export interface Voice {
  state: VoiceState;
  /** Says what is happening, for the status line. */
  status: string;
  supported: boolean;
  /** One phrase into the message box. */
  dictate(): void;
  /** Talk back and forth: listen, send after a pause, read the reply, listen again. */
  converse(): void;
  stop(reason?: string): void;
}

/**
 * Dictation and hands-free conversation over a `SpeechAdapter`. A
 * conversation sends what was said once the person pauses, reads the reply's
 * words aloud when it is done, and listens again. It stops when the reply
 * needs a decision (an approval needs the person's hands), on `stop`, or
 * after a long silence.
 */
export function useVoice(options: UseVoiceOptions): Voice {
  const { speech, silenceMs = 1200, idleMs = 30_000 } = options;
  const [state, setState] = useState<VoiceState>("off");
  const [note, setNote] = useState("");
  const live = useRef(options);
  live.current = options;
  const stopListening = useRef<(() => void) | undefined>(undefined);
  const heard = useRef("");
  const timers = useRef<{ silence?: ReturnType<typeof setTimeout>; idle?: ReturnType<typeof setTimeout> }>({});
  const mode = useRef<VoiceState>("off");
  const awaiting = useRef<string | undefined>(undefined);
  const supported = !!speech?.supported();

  const set = (next: VoiceState, message = "") => {
    mode.current = next;
    setState(next);
    setNote(message);
  };
  const clearTimers = () => {
    clearTimeout(timers.current.silence);
    clearTimeout(timers.current.idle);
  };

  const stop = useCallback(
    (reason = "") => {
      clearTimers();
      stopListening.current?.();
      stopListening.current = undefined;
      speech?.cancelSpeech?.();
      awaiting.current = undefined;
      set("off", reason);
    },
    [speech],
  );

  const listen = useCallback(
    (continuous: boolean) => {
      if (!speech) return;
      heard.current = "";
      set(continuous ? "listening" : "dictating");
      const armIdle = () => {
        clearTimeout(timers.current.idle);
        if (continuous) timers.current.idle = setTimeout(() => stop("Stopped listening after a long silence."), idleMs);
      };
      armIdle();
      stopListening.current = speech.listen({
        continuous,
        onPartial(text) {
          live.current.onText([heard.current, text].filter(Boolean).join(" "));
          if (continuous && text) clearTimeout(timers.current.silence);
        },
        onFinal(text) {
          if (!text) return;
          heard.current = [heard.current, text].filter(Boolean).join(" ");
          live.current.onText(heard.current);
          armIdle();
          if (!continuous) return;
          clearTimeout(timers.current.silence);
          timers.current.silence = setTimeout(() => {
            const said = heard.current.trim();
            if (!said || mode.current !== "listening") return;
            stopListening.current?.();
            stopListening.current = undefined;
            clearTimeout(timers.current.idle);
            heard.current = "";
            // The next reply after this one is the answer to read aloud.
            awaiting.current = live.current.reply?.id ?? "";
            set("thinking");
            live.current.onSend(said);
          }, silenceMs);
        },
        onEnd() {
          if (mode.current === "dictating") set("off");
          // A browser ends recognition on its own after a while; a conversation keeps going.
          else if (mode.current === "listening" && stopListening.current) {
            stopListening.current = undefined;
            listen(true);
          }
        },
        onError(message) {
          stop(message);
        },
      });
    },
    [speech, silenceMs, idleMs, stop],
  );

  // A conversation waits for the reply to its turn, reads it, then listens again.
  const { reply } = options;
  useEffect(() => {
    if (mode.current !== "thinking" || !reply || awaiting.current === undefined) return;
    if (reply.id === awaiting.current || reply.status === "streaming") return;
    awaiting.current = undefined;
    if (reply.status === "waiting") {
      stop("Paused: the reply needs your decision.");
      return;
    }
    const words = speakableText(reply.text);
    if (!speech?.speak || !words) {
      listen(true);
      return;
    }
    set("speaking");
    void speech.speak(words).then(() => {
      if (mode.current === "speaking") listen(true);
    });
  }, [reply, speech, listen, stop]);

  useEffect(() => () => stop(), [stop]);

  const STATUS: Record<VoiceState, string> = { off: note, dictating: "Listening… speak, then pause.", listening: "Listening. Pause when you are done.", thinking: "Sent. Waiting for the reply…", speaking: "Reading the reply aloud." };
  return {
    state,
    status: STATUS[state],
    supported,
    dictate: () => (mode.current === "off" ? listen(false) : stop()),
    converse: () => (mode.current === "off" ? listen(true) : stop()),
    stop,
  };
}
