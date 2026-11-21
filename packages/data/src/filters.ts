import type { MessageInitShape } from "@bufbuild/protobuf";
import { FilterOperator, type FilterSchema, type ValueSchema } from "@surfaces-ui/proto";

// The query's own shapes, kept unexported here so that packages re-exporting this module and their own names do not clash.
type FilterInit = MessageInitShape<typeof FilterSchema>;
type ValueInit = MessageInitShape<typeof ValueSchema>;
/** A sort as a grid holds it. */
type GridSort = { column: string; desc: boolean };

/**
 * The state of a view's controls as plain JSON, so that an agent, a URL or
 * a saved page can set exactly what a person can set by hand.
 */
export type FilterOp = "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "between" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null" | "since";

export interface FilterSpec {
  column: string;
  op: FilterOp;
  /**
   * None for is_null and is_not_null, two for between, one or more for in and not_in, otherwise one.
   * For `since`, one relative range: "7d", "4w", "3m", "1y" (that long ago, from the start of that day)
   * or "week", "month", "quarter", "year" (the start of this one). It is worked out when the query is
   * sent, so "last 30 days" still means the last 30 days tomorrow.
   */
  values?: (string | number | boolean)[];
}

/**
 * Where a relative range starts, in UTC: "30d" is the start of the day 30
 * days ago, "month" the start of this month. Undefined for anything else.
 * It moves once a day at most, so a query built from it is not sent again
 * on every draw.
 */
export function sinceStart(range: string, now: Date = new Date()): Date | undefined {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const ago = /^(\d{1,4})([dwmy])$/.exec(range.trim().toLowerCase());
  if (ago) {
    const n = Number(ago[1]);
    if (ago[2] === "d") return new Date(day - n * 86_400_000);
    if (ago[2] === "w") return new Date(day - n * 7 * 86_400_000);
    if (ago[2] === "m") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, now.getUTCDate()));
    return new Date(Date.UTC(now.getUTCFullYear() - n, now.getUTCMonth(), now.getUTCDate()));
  }
  switch (range.trim().toLowerCase()) {
    case "week":
      // Weeks start on Monday.
      return new Date(day - ((new Date(day).getUTCDay() + 6) % 7) * 86_400_000);
    case "month":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    case "quarter":
      return new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
    case "year":
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    default:
      return undefined;
  }
}

/** A relative range in words: "Last 30 days", "This month". */
export function sinceLabel(range: string): string {
  const ago = /^(\d{1,4})([dwmy])$/.exec(range.trim().toLowerCase());
  if (ago) {
    const unit = { d: "day", w: "week", m: "month", y: "year" }[ago[2] as "d" | "w" | "m" | "y"];
    return `Last ${ago[1] === "1" ? unit : `${ago[1]} ${unit}s`}`;
  }
  return `This ${range.trim().toLowerCase()}`;
}

export interface SortSpec {
  column: string;
  desc?: boolean;
}

export const FILTER_OPS: Record<FilterOp, FilterOperator> = {
  eq: FilterOperator.EQ,
  neq: FilterOperator.NEQ,
  lt: FilterOperator.LT,
  lte: FilterOperator.LTE,
  gt: FilterOperator.GT,
  gte: FilterOperator.GTE,
  in: FilterOperator.IN,
  not_in: FilterOperator.NOT_IN,
  between: FilterOperator.BETWEEN,
  contains: FilterOperator.CONTAINS,
  starts_with: FilterOperator.STARTS_WITH,
  ends_with: FilterOperator.ENDS_WITH,
  is_null: FilterOperator.IS_NULL,
  is_not_null: FilterOperator.IS_NOT_NULL,
  // Sent as "on or after" the start of the range.
  since: FilterOperator.GTE,
};

function toValueInit(value: string | number | boolean): ValueInit {
  if (typeof value === "boolean") return { kind: { case: "boolValue", value } };
  if (typeof value === "number") return Number.isInteger(value) ? { kind: { case: "intValue", value: BigInt(value) } } : { kind: { case: "doubleValue", value } };
  return { kind: { case: "stringValue", value } };
}

/** How many values an operator takes: [fewest, most]. */
const ARITY: Partial<Record<FilterOp, [number, number]>> = { is_null: [0, 0], is_not_null: [0, 0], between: [2, 2], in: [1, 1000], not_in: [1, 1000] };

/**
 * Filters for a query from their plain form. Values are always sent as bound
 * parameters. A filter with the wrong number of values is refused with a
 * message that names it, rather than sent and failed by the engine.
 */
export function filtersFromSpec(specs: FilterSpec[], now: Date = new Date()): FilterInit[] {
  return specs.map((spec) => {
    if (spec.op === "since") {
      const start = spec.values?.length === 1 ? sinceStart(String(spec.values[0]), now) : undefined;
      if (!start) throw new Error(`The filter on ${spec.column} (since) needs one range such as "30d", "3m" or "month", but has ${JSON.stringify(spec.values ?? [])}.`);
      return { column: spec.column, operator: FilterOperator.GTE, values: [{ kind: { case: "temporalValue", value: start.toISOString().slice(0, 10) } }] };
    }
    const [fewest, most] = ARITY[spec.op] ?? [1, 1];
    const given = spec.values?.length ?? 0;
    if (given < fewest || given > most) {
      throw new Error(`The filter on ${spec.column} (${spec.op}) needs ${fewest === most ? fewest : `${fewest} or more`} ${fewest === 1 && most === 1 ? "value" : "values"}, but has ${given}.`);
    }
    return { column: spec.column, operator: FILTER_OPS[spec.op], values: (spec.values ?? []).map(toValueInit) };
  });
}

export function sortsFromSpec(specs: SortSpec[]): GridSort[] {
  return specs.map((spec) => ({ column: spec.column, desc: spec.desc === true }));
}

/** A filter that keeps, or leaves out, one value of a column. A missing value becomes "is missing". */
export function valueFilter(column: string, value: unknown, exclude: boolean): FilterInit {
  if (value == null) return { column, operator: exclude ? FilterOperator.IS_NOT_NULL : FilterOperator.IS_NULL, values: [] };
  const plain = typeof value === "bigint" ? { kind: { case: "intValue" as const, value } } : value instanceof Date ? toValueInit(value.toISOString()) : toValueInit(typeof value === "number" || typeof value === "boolean" ? value : String(value));
  return { column, operator: exclude ? FilterOperator.NEQ : FilterOperator.EQ, values: [plain] };
}

// `since` is sent as "on or after", so a filter read back is "gte".
const OP_NAMES = Object.fromEntries(
  Object.entries(FILTER_OPS)
    .filter(([name]) => name !== "since")
    .map(([name, op]) => [op, name]),
) as Record<FilterOperator, FilterOp>;

function fromValueInit(value: ValueInit): string | number | boolean | undefined {
  const kind = value.kind;
  if (!kind || kind.case === undefined) return undefined;
  const v = kind.value as unknown;
  if (typeof v === "bigint") return Number(v) <= Number.MAX_SAFE_INTEGER && Number(v) >= Number.MIN_SAFE_INTEGER ? Number(v) : String(v);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return v == null ? undefined : String(v);
}

/** Filters in their plain form, the inverse of `filtersFromSpec`, for saving or giving to an agent. */
export function filtersToSpec(filters: FilterInit[]): FilterSpec[] {
  return filters.flatMap((filter) => {
    const op = OP_NAMES[filter.operator ?? FilterOperator.UNSPECIFIED];
    if (!op || !filter.column) return [];
    const values = (filter.values ?? []).map(fromValueInit).filter((v): v is string | number | boolean => v !== undefined);
    return [{ column: filter.column, op, ...(values.length > 0 ? { values } : {}) }];
  });
}

/** Sorts in their plain form, the inverse of `sortsFromSpec`. */
export function sortsToSpec(sorts: GridSort[]): SortSpec[] {
  return sorts.map((sort) => (sort.desc ? { column: sort.column, desc: true } : { column: sort.column }));
}

/** A filter list split into its fixed filters and its relative date ranges, by column. */
export function splitRelative(specs: FilterSpec[]): { fixed: FilterSpec[]; relative: Record<string, string> } {
  const relative: Record<string, string> = {};
  const fixed: FilterSpec[] = [];
  for (const spec of specs) {
    if (spec.op === "since" && spec.values?.length === 1) relative[spec.column] = String(spec.values[0]);
    else fixed.push(spec);
  }
  return { fixed, relative };
}

/** The inverse of `splitRelative`: one list again, relative ranges last. */
export function joinRelative(fixed: FilterSpec[], relative: Record<string, string>): FilterSpec[] {
  return [...fixed, ...Object.entries(relative).map(([column, range]) => ({ column, op: "since" as const, values: [range] }))];
}

/**
 * Checks a filter list from an untrusted place (storage, the address bar, a
 * saved page) and keeps only the filters that could be sent: a known
 * operator, plain values, the right number of them, and a `since` range that
 * means something. Anything else is left out, never guessed at.
 */
export function parseFilterSpecs(input: unknown): FilterSpec[] {
  if (!Array.isArray(input)) return [];
  const plain = (v: unknown): v is string | number | boolean => typeof v === "string" || (typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean";
  return input.flatMap((item): FilterSpec[] => {
    if (item === null || typeof item !== "object") return [];
    const { column, op, values } = item as { column?: unknown; op?: unknown; values?: unknown };
    if (typeof column !== "string" || column === "" || typeof op !== "string" || !Object.hasOwn(FILTER_OPS, op)) return [];
    if (values !== undefined && !(Array.isArray(values) && values.every(plain))) return [];
    const spec: FilterSpec = { column, op: op as FilterOp, ...(values && values.length > 0 ? { values: [...values] } : {}) };
    try {
      filtersFromSpec([spec]);
    } catch {
      return [];
    }
    return [spec];
  });
}

/** Checks a sort list from an untrusted place, as `parseFilterSpecs` does for filters. */
export function parseSortSpecs(input: unknown): SortSpec[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item): SortSpec[] => {
    const column = item !== null && typeof item === "object" ? (item as { column?: unknown }).column : undefined;
    if (typeof column !== "string" || column === "") return [];
    return [(item as { desc?: unknown }).desc === true ? { column, desc: true } : { column }];
  });
}

/** The values a column is filtered to by a click or a pick (`eq` or `in`), or none. */
export function chosenValues(specs: FilterSpec[], column: string): (string | number | boolean)[] {
  return specs.filter((spec) => spec.column === column && (spec.op === "eq" || spec.op === "in")).flatMap((spec) => spec.values ?? []);
}

/**
 * What a click on a value does to a shared filter list: a value not chosen
 * is added to the column's choice, and a value already chosen is taken out
 * of it, so clicking two bars shows both and clicking one again clears it.
 * One value is written `eq` and several `in`. Other filters, on this column
 * or any other, are a person's own and are left alone.
 */
export function toggleValueFilter(specs: FilterSpec[], column: string, value: string | number | boolean): FilterSpec[] {
  const current = chosenValues(specs, column);
  const chosen = current.some((v) => String(v) === String(value));
  return selectValues(specs, column, chosen ? current.filter((v) => String(v) !== String(value)) : [...current, value]);
}

/** Replaces a column's choice of values (`eq` for one, `in` for several); an empty list clears it. */
export function selectValues(specs: FilterSpec[], column: string, values: (string | number | boolean)[]): FilterSpec[] {
  const others = specs.filter((spec) => !(spec.column === column && (spec.op === "eq" || spec.op === "in")));
  if (values.length === 0) return others;
  return [...others, values.length === 1 ? { column, op: "eq", values: [values[0]!] } : { column, op: "in", values: [...values] }];
}

/** A shared filter list without the filters on one column: what a chart reads so that it never filters away the bars a person clicks. */
export function filtersExcept(specs: FilterSpec[], column: string): FilterSpec[] {
  return specs.filter((spec) => spec.column !== column);
}

const OP_WORDS: Record<FilterOp, string> = {
  eq: "is", neq: "is not", lt: "is under", lte: "is at most", gt: "is over", gte: "is at least", in: "is one of", not_in: "is none of", between: "is between",
  contains: "contains", starts_with: "starts with", ends_with: "ends with", is_null: "is empty", is_not_null: "is not empty", since: "since",
};

/** A filter in words, for a note or a label: "region is South", "ordered_at in the last 30 days". */
export function filterWords(spec: FilterSpec): string {
  if (spec.op === "since") return `${spec.column} in ${sinceLabel(String(spec.values?.[0] ?? "")).replace(/^Last /, "the last ").replace(/^This /, "this ")}`;
  const values = (spec.values ?? []).map(String);
  return `${spec.column} ${OP_WORDS[spec.op]}${values.length > 0 ? ` ${spec.op === "between" ? values.join(" and ") : values.join(", ")}` : ""}`;
}
