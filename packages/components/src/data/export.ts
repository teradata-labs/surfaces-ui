import type { MessageInitShape } from "@bufbuild/protobuf";
import { type DataSource, decodeStream } from "@surfaces-ui/data";
import type { ExecuteRequestSchema } from "@surfaces-ui/proto";
import { DataType, type Field } from "apache-arrow";
import { formatCell } from "./format.js";

/**
 * One CSV field. Quotes are doubled, and text that a spreadsheet would run
 * as a formula (starting with =, +, - or @) is prefixed with a quote so that
 * opening an export cannot execute anything.
 */
export function csvField(text: string, isText: boolean): string {
  const safe = isText && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const textual = (type: DataType) => !(DataType.isInt(type) || DataType.isFloat(type) || DataType.isDecimal(type) || DataType.isBool(type) || DataType.isTimestamp(type) || DataType.isDate(type));

/** A header line for a result's columns. */
export function csvHeader(fields: Field[]): string {
  return `${fields.map((f) => csvField(f.name, true)).join(",")}\r\n`;
}

/** One line of CSV. Nulls are empty; numbers are written in full, not abbreviated. */
export function csvRow(fields: Field[], values: unknown[]): string {
  return `${fields
    .map((field, i) => {
      const value = values[i];
      if (value == null) return "";
      const raw = DataType.isFloat(field.type) ? String(value) : formatCell(value, field.type).text;
      return csvField(raw, textual(field.type));
    })
    .join(",")}\r\n`;
}

export interface ExportResult {
  blob: Blob;
  rows: number;
  /** True when the backend stopped at its row limit, so the file is not the whole result. */
  truncated: boolean;
}

export interface ExportOptions {
  signal?: AbortSignal;
  /** Called as rows arrive. */
  onProgress?(rows: number): void;
}

/**
 * Writes a whole query result to CSV. The rows are streamed from the backend
 * and turned into text a batch at a time, so the grid's window is not the
 * limit: the backend's own row limit is.
 */
export async function exportCsv(dataSource: DataSource, request: MessageInitShape<typeof ExecuteRequestSchema>, options: ExportOptions = {}): Promise<ExportResult> {
  const parts: string[] = [];
  let schema: Uint8Array | undefined;
  let fields: Field[] = [];
  let rows = 0;
  let truncated = false;
  for await (const message of dataSource.execute(request, { signal: options.signal })) {
    const part = message.part;
    if (part.case === "header") {
      schema = part.value.arrowSchema;
      fields = decodeStream(schema, []).schema.fields;
      parts.push(csvHeader(fields));
    } else if (part.case === "batch" && schema) {
      const table = decodeStream(schema, [part.value.arrowBatch]);
      const columns = fields.map((_, i) => table.getChildAt(i));
      let chunk = "";
      for (let r = 0; r < table.numRows; r++) chunk += csvRow(fields, columns.map((column) => column?.get(r)));
      parts.push(chunk);
      rows += table.numRows;
      options.onProgress?.(rows);
    } else if (part.case === "footer") truncated = part.value.truncated;
  }
  if (!schema) throw new Error("The result ended before it began.");
  // The byte order mark makes spreadsheets read the file as UTF-8.
  return { blob: new Blob(["﻿", ...parts], { type: "text/csv;charset=utf-8" }), rows, truncated };
}

/** Hands a file to the browser to save. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
