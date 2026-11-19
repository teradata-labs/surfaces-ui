import { create, fromJson, type JsonValue, type MessageInitShape, toJson } from "@bufbuild/protobuf";
import {
  AggregateFunction,
  type DeleteSemanticModelRequestSchema,
  type DeleteSemanticModelResponse,
  DeleteSemanticModelResponseSchema,
  DimensionKind,
  type GetSemanticModelRequestSchema,
  type GetSemanticModelResponse,
  GetSemanticModelResponseSchema,
  type ListSemanticModelsRequestSchema,
  type ListSemanticModelsResponse,
  ListSemanticModelsResponseSchema,
  type ListSemanticModelVersionsRequestSchema,
  type ListSemanticModelVersionsResponse,
  ListSemanticModelVersionsResponseSchema,
  type SaveSemanticModelRequestSchema,
  type SaveSemanticModelResponse,
  SaveSemanticModelResponseSchema,
  type SemanticModel,
  SemanticModelSchema,
  SemanticModelSummarySchema,
  SemanticModelVersionSchema,
} from "@surfaces-ui/proto";
import type { CallOptions, DataSource } from "./datasource.js";
import { collect } from "./result.js";
import type { LibraryStorage } from "./library.js";
import { measureExpressionProblem } from "./measure.js";
import { semanticKeyProblem } from "./semantic-draft.js";

type Unary<Req extends Parameters<typeof create>[0], Res> = (request: MessageInitShape<Req>, options?: CallOptions) => Promise<Res>;

/**
 * A project's semantic models: what a query's rows are about, how they are
 * broken down and how they are measured. Explorers and reports take their
 * fields from them, so a metric is defined once. Any backend can hold them:
 * memory, the browser's storage, files in a repo, or a consumer's own store.
 */
export interface Semantics {
  listSemanticModels: Unary<typeof ListSemanticModelsRequestSchema, ListSemanticModelsResponse>;
  getSemanticModel: Unary<typeof GetSemanticModelRequestSchema, GetSemanticModelResponse>;
  /** Fails with `StaleSemanticModelError` when `expectedVersion` is not the latest, and `SemanticModelError` when the model does not check. */
  saveSemanticModel: Unary<typeof SaveSemanticModelRequestSchema, SaveSemanticModelResponse>;
  deleteSemanticModel: Unary<typeof DeleteSemanticModelRequestSchema, DeleteSemanticModelResponse>;
  listSemanticModelVersions: Unary<typeof ListSemanticModelVersionsRequestSchema, ListSemanticModelVersionsResponse>;
}

/** Someone else saved a newer version since this edit began. */
export class StaleSemanticModelError extends Error {
  constructor(
    readonly modelName: string,
    readonly latest: number,
    expected = 1,
  ) {
    super(
      expected === 0
        ? `There is already a model named "${modelName}" (version ${latest}). Choose another name, or change that one.`
        : `The model "${modelName}" was saved by someone else since you opened it (now version ${latest}). Reload it before saving.`,
    );
    this.name = "StaleSemanticModelError";
  }
}

/** A model that does not check; `problems` says every reason, one sentence each. */
export class SemanticModelError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "SemanticModelError";
  }
}

/** How the components name an aggregate. */
export type AggregateWord = "sum" | "avg" | "count" | "count_distinct" | "min" | "max" | "median" | "stddev" | "variance";

const AGGREGATES: [AggregateFunction, AggregateWord][] = [
  [AggregateFunction.SUM, "sum"],
  [AggregateFunction.AVG, "avg"],
  [AggregateFunction.COUNT, "count"],
  [AggregateFunction.COUNT_DISTINCT, "count_distinct"],
  [AggregateFunction.MIN, "min"],
  [AggregateFunction.MAX, "max"],
  [AggregateFunction.MEDIAN, "median"],
  [AggregateFunction.STDDEV, "stddev"],
  [AggregateFunction.VARIANCE, "variance"],
];

export const aggregateWord = (fn: AggregateFunction): AggregateWord | undefined => AGGREGATES.find(([f]) => f === fn)?.[1];
export const aggregateFunctionOf = (word: string): AggregateFunction => AGGREGATES.find(([, w]) => w === word)?.[0] ?? AggregateFunction.UNSPECIFIED;

const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const MODEL_NAME = /^[a-z][a-z0-9_]{0,63}$/;
const GRAINS = ["minute", "hour", "day", "week", "month", "quarter", "year"];
const FORMATS = ["", "number", "compact", "currency", "percent"];

type ModelInit = MessageInitShape<typeof SemanticModelSchema>;

/**
 * Every reason a model cannot be used, one sentence each; empty when it can.
 * Pure: it does not run the SQL or look up columns. A backend adds its own
 * checks (the SQL is one read-only query, the columns exist).
 */
export function semanticModelProblems(model: ModelInit, options: { isNew?: boolean } = {}): string[] {
  const problems: string[] = [];
  const name = model.name ?? "";
  if (!MODEL_NAME.test(name)) problems.push(`The model's name "${name}" must start with a lowercase letter and use only lowercase letters, digits and underscores.`);
  if (!model.sourceId) problems.push("The model needs a source.");
  if (!model.sql?.trim()) problems.push("The model needs a query.");
  // A new model says what one row is and which columns make it unique, so its sums count each thing once.
  if (options.isNew && !model.grain?.trim()) problems.push("Say what one row is, such as \"One order line.\"");
  if (options.isNew && (model.primaryKey ?? []).length === 0) problems.push("Name the columns that make a row unique.");
  if (model.dataset) {
    if (!model.dataset.pipelineId || !model.dataset.dataset) problems.push("A model from a pipeline names the pipeline and the dataset.");
    if ((model.tables ?? []).length > 0) problems.push("A model from a pipeline dataset reads that dataset, not tables and joins.");
  }
  const tables = (model.tables ?? []).map((t) => t.toLowerCase());
  for (const join of model.joins ?? []) {
    const sides = [join.left ?? "", join.right ?? ""];
    for (const side of sides) if (!tables.includes(side.toLowerCase())) problems.push(`A join names the table ${side}, which is not one of the model's tables.`);
    if ((join.keys ?? []).length === 0) problems.push(`The join of ${sides[0]} and ${sides[1]} needs a column from each.`);
  }
  const seen = new Map<string, number>();
  const all = [...(model.dimensions ?? []), ...(model.measures ?? []), ...(model.metrics ?? [])];
  for (const field of all) seen.set(field.name ?? "", (seen.get(field.name ?? "") ?? 0) + 1);
  for (const [field, count] of seen) {
    if (!NAME.test(field)) problems.push(`"${field}" cannot be a name: start with a letter and use only letters, digits and underscores.`);
    else if (count > 1) problems.push(`"${field}" is used for more than one field; names are shared by dimensions, measures and metrics.`);
  }
  for (const d of model.dimensions ?? []) {
    if (!d.column) problems.push(`The dimension "${d.name}" needs a column.`);
    if (d.kind === DimensionKind.TIME && d.grain && !GRAINS.includes(d.grain)) problems.push(`The dimension "${d.name}" has the grain "${d.grain}"; use one of ${GRAINS.join(", ")}.`);
  }
  for (const m of model.measures ?? []) {
    const word = aggregateWord(m.aggregate ?? AggregateFunction.UNSPECIFIED);
    if (!word) problems.push(`The measure "${m.name}" needs a way to summarise: sum, average, count.`);
    else if (!m.column && word !== "count") problems.push(`The measure "${m.name}" needs a column; only a count can do without one.`);
    if (!FORMATS.includes(m.format ?? "")) problems.push(`The measure "${m.name}" has the format "${m.format}"; use number, compact, currency or percent.`);
  }
  const measures = (model.measures ?? []).map((m) => m.name ?? "");
  for (const m of model.metrics ?? []) {
    // A metric is over measures only, so it can never depend on itself.
    const problem = measureExpressionProblem(m.expression ?? "", measures);
    if (problem) problems.push(`The metric "${m.name}": ${problem}`);
    if (!FORMATS.includes(m.format ?? "")) problems.push(`The metric "${m.name}" has the format "${m.format}"; use number, compact, currency or percent.`);
  }
  return problems;
}

/** A model as plain JSON, for a file in a repo or a prompt. */
export const semanticModelJson = (model: SemanticModel): JsonValue => toJson(SemanticModelSchema, model);
/** A model from plain JSON. Throws when it is not one. */
export const semanticModelFromJson = (json: JsonValue): SemanticModel => fromJson(SemanticModelSchema, json, { ignoreUnknownFields: true });

export interface MemorySemanticsOptions {
  /** Models to start with when the store holds none of that name (a project's starters). Their version starts at 1. */
  models?: ModelInit[];
  /** Keep the models somewhere that outlives the process: one key holding every model's versions. */
  storage?: LibraryStorage;
  key?: string;
  /** Versions kept per model. Default 20. */
  maxVersions?: number;
  now?(): Date;
  /** The backend's own checks, run before a save: return problems to refuse it. */
  check?(model: SemanticModel): string[] | Promise<string[]>;
}

interface Stored {
  model: JsonValue;
  note: string;
}

/** Semantic models held in memory, optionally written through to storage. */
export function memorySemantics(options: MemorySemanticsOptions = {}): Semantics {
  const key = options.key ?? "surfaces-semantic";
  const maxVersions = Math.max(1, options.maxVersions ?? 20);
  const now = options.now ?? (() => new Date());
  let all: Record<string, { model: SemanticModel; note: string }[]> | undefined;

  const load = async () => {
    if (all) return all;
    const out: Record<string, { model: SemanticModel; note: string }[]> = {};
    try {
      const text = options.storage ? await options.storage.load(key) : undefined;
      const raw = text ? (JSON.parse(text) as Record<string, Stored[]>) : {};
      for (const [name, versions] of Object.entries(raw)) {
        if (!Array.isArray(versions)) continue;
        const ok = versions.flatMap((v) => {
          try {
            return [{ model: semanticModelFromJson(v.model), note: typeof v.note === "string" ? v.note : "" }];
          } catch {
            return [];
          }
        });
        if (ok.length > 0) out[name] = ok;
      }
    } catch {
      // A store that cannot be read starts empty rather than failing every call.
    }
    for (const init of options.models ?? []) {
      const name = init.name ?? "";
      if (!out[name] && semanticModelProblems(init).length === 0) out[name] = [{ model: create(SemanticModelSchema, { ...init, version: 1, updatedAt: init.updatedAt || now().toISOString() }), note: "Starter" }];
    }
    all ??= out;
    return all;
  };
  const persist = async () => {
    if (!options.storage || !all) return;
    const raw: Record<string, Stored[]> = {};
    for (const [name, versions] of Object.entries(all)) raw[name] = versions.map((v) => ({ model: semanticModelJson(v.model), note: v.note }));
    await options.storage.save(key, JSON.stringify(raw));
  };
  const latest = (name: string) => all?.[name]?.at(-1)?.model;

  return {
    async listSemanticModels(request) {
      const store = await load();
      const models = Object.keys(store)
        .map((name) => latest(name)!)
        .filter((m) => !request.sourceId || m.sourceId === request.sourceId)
        .sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name));
      return create(ListSemanticModelsResponseSchema, {
        models: models.map((m) =>
          create(SemanticModelSummarySchema, { name: m.name, label: m.label, description: m.description, sourceId: m.sourceId, dimensionCount: m.dimensions.length, measureCount: m.measures.length, metricCount: m.metrics.length, version: m.version, updatedAt: m.updatedAt }),
        ),
      });
    },
    async getSemanticModel(request) {
      const versions = (await load())[request.name ?? ""];
      if (!versions) throw new Error(`No semantic model "${request.name}".`);
      const found = request.version ? versions.find((v) => v.model.version === request.version) : versions.at(-1);
      if (!found) throw new Error(`Version ${request.version} of "${request.name}" is no longer kept.`);
      return create(GetSemanticModelResponseSchema, { model: found.model });
    },
    async saveSemanticModel(request) {
      const store = await load();
      const input = request.model ?? {};
      const name = input.name ?? "";
      const current = latest(name)?.version ?? 0;
      if ((request.expectedVersion ?? 0) !== current) throw new StaleSemanticModelError(name, current, request.expectedVersion ?? 0);
      const model = create(SemanticModelSchema, { ...input, version: current + 1, updatedAt: now().toISOString() });
      const problems = [...semanticModelProblems(model, { isNew: current === 0 }), ...((await options.check?.(model)) ?? [])];
      if (problems.length > 0) throw new SemanticModelError(problems);
      store[name] = [...(store[name] ?? []), { model, note: request.note ?? "" }].slice(-maxVersions);
      await persist();
      return create(SaveSemanticModelResponseSchema, { model });
    },
    async deleteSemanticModel(request) {
      const store = await load();
      delete store[request.name ?? ""];
      await persist();
      return create(DeleteSemanticModelResponseSchema, {});
    },
    async listSemanticModelVersions(request) {
      const versions = (await load())[request.name ?? ""];
      if (!versions) throw new Error(`No semantic model "${request.name}".`);
      return create(ListSemanticModelVersionsResponseSchema, {
        versions: [...versions].reverse().map((v) => create(SemanticModelVersionSchema, { version: v.model.version, savedAt: v.model.updatedAt, savedBy: v.model.savedBy, note: v.note })),
      });
    },
  };
}

/**
 * Checks a model against its data: the query runs (through the read-only
 * `DataSource`, so it must be one read-only query) and returns every column
 * the model's fields name. Asks for one row; reads no values.
 */
export async function semanticModelDataProblems(model: ModelInit, dataSource: Pick<DataSource, "execute">, options?: CallOptions): Promise<string[]> {
  let names: string[];
  try {
    const result = await collect(dataSource.execute({ sourceId: model.sourceId ?? "", query: { baseSql: model.sql ?? "", page: { limit: 1 } } }, options));
    names = result.table.schema.fields.map((f) => f.name);
  } catch (error) {
    return [`The model's query does not run: ${error instanceof Error ? error.message : String(error)}`];
  }
  const missing = [...(model.dimensions ?? []), ...(model.measures ?? [])].filter((f) => f.column && !names.includes(f.column));
  const problems = missing.map((f) => `"${f.name}" names the column "${f.column}", which the model's query does not return.`);
  const unknownKey = (model.primaryKey ?? []).filter((c) => !names.includes(c));
  if (unknownKey.length > 0) problems.push(`The key names ${unknownKey.join(", ")}, which the model's query does not return.`);
  else if ((model.primaryKey ?? []).length > 0) {
    const keyProblem = await semanticKeyProblem(model, dataSource, options);
    if (keyProblem) problems.push(keyProblem);
  }
  return problems;
}
