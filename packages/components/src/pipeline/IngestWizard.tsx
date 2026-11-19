import type { Pipelines } from "@surfaces-ui/data";
import { TableFormat } from "@surfaces-ui/proto";
import { useState } from "react";
import { messageOf } from "../data/useRowWindow.js";
import { CodeBlock } from "../text/Markdown.js";
import { usePipelines } from "./PipelineView.js";
import { numberFormat } from "../locale/locale.js";

export interface IngestColumn {
  /** The column as it is in the files. */
  source: string;
  sourceType: string;
  /** Whether to load it. */
  include: boolean;
  /** Its name in the table. */
  target: string;
  /** Its type in the table. Empty keeps the type found in the files. */
  targetType: string;
}

export interface IngestDraft {
  format: "parquet" | "delta" | "iceberg" | "csv" | "json";
  /** A file, glob or table root the source may read. */
  location: string;
  /** Name for the files as a table of the source. */
  rawTable: string;
  /** Name for the cleaned table a pipeline builds. Empty leaves the pipeline step out. */
  targetTable: string;
  columns: IngestColumn[];
}

export const emptyIngestDraft: IngestDraft = { format: "parquet", location: "", rawTable: "", targetTable: "", columns: [] };

const FORMAT: Record<IngestDraft["format"], TableFormat> = {
  parquet: TableFormat.PARQUET,
  delta: TableFormat.DELTA,
  iceberg: TableFormat.ICEBERG,
  csv: TableFormat.CSV,
  json: TableFormat.JSON,
};
const TYPES = ["", "VARCHAR", "BIGINT", "INTEGER", "DOUBLE", "DECIMAL(18,2)", "BOOLEAN", "DATE", "TIMESTAMP"];
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const quote = (name: string) => (NAME.test(name) ? name : `"${name.replace(/"/g, '""')}"`);

export interface IngestPlan {
  /** A `tables` entry for the source in surfaces.config.ts. */
  table: string;
  /** A pipeline dataset that selects, renames and retypes the columns. Empty when no target table is named. */
  dataset: string;
  problems: string[];
}

/**
 * Turns a mapping into what a server needs: a table entry for the files and
 * a pipeline dataset that shapes them. It writes configuration for a person
 * to review and add; it loads nothing.
 */
export function ingestPlan(draft: IngestDraft): IngestPlan {
  const problems: string[] = [];
  const included = draft.columns.filter((c) => c.include);
  if (!draft.location.trim()) problems.push("Say where the files are.");
  if (!NAME.test(draft.rawTable)) problems.push("Name the table using letters, digits and underscores.");
  if (draft.targetTable && !NAME.test(draft.targetTable)) problems.push("The cleaned table's name uses letters, digits and underscores.");
  if (draft.targetTable && draft.targetTable.toLowerCase() === draft.rawTable.toLowerCase()) problems.push("The cleaned table needs a different name from the raw one.");
  if (draft.columns.length > 0 && included.length === 0) problems.push("Keep at least one column.");
  const targets = included.map((c) => c.target.trim().toLowerCase());
  if (included.some((c) => !NAME.test(c.target.trim()))) problems.push("Column names use letters, digits and underscores.");
  else if (new Set(targets).size !== targets.length) problems.push("Two columns have the same name.");

  const table = `{ name: ${JSON.stringify(draft.rawTable)}, format: ${JSON.stringify(draft.format)}, path: ${JSON.stringify(draft.location.trim())} },`;
  const select = included
    .map((c) => {
      const value = c.targetType ? `CAST(${quote(c.source)} AS ${c.targetType})` : quote(c.source);
      return c.target.trim() === c.source && !c.targetType ? `  ${value}` : `  ${value} AS ${quote(c.target.trim())}`;
    })
    .join(",\n");
  const dataset = draft.targetTable
    ? `{\n  name: ${JSON.stringify(draft.targetTable)},\n  layer: "silver",\n  sql: ${JSON.stringify(`SELECT\n${select}\nFROM ${quote(draft.rawTable)}`)},\n},`
    : "";
  return { table, dataset, problems };
}

export interface IngestWizardProps {
  /** The source whose engine will read the files. */
  sourceId: string;
  value: IngestDraft;
  onChange(draft: IngestDraft): void;
  pipelines?: Pipelines;
  className?: string;
}

/**
 * Brings new files in, in three steps: say where they are, look at what the
 * engine finds there, and choose which columns to keep, what to call them
 * and what type they should be. The result is configuration to review, not
 * a load: adding it to the server is a person's decision.
 */
export function IngestWizard({ sourceId, value, onChange, className, ...props }: IngestWizardProps) {
  const pipelines = usePipelines(props.pipelines);
  const [state, setState] = useState<{ loading: boolean; error?: string; rows?: number }>({ loading: false });
  const plan = ingestPlan(value);
  const set = (change: Partial<IngestDraft>) => onChange({ ...value, ...change });
  const setColumn = (index: number, change: Partial<IngestColumn>) => set({ columns: value.columns.map((c, i) => (i === index ? { ...c, ...change } : c)) });

  const inspect = async () => {
    setState({ loading: true });
    try {
      const found = await pipelines.inspectFiles({ sourceId, format: FORMAT[value.format], location: value.location });
      set({ columns: found.columns.map((c) => ({ source: c.name, sourceType: c.nativeType, include: true, target: c.name.toLowerCase().replace(/\W+/g, "_"), targetType: "" })) });
      setState({ loading: false, rows: found.rowCount === undefined ? undefined : Number(found.rowCount) });
    } catch (error) {
      setState({ loading: false, error: messageOf(error) });
    }
  };

  return (
    <div className={["sf-connect sf-ingest", className].filter(Boolean).join(" ")}>
      <fieldset className="sf-connect-group">
        <legend>1. Where the files are</legend>
        <label>
          <span>Format</span>
          <select className="sf-input" value={value.format} onChange={(e) => set({ format: e.target.value as IngestDraft["format"], columns: [] })}>
            <option value="parquet">Parquet</option>
            <option value="delta">Delta Lake</option>
            <option value="iceberg">Iceberg</option>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </label>
        <label className="sf-connect-path">
          <span>Location</span>
          <input className="sf-input" value={value.location} placeholder="s3://acme-lake/landing/orders/*.parquet" onChange={(e) => set({ location: e.target.value, columns: [] })} />
        </label>
        <button type="button" className="sf-button" data-variant="primary" disabled={state.loading || !value.location.trim()} onClick={() => void inspect()}>
          {state.loading ? "Looking…" : "Look at the files"}
        </button>
        <p className="sf-connect-note">The server reads only the schema. The location must be one this source is allowed to reach.</p>
        {state.error && (
          <p className="sf-search-error" role="alert">
            {state.error}
          </p>
        )}
      </fieldset>

      {value.columns.length > 0 && (
        <>
          <fieldset className="sf-connect-group sf-connect-tables">
            <legend>2. Columns to keep</legend>
            <p className="sf-connect-note" role="status">
              Found {value.columns.length} columns{state.rows === undefined ? "" : ` and ${numberFormat().format(state.rows)} rows`}.
            </p>
            <div className="sf-object-table" tabIndex={0} role="region" aria-label="Columns found">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Keep</th>
                    <th scope="col">In the files</th>
                    <th scope="col">Type found</th>
                    <th scope="col">Name in the table</th>
                    <th scope="col">Type in the table</th>
                  </tr>
                </thead>
                <tbody>
                  {value.columns.map((column, index) => (
                    <tr key={column.source}>
                      <td>
                        <input type="checkbox" checked={column.include} aria-label={`Keep ${column.source}`} onChange={(e) => setColumn(index, { include: e.target.checked })} />
                      </td>
                      <th scope="row">{column.source}</th>
                      <td className="sf-object-type">{column.sourceType.toLowerCase()}</td>
                      <td>
                        <input className="sf-input" value={column.target} disabled={!column.include} aria-label={`Name for ${column.source}`} onChange={(e) => setColumn(index, { target: e.target.value })} />
                      </td>
                      <td>
                        <select className="sf-input" value={column.targetType} disabled={!column.include} aria-label={`Type for ${column.source}`} onChange={(e) => setColumn(index, { targetType: e.target.value })}>
                          {TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type ? type.toLowerCase() : "as found"}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>

          <fieldset className="sf-connect-group">
            <legend>3. What to call it</legend>
            <label>
              <span>Table for the files as they are</span>
              <input className="sf-input" value={value.rawTable} placeholder="orders_landing" onChange={(e) => set({ rawTable: e.target.value })} />
            </label>
            <label>
              <span>Cleaned table (optional)</span>
              <input className="sf-input" value={value.targetTable} placeholder="orders_clean" onChange={(e) => set({ targetTable: e.target.value })} />
            </label>
          </fieldset>

          <section className="sf-connect-plan" aria-label="What to add" aria-live="polite">
            {plan.problems.length > 0 ? (
              <ul className="sf-connect-problems">
                {plan.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : (
              <>
                <p className="sf-object-label">Add this to the source&apos;s tables in surfaces.config.ts</p>
                <CodeBlock code={plan.table} language="ts" />
                {plan.dataset && (
                  <>
                    <p className="sf-object-label">Add this dataset to a pipeline to build the cleaned table</p>
                    <CodeBlock code={plan.dataset} language="ts" />
                  </>
                )}
                <p className="sf-connect-note">Nothing has been loaded. Restart the server after adding these, then run the pipeline.</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
