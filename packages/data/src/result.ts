import type { ExecuteResponse, ResultFooter, ResultHeader } from "@surfaces-ui/proto";
import type { Table } from "apache-arrow";
import { decodeStream } from "./ipc.js";

/** A complete query result, decoded. */
export interface QueryResult {
  header: ResultHeader;
  /** The rows, as an Arrow table. */
  table: Table;
  footer: ResultFooter;
}

/** Reads an `execute` stream to the end and decodes it. */
export async function collect(stream: AsyncIterable<ExecuteResponse>): Promise<QueryResult> {
  let header: ResultHeader | undefined;
  let footer: ResultFooter | undefined;
  const batches: Uint8Array[] = [];
  for await (const message of stream) {
    const part = message.part;
    if (part.case === "header") header = part.value;
    else if (part.case === "batch") batches.push(part.value.arrowBatch);
    else if (part.case === "footer") footer = part.value;
  }
  if (!header || !footer) throw new Error("the result stream ended early");
  return { header, table: decodeStream(header.arrowSchema, batches), footer };
}

/** Rows of a table as plain objects. Convenient for small results and tests; avoid for large ones. */
export function toRows(table: Table): Record<string, unknown>[] {
  return table.toArray().map((row) => (row as { toJSON(): Record<string, unknown> }).toJSON());
}
