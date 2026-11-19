import { CertificationStatus, ContextFormat, type ContextPack, type ObjectProfile, type ObjectRef, TableFormat } from "@surfaces-ui/proto";

/** One pack item resolved against the catalog, ready to render. */
export interface ResolvedItem {
  ref: ObjectRef;
  profile: ObjectProfile;
  /** Columns to include; empty means all. */
  columns: string[];
  note: string;
  /** Sample rows as strings, present only when requested and permitted. */
  sampleRows?: { columns: string[]; rows: string[][] };
  /** True when sample rows were requested but the source does not permit them. */
  sampleRowsWithheld: boolean;
}

export interface RenderedContext {
  text: string;
  tokenEstimate: number;
  containsSampleValues: boolean;
}

const FORMAT_NAME: Partial<Record<TableFormat, string>> = {
  [TableFormat.PARQUET]: "Parquet",
  [TableFormat.CSV]: "CSV",
  [TableFormat.JSON]: "JSON",
  [TableFormat.ICEBERG]: "Iceberg",
  [TableFormat.DELTA]: "Delta",
};
const count = new Intl.NumberFormat("en-US");

/** A rough token count (about four characters per token), for budgeting only. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

function selected(item: ResolvedItem) {
  const wanted = new Set(item.columns.map((c) => c.toLowerCase()));
  return wanted.size === 0 ? item.profile.columns : item.profile.columns.filter((c) => wanted.has(c.name.toLowerCase()));
}

/**
 * Renders a context pack into the text an agent receives. Pure: the same
 * function produces the live preview in the browser and the saved output on
 * a server, so what a person reviews is exactly what the agent gets.
 */
export function renderContext(pack: ContextPack, items: ResolvedItem[], format: ContextFormat): RenderedContext {
  const containsSampleValues = items.some((item) => item.sampleRows !== undefined);

  if (format === ContextFormat.JSON) {
    const text = JSON.stringify(
      {
        name: pack.name,
        description: pack.description || undefined,
        notes: pack.notes || undefined,
        definitions: Object.keys(pack.definitions).length > 0 ? pack.definitions : undefined,
        tables: items.map((item) => ({
          source: item.ref.sourceId,
          table: item.ref.table,
          format: FORMAT_NAME[item.profile.object?.format ?? TableFormat.UNSPECIFIED],
          rowCount: item.profile.rowCount === undefined ? undefined : Number(item.profile.rowCount),
          description: item.profile.object?.description || undefined,
          certification:
            item.profile.object?.certification?.status === CertificationStatus.CERTIFIED
              ? "certified"
              : item.profile.object?.certification?.status === CertificationStatus.DEPRECATED
                ? "deprecated"
                : undefined,
          note: item.note || undefined,
          columns: selected(item).map((c) => ({ name: c.name, type: c.nativeType, description: c.description || undefined })),
          sampleRows: item.sampleRows,
        })),
        joins: pack.joins.map((join) => ({
          left: join.left?.table,
          right: join.right?.table,
          on: join.keys.map((k) => ({ left: k.leftColumn, right: k.rightColumn })),
        })),
        rules: ["Read-only: only SELECT statements can run."],
      },
      null,
      2,
    );
    return { text, tokenEstimate: estimateTokens(text), containsSampleValues };
  }

  const out: string[] = [`# Data context: ${pack.name || "Untitled"}`];
  if (pack.description) out.push("", pack.description);
  if (pack.notes) out.push("", pack.notes);

  const definitions = Object.entries(pack.definitions);
  if (definitions.length > 0) {
    out.push("", "## Definitions");
    for (const [term, meaning] of definitions) out.push(`- **${term}**: ${meaning}`);
  }

  out.push("", "## Tables");
  if (items.length === 0) out.push("", "_No tables selected._");
  for (const item of items) {
    const object = item.profile.object;
    const facts = [
      `source: ${item.ref.sourceId}`,
      FORMAT_NAME[object?.format ?? TableFormat.UNSPECIFIED],
      item.profile.rowCount === undefined ? undefined : `${count.format(Number(item.profile.rowCount))} rows`,
    ].filter(Boolean);
    out.push("", `### ${item.ref.table}`, `_${facts.join(" · ")}_`);
    const mark = object?.certification;
    if (mark?.status === CertificationStatus.CERTIFIED) {
      out.push("", `Certified by ${mark.setBy}${mark.note ? `: ${mark.note}` : "."}`);
    } else if (mark?.status === CertificationStatus.DEPRECATED) {
      out.push("", `Deprecated by ${mark.setBy}; avoid using it${mark.note ? `. ${mark.note}` : "."}`);
    }
    if (object?.description) out.push("", object.description);
    if (item.note) out.push("", `Note: ${item.note}`);
    out.push("", "| Column | Type | Description |", "|---|---|---|");
    for (const column of selected(item)) {
      out.push(`| ${cell(column.name)} | ${cell(column.nativeType)} | ${cell(column.description)} |`);
    }
    if (item.sampleRows) {
      out.push("", "Sample rows:", "", `| ${item.sampleRows.columns.map(cell).join(" | ")} |`, `|${item.sampleRows.columns.map(() => "---").join("|")}|`);
      for (const row of item.sampleRows.rows) out.push(`| ${row.map(cell).join(" | ")} |`);
    } else if (item.sampleRowsWithheld) {
      out.push("", "_Sample rows withheld: this source does not allow data values to be shared._");
    }
  }

  if (pack.joins.length > 0) {
    out.push("", "## Joins");
    for (const join of pack.joins) {
      const on = join.keys.map((k) => `${join.left?.table}.${k.leftColumn} = ${join.right?.table}.${k.rightColumn}`).join(" AND ");
      out.push(`- ${join.left?.table} ⋈ ${join.right?.table} ON ${on}`);
    }
  }

  out.push("", "## Rules", "- Read-only: only SELECT statements can run.", "- Use only the tables and columns listed above.");
  const text = out.join("\n");
  return { text, tokenEstimate: estimateTokens(text), containsSampleValues };
}
