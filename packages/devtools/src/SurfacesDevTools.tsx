import { ControlIcon, ThemeProvider, useOptionalTheme } from "@surfaces-ui/components";
import { type StateStorage, browserStorage } from "@surfaces-ui/data";
import type { Catalog } from "@surfaces-ui/spec";
import type { ComponentRenderer } from "@surfaces-ui/spec/react";
import { INSPECT_COMPONENT, INSPECT_MARK, INSPECT_POINTED, type InspectTarget, type Recorder, createRecorder, performanceTracks } from "@surfaces-ui/trace";
import { TraceProvider } from "@surfaces-ui/trace/react";
import { type KeyboardEvent, type PointerEvent, type ReactNode, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { DevToolsServices } from "./Panel.js";
import { SHELL_CSS, addStyles } from "./styles.js";

// The panel is a module of its own, fetched the first time the tools are opened: an app that never opens them,
// or has them off, loads none of it.
const Panel = lazy(() => import("./Panel.js"));

export type DevToolsDock = "bottom" | "right";

export interface SurfacesDevToolsProps {
  /** The app. Everything inside is traced while the tools are on. */
  children?: ReactNode;
  /**
   * Whether the tools are there at all. Left out, they are on in a
   * development build and absent in production. Pass your own rule to offer
   * them to some people in production: `enabled={user.isDeveloper}`. Nothing
   * a visitor can set (a URL, a stored value) turns them on.
   */
  enabled?: boolean;
  /** The most events kept; the oldest are let go first. Default 2,000. */
  limit?: number;
  /** Open to begin with. */
  defaultOpen?: boolean;
  /** Which edge the panel docks to to begin with. A person can change it; on a narrow screen it is always the bottom. */
  defaultDock?: DevToolsDock;
  /** Whether Ctrl+Shift+D (⌘⇧D on a Mac) opens and closes the tools. Default true. */
  shortcut?: boolean;
  /**
   * "window" (the default) floats the button over the page's corner and docks the panel to the window.
   * "inline" keeps both in the flow where the component is placed, for a page that documents the tools.
   */
  anchor?: "window" | "inline";
  /** The catalog recorded surfaces are drawn with when shown again. Defaults to the analytics catalog. */
  catalog?: Catalog;
  renderers?: Record<string, ComponentRenderer>;
  /** Also show spans as custom tracks in the Performance panel of Chrome's developer tools. Default false. */
  performanceTracks?: boolean;
  /** Your own recorder, to read what is recorded from elsewhere (`recorder.get()`, `recorder.subscribe`). One is made when left out. */
  recorder?: Recorder;
  /** Told when the tools are opened or closed. */
  onOpenChange?(open: boolean): void;
  /**
   * Where the panel's place (open, dock, size) is kept between visits: the
   * browser by default, or any `StateStorage`. `null` keeps nothing. It only
   * arranges tools that are already on; nothing kept turns them on.
   */
  storage?: StateStorage | null;
}

declare const process: { env: { NODE_ENV?: string } };
/** True in a development build. A bundler replaces `process.env.NODE_ENV`; where nothing does, the tools stay off. */
function development(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

/**
 * Developer tools for an app built on Surfaces UI. Place it once, around the
 * app: it records what the library does inside it (messages in, components
 * drawn, problems, state, events out, agent turns, service calls) with no
 * other wiring, and shows a small button, and Ctrl+Shift+D, that open a panel
 * docked to the bottom or the side, with time travel over every surface.
 *
 * Off, it renders its children and nothing else, records nothing, and loads
 * no panel code. A trace never holds row values or credentials.
 */
export function SurfacesDevTools({ children, enabled, ...rest }: SurfacesDevToolsProps) {
  if (!(enabled ?? development())) return <>{children}</>;
  return <Enabled {...rest}>{children}</Enabled>;
}

function Enabled({ children, limit, recorder: given, performanceTracks: tracks = false, ...shell }: Omit<SurfacesDevToolsProps, "enabled">) {
  const recorder = useMemo(() => given ?? createRecorder({ limit }), [given, limit]);
  useEffect(() => (tracks ? performanceTracks(recorder) : undefined), [tracks, recorder]);
  return (
    <TraceProvider recorder={recorder}>
      {children}
      {/* The tools do not trace themselves. */}
      <TraceProvider recorder={undefined}>
        <Shell recorder={recorder} {...shell} />
      </TraceProvider>
    </TraceProvider>
  );
}

interface Kept {
  open?: boolean;
  dock?: DevToolsDock;
  size?: number;
}
const STORE = "surfaces.devtools";
/** Where the panel was left. Saved text is checked: anything else is ignored. */
const readKept = (text: string | null | undefined): Kept => {
  try {
    const value = JSON.parse(text ?? "{}") as Kept;
    if (!value || typeof value !== "object") return {};
    return {
      ...(typeof value.open === "boolean" ? { open: value.open } : {}),
      ...(value.dock === "bottom" || value.dock === "right" ? { dock: value.dock } : {}),
      ...(typeof value.size === "number" && Number.isFinite(value.size) ? { size: value.size } : {}),
    };
  } catch {
    return {};
  }
};

const MIN_SIZE = 160;
const STEP = 32;

const ToolsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 6h16v12H4z M4 10h16 M8 14l2 2-2 2 M13 18h4" />
  </svg>
);
const PickIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 4h12v6 M4 4v12h6 M12 12l8 3-3.5 1.5L15 20z" />
  </svg>
);
const PopOutIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M14 4h6v6 M20 4l-8 8 M18 14v6H4V6h6" />
  </svg>
);
const DockBottomIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 5h16v14H4z M4 14h16" />
  </svg>
);
const DockRightIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 5h16v14H4z M14 5v14" />
  </svg>
);

function Shell({ recorder, defaultOpen = false, defaultDock = "bottom", shortcut = true, anchor = "window", catalog, renderers, onOpenChange, storage }: Omit<SurfacesDevToolsProps, "enabled" | "children" | "limit" | "performanceTracks" | "recorder"> & { recorder: Recorder }) {
  const inline = anchor === "inline";
  const store = useMemo(() => (inline ? null : storage === undefined ? browserStorage() : storage), [inline, storage]);
  // Storage that answers at once (the browser's) places the panel on the first draw; one that answers later moves it then.
  const first = useMemo(() => {
    try {
      return store?.load(STORE);
    } catch {
      return undefined;
    }
  }, [store]);
  const kept = useMemo(() => (typeof first === "string" ? readKept(first) : {}), [first]);
  const [open, setOpenState] = useState(kept.open ?? defaultOpen);
  const [dock, setDock] = useState<DevToolsDock>(kept.dock ?? defaultDock);
  const [size, setSize] = useState<number | undefined>(kept.size);
  const [popped, setPopped] = useState<{ window: Window; mount: HTMLElement } | undefined>();
  const [blocked, setBlocked] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const theme = useOptionalTheme();

  useEffect(() => addStyles(document, "sf-devtools-shell-css", SHELL_CSS), []);
  const [loaded, setLoaded] = useState(!(first instanceof Promise));
  useEffect(() => {
    if (!(first instanceof Promise)) return;
    let cancelled = false;
    void first
      .then((text) => {
        if (cancelled) return;
        const later = readKept(text);
        if (later.open !== undefined) setOpenState(later.open);
        if (later.dock) setDock(later.dock);
        if (later.size !== undefined) setSize(later.size);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [first]);
  useEffect(() => {
    // Nothing is saved until what was kept has been read, so the defaults never overwrite it.
    if (!store || !loaded) return;
    void Promise.resolve(store.save(STORE, JSON.stringify({ open, dock, ...(size !== undefined ? { size } : {}) }))).catch(() => {});
  }, [store, loaded, open, dock, size]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const moved = useRef(false);
  const toggle = useCallback(() => {
    moved.current = true;
    setOpen(!open);
  }, [open, setOpen]);
  // Focus follows a person's own open or close: into the panel, and back to the button.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    if (open) panel.current?.focus();
    else button.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey || event.key.toLowerCase() !== "d") return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, toggle]);

  // The page makes room for a docked panel, so nothing is left underneath it.
  const docked = open && !popped && !inline;
  // To begin with: about half the window, within sensible bounds.
  const room = typeof window === "undefined" ? 800 : dock === "bottom" ? window.innerHeight : window.innerWidth;
  const span = size ?? Math.round(Math.max(dock === "bottom" ? 320 : 360, Math.min(640, room * (dock === "bottom" ? 0.6 : 0.42))));
  useEffect(() => {
    if (!docked) return;
    const narrow = window.matchMedia?.("(max-width: 40rem)").matches;
    const side = dock === "bottom" || narrow ? "paddingBottom" : "paddingRight";
    const body = document.body;
    const before = body.style[side];
    body.style[side] = `${span}px`;
    return () => {
      body.style[side] = before;
    };
  }, [docked, dock, span]);

  // A window of its own: the same panel, on the same recorder, drawn into another window's document.
  const popOut = () => {
    const other = window.open("", "surfaces-devtools", "popup,width=1200,height=760");
    if (!other) return setBlocked(true);
    setBlocked(false);
    other.document.title = "Surfaces dev tools";
    other.document.body.replaceChildren();
    other.document.body.style.margin = "0";
    const mount = other.document.createElement("div");
    mount.style.cssText = "display:flex;flex-direction:column;height:100vh";
    other.document.body.appendChild(mount);
    setPopped({ window: other, mount });
  };
  useEffect(() => {
    if (!popped) return;
    const other = popped.window;
    // The window looks as the page does: its stylesheets and theme are copied over, and again when they change.
    const copy = () => {
      const root = document.documentElement;
      for (const attribute of [...other.document.documentElement.attributes]) other.document.documentElement.removeAttribute(attribute.name);
      for (const attribute of [...root.attributes]) other.document.documentElement.setAttribute(attribute.name, attribute.value);
      for (const old of [...other.document.head.querySelectorAll("[data-sf-copied]")]) old.remove();
      for (const sheet of document.querySelectorAll('style, link[rel="stylesheet"]')) {
        const clone = other.document.importNode(sheet, true) as HTMLElement;
        clone.setAttribute("data-sf-copied", "");
        other.document.head.appendChild(clone);
      }
      other.document.body.style.background = "var(--sf-color-bg)";
    };
    copy();
    let waiting = 0;
    const watch = new MutationObserver(() => {
      window.clearTimeout(waiting);
      waiting = window.setTimeout(copy, 100);
    });
    watch.observe(document.documentElement, { attributes: true });
    watch.observe(document.head, { childList: true, subtree: true, characterData: true });
    for (const style of document.body.querySelectorAll("style[data-sf-theme]")) watch.observe(style, { childList: true, characterData: true, subtree: true });
    const closed = () => setPopped(undefined);
    other.addEventListener("pagehide", closed);
    const poll = window.setInterval(() => other.closed && closed(), 500);
    const leave = () => other.close();
    window.addEventListener("pagehide", leave);
    return () => {
      watch.disconnect();
      window.clearTimeout(waiting);
      window.clearInterval(poll);
      other.removeEventListener("pagehide", closed);
      window.removeEventListener("pagehide", leave);
      other.close();
    };
  }, [popped]);

  const drag = useRef<{ from: number; size: number } | undefined>(undefined);
  const along = (event: PointerEvent) => (dock === "bottom" || window.matchMedia?.("(max-width: 40rem)").matches ? -event.clientY : -event.clientX);
  const limit = () => Math.max(MIN_SIZE, (dock === "bottom" ? window.innerHeight : window.innerWidth) - 80);
  const resize = (to: number) => setSize(Math.round(Math.max(MIN_SIZE, Math.min(limit(), to))));
  const onGripKey = (event: KeyboardEvent) => {
    const grow = dock === "bottom" ? "ArrowUp" : "ArrowLeft";
    const shrink = dock === "bottom" ? "ArrowDown" : "ArrowRight";
    if (event.key !== grow && event.key !== shrink) return;
    event.preventDefault();
    resize(span + (event.key === grow ? STEP : -STEP));
  };

  const errors = useSyncExternalStore(
    recorder.subscribe,
    () => recorder.get().events.reduce((n, event) => n + (event.status === "error" ? 1 : 0), 0),
    () => 0,
  );
  // The backends the page's providers handed over, kept current as providers come and go.
  const [services, setServices] = useState<DevToolsServices>({});
  useEffect(() => {
    const read = () =>
      setServices((held) => {
        const next: DevToolsServices = { dataSource: recorder.service("dataSource"), discovery: recorder.service("discovery"), pipelines: recorder.service("pipelines"), semantics: recorder.service("semantics") };
        return (Object.keys(next) as (keyof DevToolsServices)[]).every((key) => held[key] === next[key]) ? held : next;
      });
    read();
    return recorder.subscribe(read);
  }, [recorder]);

  const inspected = useSyncExternalStore(recorder.onInspect, recorder.inspected, () => undefined);
  const picking = useSyncExternalStore(recorder.onInspect, recorder.picking, () => false);
  // Picking ends with the tools: closed, nothing is left catching presses on the page.
  useEffect(() => {
    if (!open) recorder.pick(false);
    return () => recorder.pick(false);
  }, [open, recorder]);

  const view = (inWindow: boolean) => (
    <Suspense fallback={<p className="sf-devtools-wait" role="status">Loading dev tools…</p>}>
      <Panel
        feed={recorder}
        onClear={recorder.clear}
        onInspect={recorder.inspect}
        inspected={inspected}
        catalog={catalog}
        renderers={renderers}
        services={services}
        actions={
          <>
            <button type="button" className="sf-devtools-icon" aria-pressed={picking} aria-label="Pick a component on the page" title={picking ? "Picking: press a component on the page, or Escape" : "Pick a component on the page"} onClick={() => recorder.pick(!picking)}>
              <ControlIcon icon={PickIcon} />
            </button>
            {!inWindow && !inline && (
              <button type="button" className="sf-devtools-icon sf-devtools-dockside" aria-label={dock === "bottom" ? "Dock to the side" : "Dock to the bottom"} title={dock === "bottom" ? "Dock to the side" : "Dock to the bottom"} onClick={() => setDock(dock === "bottom" ? "right" : "bottom")}>
                <ControlIcon icon={dock === "bottom" ? DockRightIcon : DockBottomIcon} />
              </button>
            )}
            {!inWindow && (
              <button type="button" className="sf-devtools-icon" aria-label="Open in a window of its own" title="Open in a window of its own" onClick={popOut}>
                <ControlIcon icon={PopOutIcon} />
              </button>
            )}
            <button
              type="button"
              className="sf-devtools-icon"
              aria-label={inWindow ? "Put back in the page" : "Close dev tools"}
              title={inWindow ? "Put back in the page" : "Close dev tools (Ctrl+Shift+D)"}
              onClick={() => (inWindow ? setPopped(undefined) : toggle())}
            >
              <ControlIcon icon={inWindow ? "fold" : "close"} />
            </button>
          </>
        }
      />
    </Suspense>
  );
  // A host with no theme of its own still gets a readable panel.
  const themed = (node: ReactNode) => (theme ? node : <ThemeProvider scope="scoped" storage={null}>{node}</ThemeProvider>);

  const count = errors > 0 ? <span className="sf-devtools-count">{errors}</span> : null;
  const parts = (
    <>
      {(!open || popped) && (
        <button ref={button} type="button" className="sf-devtools-button" aria-expanded={open} aria-label={`${open ? "Close" : "Open"} dev tools${errors > 0 ? `, ${errors} failed` : ""}`} title="Dev tools (Ctrl+Shift+D)" onClick={toggle}>
          {ToolsIcon}
          {count}
        </button>
      )}
      {blocked && (
        <p className="sf-devtools-wait" role="alert">
          The browser did not allow a new window. Allow pop-ups for this page and try again.
        </p>
      )}
      {open && !popped && (
        <div
          ref={panel}
          tabIndex={-1}
          className="sf-devtools-dock"
          data-dock={dock}
          style={inline ? { height: span } : dock === "bottom" ? { height: span } : { width: span, ["--sf-devtools-span" as string]: `${span}px` }}
        >
          {!inline && (
            <div
              role="separator"
              tabIndex={0}
              aria-label="Resize dev tools"
              aria-orientation={dock === "bottom" ? "horizontal" : "vertical"}
              aria-valuenow={span}
              aria-valuemin={MIN_SIZE}
              aria-valuemax={typeof window === "undefined" ? span : limit()}
              className="sf-devtools-grip"
              onKeyDown={onGripKey}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture?.(event.pointerId);
                drag.current = { from: along(event), size: span };
              }}
              onPointerMove={(event) => drag.current && resize(drag.current.size + (along(event) - drag.current.from))}
              onPointerUp={() => (drag.current = undefined)}
              onPointerCancel={() => (drag.current = undefined)}
            />
          )}
          <div className="sf-devtools-host">{view(false)}</div>
        </div>
      )}
      <InspectOverlay recorder={recorder} />
      {popped && createPortal(themed(view(true)), popped.mount)}
    </>
  );
  return themed(inline ? <div className="sf-devtools-inline">{parts}</div> : parts);
}

/** The drawn component an element of the page belongs to: the nearest one, going up, with a mark before it. */
function componentAt(start: Element | null): (InspectTarget & { element: Element }) | undefined {
  for (let node = start; node && node !== document.body; node = node.parentElement) {
    const mark = node.previousElementSibling;
    const surfaceKey = mark?.tagName === "TEMPLATE" ? mark.getAttribute(INSPECT_MARK) : null;
    const componentId = mark?.getAttribute(INSPECT_COMPONENT);
    if (surfaceKey && componentId) return { surfaceKey, componentId, element: node };
  }
  return undefined;
}

const OWN = ".sf-devtools-dock, .sf-devtools-button, .sf-devtools, .sf-devtools-inline";

/**
 * Outlines, on the page, the component picked in the panel, and while picking is on, the one under the pointer; a
 * press then picks it instead of reaching the page. The surface that drew a component puts a mark before it; this
 * follows the element after the mark as the page scrolls and resizes. The outline takes no presses and is hidden
 * from assistive technology: the panel says which component is picked, and its Components list picks one by keyboard.
 */
function InspectOverlay({ recorder }: { recorder: Recorder }) {
  const target = useSyncExternalStore(recorder.onInspect, recorder.inspected, () => undefined);
  const picking = useSyncExternalStore(recorder.onInspect, recorder.picking, () => false);
  const box = useRef<HTMLDivElement>(null);
  const hovered = useRef<Element | undefined>(undefined);

  useEffect(() => {
    if (!picking) return;
    const mine = (event: Event) => event.target instanceof Element && event.target.closest(OWN) !== null;
    const move = (event: Event) => {
      hovered.current = mine(event) ? undefined : componentAt(event.target as Element | null)?.element;
    };
    const press = (event: Event) => {
      if (mine(event)) return;
      // The page does not get this press: it picks a component, or nothing.
      event.preventDefault();
      event.stopPropagation();
      if (event.type !== "click") return;
      const found = componentAt(event.target as Element | null);
      if (found) recorder.inspect({ surfaceKey: found.surfaceKey, componentId: found.componentId });
      recorder.pick(false);
    };
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") recorder.pick(false);
    };
    const pressed = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const;
    document.addEventListener("pointermove", move, true);
    for (const name of pressed) document.addEventListener(name, press, true);
    document.addEventListener("keydown", key, true);
    document.documentElement.classList.add("sf-devtools-picking");
    return () => {
      document.removeEventListener("pointermove", move, true);
      for (const name of pressed) document.removeEventListener(name, press, true);
      document.removeEventListener("keydown", key, true);
      document.documentElement.classList.remove("sf-devtools-picking");
      hovered.current = undefined;
    };
  }, [picking, recorder]);

  useEffect(() => {
    const el = box.current;
    if ((!target && !picking) || !el) return;
    let frame = 0;
    let shown: Element | undefined;
    const pointed = (): Element | undefined => {
      let next = document.querySelector(`template[${INSPECT_POINTED}]`)?.nextElementSibling ?? undefined;
      while (next && next.tagName === "TEMPLATE") next = next.nextElementSibling ?? undefined;
      return next;
    };
    const place = () => {
      frame = requestAnimationFrame(place);
      const found = picking ? (hovered.current?.isConnected ? hovered.current : undefined) : pointed();
      if (!picking && found && found !== shown) {
        shown = found;
        // Brought into view once, without animation, clear of the tools' own drawer.
        reveal(found);
      }
      const rect = found?.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
    };
    place();
    return () => {
      cancelAnimationFrame(frame);
      el.hidden = true;
    };
  }, [target, picking]);
  if (!target && !picking) return null;
  return createPortal(<div ref={box} className="sf-devtools-inspect" aria-hidden="true" hidden />, document.body);
}

/** Scrolls an element of the page into view, keeping it out from under the docked tools. */
function reveal(element: Element): void {
  const dock = document.querySelector<HTMLElement>(".sf-devtools-dock");
  const styled = element instanceof HTMLElement ? element : undefined;
  const rect = dock?.getBoundingClientRect();
  const side = dock?.dataset.dock === "right" ? "scrollMarginRight" : "scrollMarginBottom";
  const before = styled?.style[side];
  // A scroll margin for this one scroll, then put back: the page's own styles are left as they were.
  if (styled && rect) styled.style[side] = `${Math.round(side === "scrollMarginRight" ? rect.width : rect.height)}px`;
  element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  if (styled && rect) styled.style[side] = before ?? "";
}
