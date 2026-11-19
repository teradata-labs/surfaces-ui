import { clone, create } from "@bufbuild/protobuf";
import { SemanticDatasetSchema, SemanticJoinSchema, type SemanticModel, SemanticModelSchema } from "@surfaces-ui/proto";
import type { Pill } from "./model.js";
import { modelChanges, pillsFromModel, setModelField } from "./semantic.js";
import type { JoinKind } from "../model/ModelDiagram.js";
import { joinKindOf, joinTypeOf, semanticSql } from "./SemanticRows.js";
import { datasetSql } from "@surfaces-ui/data";

/** A join as an agent writes it: two tables and the columns that match. */
export interface ProposedJoin {
  left: string;
  right: string;
  keys: { leftColumn: string; rightColumn: string }[];
  /** Which rows it keeps, read from left to right. Left out, "left": every row of the left table, the one nearer the first, so adding detail never drops a row. */
  type?: JoinKind;
}

/** What one row is and where the rows come from, as proposed. Any part left out stays as it is. */
export interface ProposedRows {
  grain?: string;
  primaryKey?: string[];
  /** The tables, the first being the one whose rows the model's rows are. With them the query is generated, unless `sql` is given too. */
  tables?: string[];
  joins?: ProposedJoin[];
  /** A query written out, in place of tables and joins. */
  sql?: string;
  /** A dataset a pipeline builds, in place of tables, joins and a query: the model reads its table, and its grain and key should be the dataset's, which the pipeline checks. */
  dataset?: { pipeline: string; dataset: string };
}

/**
 * A change to a semantic model in the plain form an agent writes and a
 * person's edits come back in: fields to add or put in place (as pills),
 * names to take out, and the rows. The same shape proposes a new model,
 * starting from an empty one.
 */
export interface SemanticProposal {
  add?: Pill[];
  remove?: string[];
  rows?: ProposedRows;
}

/** The model with a proposal applied, every field and join it adds marked as `by`'s. Nothing is saved. */
export function applyProposal(model: SemanticModel, proposal: SemanticProposal, by: string): SemanticModel {
  let next = model;
  for (const name of proposal.remove ?? []) next = setModelField(next, name, undefined, by);
  for (const pill of proposal.add ?? []) next = setModelField(next, pill.id, pill, pill.by || by);
  const rows = proposal.rows;
  if (!rows) return next;
  next = clone(SemanticModelSchema, next);
  if (rows.grain !== undefined) next.grain = rows.grain;
  if (rows.primaryKey !== undefined) next.primaryKey = [...rows.primaryKey];
  if (rows.tables !== undefined || rows.joins !== undefined) {
    next.tables = [...(rows.tables ?? next.tables)];
    next.joins = (rows.joins ?? []).map((j) => create(SemanticJoinSchema, { left: j.left, right: j.right, keys: j.keys, type: joinTypeOf(j.type ?? "left"), definedBy: by }));
    // Until the editor has read the columns and can name each one, the query is the plain form.
    next.sql = semanticSql({ tables: next.tables, joins: next.joins.map((j) => ({ left: j.left, right: j.right, keys: j.keys, type: joinKindOf(j.type) })) }).sql;
  }
  if (rows.sql !== undefined) {
    next.sql = rows.sql;
    if (rows.tables === undefined) (next.tables = []), (next.joins = []);
  }
  if (rows.dataset) {
    next.dataset = create(SemanticDatasetSchema, { pipelineId: rows.dataset.pipeline, dataset: rows.dataset.dataset });
    next.sql = datasetSql(rows.dataset.dataset);
    next.tables = [];
    next.joins = [];
  } else if (rows.sql !== undefined || rows.tables !== undefined) next.dataset = undefined;
  return next;
}

/** A draft as the proposal that would make it from `model`: what a person left in or changed, in the form the agent wrote. */
export function proposalFrom(model: SemanticModel, draft: SemanticModel): SemanticProposal {
  const changes = modelChanges(model, draft);
  const after = new Map(pillsFromModel(draft).map((p) => [p.id, p]));
  const out: SemanticProposal = {
    add: [...changes].filter(([name, kind]) => kind !== "removed" && after.has(name)).map(([name]) => after.get(name)!),
    remove: [...changes].filter(([, kind]) => kind === "removed").map(([name]) => name),
  };
  const rows: ProposedRows = {};
  if (changes.has("(grain)")) rows.grain = draft.grain;
  if (changes.has("(primaryKey)")) rows.primaryKey = draft.primaryKey;
  if (changes.has("(joins)")) {
    rows.tables = draft.tables;
    rows.joins = draft.joins.map((j) => ({ left: j.left, right: j.right, keys: j.keys.map((k) => ({ leftColumn: k.leftColumn, rightColumn: k.rightColumn })), type: joinKindOf(j.type) }));
  }
  if (draft.dataset && changes.has("(dataset)")) rows.dataset = { pipeline: draft.dataset.pipelineId, dataset: draft.dataset.dataset };
  else if (changes.has("(sql)") && draft.tables.length === 0) rows.sql = draft.sql;
  if (Object.keys(rows).length > 0) out.rows = rows;
  return out;
}
