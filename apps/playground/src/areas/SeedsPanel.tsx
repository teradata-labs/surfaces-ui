import { CodeBlock, DataGrid } from "@surfaces-ui/components";
import { DEFAULT_PARAMS, type Seed, type SeedParams, seedById, seeds } from "@surfaces-ui/seeds";
import { useEffect, useId, useMemo, useState } from "react";
import { CodeInput } from "../CodeInput.js";
import type { ActiveSource } from "../source.js";

/**
 * The browser's working copy of the seeds: what Regenerate, Reset and Edit
 * SQL act on. Only DuckDB in the page has one; nothing here reaches the
 * repo or a server.
 */
export interface SeedWorkingCopy {
  /** Replaces a seed source's tables with what these generator statements make. */
  run(seedId: string, statements: string[]): Promise<void>;
  /** Loads the seed's own Parquet files again. */
  reset(seedId: string): Promise<void>;
  /** Adds files a person picked (Parquet, CSV or JSON) as tables of a source, in this page only. Returns the table names. */
  addFiles(sourceId: string, files: File[]): Promise<string[]>;
}

/** Bring your own Parquet, CSV or JSON files into the picked dataset, next to its tables, in this page only. */
function AddFiles({ source, workingCopy }: { source: ActiveSource; workingCopy?: SeedWorkingCopy }) {
  const id = useId();
  const [status, setStatus] = useState<{ text: string; error?: boolean; busy?: boolean }>({ text: "" });
  const [added, setAdded] = useState<string[]>([]);
  const label = source.sources.find((s) => s.id === source.sourceId)?.label ?? source.sourceId;
  useEffect(() => setAdded([]), [source.sourceId]);
  if (source.kind !== "browser" || !workingCopy)
    return (
      <p className="hint">
        {source.kind === "server"
          ? "The dev server reads the tables listed in surfaces.config.ts. To add data there, add a table entry (a Parquet, CSV, Delta or Iceberg path) to a source, or run scripts/make-seeds.mjs --scale 5 for larger seeds."
          : "DuckDB could not start in this browser, so files cannot be added here."}
      </p>
    );
  const onPick = async (files: File[]) => {
    if (files.length === 0) return;
    setStatus({ text: `Adding ${files.length === 1 ? files[0]!.name : `${files.length} files`}…`, busy: true });
    try {
      const names = await workingCopy.addFiles(source.sourceId, files);
      setAdded((a) => [...new Set([...a, ...names])]);
      setStatus({ text: `Added ${names.join(", ")} to ${label}. Every area can query ${names.length === 1 ? "it" : "them"} now.` });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true });
    }
  };
  return (
    <>
      <label htmlFor={`${id}-files`} className="seeds-upload">
        <span>Files to add to {label}</span>
        <input
          id={`${id}-files`}
          type="file"
          multiple
          accept=".parquet,.csv,.tsv,.json,.jsonl,.ndjson"
          disabled={status.busy}
          aria-describedby={`${id}-help`}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            void onPick(files);
          }}
        />
        <span className="hint" id={`${id}-help`}>
          Parquet, CSV or JSON. Each file becomes a table named after it, read by DuckDB in this page; nothing is uploaded anywhere. A file with the name of an existing table replaces it. Regenerate or Reset removes added tables.
        </span>
      </label>
      <p className="hint" role="status" aria-live="polite">
        {status.error ? "" : status.text}
      </p>
      {status.error && (
        <p className="catalog-error" role="alert">
          {status.text}
        </p>
      )}
      {added.map((name) => (
        <DataGrid key={name} sourceId={source.sourceId} sql={`SELECT * FROM "${name}"`} height={220} label={`Rows of ${name}`} />
      ))}
    </>
  );
}

/** Splits edited SQL back into statements: a semicolon at the end of a line ends one. */
export function splitStatements(text: string): string[] {
  return text
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(--[^\n]*\n?\s*)+$/.test(`${s}\n`));
}

const joinStatements = (statements: string[]) => `${statements.join(";\n\n")};\n`;

function ParamsForm({ value, onChange, disabled }: { value: SeedParams; onChange(next: SeedParams): void; disabled: boolean }) {
  const id = useId();
  const number = (key: "scale" | "seed" | "days", raw: string) => {
    const n = Number(raw);
    if (Number.isFinite(n)) onChange({ ...value, [key]: n });
  };
  return (
    <fieldset className="seeds-params" disabled={disabled}>
      <legend>Generator parameters</legend>
      <label htmlFor={`${id}-scale`}>
        <span>Scale</span>
        <input id={`${id}-scale`} type="number" min={0.1} max={20} step={0.1} value={value.scale} aria-describedby={`${id}-scale-help`} onChange={(e) => number("scale", e.target.value)} />
        <span className="hint" id={`${id}-scale-help`}>
          Multiplies the row counts; 1 is the shipped size.
        </span>
      </label>
      <label htmlFor={`${id}-seed`}>
        <span>Random seed</span>
        <input id={`${id}-seed`} type="number" min={0} step={1} value={value.seed} aria-describedby={`${id}-seed-help`} onChange={(e) => number("seed", e.target.value)} />
        <span className="hint" id={`${id}-seed-help`}>
          The same seed always gives the same data.
        </span>
      </label>
      <label htmlFor={`${id}-start`}>
        <span>Start date</span>
        <input id={`${id}-start`} type="date" value={value.start} onChange={(e) => e.target.value && onChange({ ...value, start: e.target.value })} />
      </label>
      <label htmlFor={`${id}-days`}>
        <span>Days covered</span>
        <input id={`${id}-days`} type="number" min={7} max={3660} step={1} value={value.days} onChange={(e) => number("days", e.target.value)} />
      </label>
    </fieldset>
  );
}

function SeedDetail({ seed, source, workingCopy }: { seed: Seed; source: ActiveSource; workingCopy?: SeedWorkingCopy }) {
  const [params, setParams] = useState<SeedParams>(DEFAULT_PARAMS);
  const generated = useMemo(() => {
    try {
      return { text: joinStatements(seed.sql(params)) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [seed, params]);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<string | undefined>();
  const [status, setStatus] = useState<{ text: string; error?: boolean; busy?: boolean }>({ text: "" });
  const canWrite = source.kind === "browser" && !!workingCopy;
  const sqlText = edited ?? generated.text ?? "";

  const act = async (label: string, run: () => Promise<void>, done: string) => {
    setStatus({ text: `${label}…`, busy: true });
    try {
      await run();
      setStatus({ text: done });
    } catch (error) {
      setStatus({ text: `${label} failed: ${error instanceof Error ? error.message : String(error)}`, error: true });
    }
  };

  return (
    <div className="seeds-detail">
      <p>{seed.description}</p>

      <h3 className="catalog-sub">Tables</h3>
      <table className="catalog-props">
        <thead>
          <tr>
            <th scope="col">Table</th>
            <th scope="col">One row per</th>
            <th scope="col">Key</th>
            <th scope="col">Columns</th>
          </tr>
        </thead>
        <tbody>
          {seed.tables.map((t) => (
            <tr key={t.name}>
              <td>
                <code>{t.name}</code>
                <div className="hint">{t.description}</div>
              </td>
              <td>{t.grain}</td>
              <td>
                <code>{t.primaryKey.join(", ")}</code>
              </td>
              <td>{t.columns.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="catalog-sub">Planted data problems</h3>
      {seed.issues.length === 0 ? (
        <p className="hint">None.</p>
      ) : (
        <ul className="seeds-issues">
          {seed.issues.map((issue, i) => (
            <li key={i}>
              <span className="badge">{issue.kind.replace("_", " ")}</span>{" "}
              <code>
                {issue.table}
                {issue.column ? `.${issue.column}` : ""}
              </code>
              : {issue.description}
              <details>
                <summary>Query that finds it</summary>
                <CodeBlock code={issue.sql} language="sql" label={`Query finding ${issue.kind} in ${issue.table}`} />
              </details>
            </li>
          ))}
        </ul>
      )}

      <ParamsForm value={params} onChange={setParams} disabled={!canWrite} />
      {generated.error && (
        <p className="catalog-error" role="alert">
          {generated.error}
        </p>
      )}
      <div className="actions seeds-actions">
        <button
          type="button"
          className="btn primary"
          disabled={!canWrite || status.busy || !!generated.error}
          onClick={() =>
            void act(
              "Regenerating",
              async () => {
                await workingCopy!.run(seed.id, seed.sql(params));
                setEdited(undefined);
              },
              `Regenerated ${seed.title} in this page with scale ${params.scale}, seed ${params.seed}, from ${params.start} for ${params.days} days.`,
            )
          }
        >
          Regenerate
        </button>
        <button
          type="button"
          className="btn"
          disabled={!canWrite || status.busy}
          onClick={() =>
            void act(
              "Resetting",
              async () => {
                await workingCopy!.reset(seed.id);
                setParams(DEFAULT_PARAMS);
                setEdited(undefined);
              },
              `${seed.title} is back to the shipped seed files.`,
            )
          }
        >
          Reset to seed
        </button>
        <button type="button" className="btn" aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
          {canWrite ? (editing ? "Close SQL" : "Edit SQL") : editing ? "Hide SQL" : "Show SQL"}
        </button>
      </div>
      {!canWrite && (
        <p className="hint">
          {source.kind === "server"
            ? "The dev server serves the seed Parquet files from the repo. To change them, run scripts/make-seeds.mjs with other parameters, or point surfaces.config.ts at your own files; this page does not write to the server."
            : source.kind === "browser"
              ? "This page's DuckDB has no working copy hook for seeds, so regeneration is off."
              : "DuckDB could not start in this browser, so the seeds cannot be regenerated here."}
        </p>
      )}
      <p className="hint" role="status" aria-live="polite">
        {status.error ? "" : status.text}
      </p>
      {status.error && (
        <p className="catalog-error" role="alert">
          {status.text}
        </p>
      )}

      {editing && (
        <div className="seeds-sql">
          <div className="card-head">
            <h3 className="catalog-sub">Generator SQL</h3>
            <span className="hint">{canWrite ? "Applied to this page's working copy only, never to the repo." : "Read only here."}</span>
          </div>
          {canWrite ? (
            <>
              <CodeInput language="sql" label={`${seed.title} generator SQL`} value={sqlText} onChange={setEdited} />
              <div className="actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={status.busy || splitStatements(sqlText).length === 0}
                  onClick={() => void act("Running the edited SQL", () => workingCopy!.run(seed.id, splitStatements(sqlText)), `Ran ${splitStatements(sqlText).length} statements into ${seed.title} in this page.`)}
                >
                  Run into the working copy
                </button>
                <button type="button" className="btn" disabled={edited === undefined} onClick={() => setEdited(undefined)}>
                  Discard edits
                </button>
              </div>
            </>
          ) : (
            <CodeBlock code={sqlText} language="sql" label={`${seed.title} generator SQL`} />
          )}
        </div>
      )}
    </div>
  );
}

/** Submissions kept by the dev server's forms backend, read through its read-only `forms` source. */
function FormSubmissions({ source }: { source: ActiveSource }) {
  const [tables, setTables] = useState<string[] | undefined>();
  const [table, setTable] = useState("");
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { sources } = await source.dataSource.listSources({});
        if (!sources.some((s) => s.id === "forms")) return live && setTables([]);
        const listed = await source.dataSource.listTables({ sourceId: "forms" });
        const names = listed.tables.map((t) => t.ref?.table ?? "").filter(Boolean);
        if (live) {
          setTables(names);
          setTable((t) => t || names[0] || "");
        }
      } catch {
        if (live) setTables([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [source.dataSource]);

  if (tables === undefined) return <p className="hint">Looking for form submissions…</p>;
  if (tables.length === 0)
    return (
      <p className="hint">
        {source.kind === "server"
          ? "The dev server lists no forms source yet. Submit a form (Patterns, or a seed's form) and its submissions appear here, read only."
          : "Form submissions are kept by the dev server and read through its read-only forms source. Start the server with pnpm serve to see them here."}
      </p>
    );
  return (
    <>
      <label className="inline">
        <span>Form</span>
        <select value={table} onChange={(e) => setTable(e.target.value)}>
          {tables.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {table && <DataGrid key={table} sourceId="forms" sql={`SELECT * FROM "${table.replace(/"/g, '""')}"`} height={280} label={`Submissions to ${table}`} />}
    </>
  );
}

const ENGINE_EXAMPLES = [
  {
    id: "duckdb",
    label: "DuckDB",
    code: `// surfaces.config.ts
{
  id: "lake",
  engine: "duckdb",
  connections: [{ name: "sales", kind: "s3", scope: "s3://acme-lake/sales", secret: "LAKE", region: "eu-west-1" }],
  tables: [{ name: "orders", format: "delta", path: "s3://acme-lake/sales/orders" }],
}
// The server reads LAKE_KEY_ID and LAKE_SECRET from its environment.`,
  },
  {
    id: "datafusion",
    label: "DataFusion",
    code: `// surfaces.config.ts: a DataFusion server (ROAPI) over HTTP, read only
{
  id: "fusion",
  engine: "datafusion",
  baseUrl: "http://localhost:8080",
}`,
  },
  {
    id: "teradata",
    label: "Teradata",
    code: `// surfaces.config.ts: Teradata through Query Service, read only
{
  id: "vantage",
  engine: "teradata",
  baseUrl: "https://vantage.example.com:1443",
  system: "prod",
  user: "surfaces_reader",   // a user with SELECT rights only
  secret: "TD",              // a name, never the password
  database: "sales",
}
// The server reads TD_PASSWORD (or TD_TOKEN for a JWT) from its environment.
// Nothing here has run against a Teradata system.`,
  },
];

/**
 * The six seed models with their tables, planted problems and generator
 * parameters; regenerating, resetting and editing the SQL in the browser's
 * working copy; form submissions on the dev server; and how each engine is
 * configured.
 */
export function SeedsPanel({ source, workingCopy }: { source: ActiveSource; workingCopy?: SeedWorkingCopy }) {
  // A source may carry its own working copy (DuckDB in the page); a prop overrides it.
  const copy = workingCopy ?? (source as ActiveSource & { seedCopy?: SeedWorkingCopy }).seedCopy;
  const [seedId, setSeedId] = useState(() => seedById(source.sourceId)?.id ?? seeds[0]!.id);
  useEffect(() => {
    if (seedById(source.sourceId)) setSeedId(source.sourceId);
  }, [source.sourceId]);
  const seed = seedById(seedId) ?? seeds[0]!;
  const [engine, setEngine] = useState("teradata");
  const tabsId = useId();

  return (
    <>
      <section className="card" aria-label="Seeds">
        <div className="card-head">
          <h2>Seeds</h2>
          <label className="inline">
            <span>Model</span>
            <select value={seed.id} onChange={(e) => setSeedId(e.target.value)}>
              {seeds.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="hint">Six synthetic industry models. Every value is invented; the problems in them are planted for cleaning and quality work to find.</p>
        <SeedDetail key={seed.id} seed={seed} source={source} workingCopy={copy} />
      </section>

      <section className="card" aria-label="Add your own data">
        <div className="card-head">
          <h2>Add your own data</h2>
        </div>
        <p className="hint">More rows: raise Scale above and Regenerate. More tables: add files here. They join the picked dataset, so they show up in the workbench, the object browser, search and the model diagram.</p>
        <AddFiles source={source} workingCopy={copy} />
      </section>

      <section className="card" aria-label="Form submissions">
        <div className="card-head">
          <h2>Form submissions</h2>
        </div>
        <FormSubmissions source={source} />
      </section>

      <section className="card" aria-label="Engine configuration">
        <div className="card-head">
          <h2>Engine configuration</h2>
          <div className="tabs" role="tablist" aria-label="Engine">
            {ENGINE_EXAMPLES.map((e) => (
              <button
                key={e.id}
                id={`${tabsId}-${e.id}`}
                type="button"
                role="tab"
                className="composer-tab"
                aria-selected={engine === e.id}
                aria-controls={`${tabsId}-panel`}
                tabIndex={engine === e.id ? 0 : -1}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                  event.preventDefault();
                  const i = ENGINE_EXAMPLES.findIndex((x) => x.id === engine);
                  const next = ENGINE_EXAMPLES[(i + (event.key === "ArrowRight" ? 1 : -1) + ENGINE_EXAMPLES.length) % ENGINE_EXAMPLES.length]!;
                  setEngine(next.id);
                  document.getElementById(`${tabsId}-${next.id}`)?.focus();
                }}
                onClick={() => setEngine(e.id)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${engine}`}>
          <CodeBlock code={ENGINE_EXAMPLES.find((e) => e.id === engine)!.code} language="ts" label={`${engine} source configuration`} />
        </div>
        <p className="hint">Credentials are referenced by secret name and read on the server. No credential is ever typed into this page.</p>
      </section>
    </>
  );
}
