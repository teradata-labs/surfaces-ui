import type { MessageInitShape } from "@bufbuild/protobuf";
import { datasetSql } from "@surfaces-ui/data";
import { AggregateFunction, DimensionKind, type DimensionSchema, type MeasureSchema, type MetricSchema, type SemanticModelSchema } from "@surfaces-ui/proto";
import type { DbtArtifacts, DbtMetric, DbtNode } from "./artifacts.js";
import { type DbtPipelineOptions, datasetNames, defaultRelation } from "./pipeline.js";

type ModelInit = MessageInitShape<typeof SemanticModelSchema>;

export interface DbtSemanticModels {
  models: ModelInit[];
  /** What was left out and why, one sentence each: a computed dimension, a filtered or cumulative metric, a measure with no aggregate here. */
  skipped: string[];
}

const COLUMN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const GRAINS = new Set(["minute", "hour", "day", "week", "month", "quarter", "year"]);
const AGG: Record<string, AggregateFunction> = {
  sum: AggregateFunction.SUM,
  sum_boolean: AggregateFunction.SUM,
  count: AggregateFunction.COUNT,
  count_distinct: AggregateFunction.COUNT_DISTINCT,
  average: AggregateFunction.AVG,
  min: AggregateFunction.MIN,
  max: AggregateFunction.MAX,
  median: AggregateFunction.MEDIAN,
};
const BY = "dbt's semantic layer";

const modelName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .slice(0, 64) || "model";
const words = (name: string) => name.replace(/_+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/**
 * The semantic models of dbt's semantic layer (semantic_manifest.json) as
 * models here, each on the dbt model it reads as a pipeline dataset:
 * dimensions that are columns, measures with an aggregate this library has,
 * and metrics that are arithmetic over one model's measures (simple, ratio
 * and derived, with each metric they use written out as its measures). The
 * primary entity is the key and says what one row is. Anything that does
 * not fit is left out and listed in `skipped`, never approximated: a
 * computed dimension or measure, a percentile, a metric with a filter, a
 * cumulative or conversion metric, one that spans models. Drafts, not
 * saved: a host keeps them as starter models or offers them to a person.
 */
export function semanticModelsFromDbt(artifacts: DbtArtifacts, options: Pick<DbtPipelineOptions, "id" | "sourceId" | "relationOf">): DbtSemanticModels {
  const manifest = artifacts.semanticManifest;
  const skipped: string[] = [];
  if (!manifest) return { models: [], skipped };
  const pipelineId = options.id ?? artifacts.manifest.metadata?.project_name ?? "dbt";
  const names = datasetNames(artifacts);
  const relationOf = options.relationOf ?? defaultRelation;
  const nodes = Object.values(artifacts.manifest.nodes ?? {});
  const metrics = new Map((manifest.metrics ?? []).map((m) => [m.name ?? "", m]));
  const measureHome = new Map<string, string>();
  const models: ModelInit[] = [];

  for (const semantic of manifest.semantic_models ?? []) {
    const relation = semantic.node_relation ?? {};
    const node: DbtNode | undefined = nodes.find(
      (n) => n.resource_type === "model" && (n.alias || n.name) === relation.alias && (!relation.schema_name || n.schema === relation.schema_name),
    );
    const dataset = node ? names.get(node.unique_id ?? "") : undefined;
    if (!node || !dataset) {
      skipped.push(`The semantic model ${semantic.name} reads ${relation.relation_name ?? relation.alias}, which is not a model of this project with a table.`);
      continue;
    }
    const name = modelName(semantic.name ?? dataset);
    const primary = semantic.entities?.find((e) => e.type === "primary" || e.type === "natural");
    const key = primary ? (primary.expr ?? primary.name ?? "") : "";
    // A field with no description of its own takes the dbt model's description of its column.
    const described = (own: string | null | undefined, column: string) => own || node.columns?.[column]?.description || "";
    const used = new Set<string>();
    const free = (field: string) => {
      if (used.has(field.toLowerCase())) return false;
      used.add(field.toLowerCase());
      return true;
    };

    const dimensions: MessageInitShape<typeof DimensionSchema>[] = [];
    for (const d of semantic.dimensions ?? []) {
      const column = d.expr ?? d.name ?? "";
      if (!COLUMN.test(column)) {
        skipped.push(`${semantic.name}.${d.name} is worked out by an expression (${column}); add it as a column of the dbt model to use it here.`);
        continue;
      }
      if (!free(d.name ?? "")) continue;
      const time = d.type === "time";
      const grain = d.type_params?.time_granularity ?? "";
      dimensions.push({ name: d.name, label: d.label || words(d.name ?? ""), column, kind: time ? DimensionKind.TIME : DimensionKind.CATEGORY, ...(time ? { grain: GRAINS.has(grain) ? grain : "day" } : {}), description: described(d.description, column), definedBy: BY });
    }
    // The entities that are columns are ways to break the rows down too: by customer.
    for (const e of semantic.entities ?? []) {
      if (e === primary || !COLUMN.test(e.expr ?? e.name ?? "") || !free(e.name ?? "")) continue;
      dimensions.push({ name: e.name, label: words(e.name ?? ""), column: e.expr ?? e.name ?? "", kind: DimensionKind.CATEGORY, description: described(e.description, e.expr ?? e.name ?? ""), definedBy: BY });
    }

    const measures: MessageInitShape<typeof MeasureSchema>[] = [];
    for (const m of semantic.measures ?? []) {
      const aggregate = AGG[m.agg ?? ""];
      const column = m.expr ?? m.name ?? "";
      const countRows = m.agg === "count" && (column === "1" || column === "*");
      if (aggregate === undefined) {
        skipped.push(`${semantic.name}.${m.name} uses the aggregate ${m.agg}, which has no form here.`);
        continue;
      }
      if (!countRows && !COLUMN.test(column)) {
        skipped.push(`${semantic.name}.${m.name} summarises an expression (${column}); add it as a column of the dbt model to use it here.`);
        continue;
      }
      if (!free(m.name ?? "")) continue;
      measures.push({ name: m.name, label: m.label || words(m.name ?? ""), ...(countRows ? {} : { column }), aggregate, description: described(m.description, countRows ? "" : column), definedBy: BY });
      measureHome.set(m.name ?? "", name);
    }

    models.push({
      name,
      label: semantic.label || words(semantic.name ?? name),
      description: semantic.description ?? node.description ?? "",
      sourceId: options.sourceId,
      sql: datasetSql({ name: dataset, relation: relationOf(node) }),
      grain: primary ? `One ${words(primary.name ?? "row").toLowerCase()}.` : "",
      primaryKey: key && COLUMN.test(key) ? [key] : [],
      dataset: { pipelineId, dataset },
      dimensions,
      measures,
      metrics: [],
    });
    for (const field of [...dimensions, ...measures]) used.add(String(field.name).toLowerCase());
  }

  // A metric here is arithmetic over one model's measures, so each metric a dbt metric uses is written out as its own.
  const expand = (metric: DbtMetric, seen: Set<string>): { expression: string; home: string } | string => {
    if (seen.has(metric.name ?? "")) return `${metric.name} refers to itself.`;
    seen.add(metric.name ?? "");
    if (metric.filter) return `${metric.name} has a filter, which a metric here cannot hold.`;
    const params = metric.type_params ?? {};
    const operand = (ref: { name?: string } | null | undefined) => {
      const other = metrics.get(ref?.name ?? "");
      return other ? expand(other, new Set(seen)) : `${metric.name} uses ${ref?.name}, which is not a metric of the project.`;
    };
    if (metric.type === "simple") {
      const measure = params.measure?.name ?? "";
      const home = measureHome.get(measure);
      return home ? { expression: measure, home } : `${metric.name} measures ${measure}, which was left out or is not in a semantic model.`;
    }
    if (metric.type === "ratio") {
      const top = operand(params.numerator);
      const bottom = operand(params.denominator);
      if (typeof top === "string") return top;
      if (typeof bottom === "string") return bottom;
      if (top.home !== bottom.home) return `${metric.name} divides measures of two semantic models.`;
      return { expression: `(${top.expression}) / (${bottom.expression})`, home: top.home };
    }
    if (metric.type === "derived" && params.expr) {
      let home = "";
      const parts = new Map<string, string>();
      for (const ref of params.metrics ?? []) {
        const part = operand(ref);
        if (typeof part === "string") return part;
        if (home && part.home !== home) return `${metric.name} combines measures of two semantic models.`;
        home = part.home;
        parts.set(ref.name ?? "", part.expression);
      }
      if (!home) return `${metric.name} uses no metric.`;
      // One pass, so a measure written in for one metric is never mistaken for another metric's name.
      const names = [...parts.keys()].filter((n) => COLUMN.test(n));
      const expression = params.expr.replace(new RegExp(`\\b(${names.join("|")})\\b`, "g"), (found) => `(${parts.get(found)})`);
      return { expression, home };
    }
    return `${metric.name} is a ${metric.type} metric, which has no form here.`;
  };
  for (const metric of manifest.metrics ?? []) {
    const result = expand(metric, new Set());
    if (typeof result === "string") {
      skipped.push(result);
      continue;
    }
    const model = models.find((m) => m.name === result.home);
    if (!model) continue;
    const taken = [...(model.dimensions ?? []), ...(model.measures ?? []), ...(model.metrics ?? [])].some((f) => String(f.name).toLowerCase() === String(metric.name).toLowerCase());
    // A simple metric with its measure's name is that measure already.
    if (taken) {
      if (result.expression !== metric.name) skipped.push(`${metric.name} has the name of another field of ${model.name}.`);
      continue;
    }
    const added: MessageInitShape<typeof MetricSchema> = { name: metric.name, label: metric.label || words(metric.name ?? ""), expression: result.expression.replace(/^\((\w+)\)$/, "$1"), description: metric.description ?? "", definedBy: BY };
    model.metrics = [...(model.metrics ?? []), added];
  }
  return { models, skipped };
}
