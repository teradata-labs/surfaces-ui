import { Chat } from "@surfaces-ui/chat";
import { type ExploreState, Explorer, PipelinesProvider, SemanticModelEditor, SemanticsProvider, emptyModel, useSemanticModel, useSemantics } from "@surfaces-ui/components";
import type { Semantics } from "@surfaces-ui/data";
import type { SemanticModelSummary } from "@surfaces-ui/proto";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentChoice } from "../agentChoice.js";
import { useProviderMenu } from "../providers.js";
import { agentFor } from "../composerAgent.js";
import { demoAgent } from "../demoAgent.js";
import { focusFor } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";

const EMPTY: ExploreState = { fields: [], rows: [], values: [], filters: [] };

/**
 * A project's semantic models over the picked source: read and change one
 * (dimensions, measures, metrics, who defined each), and explore it with
 * pills that come from it. A field made in the explorer can be added to the
 * model, after which every report on it has it.
 */
export function SemanticPage({ source }: { source: ActiveSource }) {
  const semantics = useSemantics();
  const [models, setModels] = useState<SemanticModelSummary[] | undefined>();
  const [problem, setProblem] = useState<string | undefined>();
  const [chosen, setChosen] = useState<string | undefined>();
  // A new model is made with the agent first; "yourself" opens the same editor empty.
  const [making, setMaking] = useState<"agent" | "yourself" | undefined>();
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    if (!semantics) return;
    let live = true;
    semantics
      .listSemanticModels({ sourceId: source.sourceId })
      .then((found) => {
        if (!live) return;
        setModels(found.models);
        // Open on the model with the most defined (its metrics), not the first by name.
        const richest = [...found.models].sort((a, b) => b.metricCount - a.metricCount || b.measureCount - a.measureCount)[0];
        setChosen((now) => (now && found.models.some((m) => m.name === now) ? now : richest?.name));
      })
      .catch((error: unknown) => live && setProblem(error instanceof Error ? error.message : String(error)));
    return () => {
      live = false;
    };
  }, [semantics, source.sourceId, asked]);

  const { model, problem: modelProblem, save, promote } = useSemanticModel(chosen, { editor: "you" });
  // The shelves belong to one model: another model starts them again, and never sees the last one's pills.
  const [explored, setExplored] = useState<{ model: string; state: ExploreState }>({ model: "", state: EMPTY });
  const explore = explored.model === model?.name ? explored.state : EMPTY;
  const setExplore = (state: ExploreState) => setExplored({ model: model?.name ?? "", state });

  // Models built on a pipeline's dataset show when it was built and how its checks went.
  const page = (
    <div className="semantic-page">
      <aside className="card side" aria-label="Semantic models">
        <div className="card-head">
          <h2>Models</h2>
          <button type="button" className="sf-button" data-variant="primary" aria-pressed={!!making} onClick={() => setMaking("agent")}>
            New model
          </button>
        </div>
        {problem && <p className="hint">{problem}</p>}
        {models?.length === 0 && <p className="hint">No semantic model over this source yet. Fields made in an explorer or a report can start one.</p>}
        <ul className="semantic-list">
          {models?.map((m) => (
            <li key={m.name}>
              <button type="button" className="sf-button" aria-pressed={!making && m.name === chosen} onClick={() => (setChosen(m.name), setMaking(undefined))}>
                <span className="semantic-list-label">{m.label || m.name}</span>
                <span className="hint">
                  {m.dimensionCount} dimensions · {m.measureCount} measures · {m.metricCount} metrics · v{m.version}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="semantic-main">
        {making ? (
          <NewModel
            source={source}
            mode={making}
            onMode={setMaking}
            onSaved={(name) => {
              setAsked((n) => n + 1);
              if (name) (setChosen(name), setMaking(undefined));
            }}
          />
        ) : model && model.name === chosen ? (
          <>
            <section className="card" aria-label="Model">
              <SemanticModelEditor
                model={model}
                problem={modelProblem}
                onSave={async (draft, note) => {
                  const saved = await save(draft, note);
                  setAsked((n) => n + 1);
                  return saved;
                }}
              />
            </section>
            <section className="card" aria-label="Explore the model">
              <div className="card-head">
                <h2>Explore it</h2>
                <span className="hint">Pills marked “model” come from it. Make a field here, then “Add to the model” from its menu or with M.</span>
              </div>
              <Explorer
                key={model.name}
                model={model}
                value={explore}
                onChange={setExplore}
                onPromote={async (pill, all) => {
                  const said = await promote(pill, all);
                  setAsked((n) => n + 1);
                  return said;
                }}
              />
            </section>
          </>
        ) : (
          <p className="hint">{modelProblem ?? (chosen ? "Loading the model…" : "Choose a model.")}</p>
        )}
      </div>
    </div>
  );
  return source.pipelines ? <PipelinesProvider pipelines={source.pipelines}>{page}</PipelinesProvider> : page;
}

/**
 * Making a model: the agent first, in a conversation whose replies draw the
 * proposed model live (its joins, grain, key and fields, all editable), and
 * the same editor empty for a person who would rather start it themselves.
 */
function NewModel({ source, mode, onMode, onSaved }: { source: ActiveSource; mode: "agent" | "yourself"; onMode(mode: "agent" | "yourself" | undefined): void; onSaved(name?: string): void }) {
  const choice = useAgentChoice(source.kind === "server");
  const { picked } = choice;
  const table = firstTable(source);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the focus depends only on the source id and table.
  const focus = useMemo(() => focusFor(source.sourceId, table), [source.sourceId, table]);
  const agent = useMemo(() => agentFor(picked, source.dataSource, focus, () => demoAgent(source.dataSource, focus), source.semantics, choice.model), [picked, source.dataSource, focus, source.semantics, choice.model]);
  const scripted = picked.kind === "scripted";
  const menu = useProviderMenu(choice);
  const start = useMemo(() => emptyModel({ sourceId: source.sourceId }), [source.sourceId]);
  // Whatever saves a model here (a proposal in the conversation, or the editor) goes through this store, which says so once it is kept.
  const saved = useRef(onSaved);
  saved.current = onSaved;
  const semantics = useMemo<Semantics>(
    () => ({
      ...source.semantics,
      saveSemanticModel: async (request, options) => {
        const answer = await source.semantics.saveSemanticModel(request, options);
        saved.current(answer.model?.name);
        return answer;
      },
    }),
    [source.semantics],
  );
  return (
    <section className="card semantic-new" aria-label="New model">
      <div className="card-head">
        <h2>New model</h2>
        <div className="sf-segmented" role="group" aria-label="Make it">
          <button type="button" className="sf-button" aria-pressed={mode === "agent"} onClick={() => onMode("agent")}>
            With the agent
          </button>
          <button type="button" className="sf-button" aria-pressed={mode === "yourself"} onClick={() => onMode("yourself")}>
            Yourself
          </button>
        </div>
        <button type="button" className="sf-button" onClick={() => onMode(undefined)}>
          Cancel
        </button>
      </div>
      <SemanticsProvider semantics={semantics}>
      {mode === "agent" ? (
        <>
          <Chat
            key={source.sourceId}
            {...menu}
            agent={agent}
            agentId={picked.agentId}
            height="min(48rem, calc(100dvh - 14rem - var(--shell-bar, 0px)))"
            starters={
              scripted
                ? ["Draft a semantic model of the main table"]
                : [
                    `Draft a semantic model of the main table in the "${source.sourceId}" source: read the tables, join what adds detail to each row, and propose what one row is, its key and its fields`,
                    `Which measures would a model of the "${source.sourceId}" source need? Propose one`,
                  ]
            }
            empty="Say what you want to measure. The agent reads the tables (names, types and keys, never values) and proposes a model: the table whose rows it counts, the joins that add detail, what one row is, its key and its fields. You change any of it, and only your save keeps it."
          />
          <p className="hint">{scripted ? "No model is picked, so the draft follows a fixed recipe from the declared keys and column types. Pick a model in the box's Model menu for one that reads your request." : `${picked.detail} Nothing it proposes is kept until you save.`}</p>
        </>
      ) : (
        <SemanticModelEditor
          model={start}
          building
          onSave={async (draft, note) => {
            return (await semantics.saveSemanticModel({ model: { ...draft, savedBy: "you" }, expectedVersion: 0, note })).model;
          }}
        />
      )}
      </SemanticsProvider>
    </section>
  );
}
