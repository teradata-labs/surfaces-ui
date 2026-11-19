import { Binary, type DataType, DateDay, Decimal, Float64, Int8, Int16, Int32, Int64, TimeUnit, Timestamp, Utf8 } from "apache-arrow";

export type Family = "int8" | "int16" | "int32" | "int64" | "decimal" | "float" | "date" | "timestamp" | "timestamptz" | "binary" | "text";

export interface ColumnType {
  family: Family;
  /** Digits after the point, for `decimal`. */
  scale: number;
  arrow: DataType;
}

const of = (family: Family, arrow: DataType, scale = 0): ColumnType => ({ family, scale, arrow });

/**
 * The Arrow type a Teradata type arrives as, from Teradata's name for it
 * (`INTEGER`, `DECIMAL(18,2)`, `TIMESTAMP(6) WITH TIME ZONE`, ...).
 *
 * - DECIMAL and NUMBER with a stated precision are exact (decimal128).
 *   Without one (`NUMBER`, or a transport that reports only `DECIMAL`) the
 *   scale is not known, so the column is a float.
 * - TIMESTAMP is microseconds; values are read as UTC. WITH TIME ZONE values
 *   are moved to UTC and the column says so.
 * - TIME, INTERVAL, PERIOD, JSON, XML and other types arrive as text.
 */
export function columnType(native: string): ColumnType {
  const text = native.trim().toUpperCase().replace(/_/g, " ");
  const base = text.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  const args = (/\(([^)]*)\)/.exec(text)?.[1] ?? "").split(",").map((a) => a.trim());
  const precision = /^\d+$/.test(args[0] ?? "") ? Number(args[0]) : undefined;
  const scale = /^\d+$/.test(args[1] ?? "") ? Number(args[1]) : 0;
  switch (base) {
    case "BYTEINT":
      return of("int8", new Int8());
    case "SMALLINT":
      return of("int16", new Int16());
    case "INTEGER":
    case "INT":
      return of("int32", new Int32());
    case "BIGINT":
      return of("int64", new Int64());
    case "DECIMAL":
    case "DEC":
    case "NUMERIC":
    case "NUMBER":
      if (precision !== undefined && precision >= 1 && precision <= 38 && scale <= precision) return of("decimal", new Decimal(scale, precision, 128), scale);
      return of("float", new Float64());
    case "FLOAT":
    case "REAL":
    case "DOUBLE":
    case "DOUBLE PRECISION":
      return of("float", new Float64());
    case "DATE":
      return of("date", new DateDay());
    case "BYTE":
    case "VARBYTE":
    case "BLOB":
    case "BINARY LARGE OBJECT":
      return of("binary", new Binary());
  }
  if (/^TIMESTAMP\b.*\bZONE$/.test(base)) return of("timestamptz", new Timestamp(TimeUnit.MICROSECOND, "UTC"));
  if (base === "TIMESTAMP") return of("timestamp", new Timestamp(TimeUnit.MICROSECOND));
  return of("text", new Utf8());
}

/** The type to use when a transport gives no type name: whatever the first value that is not null looks like. */
export function inferType(values: Iterable<unknown>): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "bigint") return "BIGINT";
    if (typeof value === "number") return "FLOAT";
    if (typeof value === "boolean") return "BYTEINT";
    if (value instanceof Date) return "TIMESTAMP(6)";
    if (value instanceof Uint8Array) return "VARBYTE";
    return "VARCHAR";
  }
  return "VARCHAR";
}

const INTERVALS: Record<string, string> = {
  YR: "INTERVAL YEAR",
  YM: "INTERVAL YEAR TO MONTH",
  MO: "INTERVAL MONTH",
  DY: "INTERVAL DAY",
  DH: "INTERVAL DAY TO HOUR",
  DM: "INTERVAL DAY TO MINUTE",
  DS: "INTERVAL DAY TO SECOND",
  HR: "INTERVAL HOUR",
  HM: "INTERVAL HOUR TO MINUTE",
  HS: "INTERVAL HOUR TO SECOND",
  MI: "INTERVAL MINUTE",
  MS: "INTERVAL MINUTE TO SECOND",
  SC: "INTERVAL SECOND",
};

const PLAIN: Record<string, string> = {
  I1: "BYTEINT",
  I2: "SMALLINT",
  I: "INTEGER",
  I8: "BIGINT",
  F: "FLOAT",
  DA: "DATE",
  CO: "CLOB",
  BO: "BLOB",
  JN: "JSON",
  XM: "XML",
  PD: "PERIOD(DATE)",
  UT: "UDT",
  A1: "ARRAY",
  AN: "ARRAY",
  DT: "DATASET",
  "++": "TD_ANYTYPE",
};

export interface DictionaryColumn {
  /** `DBC.ColumnsV.ColumnType`, e.g. `CV`, `I`, `D`, `DA`, `TS`. */
  code: string;
  /** `ColumnLength`: bytes. */
  length?: number;
  /** `DecimalTotalDigits`. */
  digits?: number;
  /** `DecimalFractionalDigits`: the scale of a DECIMAL, or the fractional seconds of a time. */
  fraction?: number;
  /** `CharType`: 1 Latin, 2 Unicode (two bytes a character). */
  charType?: number;
}

/**
 * Teradata's name for a column type from the codes the data dictionary
 * (`DBC.ColumnsV`) holds. An unknown code is returned as it is.
 */
export function nativeType({ code, length, digits, fraction, charType }: DictionaryColumn): string {
  const key = code.trim().toUpperCase();
  const sized = (name: string, size: number | undefined) => (size && size > 0 ? `${name}(${size})` : name);
  const characters = length === undefined ? undefined : charType === 2 ? Math.floor(length / 2) : length;
  const seconds = fraction ?? 6;
  switch (key) {
    case "D":
      return digits ? `DECIMAL(${digits},${fraction ?? 0})` : "DECIMAL";
    case "N":
      // NUMBER with no stated precision is stored with digits recorded as 0 or less.
      return digits && digits > 0 ? `NUMBER(${digits},${Math.max(0, fraction ?? 0)})` : "NUMBER";
    case "CF":
      return sized("CHAR", characters);
    case "CV":
      return sized("VARCHAR", characters);
    case "BF":
      return sized("BYTE", length);
    case "BV":
      return sized("VARBYTE", length);
    case "TS":
      return `TIMESTAMP(${seconds})`;
    case "SZ":
      return `TIMESTAMP(${seconds}) WITH TIME ZONE`;
    case "AT":
      return `TIME(${seconds})`;
    case "TZ":
      return `TIME(${seconds}) WITH TIME ZONE`;
    case "PS":
      return `PERIOD(TIMESTAMP(${seconds}))`;
    case "PM":
      return `PERIOD(TIMESTAMP(${seconds}) WITH TIME ZONE)`;
    case "PT":
      return `PERIOD(TIME(${seconds}))`;
    case "PZ":
      return `PERIOD(TIME(${seconds}) WITH TIME ZONE)`;
  }
  return PLAIN[key] ?? INTERVALS[key] ?? key;
}
