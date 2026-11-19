import { type MessageInitShape, clone, create } from "@bufbuild/protobuf";
import { aggregateFunctionOf, aggregateWord, measureNames, parseMeasureExpression } from "@surfaces-ui/data";
import { type Dimension, DimensionKind, type Measure, type Metric, type SemanticModel, SemanticModelSchema } from "@surfaces-ui/proto";
import type { Field } from "apache-arrow";
import type { ChartGrain } from "../chart/Chart.js";
import { type Pill, type PillFormat, pillsFromFields } from "./model.js";

const FORMATS: PillFormat[] = ["number", "compact", "currency", "percent"];
const format = (value: string): PillFormat | undefined => (FORMATS.includes(value as PillFormat) ? (value as PillFormat) : undefined);

/** What a model calls itself on a pill: "the Sales lines model". */
export const modelByline = (model: Pick<SemanticModel, "name" | "label">) => `the ${model.label || model.name} model`;

/**
 * A semantic model's fields as pills: dimensions are attributes, measures
 * are metrics, metrics are calculations. Each says it comes from the model
 * (`model`) and who defined it (`by`).
 */
export function pillsFromModel(model: SemanticModel): Pill[] {
  const by = (definedBy: string) => definedBy || modelByline(model);
  const pills: Pill[] = [];
  for (const d of model.dimensions) {
    const time = d.kind === DimensionKind.TIME;
    pills.push({ id: d.name, kind: "attribute", label: d.label || d.name, column: d.column, ...(time ? { grain: (d.grain || "month") as ChartGrain } : {}), ...(d.description ? { description: d.description } : {}), by: by(d.definedBy), model: model.name });
  }
  for (const m of model.measures) {
    const aggregate = aggregateWord(m.aggregate);
    if (!aggregate) continue;
    pills.push({ id: m.name, kind: "metric", label: m.label || m.name, ...(m.column ? { column: m.column } : {}), aggregate, ...(format(m.format) ? { format: format(m.format) } : {}), ...(m.description ? { description: m.description } : {}), by: by(m.definedBy), model: model.name });
  }
  for (const m of model.metrics) {
    pills.push({ id: m.name, kind: "derived", label: m.label || m.name, expression: m.expression, ...(format(m.format) ? { format: format(m.format) } : {}), ...(m.description ? { description: m.description } : {}), by: by(m.definedBy), model: model.name });
  }
  return pills;
}

/** The model's pills first, then pills generated for the columns the model leaves out. */
export function pillsWithModel(model: SemanticModel, columns: Pick<Field, "name" | "type">[]): Pill[] {
  const fromModel = pillsFromModel(model);
  const used = new Set(fromModel.flatMap((p) => (p.column ? [p.column] : [])));
  const ids = new Set(fromModel.map((p) => p.id));
  const counts = fromModel.some((p) => p.kind === "metric" && p.aggregate === "count" && !p.column);
  const generated = pillsFromFields(columns.filter((c) => !used.has(c.name))).filter((p) => !ids.has(p.id) && !(counts && p.aggregate === "count" && !p.column));
  return [...fromModel, ...generated];
}

/** Whether two pills define the same thing, whatever they are called and whoever made them. */
export function sameDefinition(a: Pill, b: Pill): boolean {
  return a.id === b.id && a.kind === b.kind && (a.column ?? "") === (b.column ?? "") && (a.aggregate ?? "") === (b.aggregate ?? "") && (a.grain ?? "") === (b.grain ?? "") && (a.expression ?? "").replace(/\s+/g, "") === (b.expression ?? "").replace(/\s+/g, "") && (a.format ?? "") === (b.format ?? "") && a.label === b.label && (a.description ?? "") === (b.description ?? "");
}

/**
 * The fields after the model changed: a pill the model now defines the same
 * way becomes the model's, a pill that came from the model follows it, and
 * a model field not shown yet is added. A pill a person or an agent changed
 * since it came from the model is kept as they left it.
 */
export function mergeModelPills(fields: Pill[], model: SemanticModel): Pill[] {
  const fromModel = pillsFromModel(model);
  const byId = new Map(fromModel.map((p) => [p.id, p]));
  const out = fields.flatMap((p) => {
    const defined = byId.get(p.id);
    if (!defined) return p.model === model.name ? [] : [p];
    return p.model === model.name || sameDefinition(p, defined) ? [defined] : [p];
  });
  const have = new Set(out.map((p) => p.id));
  return [...fromModel.filter((p) => !have.has(p.id)), ...out];
}

/** Whether a pill is worth offering to the model: it is not the model's own, or it was changed since. */
export const canPromote = (pill: Pill, model: SemanticModel | undefined) => !!model && pill.model !== model.name;

/**
 * The model with a pill added to it, or put in place of the field of the
 * same name. A calculation brings the metrics it uses that the model does
 * not have yet. `by` is recorded as who defined what is added.
 */
export function promotePill(model: SemanticModel, pill: Pill, all: Pill[], by: string): SemanticModel {
  const next = create(SemanticModelSchema, model);
  const bring = [pill];
  if (pill.kind === "derived") {
    let names: string[] = [];
    try {
      names = measureNames(parseMeasureExpression(pill.expression ?? ""));
    } catch {
      names = [];
    }
    for (const name of names) {
      const used = all.find((p) => p.id === name && p.kind === "metric");
      if (used && !next.measures.some((m) => m.name === name)) bring.unshift(used);
    }
  }
  let out = next;
  for (const p of bring) out = setModelField(out, p.id, p, p === pill || p.model !== model.name ? by : (fieldNamed(model, p.id)?.definedBy ?? ""));
  return out;
}

/** The model's field of that name, whichever kind it is. */
export function fieldNamed(model: SemanticModel, name: string): Dimension | Measure | Metric | undefined {
  return model.dimensions.find((d) => d.name === name) ?? model.measures.find((m) => m.name === name) ?? model.metrics.find((m) => m.name === name);
}

/**
 * The model with the field called `name` changed to `pill`, in the same
 * place, or removed when `pill` is undefined, or added at the end of its
 * kind when there is none. A rename follows into the metrics that use it.
 */
export function setModelField(model: SemanticModel, name: string, pill: Pill | undefined, definedBy: string): SemanticModel {
  const next = clone(SemanticModelSchema, model);
  const common = pill && { name: pill.id, label: pill.label, description: pill.description ?? "", definedBy };
  const dimension: Dimension | undefined = pill?.kind === "attribute" ? { $typeName: "surfaces.v1.Dimension", ...common!, column: pill.column ?? "", kind: pill.grain ? DimensionKind.TIME : DimensionKind.CATEGORY, grain: pill.grain ?? "" } : undefined;
  const measure: Measure | undefined = pill?.kind === "metric" ? { $typeName: "surfaces.v1.Measure", ...common!, column: pill.column ?? "", aggregate: aggregateFunctionOf(pill.aggregate ?? ""), format: pill.format ?? "" } : undefined;
  const metric: Metric | undefined = pill?.kind === "derived" ? { $typeName: "surfaces.v1.Metric", ...common!, expression: pill.expression ?? "", format: pill.format ?? "" } : undefined;
  const place = <T extends { name: string }>(list: T[], field: T | undefined): T[] => {
    const at = list.findIndex((f) => f.name === name);
    if (at < 0) return field ? [...list, field] : list;
    return field ? list.map((f, i) => (i === at ? field : f)) : list.filter((_, i) => i !== at);
  };
  next.dimensions = place(next.dimensions, dimension);
  next.measures = place(next.measures, measure);
  next.metrics = place(next.metrics, metric);
  if (pill && pill.id !== name) {
    const word = new RegExp(`\\b${name}\\b`, "g");
    next.metrics = next.metrics.map((m) => ({ ...m, expression: m.expression.replace(word, pill.id) }));
  }
  return next;
}

export type FieldChange = "added" | "changed" | "removed";

/** What a draft changes against the saved model, by field name. Who defined a field does not count as a change. */
export function modelChanges(saved: SemanticModel, draft: SemanticModel): Map<string, FieldChange> {
  const before = new Map(pillsFromModel(saved).map((p) => [p.id, p]));
  const after = new Map(pillsFromModel(draft).map((p) => [p.id, p]));
  const out = new Map<string, FieldChange>();
  for (const [name, pill] of after) {
    const was = before.get(name);
    if (!was) out.set(name, "added");
    else if (!sameDefinition(was, pill)) out.set(name, "changed");
  }
  for (const name of before.keys()) if (!after.has(name)) out.set(name, "removed");
  for (const key of ["name", "label", "description", "sql", "grain"] as const) if (saved[key] !== draft[key]) out.set(`(${key})`, "changed");
  if (saved.primaryKey.join("|") !== draft.primaryKey.join("|")) out.set("(primaryKey)", "changed");
  const rows = (m: SemanticModel) => JSON.stringify([m.tables, m.joins.map((j) => [j.left, j.right, j.keys.map((k) => [k.leftColumn, k.rightColumn]), j.definedBy, j.type || 1])]);
  if (rows(saved) !== rows(draft)) out.set("(joins)", "changed");
  const from = (m: SemanticModel) => (m.dataset ? `${m.dataset.pipelineId}/${m.dataset.dataset}` : "");
  if (from(saved) !== from(draft)) out.set("(dataset)", "changed");
  return out;
}

/** A model to start from for a query, with nothing defined yet: a person or an agent adds the fields. */
export function emptyModel(init: MessageInitShape<typeof SemanticModelSchema>): SemanticModel {
  return create(SemanticModelSchema, init);
}
