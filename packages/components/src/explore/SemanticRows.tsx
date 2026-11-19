import { create } from "@bufbuild/protobuf";
import { type DataSource, semanticKeyProblem } from "@surfaces-ui/data";
import { JoinType, type SemanticJoin, SemanticJoinSchema, type SemanticModel, SemanticModelSchema } from "@surfaces-ui/proto";
import type { Field } from "apache-arrow";
import { useEffect, useId, useRef, useState } from "react";
import { messageOf } from "../data/useRowWindow.js";
import { type DataModel, type JoinKind, ModelDiagram, type ModelJoin, type ModelSql, joinId, joinText, kindText, modelSql } from "../model/ModelDiagram.js";
import { CodeBlock } from "../text/Markdown.js";

export const INFERRED_BY = "inferred from names";
export const DECLARED_BY = "declared by the source";

const KIND_OF: Record<JoinType, JoinKind> = { [JoinType.UNSPECIFIED]: "inner", [JoinType.INNER]: "inner", [JoinType.LEFT]: "left", [JoinType.RIGHT]: "right", [JoinType.FULL]: "full" };
const TYPE_OF: Record<JoinKind, JoinType> = { inner: JoinType.INNER, left: JoinType.LEFT, right: JoinType.RIGHT, full: JoinType.FULL };

/** A join kind as the contract stores it. */
export const joinTypeOf = (kind: JoinKind | undefined): JoinType => TYPE_OF[kind ?? "inner"];
/** A stored join type as a kind; unspecified is an inner join, which is what models saved before join kinds ran. */
export const joinKindOf = (type: JoinType): JoinKind => KIND_OF[type] ?? "inner";

/** A model's joins as the diagram draws them: a guess no one confirmed is "Inferred", a foreign key the source declares is "Declared". */
export function diagramJoins(joins: SemanticJoin[]): ModelJoin[] {
  return joins.map((j) => ({
    left: j.left,
    right: j.right,
    keys: j.keys.map((k) => ({ leftColumn: k.leftColumn, rightColumn: k.rightColumn })),
    type: joinKindOf(j.type),
    ...(j.definedBy === INFERRED_BY ? { inferred: true } : {}),
    ...(j.definedBy === DECLARED_BY ? { declared: true } : {}),
  }));
}

/**
 * The model's tables and joins from what the diagram holds, each join saying
 * who made it (kept from before, or the person editing now), and its query:
 * the diagram's own when given (it names every column, so it runs on every
 * engine), generated without the columns otherwise. A guess no one has
 * confirmed is kept on the model, marked, but left out of the query.
 */
export function rowsFromDiagram(model: SemanticModel, diagram: DataModel, editor: string, query?: ModelSql): SemanticModel {
  const before = new Map(diagramJoins(model.joins).map((j, i) => [joinId(j), model.joins[i]!.definedBy]));
  const joins = diagram.joins.map((j) =>
    create(SemanticJoinSchema, {
      left: j.left,
      right: j.right,
      keys: j.keys.map((k) => ({ leftColumn: k.leftColumn, rightColumn: k.rightColumn })),
      type: joinTypeOf(j.type),
      // Confirming a guess makes it the confirming person's.
      definedBy: j.inferred ? INFERRED_BY : j.declared ? DECLARED_BY : ((w) => (w && w !== INFERRED_BY ? w : editor))(before.get(joinId(j))),
    }),
  );
  return create(SemanticModelSchema, { ...model, tables: diagram.tables, joins, sql: query?.sql ?? semanticSql(diagram).sql });
}

/** The query a model's tables and joins make without knowing their columns: from the first table, through every join but unconfirmed guesses. The diagram replaces it with one that names every column once it has read them. */
export function semanticSql(diagram: DataModel): { sql: string; unjoined: string[] } {
  return modelSql({ tables: diagram.tables, joins: diagram.joins.filter((j) => !j.inferred) });
}

const rowsKey = (model: SemanticModel) => JSON.stringify([model.tables, diagramJoins(model.joins).map((j) => [joinId(j), j.type, j.left, !!j.inferred])]);

export interface SemanticRowsProps {
  model: SemanticModel;
  columns: Field[];
  /** Called with every change; `summary` says it in words for the agent, and is left out while a person is still typing. Left out, the rows are shown and cannot be changed. */
  onChange?(next: SemanticModel, summary?: string): void;
  editor: string;
  dataSource: DataSource;
  /** A new model: the join builder is open even before it has a table. */
  building?: boolean;
}

/**
 * What one row of a model is and where the rows come from: the grain, the
 * columns that make a row unique (checked by the engine on request), and
 * the tables and joins the rows are built from, drawn in a ModelDiagram with
 * the first table as where the rows come from, or the query as written.
 */
export function SemanticRows(props: SemanticRowsProps) {
  const { model, columns, onChange, editor, dataSource } = props;
  const id = useId();
  const editable = !!onChange;
  const built = model.tables.length > 0;
  // Until a person chooses, a model written as a query opens on its query and one built from tables on its diagram.
  const [writingChoice, setWriting] = useState<boolean | undefined>();
  const writing = writingChoice ?? (!built && !!model.sql.trim() && !props.building);
  const [keyNote, setKeyNote] = useState<{ ok: boolean; text: string } | undefined>();
  const [checking, setChecking] = useState(false);
  const names = columns.map((c) => c.name);
  const unjoined = built ? semanticSql({ tables: model.tables, joins: diagramJoins(model.joins) }).unjoined : [];
  const guesses = model.joins.filter((j) => j.definedBy === INFERRED_BY);
  const used = [...model.dimensions.map((d) => d.column), ...model.measures.map((m) => m.column)].filter(Boolean);

  // The diagram starts from the model's rows and then holds them itself; handing its own changes back would start it again.
  // Rows changed from outside (an agent's proposal, Start again) start it again.
  const [start, setStart] = useState<DataModel>(() => ({ tables: model.tables, joins: diagramJoins(model.joins) }));
  const [generation, setGeneration] = useState(0);
  const echoed = useRef(rowsKey(model));
  const key = rowsKey(model);
  useEffect(() => {
    if (echoed.current === key) return;
    echoed.current = key;
    setStart({ tables: model.tables, joins: diagramJoins(model.joins) });
    setGeneration((n) => n + 1);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Pick<SemanticModel, "grain" | "primaryKey" | "sql" | "tables" | "joins">>, summary?: string) => onChange?.(create(SemanticModelSchema, { ...model, ...patch }), summary);
  const toggleKey = (column: string) => {
    const nextKey = model.primaryKey.includes(column) ? model.primaryKey.filter((c) => c !== column) : [...model.primaryKey, column];
    setKeyNote(undefined);
    set({ primaryKey: nextKey }, nextKey.length ? `The key is now ${nextKey.join(", ")}.` : "The model has no key yet.");
  };
  const checkKey = async () => {
    setChecking(true);
    try {
      const problem = await semanticKeyProblem(model, dataSource);
      setKeyNote(problem ? { ok: false, text: problem } : { ok: true, text: `Unique: each ${model.primaryKey.join(" and ")} names one row, so sums count each row once.` });
    } catch (error) {
      setKeyNote({ ok: false, text: messageOf(error) });
    } finally {
      setChecking(false);
    }
  };
  const fromDiagram = (diagram: DataModel, query: ModelSql) => {
    const next = rowsFromDiagram(model, diagram, editor, query);
    const sameRows = rowsKey(next) === rowsKey(model);
    // Only the query changed, because the diagram has read the columns and can name them. A saved model keeps
    // the query it was saved with until its rows change; a new one takes the named form, which runs on every engine.
    if (sameRows && (next.sql === model.sql || model.version > 0)) return;
    echoed.current = rowsKey(next);
    const kinds = diagram.joins.map((j) => `${joinText(j)} keeps ${kindText(j, j.type ?? "inner").toLowerCase()}`);
    onChange?.(next, sameRows ? undefined : `The rows now come from ${diagram.tables.join(", ") || "no table"}${kinds.length ? `: ${kinds.join("; ")}` : ""}.`);
  };

  return (
    <section className="sf-semantic-section sf-semantic-rows" aria-labelledby={`${id}-rows`}>
      <h4 id={`${id}-rows`} className="sf-explore-heading">
        <span>Rows</span>
      </h4>
      <p className="sf-explore-hint">What one row is, and where the rows come from. Sums are right only when each row is one thing.</p>

      <div className="sf-semantic-grain">
        <label htmlFor={`${id}-grain`}>One row is</label>
        {editable ? (
          <input id={`${id}-grain`} className="sf-input" placeholder="One order line." value={model.grain} onChange={(e) => set({ grain: e.target.value })} onBlur={(e) => e.target.value.trim() && set({ grain: e.target.value }, `One row is now: ${e.target.value.trim()}`)} />
        ) : (
          <span id={`${id}-grain`}>{model.grain || "not said yet"}</span>
        )}
      </div>

      <div className="sf-semantic-key">
        <span id={`${id}-key`}>Unique by</span>
        {model.primaryKey.length > 0 ? (
          <span className="sf-semantic-chips" aria-labelledby={`${id}-key`}>
            {model.primaryKey.map((c) => (
              <code key={c}>{c}</code>
            ))}
          </span>
        ) : (
          <span className="sf-explore-hint">no key yet</span>
        )}
        {editable && names.length > 0 && (
          <details className="sf-semantic-pick">
            <summary>Choose the key</summary>
            <fieldset>
              <legend className="sf-a2-visually-hidden">Columns that make a row unique</legend>
              {names.map((name) => (
                <label key={name} className="sf-semantic-option">
                  <input type="checkbox" checked={model.primaryKey.includes(name)} onChange={() => toggleKey(name)} /> {name}
                </label>
              ))}
            </fieldset>
          </details>
        )}
        {model.primaryKey.length > 0 && model.sql.trim() && (
          <button type="button" className="sf-button" disabled={checking} onClick={() => void checkKey()}>
            {checking ? "Checking…" : "Check the key"}
          </button>
        )}
      </div>
      {keyNote && (
        <p className={keyNote.ok ? "sf-explore-hint" : "sf-filter-problem"} role={keyNote.ok ? "status" : "alert"}>
          {keyNote.text}
        </p>
      )}

      {editable && !writing ? (
        <>
          <p className="sf-explore-hint">
            Tables and joins. The first table is where the rows come from; each join adds detail to it and says whether it keeps every row and whether it can repeat rows.
          </p>
          <ModelDiagram
            key={generation}
            sourceId={model.sourceId}
            tables={start.tables}
            joins={start.joins}
            height={400}
            rowsFrom
            usedColumns={used}
            label="The model's tables and joins"
            dataSource={dataSource}
            onChange={fromDiagram}
          />
          {guesses.length > 0 && (
            <p className="sf-result-notice">
              {guesses.length} inferred {guesses.length === 1 ? "join is" : "joins are"} a guess from names: confirm {guesses.length === 1 ? "it" : "them"} in the joins to use {guesses.length === 1 ? "it" : "them"}.
            </p>
          )}
        </>
      ) : built ? (
        <div className="sf-semantic-from">
          <p>
            From <code>{model.tables[0]}</code>
            {model.tables.length > 1 ? (
              <>
                , with the detail of{" "}
                {model.tables.slice(1).map((t, i) => (
                  <span key={t}>
                    {i > 0 && ", "}
                    <code>{t}</code>
                  </span>
                ))}
              </>
            ) : (
              " alone"
            )}
            . The first table's rows are the model's rows.
          </p>
          {model.joins.length > 0 && (
            <ul className="sf-semantic-joins">
              {diagramJoins(model.joins).map((j, i) => (
                <li key={joinId(j)} data-inferred={j.inferred || undefined}>
                  <code>{joinText(j)}</code> <span className="sf-semantic-format">· keeps {kindText(j, j.type ?? "inner").toLowerCase()} · {j.inferred ? "Inferred, not in the query until confirmed" : model.joins[i]!.definedBy || "—"}</span>
                </li>
              ))}
            </ul>
          )}
          {unjoined.length > 0 && <p className="sf-result-notice">Not joined to the first table, so left out: {unjoined.join(", ")}.</p>}
        </div>
      ) : (
        <p>{model.sql.trim() ? "Written as a query." : "No rows yet: add a table, or write the query."}</p>
      )}

      <details className="sf-semantic-query">
        <summary>The query</summary>
        {model.sql.trim() ? <CodeBlock code={model.sql} language="sql" label="The model's query" /> : <p className="sf-explore-hint">No query yet: add a table, or write one.</p>}
      </details>

      {editable && (
        <div className="sf-semantic-actions">
          <button type="button" className="sf-button" aria-expanded={writing} onClick={() => setWriting(!writing)}>
            {writing ? "Build from tables instead" : "Write the query instead"}
          </button>
        </div>
      )}
      {editable && writing && (
        <div className="sf-semantic-write">
          <label htmlFor={`${id}-sql`}>The model's query, one read-only SELECT</label>
          <textarea id={`${id}-sql`} className="sf-input" rows={6} spellCheck={false} value={model.sql} onChange={(e) => set({ sql: e.target.value, tables: [], joins: [] })} onBlur={() => set({}, "The query was rewritten.")} />
        </div>
      )}
    </section>
  );
}
