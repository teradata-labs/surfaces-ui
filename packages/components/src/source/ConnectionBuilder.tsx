import { useId, useState } from "react";
import { CodeBlock } from "../text/Markdown.js";

export type StorageKind = "local" | "s3" | "gcs" | "azure" | "http";
export type TableFormatName = "parquet" | "delta" | "iceberg" | "csv" | "json";
export type CredentialMode = "secret" | "ambient" | "public";

export interface ConnectionDraftTable {
  name: string;
  format: TableFormatName;
  /** A file, glob or table root. For Iceberg, the table root or a metadata.json file. */
  path: string;
}

/** A source being set up. It holds the name of a secret, never a credential. */
export interface ConnectionDraft {
  sourceId: string;
  storage: StorageKind;
  /** Bucket or prefix the connection covers, e.g. s3://acme-lake/sales. Not used for local files. */
  scope: string;
  credentials: CredentialMode;
  /** Name of the server-side secret, e.g. LAKE. */
  secret: string;
  region: string;
  /** For S3-compatible stores such as MinIO. */
  endpoint: string;
  tables: ConnectionDraftTable[];
  /** Optional Iceberg REST catalog to attach. */
  catalogUri: string;
  catalogWarehouse: string;
}

export const emptyConnectionDraft: ConnectionDraft = {
  sourceId: "lake",
  storage: "s3",
  scope: "",
  credentials: "secret",
  secret: "LAKE",
  region: "",
  endpoint: "",
  tables: [{ name: "", format: "parquet", path: "" }],
  catalogUri: "",
  catalogWarehouse: "",
};

const STORAGE: { id: StorageKind; label: string; prefix: string; example: string }[] = [
  { id: "s3", label: "Amazon S3 or compatible", prefix: "s3://", example: "s3://acme-lake/sales" },
  { id: "gcs", label: "Google Cloud Storage", prefix: "gs://", example: "gs://acme-lake/sales" },
  { id: "azure", label: "Azure Storage", prefix: "az://", example: "az://lake/sales" },
  { id: "http", label: "Web (https)", prefix: "https://", example: "https://data.example.com/lake" },
  { id: "local", label: "Files on the server", prefix: "", example: "data/orders.parquet" },
];
const FORMATS: { id: TableFormatName; label: string; hint: string }[] = [
  { id: "parquet", label: "Parquet", hint: "A file or a glob such as orders/*.parquet" },
  { id: "delta", label: "Delta Lake", hint: "The table's root folder (the one holding _delta_log)" },
  { id: "iceberg", label: "Iceberg", hint: "The table's root folder, or its metadata.json file" },
  { id: "csv", label: "CSV", hint: "A file or a glob" },
  { id: "json", label: "JSON", hint: "A file or a glob" },
];

const ENV_FIELDS: Record<Exclude<StorageKind, "local">, string[]> = {
  s3: ["KEY_ID", "SECRET"],
  gcs: ["KEY_ID", "SECRET"],
  azure: ["CONNECTION_STRING"],
  http: ["TOKEN"],
};

export interface ConnectionPlan {
  /** A `surfaces.config.ts` source entry. Contains secret names only. */
  config: string;
  /** Environment variables to set on the server before starting it. */
  env: string[];
  /** What must be fixed before the config will work. */
  problems: string[];
}

const quote = (value: string) => JSON.stringify(value);

/**
 * Turns a draft into the config a server reads and the environment
 * variables that carry its credentials. Pure, so it can be tested and reused
 * by an agent or a command-line tool.
 */
export function connectionPlan(draft: ConnectionDraft): ConnectionPlan {
  const problems: string[] = [];
  const remote = draft.storage !== "local";
  const storage = STORAGE.find((s) => s.id === draft.storage)!;
  const scope = draft.scope.trim().replace(/\/+$/, "");
  const secret = draft.secret.trim();
  if (!/^[A-Za-z_][\w-]*$/.test(draft.sourceId)) problems.push("Give the source a short name made of letters, digits, hyphens or underscores.");
  if (remote && !scope.startsWith(storage.prefix)) problems.push(`The location should start with ${storage.prefix}`);
  if (remote && draft.credentials === "secret" && !/^[A-Z][A-Z0-9_]*$/.test(secret)) problems.push("Name the secret in capitals, e.g. LAKE. Its values are set on the server, not here.");
  const tables = draft.tables.filter((t) => t.name.trim() || t.path.trim());
  if (tables.length === 0 && !draft.catalogUri.trim()) problems.push("Add at least one table or a catalog.");
  for (const table of tables) {
    if (!/^[A-Za-z_]\w*$/.test(table.name.trim())) problems.push(`Table names use letters, digits and underscores: ${table.name || "(empty)"}`);
    if (remote && scope && !table.path.trim().startsWith(scope)) problems.push(`${table.name || "A table"} is outside ${scope}, so the connection will not cover it.`);
    if (!table.path.trim()) problems.push(`${table.name || "A table"} needs a location.`);
  }
  if (new Set(tables.map((t) => t.name.trim().toLowerCase())).size !== tables.length) problems.push("Two tables have the same name.");

  const lines = ["{", `  id: ${quote(draft.sourceId)},`, `  engine: "duckdb",`];
  if (remote) {
    const connection = [`name: ${quote(draft.sourceId.replace(/-/g, "_"))}`, `kind: ${quote(draft.storage)}`, `scope: ${quote(scope)}`];
    if (draft.credentials === "secret") connection.push(`secret: ${quote(secret)}`);
    if (draft.credentials === "ambient") connection.push("ambientCredentials: true");
    if (draft.region.trim()) connection.push(`region: ${quote(draft.region.trim())}`);
    if (draft.endpoint.trim()) connection.push(`endpoint: ${quote(draft.endpoint.trim())}`, `urlStyle: "path"`);
    lines.push(`  connections: [{ ${connection.join(", ")} }],`);
  }
  lines.push("  tables: [");
  for (const table of tables) lines.push(`    { name: ${quote(table.name.trim())}, format: ${quote(table.format)}, path: ${quote(table.path.trim())} },`);
  lines.push("  ],");
  if (draft.catalogUri.trim()) {
    const catalog = [`name: "catalog"`, `kind: "iceberg-rest"`, `uri: ${quote(draft.catalogUri.trim())}`];
    if (draft.catalogWarehouse.trim()) catalog.push(`warehouse: ${quote(draft.catalogWarehouse.trim())}`);
    if (draft.credentials === "secret") catalog.push(`secret: ${quote(secret)}`);
    lines.push(`  catalogs: [{ ${catalog.join(", ")} }],`);
  }
  lines.push("}");

  const env =
    remote && draft.credentials === "secret"
      ? [...ENV_FIELDS[draft.storage as Exclude<StorageKind, "local">], ...(draft.catalogUri.trim() ? ["TOKEN"] : [])].filter((f, i, all) => all.indexOf(f) === i).map((field) => `${secret}_${field}`)
      : [];
  return { config: lines.join("\n"), env, problems };
}

export interface ConnectionBuilderProps {
  value: ConnectionDraft;
  onChange(draft: ConnectionDraft): void;
  className?: string;
}

/**
 * Sets up a connection to Parquet, Delta Lake or Iceberg data on an object
 * store, a web server or the server's own disk, and optionally an Iceberg
 * REST catalog. It writes the config for the server and lists the
 * environment variables that hold the credentials. There is nowhere to type
 * a credential: the browser only ever handles the secret's name.
 */
export function ConnectionBuilder({ value, onChange, className }: ConnectionBuilderProps) {
  const id = useId();
  const plan = connectionPlan(value);
  const storage = STORAGE.find((s) => s.id === value.storage)!;
  const remote = value.storage !== "local";
  const set = (change: Partial<ConnectionDraft>) => onChange({ ...value, ...change });
  const setTable = (index: number, change: Partial<ConnectionDraftTable>) => set({ tables: value.tables.map((t, i) => (i === index ? { ...t, ...change } : t)) });
  const field = (label: string, key: keyof ConnectionDraft, placeholder = "") => (
    <label>
      <span>{label}</span>
      <input className="sf-input" value={String(value[key])} placeholder={placeholder} onChange={(e) => set({ [key]: e.target.value } as Partial<ConnectionDraft>)} />
    </label>
  );

  return (
    <div className={["sf-connect", className].filter(Boolean).join(" ")}>
      <fieldset className="sf-connect-group">
        <legend>Where the data is</legend>
        {field("Source name", "sourceId", "lake")}
        <label>
          <span>Storage</span>
          <select className="sf-input" value={value.storage} onChange={(e) => set({ storage: e.target.value as StorageKind, scope: "" })}>
            {STORAGE.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {remote && field("Bucket or folder it covers", "scope", storage.example)}
        {(value.storage === "s3" || value.storage === "gcs") && field("Region", "region", "us-east-1")}
        {value.storage === "s3" && field("Endpoint (S3-compatible stores only)", "endpoint", "minio.internal:9000")}
      </fieldset>

      {remote && (
        <fieldset className="sf-connect-group">
          <legend>How the server signs in</legend>
          <label>
            <span>Credentials</span>
            <select className="sf-input" value={value.credentials} onChange={(e) => set({ credentials: e.target.value as CredentialMode })}>
              <option value="secret">A named secret on the server</option>
              {value.storage !== "http" && <option value="ambient">The server&apos;s own cloud role or profile</option>}
              <option value="public">None, the data is public</option>
            </select>
          </label>
          {value.credentials === "secret" && field("Secret name", "secret", "LAKE")}
          <p className="sf-connect-note">Credentials are never typed here. The server reads them from its environment by this name.</p>
        </fieldset>
      )}

      <fieldset className="sf-connect-group sf-connect-tables">
        <legend>Tables</legend>
        {value.tables.map((table, index) => (
          <div key={index} className="sf-connect-row" role="group" aria-label={`Table ${index + 1}`}>
            <label>
              <span>Name</span>
              <input className="sf-input" value={table.name} placeholder="orders" onChange={(e) => setTable(index, { name: e.target.value })} />
            </label>
            <label>
              <span>Format</span>
              <select className="sf-input" value={table.format} onChange={(e) => setTable(index, { format: e.target.value as TableFormatName })}>
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="sf-connect-path">
              <label>
                <span>Location</span>
              <input
                className="sf-input"
                value={table.path}
                placeholder={remote ? `${value.scope || storage.example}/orders` : storage.example}
                aria-describedby={`${id}-hint-${index}`}
                onChange={(e) => setTable(index, { path: e.target.value })}
              />
              </label>
              <span id={`${id}-hint-${index}`} className="sf-connect-note">
                {FORMATS.find((f) => f.id === table.format)!.hint}
              </span>
            </div>
            {value.tables.length > 1 && (
              <button type="button" className="sf-button" aria-label={`Remove table ${index + 1}`} onClick={() => set({ tables: value.tables.filter((_, i) => i !== index) })}>
                Remove
              </button>
            )}
          </div>
        ))}
        <button type="button" className="sf-button" onClick={() => set({ tables: [...value.tables, { name: "", format: "parquet", path: "" }] })}>
          Add table
        </button>
      </fieldset>

      {remote && (
        <fieldset className="sf-connect-group">
          <legend>Iceberg catalog (optional)</legend>
          {field("REST catalog address", "catalogUri", "https://catalog.example.com/api/catalog")}
          {field("Warehouse", "catalogWarehouse", "analytics")}
          <p className="sf-connect-note">Every table in the catalog is listed under its own schema, so they need not be added one by one.</p>
        </fieldset>
      )}

      <section className="sf-connect-plan" aria-label="What to do" aria-live="polite">
        {plan.problems.length > 0 ? (
          <ul className="sf-connect-problems">
            {plan.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        ) : (
          <>
            <p className="sf-object-label">1. Add this to sources in surfaces.config.ts</p>
            <CodeBlock code={plan.config} language="ts" />
            {plan.env.length > 0 && (
              <>
                <p className="sf-object-label">2. Set these on the server, then restart it</p>
                <CodeBlock code={plan.env.map((name) => `export ${name}=…`).join("\n")} language="sh" />
              </>
            )}
            <p className="sf-connect-note">Then use “Test connection” on the source to see that each table can be reached.</p>
          </>
        )}
      </section>
    </div>
  );
}
