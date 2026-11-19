import { EngineError } from "@surfaces-ui/engine";
import { type Data, type DataType, Field, RecordBatch, Schema, Struct, makeData } from "apache-arrow";
import type { TeradataResult } from "./client.js";
import { type ColumnType, columnType, inferType } from "./types.js";

const DAY_MS = 86_400_000;
const TIMESTAMP = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d)(?:\.(\d{1,9}))?)?)?\s*(Z|[+-]\d\d(?::?\d\d)?)?$/i;

class Unreadable extends Error {}

/** Microseconds since 1970 in UTC. Text with no zone is UTC, as the session is set to; a stated zone is honoured. */
function micros(value: unknown): bigint {
  if (value instanceof Date) return BigInt(value.getTime()) * 1000n;
  // A number is milliseconds since 1970, which is how some transports send times.
  if (typeof value === "bigint") return value * 1000n;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.round(value * 1000));
  const match = TIMESTAMP.exec(String(value).trim());
  if (!match) throw new Unreadable();
  const [, year, month, day, hour = "0", minute = "0", second = "0", fraction = "", zone] = match;
  let at = BigInt(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))) * 1000n;
  at += BigInt(fraction.padEnd(6, "0").slice(0, 6) || "0");
  if (zone && zone.toUpperCase() !== "Z") {
    const digits = zone.slice(1).replace(":", "").padEnd(4, "0");
    const offset = BigInt(Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4))) * 60_000_000n;
    at += zone.startsWith("-") ? offset : -offset;
  }
  return at;
}

/** Days since 1970. */
function days(value: unknown): number {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d\d)-(\d\d)/.exec(value.trim());
    if (!match) throw new Unreadable();
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS;
  }
  return Number(micros(value) / 1000n / BigInt(DAY_MS));
}

function integer(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "boolean") return value ? 1n : 0n;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\s*[+-]?\d+\s*$/.test(value)) return BigInt(value.trim());
  throw new Unreadable();
}

/** A decimal as a whole number of its smallest unit, without going through a float when the value is text. */
function scaled(value: unknown, scale: number): bigint {
  if (typeof value === "bigint") return value * 10n ** BigInt(scale);
  let text = typeof value === "number" ? value.toFixed(scale) : String(value).trim();
  if (/e/i.test(text)) text = Number(text).toFixed(scale);
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[2] === "" && !match[3])) throw new Unreadable();
  const digits = (match[2] || "0") + (match[3] ?? "").padEnd(scale, "0").slice(0, scale);
  return match[1] === "-" ? -BigInt(digits) : BigInt(digits);
}

function bytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  const text = String(value);
  // Transports that speak JSON send binary as hexadecimal.
  if (text.length % 2 === 0 && /^[0-9a-f]*$/i.test(text)) return Uint8Array.from(text.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
  return new TextEncoder().encode(text);
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value, (_key, inner: unknown) => (typeof inner === "bigint" ? inner.toString() : inner));
  return String(value);
}

function variable(type: DataType, values: (Uint8Array | null)[], nullCount: number, nullBitmap: Uint8Array): Data {
  const offsets = new Int32Array(values.length + 1);
  values.forEach((value, i) => (offsets[i + 1] = offsets[i]! + (value?.length ?? 0)));
  const data = new Uint8Array(offsets[values.length]!);
  values.forEach((value, i) => value && data.set(value, offsets[i]!));
  return makeData({ type, length: values.length, nullCount, nullBitmap, valueOffsets: offsets, data } as never) as Data;
}

/** One Arrow column from a column of driver values. */
function column(type: ColumnType, values: unknown[]): Data {
  const length = values.length;
  const nullBitmap = new Uint8Array(Math.ceil(length / 8));
  let nullCount = 0;
  const present = values.map((value, i) => {
    if (value === null || value === undefined) {
      nullCount += 1;
      return false;
    }
    nullBitmap[i >> 3]! |= 1 << (i & 7);
    return true;
  });
  const fill = <T extends { [index: number]: unknown }>(target: T, read: (value: unknown) => T[number]): T => {
    values.forEach((value, i) => {
      if (present[i]) target[i] = read(value);
    });
    return target;
  };
  const fixed = (data: unknown) => makeData({ type: type.arrow, length, nullCount, nullBitmap, data } as never) as Data;
  switch (type.family) {
    case "int8":
      return fixed(fill(new Int8Array(length), (v) => Number(integer(v))));
    case "int16":
      return fixed(fill(new Int16Array(length), (v) => Number(integer(v))));
    case "int32":
      return fixed(fill(new Int32Array(length), (v) => Number(integer(v))));
    case "int64":
      return fixed(fill(new BigInt64Array(length), integer));
    case "float":
      return fixed(
        fill(new Float64Array(length), (v) => {
          const n = Number(v);
          if (Number.isNaN(n) && String(v).trim().toLowerCase() !== "nan") throw new Unreadable();
          return n;
        }),
      );
    case "date":
      return fixed(fill(new Int32Array(length), days));
    case "timestamp":
    case "timestamptz":
      return fixed(fill(new BigInt64Array(length), micros));
    case "decimal": {
      // 128 bits, two's complement, least significant word first.
      const words = new Uint32Array(length * 4);
      values.forEach((value, i) => {
        if (!present[i]) return;
        const whole = BigInt.asUintN(128, scaled(value, type.scale));
        for (let w = 0; w < 4; w++) words[i * 4 + w] = Number((whole >> BigInt(32 * w)) & 0xffffffffn);
      });
      return fixed(words);
    }
    case "binary":
      return variable(type.arrow, values.map((v, i) => (present[i] ? bytes(v) : null)), nullCount, nullBitmap);
    case "text": {
      const encoder = new TextEncoder();
      return variable(type.arrow, values.map((v, i) => (present[i] ? encoder.encode(text(v)) : null)), nullCount, nullBitmap);
    }
  }
}

export interface ArrowResult {
  schema: Schema;
  types: ColumnType[];
  batch(rows: unknown[][]): RecordBatch;
}

/**
 * Describes a result as Arrow and builds batches of it. Types come from the
 * names the transport reports; values are converted to them, never the type
 * guessed from a value unless the transport gave no name at all.
 */
export function arrowResult(result: TeradataResult): ArrowResult {
  const types = result.columns.map((c, i) => columnType(c.type.trim() || inferType(result.rows.map((row) => row[i]))));
  const schema = new Schema(result.columns.map((c, i) => new Field(c.name, types[i]!.arrow, true)));
  return {
    schema,
    types,
    batch(rows) {
      const children = types.map((type, i) => {
        try {
          return column(type, rows.map((row) => row[i]));
        } catch (error) {
          if (!(error instanceof Unreadable)) throw error;
          // The value itself is left out: it is data, and this text may be logged.
          throw new EngineError("ENGINE", `A value in the column "${result.columns[i]!.name}" could not be read as ${String(type.arrow)}.`);
        }
      });
      return new RecordBatch(schema, makeData({ type: new Struct(schema.fields), length: rows.length, nullCount: 0, children }));
    },
  };
}
