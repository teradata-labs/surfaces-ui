import { clone, create } from "@bufbuild/protobuf";
import { type DataSource, type Pipelines, aggregateWord, collect, datasetSql, draftSemanticFields, semanticModelFromDataset, semanticModelProblems, thePipeline } from "@surfaces-ui/data";
import { DatasetKind, DimensionKind, DimensionSchema, MeasureSchema, type Pipeline, type SemanticModel, SemanticModelSchema } from "@surfaces-ui/proto";
import type { Field } from "apache-arrow";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OnContext } from "../controls/context.js";
import { CONTROLS_HOST, ItemControls, standardControls } from "../controls/ItemControls.js";
import { useDataSource } from "../data/DataSourceProvider.js";
import { messageOf } from "../data/useRowWindow.js";
import { useOptionalPipelines } from "../pipeline/PipelineView.js";
import { piiHints } from "../review/pii.js";
import { ModelLineage } from "./ModelLineage.js";
import { PillEditor } from "./Explorer.js";
import type { Pill, PillKind } from "./model.js";
import { type FieldChange, fieldNamed, modelChanges, pillsFromModel, setModelField } from "./semantic.js";
import { SemanticRows } from "./SemanticRows.js";

export interface SemanticModelEditorProps {
  /**
   * The model as saved. A model of version 0 is not saved yet: the editor
   * creates it, asking for its name, what one row is and its key, and keeps
   * it as version 1 when a person saves.
   */
  model: SemanticModel;
  /**
   * Changes not saved yet: a person's edits, or what an agent proposes. Held
   * by the host when given; each change comes back through `onDraftChange`.
   * Nothing is kept until a person presses Save.
   */
  draft?: SemanticModel;
  defaultDraft?: SemanticModel;
  onDraftChange?(draft: SemanticModel | undefined): void;
  /** Who proposed the draft, when it was not the person looking at it: an agent's name. Shown above the changes. */
  proposedBy?: string;
  /** Keeps the draft as the model's next version. Left out, the model is shown and cannot be changed. Resolve to the saved model, or undefined when it was refused. */
  onSave?(draft: SemanticModel, note: string): Promise<SemanticModel | undefined> | SemanticModel | undefined | void;
  /** A problem the store reported on the last save, shown with the changes. */
  problem?: string;
  /** Name recorded on fields a person adds or changes. Defaults to "you". */
  editor?: string;
  /** Told what a person does here (a field added, changed or removed, the rows changed, the changes saved or dropped), for an agent's context. */
  onContext?: OnContext;
  /**
   * Hands a person's words to the host's agent with the draft as it stands,
   * so the agent can propose or redo it. The editor never calls a model.
   * Left out, there is no box to ask in.
   */
  onAsk?(text: string, draft: SemanticModel): void;
  /** Who `onAsk` reaches, as the box names it. Defaults to "the agent". */
  askLabel?: string;
  /** Open the join builder at once: a new model built from tables. */
  building?: boolean;
  dataSource?: DataSource;
  /**
   * Where pipeline datasets come from. Left out, the one from
   * `PipelinesProvider`. With one, a new model can start from a built
   * dataset (its grain, key and columns), and a model on a dataset shows
   * when it was built, how its checks went and what it reads.
   */
  pipelines?: Pipelines;
  /** Opens a model's dataset in the host's pipeline view. */
  onOpenDataset?(pipelineId: string, dataset: string): void;
  className?: string;
}

const KIND: Record<PillKind, { title: string; one: string; hint: string }> = {
  attribute: { title: "Dimensions", one: "dimension", hint: "Ways to break the rows down: a category, or a date grouped by month." },
  metric: { title: "Measures", one: "measure", hint: "A column summarised: a sum, an average, a count." },
  derived: { title: "Metrics", one: "metric", hint: "Arithmetic over measures, worked out by the database after summarising: a rate, a margin." },
};
const AGGREGATE_WORDS: Record<string, string> = { sum: "Sum", avg: "Average", count: "Count", count_distinct: "Distinct count", min: "Smallest", max: "Largest", median: "Median", stddev: "Standard deviation", variance: "Variance" };
const CHANGE_WORDS: Record<FieldChange, string> = { added: "Added", changed: "Changed", removed: "Removed" };
/** The parts of a model that are not fields, as a change list names them. */
const PART_WORDS: Record<string, string> = { "(name)": "the name", "(label)": "the label", "(description)": "the description", "(sql)": "the query", "(grain)": "what one row is", "(primaryKey)": "the key", "(joins)": "the tables and joins", "(dataset)": "the pipeline dataset" };
const changeText = ([name, kind]: [string, FieldChange]) => (PART_WORDS[name] ? `Changed ${PART_WORDS[name]}` : `${CHANGE_WORDS[kind]} ${name}`);
const modelName = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+|_+$/g, "")
    .slice(0, 64);

function definition(model: SemanticModel, pill: Pill): string {
  if (pill.kind === "attribute") {
    const dimension = model.dimensions.find((d) => d.name === pill.id);
    return dimension?.kind === DimensionKind.TIME ? `${pill.column}, by ${pill.grain ?? "month"}` : (pill.column ?? "");
  }
  if (pill.kind === "metric") return pill.column ? `${AGGREGATE_WORDS[pill.aggregate ?? ""] ?? pill.aggregate} of ${pill.column}` : "Count of rows";
  return pill.expression ?? "";
}

/**
 * A semantic model, to read and to change: its query, and its dimensions,
 * measures and metrics with who defined each. Changes, a person's or an
 * agent's, are a draft marked field by field against what is saved, checked
 * as they are made, and kept only when a person saves them as the next
 * version. Every report and explorer on the model takes its fields from it.
 */
export function SemanticModelEditor(props: SemanticModelEditorProps) {
  const { model, onSave, editor = "you" } = props;
  const isNew = model.version === 0;
  const dataSource = useDataSource(props.dataSource);
  const id = useId();
  const [ownDraft, setOwnDraft] = useState<SemanticModel | undefined>(props.defaultDraft);
  const draft = props.draft !== undefined || props.onDraftChange ? props.draft : ownDraft;
  const shown = draft ?? model;
  const setDraft = (next: SemanticModel | undefined) => {
    setOwnDraft(next);
    props.onDraftChange?.(next);
  };
  const context = useRef(props.onContext);
  context.current = props.onContext;
  const [note, setNote] = useState("");
  const say = (kind: string, summary: string, subject?: Record<string, unknown>) => {
    setNote(summary);
    context.current?.({ kind, summary, ...(subject ? { subject } : {}) });
  };

  const [columns, setColumns] = useState<Field[]>([]);
  const [queryProblem, setQueryProblem] = useState<string | undefined>();
  useEffect(() => {
    if (!shown.sql.trim() || !shown.sourceId) return setColumns([]), setQueryProblem(undefined);
    const controller = new AbortController();
    collect(dataSource.execute({ sourceId: shown.sourceId, query: { baseSql: shown.sql, page: { limit: 1 } } }, { signal: controller.signal }))
      .then((result) => !controller.signal.aborted && (setColumns(result.table.schema.fields), setQueryProblem(undefined)))
      .catch((error: unknown) => !controller.signal.aborted && setQueryProblem(messageOf(error)));
    return () => controller.abort();
  }, [dataSource, shown.sourceId, shown.sql]);

  const pipelines = useOptionalPipelines(props.pipelines);
  const [built, setBuilt] = useState<Pipeline[]>([]);
  const [datasetChoice, setDatasetChoice] = useState("");
  useEffect(() => {
    if (!isNew || !onSave || !pipelines) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    pipelines
      .listPipelines({}, options)
      .then((list) => Promise.all(list.pipelines.filter((p) => !model.sourceId || p.sourceId === model.sourceId).map((p) => pipelines.getPipeline({ id: p.id }, options).then((r) => r.pipeline))))
      .then((found) => !controller.signal.aborted && setBuilt(found.filter((p): p is Pipeline => !!p && p.datasets.some((d) => d.kind !== DatasetKind.SOURCE))))
      .catch(() => !controller.signal.aborted && setBuilt([]));
    return () => controller.abort();
  }, [pipelines, isNew, !!onSave, model.sourceId]); // eslint-disable-line react-hooks/exhaustive-deps
  const fromDataset = () => {
    const [pi, di] = datasetChoice.split(":").map(Number);
    const pipeline = built[pi ?? -1];
    const dataset = pipeline?.datasets[di ?? -1]?.name;
    const pipelineId = pipeline?.summary?.id ?? "";
    if (!pipeline || !dataset) return;
    const next = semanticModelFromDataset(pipeline, dataset, { ...(shown.name ? { name: shown.name } : {}), ...(shown.label ? { label: shown.label } : {}) });
    if (shown.description) next.description = shown.description;
    keep(next);
    setNameTouched(true);
    say("rows.changed", `Started from the dataset ${dataset} of ${thePipeline(pipeline.summary?.name || pipelineId)}: its grain, key and ${next.dimensions.length + next.measures.length} fields from its columns, for you to check.`, { pipeline: pipelineId, dataset });
  };

  const pills = useMemo(() => pillsFromModel(shown), [shown]);
  const changes = useMemo(() => (draft ? modelChanges(model, draft) : new Map<string, FieldChange>()), [model, draft]);
  const removed = useMemo(() => pillsFromModel(model).filter((p) => changes.get(p.id) === "removed"), [model, changes]);
  const names = columns.map((c) => c.name);
  const problems = useMemo(() => {
    const found = draft ? semanticModelProblems(draft, { isNew }) : [];
    if (columns.length > 0) for (const p of pills) if (p.column && !names.includes(p.column)) found.push(`"${p.id}" names the column "${p.column}", which the query does not return.`);
    return found;
  }, [draft, pills, columns]); // eslint-disable-line react-hooks/exhaustive-deps

  const [editing, setEditing] = useState<{ pill: Pill; isNew: boolean } | undefined>();
  const [saveNote, setSaveNote] = useState("");
  const [saving, setSaving] = useState(false);
  const blank = (kind: PillKind): Pill => ({ id: "", kind, label: "", by: editor, ...(kind === "metric" ? { aggregate: "sum" as const, column: columns.find((c) => /Int|Float|Decimal/.test(String(c.type)))?.name } : kind === "attribute" ? { column: columns[0]?.name } : { expression: "", format: "number" as const }) });

  // A draft that comes back to what is saved is no draft; a new model's draft is kept, as it is all there is.
  const keep = (next: SemanticModel) => setDraft(!isNew && modelChanges(model, next).size === 0 ? undefined : next);
  const change = (name: string, pill: Pill | undefined) => keep(setModelField(shown, name, pill, editor));
  const setPart = (patch: Partial<Pick<SemanticModel, "name" | "label" | "description">>) => keep(create(SemanticModelSchema, { ...shown, ...patch }));
  const [nameTouched, setNameTouched] = useState(!isNew || !!model.name);
  const draftFields = () => {
    const personal = new Set(piiHints(columns.map((c) => c.name)).map((h) => h.column));
    const fields = draftSemanticFields(
      columns.map((c) => ({ name: c.name, type: String(c.type), personal: personal.has(c.name) })),
      { grain: shown.grain },
    );
    const next = clone(SemanticModelSchema, shown);
    next.dimensions = (fields.dimensions ?? []).map((d) => create(DimensionSchema, d));
    next.measures = (fields.measures ?? []).map((m) => create(MeasureSchema, m));
    keep(next);
    say("fields.drafted", `Fields drafted from the query's ${columns.length} columns by name and type${personal.size ? `, leaving out ${personal.size} that may hold personal data` : ""}. Check them before saving.`);
  };
  const [ask, setAsk] = useState("");
  const sendAsk = () => {
    const text = ask.trim();
    if (!text || !props.onAsk) return;
    props.onAsk(text, shown);
    setAsk("");
    setNote(`Sent to ${props.askLabel ?? "the agent"}.`);
  };
  const restore = (name: string) => {
    const was = pillsFromModel(model).find((p) => p.id === name);
    if (!was) return;
    change(name, was);
    say("field.restored", `${was.label} put back as it is saved.`, { field: name });
  };
  const save = async () => {
    if (!draft || !onSave || problems.length > 0) return;
    setSaving(true);
    try {
      const saved = await onSave(draft, saveNote.trim() || `${changes.size} ${changes.size === 1 ? "change" : "changes"}`);
      if (saved) {
        setDraft(undefined);
        setSaveNote("");
        say("model.saved", `Saved as version ${saved.version}. Every report and explorer on this model now uses it.`, { model: saved.name, version: saved.version, changes: Object.fromEntries(changes) });
      }
    } catch (error) {
      setNote(messageOf(error));
    } finally {
      setSaving(false);
    }
  };

  const askBox = props.onAsk && (
    <form
      className="sf-semantic-ask"
      onSubmit={(e) => {
        e.preventDefault();
        sendAsk();
      }}
    >
      <label htmlFor={`${id}-ask`}>
        {isNew ? `Tell ${props.askLabel ?? "the agent"} what this model should measure; it drafts the tables, joins, grain and fields for you to check.` : `Ask ${props.askLabel ?? "the agent"} to change this model.`}
      </label>
      <span className="sf-semantic-ask-row">
        <input id={`${id}-ask`} className="sf-input" placeholder={isNew ? "Order lines with their store and product, to measure revenue and refunds" : "Add margin as a share of revenue"} value={ask} onChange={(e) => setAsk(e.target.value)} />
        <button type="submit" className="sf-button" data-variant="primary" disabled={!ask.trim()}>
          Ask
        </button>
      </span>
    </form>
  );

  const section = (kind: PillKind) => {
    const rows = [...pills.filter((p) => p.kind === kind), ...removed.filter((p) => p.kind === kind)];
    return (
      <section key={kind} className="sf-semantic-section" aria-labelledby={`${id}-${kind}`}>
        <h4 id={`${id}-${kind}`} className="sf-explore-heading">
          <span>
            {KIND[kind].title} <span className="sf-semantic-count">{pills.filter((p) => p.kind === kind).length}</span>
          </span>
          {onSave && (
            <button type="button" className="sf-explore-add" aria-label={`Add a ${KIND[kind].one}`} onClick={() => setEditing({ pill: blank(kind), isNew: true })}>
              +
            </button>
          )}
        </h4>
        <p className="sf-explore-hint">{KIND[kind].hint}</p>
        {rows.length === 0 ? (
          <p className="sf-explore-hint">None yet.</p>
        ) : (
          <table className="sf-semantic-table">
            <thead>
              <tr>
                <th scope="col">Label</th>
                <th scope="col">Name</th>
                <th scope="col">{kind === "derived" ? "Calculation" : "Definition"}</th>
                <th scope="col">Defined by</th>
                {onSave && (
                  <th scope="col">
                    <span className="sf-a2-visually-hidden">Controls</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((pill) => {
                const state = changes.get(pill.id);
                const gone = state === "removed";
                return (
                  <tr key={pill.id} className={CONTROLS_HOST} data-change={state}>
                    <th scope="row">
                      {pill.label}
                      {state && <span className="sf-semantic-change">{CHANGE_WORDS[state]}</span>}
                      {pill.description && <span className="sf-semantic-description">{pill.description}</span>}
                    </th>
                    <td>
                      <code>{pill.id}</code>
                    </td>
                    <td>
                      <code>{definition(gone ? model : shown, pill)}</code>
                      {pill.format && <span className="sf-semantic-format"> · {pill.format}</span>}
                    </td>
                    <td>{fieldNamed(gone ? model : shown, pill.id)?.definedBy || "—"}</td>
                    {onSave && (
                      <td>
                        {gone ? (
                          <button type="button" className="sf-button" onClick={() => restore(pill.id)}>
                            Put back
                          </button>
                        ) : (
                          <ItemControls
                            label={`${pill.label} controls`}
                            controls={standardControls(pill.label, {
                              edit: () => setEditing({ pill, isNew: false }),
                              duplicate: () => setEditing({ pill: { ...pill, label: `${pill.label} copy`, by: editor }, isNew: true }),
                              remove: () => {
                                change(pill.id, undefined);
                                say("field.removed", `${pill.label} taken out of the draft. Save to remove it from the model.`, { field: pill.id });
                              },
                            })}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    );
  };

  return (
    <div className={["sf-semantic", props.className].filter(Boolean).join(" ")}>
      <header className="sf-semantic-header">
        {isNew && onSave ? (
          <div className="sf-semantic-identity">
            <h3 className="sf-semantic-title">New model</h3>
            <label htmlFor={`${id}-label`}>Name for people</label>
            <input
              id={`${id}-label`}
              className="sf-input"
              placeholder="Sales lines"
              value={shown.label}
              onChange={(e) => setPart({ label: e.target.value, ...(nameTouched ? {} : { name: modelName(e.target.value) }) })}
            />
            <label htmlFor={`${id}-name`}>Name in calculations and files</label>
            <input
              id={`${id}-name`}
              className="sf-input"
              placeholder="sales_lines"
              value={shown.name}
              onChange={(e) => (setNameTouched(true), setPart({ name: e.target.value }))}
            />
            <label htmlFor={`${id}-about`}>What it is for</label>
            <input id={`${id}-about`} className="sf-input" placeholder="Revenue, cost and refunds by store and product." value={shown.description} onChange={(e) => setPart({ description: e.target.value })} />
          </div>
        ) : (
          <>
            <h3 className="sf-semantic-title">{shown.label || shown.name}</h3>
            {shown.description && <p className="sf-semantic-description">{shown.description}</p>}
          </>
        )}
        <p className="sf-explore-hint">
          {shown.name ? <code>{shown.name}</code> : "Not named yet"} on {model.sourceId}
          {isNew ? " · not saved yet" : ` · version ${model.version}`}
          {model.savedBy && ` · saved by ${model.savedBy}`}
          {model.updatedAt && ` on ${model.updatedAt.slice(0, 10)}`}
        </p>
        {queryProblem && (
          <p className="sf-filter-problem" role="alert">
            The query does not run: {queryProblem}
          </p>
        )}
      </header>

      {isNew && onSave && built.length > 0 && !shown.dataset && (
        <div className="sf-semantic-actions sf-semantic-from-dataset">
          <label htmlFor={`${id}-dataset`}>Start from a pipeline dataset</label>
          <select id={`${id}-dataset`} className="sf-input" value={datasetChoice} onChange={(e) => setDatasetChoice(e.target.value)}>
            <option value="">Choose a dataset…</option>
            {built.map((p, pi) => (
              <optgroup key={p.summary?.id} label={p.summary?.name || p.summary?.id}>
                {p.datasets.map((d, di) =>
                  d.kind === DatasetKind.SOURCE ? null : (
                  <option key={d.name} value={`${pi}:${di}`}>
                    {d.name}
                    {d.grain ? ` · ${d.grain}` : ""}
                    {d.builtAt ? "" : " · not built yet"}
                  </option>
                  ),
                )}
              </optgroup>
            ))}
          </select>
          <button type="button" className="sf-button" disabled={!datasetChoice} onClick={fromDataset}>
            Use this dataset
          </button>
          <span className="sf-explore-hint">Its grain and key are checked by the pipeline after every build; its columns become fields for you to check.</span>
        </div>
      )}

      <ModelLineage
        model={shown}
        pipelines={pipelines}
        onOpenDataset={props.onOpenDataset}
        onUseDataset={
          onSave
            ? (standing) => {
                keep(create(SemanticModelSchema, { ...shown, sourceId: shown.sourceId, sql: datasetSql({ name: standing.dataset, relation: standing.relation ?? "" }), grain: standing.grain || shown.grain, primaryKey: standing.primaryKey }));
                say("rows.changed", `The grain and key are the dataset's again: ${standing.primaryKey.join(", ")}.`, { grain: standing.grain, primaryKey: standing.primaryKey });
              }
            : undefined
        }
      />

      {isNew && askBox}

      <SemanticRows
        model={shown}
        columns={columns}
        editor={editor}
        dataSource={dataSource}
        building={props.building && !shown.dataset}
        onChange={
          onSave
            ? (next, summary) => {
                // Rows written or joined by hand are no longer the pipeline's dataset.
                if (next.dataset && (next.tables.length > 0 || next.sql !== shown.sql)) next = create(SemanticModelSchema, { ...next, dataset: undefined });
                keep(next);
                if (summary) say("rows.changed", summary, { grain: next.grain, primaryKey: next.primaryKey, tables: next.tables });
              }
            : undefined
        }
      />

      {onSave && columns.length > 0 && shown.dimensions.length === 0 && shown.measures.length === 0 && (
        <p className="sf-semantic-actions">
          <button type="button" className="sf-button" onClick={draftFields}>
            Draft fields from the columns
          </button>
          <span className="sf-explore-hint">Dimensions and measures from the columns' names and types, marked as generated, for you to check.</span>
        </p>
      )}

      {draft && (
        <div className="sf-semantic-draft" role="region" aria-label="Changes not saved">
          <p>
            <strong>{isNew ? "New model, not saved" : `${changes.size} ${changes.size === 1 ? "change" : "changes"} not saved`}</strong>
            {props.proposedBy ? `, proposed by ${props.proposedBy}. Read ${isNew ? "it" : "them"} before saving.` : "."}{" "}
            {isNew ? `${shown.dimensions.length} dimensions, ${shown.measures.length} measures, ${shown.metrics.length} metrics.` : [...changes].map(changeText).join(", ")}
          </p>
          {(problems.length > 0 || props.problem) && (
            <ul className="sf-filter-problem" role="alert">
              {[...problems, ...(props.problem ? [props.problem] : [])].map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
          {onSave && (
            <div className="sf-semantic-actions">
              <label htmlFor={`${id}-note`} className="sf-a2-visually-hidden">
                What changed
              </label>
              <input id={`${id}-note`} className="sf-input" placeholder="What changed, in a few words" value={saveNote} onChange={(e) => setSaveNote(e.target.value)} />
              <button type="button" className="sf-button" data-variant="primary" disabled={problems.length > 0 || saving} onClick={() => void save()}>
                {saving ? "Saving…" : `Save as version ${model.version + 1}`}
              </button>
              <button
                type="button"
                className="sf-button"
                onClick={() => {
                  setDraft(undefined);
                  say("draft.discarded", isNew ? "The new model was cleared, to start again." : `${changes.size} ${changes.size === 1 ? "change" : "changes"} dropped; the model is as saved.`);
                }}
              >
                {isNew ? "Start again" : "Drop changes"}
              </button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <PillEditor
          key={`${editing.pill.id}-${editing.isNew}`}
          pill={editing.pill}
          all={pills}
          columns={columns}
          isNew={editing.isNew}
          onCancel={() => setEditing(undefined)}
          onSave={(next) => {
            change(editing.isNew ? next.id : editing.pill.id, next);
            say(editing.isNew ? "field.added" : "field.changed", `${next.label} ${editing.isNew ? "added to" : "changed in"} the draft. Save to keep it.`, { field: next, ...(editing.isNew ? {} : { was: editing.pill }) });
            setEditing(undefined);
          }}
          onRemove={
            editing.isNew
              ? undefined
              : () => {
                  change(editing.pill.id, undefined);
                  say("field.removed", `${editing.pill.label} taken out of the draft. Save to remove it from the model.`, { field: editing.pill.id });
                  setEditing(undefined);
                }
          }
        />
      )}
      {(["attribute", "metric", "derived"] as PillKind[]).map(section)}
      {!isNew && askBox}
      <p className="sf-explore-note" role="status">
        {note}
      </p>
    </div>
  );
}

/** The aggregate words the editor shows, by the contract's function. */
export const aggregateLabel = (fn: Parameters<typeof aggregateWord>[0]) => AGGREGATE_WORDS[aggregateWord(fn) ?? ""] ?? "";
