import { useCallback, useEffect, useRef, useState } from "react";

export type ComposerTab = "a2ui" | "jsonrender";

/** What the composer's JSON panel shows, shared between the page and a popped-out window. */
export interface ComposerState {
  tab: ComposerTab;
  a2uiText: string;
  specText: string;
  /** How many messages are applied. */
  step: number;
  /** A line about the last open, for the panel. */
  loadStatus: string;
}

export type ComposerEdit = Partial<Omit<ComposerState, "loadStatus">>;

type Message =
  | { type: "hello"; from: string }
  | { type: "bye"; from: string }
  | { type: "edit"; from: string; edit: ComposerEdit }
  | { type: "state"; origin: string; state: ComposerState }
  | { type: "closed" };

const CHANNEL = "surfaces-playground-composer";
const WINDOW = "surfaces-composer";
const newId = () => Math.random().toString(36).slice(2);

/** The page's address for the popped-out panel. */
export const popoutUrl = () => `${location.pathname}?popout=composer`;

/**
 * The composer page's side. It owns the state: it sends every change to a
 * popped-out window and applies the edits made there. A change made in the
 * window comes back tagged with the window's id, so the window does not
 * overwrite text typed after it.
 */
export function useComposerHost(state: ComposerState, apply: (edit: ComposerEdit) => void) {
  const channel = useRef<BroadcastChannel | null>(null);
  const latest = useRef(state);
  latest.current = state;
  const origin = useRef("page");
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const [windows, setWindows] = useState<string[]>([]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    channel.current = ch;
    ch.onmessage = (event: MessageEvent<Message>) => {
      const m = event.data;
      if (m.type === "hello") {
        setWindows((w) => (w.includes(m.from) ? w : [...w, m.from]));
        // Sent as if it came from the asker, so a window that is typing keeps its own newer text.
        ch.postMessage({ type: "state", origin: m.from, state: latest.current } satisfies Message);
      } else if (m.type === "bye") {
        setWindows((w) => w.filter((id) => id !== m.from));
      } else if (m.type === "edit") {
        origin.current = m.from;
        applyRef.current(m.edit);
      }
    };
    const closed = () => ch.postMessage({ type: "closed" } satisfies Message);
    window.addEventListener("pagehide", closed);
    return () => {
      window.removeEventListener("pagehide", closed);
      closed();
      ch.close();
      channel.current = null;
    };
  }, []);

  useEffect(() => {
    channel.current?.postMessage({ type: "state", origin: origin.current, state } satisfies Message);
    origin.current = "page";
  }, [state]);

  const popOut = useCallback(() => {
    const opened = window.open(popoutUrl(), WINDOW, "popup,width=760,height=900");
    opened?.focus();
    return Boolean(opened);
  }, []);

  return { poppedOut: windows.length > 0, popOut };
}

/**
 * The popped-out window's side: it asks the page for the state, shows it,
 * and sends each edit back. While the page is gone it says so.
 */
export function useComposerGuest() {
  const id = useRef(newId());
  const channel = useRef<BroadcastChannel | null>(null);
  const [state, setState] = useState<ComposerState | undefined>();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL);
    channel.current = ch;
    ch.onmessage = (event: MessageEvent<Message>) => {
      const m = event.data;
      if (m.type === "state") {
        setConnected(true);
        // Text this window sent is already newer here than the copy coming back.
        setState((mine) => (m.origin === id.current && mine ? { ...m.state, a2uiText: mine.a2uiText, specText: mine.specText } : m.state));
      } else if (m.type === "closed") {
        setConnected(false);
      }
    };
    ch.postMessage({ type: "hello", from: id.current } satisfies Message);
    // A page opened later finds this window when it says hello again.
    const again = window.setInterval(() => {
      if (!document.hidden) ch.postMessage({ type: "hello", from: id.current } satisfies Message);
    }, 3000);
    const bye = () => ch.postMessage({ type: "bye", from: id.current } satisfies Message);
    window.addEventListener("pagehide", bye);
    return () => {
      window.clearInterval(again);
      window.removeEventListener("pagehide", bye);
      bye();
      ch.close();
      channel.current = null;
    };
  }, []);

  const edit = useCallback((change: ComposerEdit) => {
    setState((s) => (s ? { ...s, ...change } : s));
    channel.current?.postMessage({ type: "edit", from: id.current, edit: change } satisfies Message);
  }, []);

  return { state, connected, edit };
}
