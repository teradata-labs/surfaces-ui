import { type RecordBatch, RecordBatchStreamWriter, type Schema, Table, tableFromIPC } from "apache-arrow";

/**
 * Arrow IPC framing used by `ExecuteResponse`.
 *
 * `ResultHeader.arrow_schema` holds the schema message and each
 * `ResultBatch.arrow_batch` holds the message(s) for one record batch.
 * Concatenating them in order and appending the end-of-stream marker yields a
 * standard Arrow IPC stream.
 */
const END_OF_STREAM = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0]);

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

/** Length of the leading schema message in an IPC stream. */
function schemaLength(stream: Uint8Array): number {
  const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
  if (stream.byteLength < 8 || view.getUint32(0, true) !== 0xffffffff) {
    throw new Error("not an Arrow IPC stream");
  }
  return 8 + view.getInt32(4, true);
}

/** Splits a complete IPC stream into the schema message and everything after it (without the end marker). */
export function splitStream(stream: Uint8Array): { schema: Uint8Array; body: Uint8Array } {
  const at = schemaLength(stream);
  return { schema: stream.slice(0, at), body: stream.slice(at, stream.byteLength - END_OF_STREAM.byteLength) };
}

/** Encodes one record batch as `{ schema, batch }` message bytes. */
export function encodeBatch(batch: RecordBatch): { schema: Uint8Array; batch: Uint8Array } {
  const { schema, body } = splitStream(RecordBatchStreamWriter.writeAll([batch]).toUint8Array(true));
  return { schema, batch: body };
}

/** Encodes only a schema, for results with no rows. */
export function encodeSchema(schema: Schema): Uint8Array {
  const writer = new RecordBatchStreamWriter();
  writer.reset(undefined, schema);
  writer.finish();
  return splitStream(writer.toUint8Array(true)).schema;
}

/** Rebuilds a table from a schema message and batch messages. */
export function decodeStream(schema: Uint8Array, batches: Uint8Array[]): Table {
  return tableFromIPC(concat([schema, ...batches, END_OF_STREAM]));
}

/** Splits a table into batches of at most `rows` rows, encoded for the wire. */
export function encodeTable(table: Table, rows = 0): { schema: Uint8Array; batches: { bytes: Uint8Array; rows: number }[] } {
  const out: { bytes: Uint8Array; rows: number }[] = [];
  for (const batch of table.batches) {
    const step = rows > 0 ? rows : Math.max(batch.numRows, 1);
    for (let start = 0; start < batch.numRows; start += step) {
      const slice = batch.slice(start, Math.min(start + step, batch.numRows));
      out.push({ bytes: encodeBatch(slice).batch, rows: slice.numRows });
    }
  }
  return { schema: encodeSchema(table.schema), batches: out };
}
