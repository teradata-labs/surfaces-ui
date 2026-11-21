import type { JsonObject } from "@bufbuild/protobuf";
import type { AgentBackend } from "@surfaces-ui/agent";
import { type Catalog, type PageDocument, type SurfaceMessage, analyticsCatalog, editPage, editsFromMessages, pageSurface, removeComponentMessages } from "@surfaces-ui/spec";
import { ArrangeGhost, ArrangeHelp, ArrangeToggle, type ComponentRenderer, type SurfaceNote, SurfaceView, lazyAnalyticsRenderers, useArrange } from "@surfaces-ui/spec/react";
import { type Store, createStore } from "@surfaces-ui/state";
import { useHistory, useStore } from "@surfaces-ui/state/react";
import { ChatComposer } from "./ChatComposer.js";
import type { ChatProvider } from "./selectors.js";
import type { ChatActor } from "./thread.js";
import type { ChatSettings } from "./useChat.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** What happened when one instruction was applied. */
export interface StudioChange {
  instruction: string;
  /** The agent's own words about what it did. */
  summary: string;
  /** The model or agent that made the change, or the person who arranged the page by hand. Always shown. */
  generatedBy: string;
  /** True when a person made the change by hand (arranging), not an agent. */
  byPerson?: boolean;
  applied: number;
  /** Changes the catalog refused, and why. */
  rejected: string[];
  error?: string;
}

/**
 * The text sent to the agent for one instruction: what the person asked, how
 * to answer, and the page as it is now.
 */
export function studioPrompt(page: PageDocument, instruction: string): string {
  return [
    `Instruction: ${instruction}`,
    "",
    `Change the page "${page.id}" by sending A2UI updateComponents messages for surfaceId "${page.id}".`,
    "Send only the components you add or change. To remove one, send its container without it in children.",
    "Say in one sentence what you changed.",
    "",
    `Page title: ${page.title}`,
    "Current page:",
    JSON.stringify(page.components),
  ].join("\n");
}

export interface UsePageStudio {
  page: PageDocument;
  /** The store holding the page, for persistence or URL sync from `@surfaces-ui/state`. */
  store: Store<PageDocument>;
  changes: StudioChange[];
  busy: boolean;
  /** Sends an instruction to the agent and applies the edits it returns. */
  instruct(instruction: string): Promise<void>;
  /**
   * Applies a change a person made by hand, such as arranging, as A2UI
   * messages: one undo step, a line in the log by them, and a note the agent
   * reads with the next instruction.
   */
  arrange(messages: SurfaceMessage[], title: string, by?: string): void;
  stop(): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * Records where the drawn page stands: what a person typed, or one
   * component's controls in catalog prop form. Sent with every instruction
   * (`SendRequest.surfaces`), so the agent edits the page as the person sees it.
   */
  report(state: { data?: unknown; componentId?: string; controls?: Record<string, unknown>; note?: SurfaceNote }): void;
}

/**
 * Lets an agent configure a page from plain-language instructions. The
 * agent answers with A2UI messages; they are turned into edits, each edit is
 * checked against the catalog, and only valid ones change the page. Every
 * instruction is one undo step.
 */
export function usePageStudio(agent: AgentBackend, initial: PageDocument, catalog: Catalog = analyticsCatalog): UsePageStudio {
  const store = useMemo(() => createStore(initial), [initial]);
  const page = useStore(store);
  const history = useHistory(store);
  const [changes, setChanges] = useState<StudioChange[]>([]);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | undefined>(undefined);
  const session = useRef("");
  const local = useRef<{ data?: unknown; controls: Record<string, Record<string, unknown>>; activity: { componentId: string; kind: string; summary: string; subject?: Record<string, unknown>; at: string }[] }>({ controls: {}, activity: [] });

  useEffect(() => {
    setChanges([]);
    session.current = "";
    local.current = { controls: {}, activity: [] };
    return () => controller.current?.abort();
  }, [store]);

  const instruct = useCallback(
    async (instruction: string) => {
      const text = instruction.trim();
      if (!text) return;
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setBusy(true);
      const before = store.get();
      const messages: SurfaceMessage[] = [];
      const change: StudioChange = { instruction: text, summary: "", generatedBy: "", applied: 0, rejected: [] };
      try {
        const surfaces = [
          {
            surfaceId: before.id,
            dataModel: toJson(local.current.data ?? before.data ?? {}),
            controls: Object.fromEntries(Object.entries(local.current.controls).map(([id, c]) => [id, toJson(c)])),
            // What the person did on the page since the last instruction, told once.
            activity: local.current.activity.map((a) => ({ componentId: a.componentId, kind: a.kind, summary: a.summary, at: a.at, ...(a.subject ? { subject: toJson(a.subject) } : {}) })),
          },
        ];
        local.current.activity = [];
        for await (const event of agent.send({ sessionId: session.current, input: { case: "text", value: studioPrompt(before, text) }, surfaces }, { signal: current.signal })) {
          const part = event.event;
          if (part.case === "text") change.summary += part.value.delta;
          else if (part.case === "surface") messages.push(part.value as unknown as SurfaceMessage);
          else if (part.case === "error") change.error = part.value.message;
          else if (part.case === "done") {
            change.generatedBy = part.value.generatedBy;
            session.current = part.value.sessionId || session.current;
          }
        }
        const edits = editsFromMessages(before, messages);
        const result = editPage(before, edits, catalog);
        change.applied = edits.length - result.rejected.length;
        change.rejected = result.rejected.map((r) => r.reason);
        if (change.applied > 0) store.set(result.page);
      } catch (error) {
        change.error = error instanceof Error ? error.message : String(error);
      } finally {
        if (!current.signal.aborted) setChanges((previous) => [...previous, { ...change, summary: change.summary.trim() }]);
        if (controller.current === current) {
          controller.current = undefined;
          setBusy(false);
        }
      }
    },
    [agent, catalog, store],
  );
  const stop = useCallback(() => {
    controller.current?.abort();
    controller.current = undefined;
    setBusy(false);
  }, []);

  const arrange = useCallback<UsePageStudio["arrange"]>(
    (messages, title, by = "you") => {
      const before = store.get();
      const edits = editsFromMessages(before, messages);
      const result = editPage(before, edits, catalog);
      const applied = edits.length - result.rejected.length;
      if (applied > 0) store.set(result.page);
      setChanges((previous) => [...previous, { instruction: title, summary: "", generatedBy: by, byPerson: true, applied, rejected: result.rejected.map((r) => r.reason) }]);
      if (applied === 0) return;
      // What changed, as the props that now say where things are: the same form an agent arranges with.
      const changed = edits.flatMap((edit) => (edit.op === "set" ? [edit.component] : []));
      const subject = Object.fromEntries(changed.map(({ id, children, widths, height, minHeight }) => [id, Object.fromEntries(Object.entries({ children, widths, height, minHeight }).filter(([, v]) => v !== undefined))]));
      local.current.activity = [...local.current.activity, { componentId: changed[0]?.id ?? "root", kind: "layout.changed", summary: `${title}.`, subject, at: new Date().toISOString() }].slice(-40);
    },
    [catalog, store],
  );

  const report = useCallback<UsePageStudio["report"]>((state) => {
    if (state.data !== undefined) local.current.data = state.data;
    if (state.componentId && state.controls) local.current.controls[state.componentId] = state.controls;
    if (state.componentId && state.note) local.current.activity = [...local.current.activity, { componentId: state.componentId, ...state.note, at: new Date().toISOString() }].slice(-40);
  }, []);

  return { page, store, changes, busy, instruct, arrange, stop, undo: history.undo, redo: history.redo, canUndo: history.canUndo(), canRedo: history.canRedo(), report };
}

const toJson = (value: unknown): JsonObject => {
  const plain = JSON.parse(JSON.stringify(value ?? {}, (_, v) => (typeof v === "bigint" ? String(v) : v))) as unknown;
  return plain && typeof plain === "object" && !Array.isArray(plain) ? (plain as JsonObject) : {};
};

export interface PageStudioProps {
  agent: AgentBackend;
  /** The page to start from. A different document starts again. */
  page: PageDocument;
  catalog?: Catalog;
  renderers?: Record<string, ComponentRenderer>;
  /** Instructions offered as one-press examples. */
  starters?: string[];
  /** Called after each change with the page as it is now. */
  onChange?(page: PageDocument): void;
  /** Where models run, when the host can reach several: the box's Model menu groups models by provider. */
  providers?: ChatProvider[];
  settings?: ChatSettings;
  onSettingsChange?(settings: ChatSettings): void;
  onManageProviders?(): void;
  /**
   * Lets a person arrange the page by hand: move components, put two side by
   * side, and drag heights and widths. Off unless given. Each change is one
   * undo step, shows in the log by `user`, and is told to the agent.
   */
  arrange?: boolean;
  /**
   * With `arrange`: keeps the width handles between a Grid's or Row's columns,
   * and the height handle under a component whose height is set, while nobody
   * is arranging. Each drag is one undo step, the same as in Arrange.
   */
  resizeWhileViewing?: boolean;
  /** Who is arranging, for the log. */
  user?: ChatActor;
  className?: string;
}

/**
 * A page with an instruction box beside it. A person says what they want
 * ("add a chart of revenue by month", "remove the table") and the agent
 * changes the page. Changes are listed with who made them, anything the
 * catalog refused, and can be undone.
 */
export function PageStudio(props: PageStudioProps) {
  const catalog = props.catalog ?? analyticsCatalog;
  const studio = usePageStudio(props.agent, props.page, catalog);
  const onChange = useRef(props.onChange);
  onChange.current = props.onChange;
  useEffect(() => onChange.current?.(studio.page), [studio.page]);
  const surface = useMemo(() => pageSurface(studio.page), [studio.page]);
  const by = props.user?.name ?? "you";
  const [arrangeStatus, setArrangeStatus] = useState<{ text: string; error?: boolean }>();
  const arrange = useArrange({
    surface,
    catalog,
    apply: (messages, title) => studio.arrange(messages, title, by),
    say: setArrangeStatus,
    remove: (id) => {
      const result = removeComponentMessages(surface, id);
      if ("error" in result) setArrangeStatus({ text: result.error, error: true });
      else studio.arrange(result.messages, `Removed "${id}"`, by);
    },
    resizeWhileViewing: props.resizeWhileViewing === true,
  });
  const frame = props.arrange === true ? arrange.surfaceFrame : undefined;

  return (
    <div className={["sf-studio", props.className].filter(Boolean).join(" ")}>
      <section className="sf-studio-page" aria-label={studio.page.title} aria-busy={studio.busy}>
        <h3 className="sf-studio-title">{studio.page.title}</h3>
        {studio.page.description && <p className="sf-object-muted">{studio.page.description}</p>}
        {props.arrange && <ArrangeHelp arrange={arrange} status={arrangeStatus} />}
        <div {...(props.arrange ? arrange.region : {})}>
          <SurfaceView
            surface={props.arrange ? arrange.shown(surface) : surface}
            catalog={catalog}
            renderers={props.renderers ?? lazyAnalyticsRenderers}
            onDataChange={(data) => studio.report({ data })}
            onControlsChange={(componentId, controls) => studio.report({ componentId, controls })}
            onContext={(componentId, note) => studio.report({ componentId, note })}
            {...(frame ? { frame } : {})}
          />
        </div>
        {props.arrange && <ArrangeGhost arrange={arrange} />}
      </section>

      <aside className="sf-studio-side" aria-label="Change this page">
        <div className="sf-studio-form">
          <ChatComposer
            label="Describe a change"
            placeholder="Add a line chart of revenue by month"
            onSend={(text) => void studio.instruct(text)}
            onStop={studio.stop}
            streaming={studio.busy}
            agents={[]}
            providers={props.providers}
            settings={props.settings}
            onSettingsChange={props.onSettingsChange}
            onManageProviders={props.onManageProviders}
          />
          <div className="sf-object-buttons">
            <button type="button" className="sf-button" disabled={!studio.canUndo || studio.busy} onClick={studio.undo}>
              Undo
            </button>
            <button type="button" className="sf-button" disabled={!studio.canRedo || studio.busy} onClick={studio.redo}>
              Redo
            </button>
            {props.arrange && <ArrangeToggle arrange={arrange} />}
          </div>
        </div>
        {props.starters && props.starters.length > 0 && (
          <div className="sf-chat-suggestions" role="group" aria-label="Examples">
            {props.starters.map((starter) => (
              <button key={starter} type="button" className="sf-button" disabled={studio.busy} onClick={() => void studio.instruct(starter)}>
                {starter}
              </button>
            ))}
          </div>
        )}
        <ol className="sf-studio-log" aria-label="Changes" aria-live="polite">
          {studio.changes.map((change, index) => (
            <li key={index} data-failed={change.error || change.applied === 0 ? "" : undefined}>
              <p className="sf-studio-instruction">{change.instruction}</p>
              {!change.byPerson && <p>{change.error ?? (change.summary || (change.applied > 0 ? "Changed." : "Nothing was changed."))}</p>}
              {change.rejected.map((reason) => (
                <p key={reason} className="sf-studio-rejected">
                  Not applied: {reason}
                </p>
              ))}
              {change.generatedBy && <p className="sf-chat-by">{change.byPerson ? `Arranged by ${change.generatedBy}` : `By ${change.generatedBy}`}</p>}
            </li>
          ))}
          {studio.busy && <li className="sf-chat-thinking">Working…</li>}
        </ol>
      </aside>
    </div>
  );
}
