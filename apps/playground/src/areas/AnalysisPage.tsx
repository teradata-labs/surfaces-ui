import { Chat, type ChatThread, agentSurfaceId, conversationDocument, scriptAgent, scriptThread } from "@surfaces-ui/chat";
import { Workspace } from "@surfaces-ui/components";
import { StaleSurfaceError, surfaceKindOf } from "@surfaces-ui/data";
import { seedById } from "@surfaces-ui/seeds";
import { type ConversationScript, type PageDocument, type SurfaceAction, analyticsCatalog, surfaceKind } from "@surfaces-ui/spec";
import { SurfaceView, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { useMemo, useState } from "react";
import { SaveToLibrary } from "../SaveToLibrary.js";
import { surfaceLink } from "../libraryLinks.js";
import type { ActiveSource } from "../source.js";
import { MaybePipelines, usePrepared } from "./LibraryPage.js";

/** The written conversations the playground ships, from the seeds they are about. */
export function sampleConversations(source: ActiveSource): { seedId: string; script: ConversationScript }[] {
  return source.sources.flatMap((option) => (seedById(option.id)?.conversations ?? []).map((script) => ({ seedId: option.id, script })));
}

/** The last surface a thread drew that would stand on its own as a page (a dashboard), as a page document. */
export function surfaceToKeep(thread: ChatThread, id: string, fallbackTitle: string): PageDocument | undefined {
  const keys = thread.messages.flatMap((m) => m.parts.flatMap((p) => (p.kind === "surface" ? [p.surfaceId] : [])));
  for (const key of keys.reverse()) {
    const drawn = thread.surfaces[key];
    if (!drawn) continue;
    const components = Object.values(drawn.components);
    if (surfaceKind({ components }) !== "dashboard") continue;
    const heading = components.find((c) => c.component === "Text" && c.variant === "h2");
    return {
      id: `${id}-${agentSurfaceId(key)}`,
      title: typeof heading?.text === "string" ? heading.text : fallbackTitle,
      catalogId: drawn.catalogId,
      components,
      ...(drawn.data && Object.keys(drawn.data as object).length > 0 ? { data: drawn.data } : {}),
    };
  }
  return undefined;
}

/** Saves the conversation as it stands as a saved surface of kind "conversation", a new version each time. */
function SaveConversation({ source, script, thread }: { source: ActiveSource; script: ConversationScript; thread: ChatThread }) {
  const [state, setState] = useState<{ busy?: boolean; saved?: number; error?: string }>({});
  const save = async () => {
    setState({ busy: true });
    try {
      let latest = 0;
      try {
        latest = (await source.library.getSurface({ id: script.id })).surface?.version ?? 0;
      } catch {
        // Not saved yet.
      }
      const { surface } = await source.library.saveSurface({
        surface: {
          id: script.id,
          kind: surfaceKindOf("conversation"),
          title: script.title,
          description: script.description,
          document: conversationDocument(thread, { id: script.id, title: script.title, description: script.description }) as never,
          tags: ["conversation", "sample"],
          savedBy: "Playground user",
          generatedBy: script.answeredBy,
        },
        expectedVersion: latest,
        note: `${thread.messages.filter((m) => m.role === "user").length} turns`,
      });
      setState({ saved: surface?.version ?? latest + 1 });
    } catch (error) {
      setState({ error: error instanceof StaleSurfaceError ? error.message : error instanceof Error ? error.message : String(error) });
    }
  };
  return (
    <div className="analysis-save">
      <button type="button" className="btn" disabled={state.busy || thread.messages.length === 0 || thread.status !== "idle"} onClick={() => void save()}>
        Save this conversation
      </button>
      {state.saved !== undefined && (
        <p className="hint" role="status">
          Saved as version {state.saved}. <a href={surfaceLink(script.id)}>Open it in the library</a>, under Conversation.
        </p>
      )}
      {state.error && (
        <p className="catalog-error" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}

/**
 * A written conversation shown whole: a question that needs several tables,
 * answered in one thread with text, steps, description cards, a relationship
 * diagram, charts, a table and a pipeline graph, ending in a dashboard a
 * person can keep. The components are live and read the sample data; the
 * replies are written out, not a model's, and say so.
 */
export function AnalysisPage({ source }: { source: ActiveSource }) {
  const samples = useMemo(() => sampleConversations(source), [source.sources]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opens on a conversation over the model picked in the sidebar, until the person picks another here.
  const [choice, setChoice] = useState<{ sourceId: string; index: number }>();
  const preferred = Math.max(0, samples.findIndex((s) => s.seedId === source.sourceId));
  const picked = choice?.sourceId === source.sourceId ? choice.index : preferred;
  const setPicked = (index: number) => setChoice({ sourceId: source.sourceId, index });
  const sample = samples[Math.min(picked, samples.length - 1)];
  // How much of the script the thread opens with: all of it, or nothing, to step through it.
  const [start, setStart] = useState<"whole" | "empty">("whole");
  // Each restart is a new conversation: a new thread and an agent that has played nothing.
  const [run, setRun] = useState(0);
  const [thread, setThread] = useState<ChatThread | undefined>();
  const [sent, setSent] = useState<SurfaceAction | undefined>();

  const script = sample?.script;
  const agent = useMemo(() => (script ? scriptAgent(script, { catalog: analyticsCatalog, delayMs: 60, played: start === "whole" ? script.turns.length : 0 }) : undefined), [script, start, run]); // eslint-disable-line react-hooks/exhaustive-deps
  const initial = useMemo(() => (script ? scriptThread(script, analyticsCatalog, start === "whole" ? script.turns.length : 0) : undefined), [script, start]);
  const seedPage = useMemo<PageDocument | undefined>(() => (sample ? { id: "prepare", title: "", catalogId: analyticsCatalog.id, components: [{ id: "root", component: "Text", text: "", sourceId: sample.seedId }] } : undefined), [sample]);
  const prepared = usePrepared(source, seedPage);
  const kept = useMemo(() => (thread && script ? surfaceToKeep(thread, script.id, script.title) : undefined), [thread, script]);

  if (!sample || !script || !agent || !initial) {
    return (
      <section className="card">
        <h2>Sample analysis</h2>
        <p className="hint">No written conversation ships for the data in reach. The Retail and Telco churn samples have them.</p>
      </section>
    );
  }

  const restart = (next: "whole" | "empty") => {
    setStart(next);
    setRun((n) => n + 1);
    setThread(undefined);
    setSent(undefined);
  };
  const turns = thread?.messages.filter((m) => m.role === "user").length ?? 0;

  const conversation = (
    <section className="card chat-page analysis-thread">
      <div className="card-head">
        <h2>{script.title}</h2>
        <div className="actions">
          {samples.length > 1 && (
            <label className="analysis-pick">
              <span className="sf-a2-visually-hidden">Conversation</span>
              <select className="sf-input" value={picked} onChange={(e) => (setPicked(Number(e.target.value)), restart("whole"))}>
                {samples.map((s, i) => (
                  <option key={s.script.id} value={i}>
                    {s.script.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="btn" onClick={() => restart("empty")}>
            Play from the start
          </button>
          <button type="button" className="btn" onClick={() => restart("whole")}>
            Show it whole
          </button>
        </div>
      </div>
      <p className="hint" role="note">
        Written out in advance, not a model's answers; each reply says so. The components are real and read the {seedById(sample.seedId)?.title ?? sample.seedId} sample. {script.description}
      </p>
      {prepared.error && (
        <p className="catalog-error" role="alert">
          {prepared.error}
        </p>
      )}
      {!prepared.ready ? (
        <p className="hint">Loading the data this conversation reads…</p>
      ) : (
        <MaybePipelines source={source}>
          <Chat
            key={`${script.id}-${run}`}
            agent={agent}
            height="100%"
            initialThread={initial}
            onThreadChange={setThread}
            starters={[script.turns[0]!.say]}
            placeholder="Pick a suggestion: this conversation answers what it was written for"
            empty="Press the suggestion below to ask the first question, then follow the suggestions after each reply."
          />
        </MaybePipelines>
      )}
    </section>
  );

  const keep = (
    <div className="analysis-keep">
      <p className="hint">
        {turns} of {script.turns.length} turns shown. A conversation is a document too: kept, it is a saved surface of kind Conversation, with versions like any other.
      </p>
      <SaveConversation key={`${script.id}-${run}`} source={source} script={script} thread={thread ?? initial} />
      <h3 className="catalog-sub">The surface it made</h3>
      {!kept ? (
        <p className="hint">Nothing to keep yet. When the thread draws something that stands on its own (several charts and numbers together), the latest one appears here as a page.</p>
      ) : (
        <>
          <p className="hint">
            Taken from the thread as a page document ({kept.components.length} components). Saving is a person's step; from the library it opens in the Playground to rearrange or change by asking.
          </p>
          <SaveToLibrary key={kept.id} source={source} page={kept} defaultKind="dashboard" defaultTags={["retail", "from a conversation"]} generatedBy={script.answeredBy} label="Save as a surface" />
          <div className="analysis-surface sf-container">
            <SurfaceView
              surface={{ surfaceId: kept.id, catalogId: kept.catalogId, components: Object.fromEntries(kept.components.map((c) => [c.id, c])), data: (kept.data as Record<string, unknown>) ?? {} }}
              catalog={analyticsCatalog}
              renderers={lazyAnalyticsRenderers}
              onAction={setSent}
            />
          </div>
          {sent && (
            <p className="hint" role="status">
              A control sent “{sent.name}”. On a page of its own nothing else acts on it.
            </p>
          )}
        </>
      )}
    </div>
  );

  return (
    <Workspace
      className="chat-workspace analysis-workspace"
      label="Sample analysis panels"
      height="max(34rem, calc(100dvh - 7.5rem - var(--shell-bar, 0px)))"
      defaultLayout={{ columns: [["thread"], ["keep"]], columnWidths: [0.62, 0.38] }}
      panels={[
        { id: "thread", title: "Conversation", shortTitle: "Thread", icon: "agent", fill: true, content: conversation },
        { id: "keep", title: "Keep", icon: "save", content: keep },
      ]}
    />
  );
}
