import { DataType } from "apache-arrow";
import { label, numberFormat } from "../locale/locale.js";

export interface FormattedCell {
  text: string;
  /** Numbers align right so digits line up. */
  numeric: boolean;
  isNull: boolean;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function decimal(unscaled: string, scale: number): string {
  if (scale <= 0) return unscaled;
  const negative = unscaled.startsWith("-");
  const digits = (negative ? unscaled.slice(1) : unscaled).padStart(scale + 1, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

function timestamp(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const millis = d.getUTCMilliseconds();
  return `${date} ${time}${millis ? `.${pad(millis, 3)}` : ""}`;
}

function json(value: unknown): string {
  return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}

/** True for types whose values should be right-aligned. */
export function isNumeric(type: DataType): boolean {
  return DataType.isInt(type) || DataType.isFloat(type) || DataType.isDecimal(type);
}

/** Turns one Arrow value into display text, by its column type. */
export function formatCell(value: unknown, type: DataType): FormattedCell {
  if (value == null) return { text: "null", numeric: false, isNull: true };
  if (DataType.isDecimal(type)) return { text: decimal(String(value), type.scale), numeric: true, isNull: false };
  if (DataType.isTimestamp(type)) return { text: timestamp(Number(value)), numeric: false, isNull: false };
  if (DataType.isDate(type)) return { text: timestamp(Number(value)).slice(0, 10), numeric: false, isNull: false };
  if (DataType.isInt(type)) return { text: String(value), numeric: true, isNull: false };
  if (DataType.isFloat(type)) return { text: numberFormat({ maximumFractionDigits: 4 }).format(Number(value)), numeric: true, isNull: false };
  if (DataType.isBool(type)) return { text: value ? "true" : "false", numeric: false, isNull: false };
  if (typeof value === "object") {
    const plain = typeof (value as { toJSON?: unknown }).toJSON === "function" ? (value as { toJSON(): unknown }).toJSON() : value;
    return { text: json(plain), numeric: false, isNull: false };
  }
  return { text: String(value), numeric: typeof value === "number" || typeof value === "bigint", isNull: false };
}

/** How a column's values are written, when the default for its type is not what a reader needs. */
export interface ColumnFormat {
  /**
   * "number" groups digits; "compact" writes 1.2M; "currency" adds a symbol;
   * "percent" treats 0.12 as 12%; "date" drops the time; "text" shows the raw value.
   */
  kind: "number" | "compact" | "currency" | "percent" | "date" | "datetime" | "text";
  /** Digits after the decimal point. */
  decimals?: number;
  /** ISO 4217 code for "currency". Defaults to USD. */
  currency?: string;
}

/** Turns one Arrow value into display text, using a column format when one is given. */
export function formatCellAs(value: unknown, type: DataType, format: ColumnFormat | undefined): FormattedCell {
  const plain = formatCell(value, type);
  if (!format || plain.isNull) return plain;
  if (format.kind === "text") return { ...plain, numeric: false };
  if (format.kind === "date" || format.kind === "datetime") {
    if (!DataType.isTimestamp(type) && !DataType.isDate(type)) return plain;
    return { ...plain, text: format.kind === "date" ? plain.text.slice(0, 10) : plain.text.slice(0, 19) };
  }
  const number = DataType.isDecimal(type) ? Number(plain.text) : Number(value);
  if (!Number.isFinite(number)) return plain;
  const digits = format.decimals === undefined ? {} : { minimumFractionDigits: format.decimals, maximumFractionDigits: format.decimals };
  const options: Intl.NumberFormatOptions =
    format.kind === "currency"
      ? { style: "currency", currency: format.currency ?? "USD", ...digits }
      : format.kind === "percent"
        ? { style: "percent", maximumFractionDigits: 1, ...digits }
        : format.kind === "compact"
          ? { notation: "compact", maximumFractionDigits: 1, ...digits }
          : { maximumFractionDigits: 4, ...digits };
  return { text: numberFormat(options).format(number), numeric: true, isNull: false };
}

/**
 * Display text for a cell on screen: like `formatCellAs`, with null, true and
 * false in the page's words (`cell.null`, `cell.true`, `cell.false`).
 * Exports keep the raw text from `formatCell`.
 */
export function displayCell(value: unknown, type: DataType, format: ColumnFormat | undefined): FormattedCell {
  const cell = formatCellAs(value, type, format);
  if (cell.isNull) return { ...cell, text: label("cell.null") };
  if (DataType.isBool(type) && format?.kind !== "text") return { ...cell, text: label(value ? "cell.true" : "cell.false") };
  return cell;
}

/**
 * A number from an Arrow value of any numeric type. DECIMAL arrives as its
 * unscaled integer (790558312 for 7905583.12), so it must be read with its scale;
 * `Number(raw)` alone is off by a power of ten.
 */
export function numericValue(value: unknown, type: DataType): number | null {
  if (value == null) return null;
  const number = DataType.isDecimal(type) ? Number(decimal(String(value), type.scale)) : Number(value);
  return Number.isFinite(number) ? number : null;
}

/** A value suitable for a chart axis or series: numbers stay numbers, times become ISO strings. */
export function chartValue(value: unknown, type: DataType): string | number | null {
  if (value == null) return null;
  if (DataType.isDecimal(type)) return Number(decimal(String(value), type.scale));
  if (DataType.isTimestamp(type)) return new Date(Number(value)).toISOString();
  if (DataType.isDate(type)) return new Date(Number(value)).toISOString().slice(0, 10);
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
