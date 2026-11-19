import { FilterOperator } from "@surfaces-ui/proto";
import { DataType, type Field } from "apache-arrow";
import { type FormEvent, useEffect, useId, useState } from "react";
import { sinceLabel } from "../data/controls.js";
import { isNumeric } from "../data/format.js";
import type { FilterInit, ValueInit } from "../data/useRowWindow.js";
import { label as words } from "../locale/locale.js";
import { ControlIcon } from "../controls/ItemControls.js";

export interface FilterBarProps {
  /** Columns that can be filtered, usually a result's fields. */
  fields: Field[];
  filters: FilterInit[];
  onChange(filters: FilterInit[]): void;
  /**
   * Supplies the values a column holds, most common first, so a person can
   * pick one instead of typing it. The backend does the looking.
   */
  loadValues?(column: string): Promise<string[]>;
  /** The current time, for "last 30 days" and similar. Defaults to now. */
  now?: () => Date;
  /**
   * Date ranges that stay relative, by column: "30d", "month" (see
   * `sinceStart`). With `onRelativeChange`, a quick range is kept here
   * instead of becoming a fixed date in `filters`, so "last 30 days" still
   * means the last 30 days tomorrow. The host turns them into filters when
   * it queries (`filtersFromSpec` does, for the `since` operator).
   */
  relative?: Record<string, string>;
  onRelativeChange?(relative: Record<string, string>): void;
  className?: string;
}

/** Date ranges offered for date and time columns. */
export const QUICK_RANGES: { id: string; label: string; start(now: Date): Date }[] = [
  { id: "7d", get label() { return words("filter.range7d"); }, start: (now) => new Date(now.getTime() - 7 * 86_400_000) },
  { id: "30d", get label() { return words("filter.range30d"); }, start: (now) => new Date(now.getTime() - 30 * 86_400_000) },
  { id: "90d", get label() { return words("filter.range90d"); }, start: (now) => new Date(now.getTime() - 90 * 86_400_000) },
  { id: "12m", get label() { return words("filter.range12m"); }, start: (now) => new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate())) },
  { id: "month", get label() { return words("filter.rangeMonth"); }, start: (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) },
  { id: "year", get label() { return words("filter.rangeYear"); }, start: (now) => new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) },
];

interface OperatorChoice {
  operator: FilterOperator;
  label: string;
  /** Whether the operator takes a value. */
  value: boolean;
}

const COMPARE: OperatorChoice[] = [
  { operator: FilterOperator.EQ, label: "=", value: true },
  { operator: FilterOperator.NEQ, label: "≠", value: true },
  { operator: FilterOperator.GT, label: ">", value: true },
  { operator: FilterOperator.GTE, label: "≥", value: true },
  { operator: FilterOperator.LT, label: "<", value: true },
  { operator: FilterOperator.LTE, label: "≤", value: true },
];
const NULLS: OperatorChoice[] = [
  { operator: FilterOperator.IS_NULL, get label() { return words("filter.isEmpty"); }, value: false },
  { operator: FilterOperator.IS_NOT_NULL, get label() { return words("filter.isNotEmpty"); }, value: false },
];
const TEXT: OperatorChoice[] = [
  { operator: FilterOperator.CONTAINS, get label() { return words("filter.contains"); }, value: true },
  { operator: FilterOperator.EQ, get label() { return words("filter.is"); }, value: true },
  { operator: FilterOperator.NEQ, get label() { return words("filter.isNot"); }, value: true },
  { operator: FilterOperator.STARTS_WITH, get label() { return words("filter.startsWith"); }, value: true },
  { operator: FilterOperator.ENDS_WITH, get label() { return words("filter.endsWith"); }, value: true },
];
const ALL = [...TEXT, ...COMPARE, ...NULLS];

function isText(type: DataType): boolean {
  return DataType.isUtf8(type) || DataType.isLargeUtf8(type) || DataType.isDictionary(type);
}

/** Operators that make sense for a column type. */
export function operatorsFor(type: DataType): OperatorChoice[] {
  if (isText(type)) return [...TEXT, ...NULLS];
  if (DataType.isBool(type)) return [COMPARE[0]!, COMPARE[1]!, ...NULLS];
  return [...COMPARE, ...NULLS];
}

/** Converts typed text into a contract Value for a column type. Throws a readable message when it does not fit. */
export function toValue(text: string, type: DataType): ValueInit {
  const trimmed = text.trim();
  if (DataType.isInt(type)) {
    if (!/^-?\d+$/.test(trimmed)) throw new Error(words("filter.enterWholeNumber"));
    return { kind: { case: "intValue", value: BigInt(trimmed) } };
  }
  if (DataType.isDecimal(type)) {
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) throw new Error(words("filter.enterNumber"));
    return { kind: { case: "decimalValue", value: trimmed } };
  }
  if (DataType.isFloat(type)) {
    if (trimmed === "" || Number.isNaN(Number(trimmed))) throw new Error(words("filter.enterNumber"));
    return { kind: { case: "doubleValue", value: Number(trimmed) } };
  }
  if (DataType.isBool(type)) {
    if (!/^(true|false)$/i.test(trimmed)) throw new Error(words("filter.enterTrueFalse"));
    return { kind: { case: "boolValue", value: trimmed.toLowerCase() === "true" } };
  }
  if (DataType.isTimestamp(type) || DataType.isDate(type)) {
    if (Number.isNaN(Date.parse(trimmed))) throw new Error(words("filter.enterDate"));
    return { kind: { case: "temporalValue", value: trimmed } };
  }
  if (text === "") throw new Error(words("filter.enterValue"));
  return { kind: { case: "stringValue", value: text } };
}

function describe(filter: FilterInit): string {
  const label = ALL.find((o) => o.operator === filter.operator)?.label ?? "?";
  const values = (filter.values ?? []).map((v) => String((v as { kind?: { value?: unknown } }).kind?.value ?? ""));
  return `${filter.column} ${label}${values.length > 0 ? ` ${values.join(", ")}` : ""}`;
}

/**
 * Shows the active filters as removable chips and lets a person add one by
 * choosing a column, a comparison and a value. It only edits the filter
 * list; the grid or chart given the same list re-queries the backend.
 */
export function FilterBar({ fields, filters, onChange, loadValues, now, relative, onRelativeChange, className }: FilterBarProps) {
  const id = useId();
  const [column, setColumn] = useState("");
  const [operator, setOperator] = useState<FilterOperator | undefined>();
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [values, setValues] = useState<Record<string, string[]>>({});

  const usable = fields.filter((f) => !DataType.isList(f.type) && !DataType.isStruct(f.type) && !DataType.isMap(f.type));
  const field = usable.find((f) => f.name === column) ?? usable[0];
  const choices = field ? operatorsFor(field.type) : [];
  const choice = choices.find((c) => c.operator === operator) ?? choices[0];

  const temporal = field !== undefined && (DataType.isTimestamp(field.type) || DataType.isDate(field.type));
  // Values are offered for columns where picking beats typing: text and true/false.
  const pickable = field !== undefined && loadValues !== undefined && (isText(field.type) || DataType.isBool(field.type));
  const fieldName = field?.name;
  useEffect(() => {
    if (!pickable || !fieldName || !loadValues || values[fieldName]) return;
    let current = true;
    loadValues(fieldName)
      .then((found) => current && setValues((previous) => ({ ...previous, [fieldName]: found })))
      .catch(() => current && setValues((previous) => ({ ...previous, [fieldName]: [] })));
    return () => {
      current = false;
    };
  }, [pickable, fieldName, loadValues]); // eslint-disable-line react-hooks/exhaustive-deps
  const options = pickable && fieldName ? (values[fieldName] ?? []) : [];

  const addRange = (id: string) => {
    const range = QUICK_RANGES.find((r) => r.id === id);
    if (!range || !field) return;
    // Kept relative when the host holds relative ranges; a fixed date otherwise.
    if (onRelativeChange) return onRelativeChange({ ...(relative ?? {}), [field.name]: range.id });
    const start = range.start((now ?? (() => new Date()))()).toISOString().slice(0, 10);
    // One range per column: a new one replaces the last.
    const others = filters.filter((f) => !(f.column === field.name && f.operator === FilterOperator.GTE));
    onChange([...others, { column: field.name, operator: FilterOperator.GTE, values: [{ kind: { case: "temporalValue", value: start } }] }]);
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!field || !choice) return;
    try {
      const values = choice.value ? [toValue(text, field.type)] : [];
      onChange([...filters, { column: field.name, operator: choice.operator, values }]);
      setText("");
      setProblem(undefined);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className={["sf-filters", className].filter(Boolean).join(" ")}>
      {(filters.length > 0 || Object.keys(relative ?? {}).length > 0) && (
        <ul className="sf-filter-chips" aria-label={words("filter.active")}>
          {Object.entries(relative ?? {}).map(([name, range]) => (
            <li key={`relative-${name}`} className="sf-filter-chip" data-relative="true">
              <span>
                {name}: {sinceLabel(range).toLowerCase()}
              </span>
              <button type="button" aria-label={words("filter.remove", { filter: `${name}: ${sinceLabel(range).toLowerCase()}` })} onClick={() => onRelativeChange?.(Object.fromEntries(Object.entries(relative ?? {}).filter(([column]) => column !== name)))}>
                <ControlIcon icon="close" />
              </button>
            </li>
          ))}
          {filters.map((filter, index) => (
            <li key={`${describe(filter)}-${index}`} className="sf-filter-chip">
              <span>{describe(filter)}</span>
              <button
                type="button"
                aria-label={words("filter.remove", { filter: describe(filter) })}
                onClick={() => onChange(filters.filter((_, i) => i !== index))}
              >
                <ControlIcon icon="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="sf-filter-form" onSubmit={add} aria-label={words("filter.form")}>
        <select
          className="sf-input"
          aria-label={words("filter.column")}
          value={field?.name ?? ""}
          disabled={usable.length === 0}
          onChange={(e) => {
            setColumn(e.target.value);
            setOperator(undefined);
            setProblem(undefined);
          }}
        >
          {usable.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          className="sf-input"
          aria-label={words("filter.comparison")}
          value={choice?.operator ?? ""}
          disabled={usable.length === 0}
          onChange={(e) => setOperator(Number(e.target.value) as FilterOperator)}
        >
          {choices.map((c) => (
            <option key={c.operator} value={c.operator}>
              {c.label}
            </option>
          ))}
        </select>
        {choice?.value && (
          <input
            className="sf-input sf-filter-value"
            aria-label={words("filter.value")}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${id}-problem` : undefined}
            placeholder={options.length > 0 ? words("filter.typeOrPick") : words("filter.value")}
            type={temporal ? "date" : "text"}
            list={options.length > 0 ? `${id}-values` : undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setProblem(undefined);
            }}
          />
        )}
        {options.length > 0 && (
          <datalist id={`${id}-values`}>
            {options.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        )}
        <button type="submit" className="sf-button" disabled={usable.length === 0}>
          {words("filter.add")}
        </button>
        {temporal && (
          <select className="sf-input" aria-label={words("filter.quickRange")} value="" onChange={(e) => addRange(e.target.value)}>
            <option value="">{words("filter.quickRangeChoose")}</option>
            {QUICK_RANGES.map((range) => (
              <option key={range.id} value={range.id}>
                {range.label}
              </option>
            ))}
          </select>
        )}
        {problem && (
          <span id={`${id}-problem`} className="sf-filter-problem" role="alert">
            {problem}
          </span>
        )}
      </form>
    </div>
  );
}
