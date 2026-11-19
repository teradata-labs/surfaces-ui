/**
 * Speech for a chat: turning what a person says into text, and reading a
 * reply aloud. The chat never chooses where audio goes; the host passes an
 * adapter, and its `label` says where, so the person can be told.
 */
export interface SpeechAdapter {
  /** Whether it can run here. A chat leaves the microphone out when it cannot. */
  supported(): boolean;
  /** Where audio goes, in a sentence a person can read before they talk. */
  label: string;
  /**
   * Starts listening. `onPartial` is called with words as they are heard,
   * `onFinal` with each finished phrase. Returns a function that stops.
   */
  listen(handlers: SpeechHandlers): () => void;
  /** Reads text aloud; resolves when done. Left out: replies are not read. */
  speak?(text: string): Promise<void>;
  /** Stops reading aloud. */
  cancelSpeech?(): void;
}

export interface SpeechHandlers {
  /** Keep listening across pauses (a conversation) rather than stopping after one phrase (dictation). */
  continuous: boolean;
  onPartial(text: string): void;
  onFinal(text: string): void;
  /** Listening ended, on its own or after `stop`. */
  onEnd(): void;
  onError(message: string): void;
}

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

const recognitionClass = (): (new () => Recognition) | undefined => {
  const scope = globalThis as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
};

const ERRORS: Record<string, string> = {
  "not-allowed": "The microphone is blocked for this page.",
  "service-not-allowed": "Speech recognition is turned off in this browser.",
  "no-speech": "Nothing was heard.",
  network: "The browser's speech service could not be reached.",
  "audio-capture": "No microphone was found.",
};

/**
 * Speech through the browser's own recognition and voices. Chrome sends the
 * audio to Google to be recognised; Safari uses Apple's service or the
 * device. Firefox has no recognition, so `supported` is false there. Pass it
 * only where that is acceptable, and keep its `label` visible.
 */
export function browserSpeech(options: { lang?: string } = {}): SpeechAdapter {
  const lang = options.lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
  const synth = () => (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  return {
    label: "Uses your browser's speech service: in Chrome, audio is sent to Google to be recognised.",
    supported: () => !!recognitionClass(),
    listen(handlers) {
      const Class = recognitionClass();
      if (!Class) {
        handlers.onError("This browser cannot recognise speech.");
        handlers.onEnd();
        return () => {};
      }
      const recognition = new Class();
      recognition.continuous = handlers.continuous;
      recognition.interimResults = true;
      recognition.lang = lang;
      recognition.onresult = (event) => {
        let partial = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]!;
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) handlers.onFinal(text.trim());
          else partial += text;
        }
        handlers.onPartial(partial.trim());
      };
      recognition.onerror = (event) => {
        if (event.error !== "aborted") handlers.onError(ERRORS[event.error] ?? `Speech recognition stopped: ${event.error}.`);
      };
      recognition.onend = () => handlers.onEnd();
      recognition.start();
      return () => recognition.stop();
    },
    speak(text) {
      const speech = synth();
      if (!speech || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve();
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speech.speak(utterance);
      });
    },
    cancelSpeech() {
      synth()?.cancel();
    },
  };
}

/**
 * Text of a reply as it should be read aloud: words only. Code, tables and
 * links are named rather than read, since a listener cannot use them.
 */
export function speakableText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " (code shown on screen) ")
    .replace(/(^\|.*\|$\n?)+/gm, " (table shown on screen) ")
    // A heading ends where its line does; a listener needs the pause.
    .replace(/^#{1,6}\s+(.+?)[.:]?$/gm, "$1.")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
