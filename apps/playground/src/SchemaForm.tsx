import { type ReactNode, useId } from "react";

/** The parts of JSON Schema the catalog's generated schemas use. */
export interface JsonSchema {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  minItems?: number;
  maxItems?: number;
  description?: string;
}

/** How one value is edited. Anything the form cannot draw falls back to a small JSON box, so no prop is out of reach. */
export type FieldKind = "choice" | "text" | "longText" | "number" | "boolean" | "dynamic" | "binding" | "object" | "list" | "json";

const typeOf = (schema: JsonSchema) => (Array.isArray(schema.type) ? schema.type[0] : schema.type);
const isBinding = (schema: JsonSchema) => typeOf(schema) === "object" && !!schema.properties?.["@path"] && Object.keys(schema.properties).length === 1;
/** Props that hold code or prose read better in a box several lines tall. */
const LONG = /^(sql|text|code|markdown|description|detail|body|summary|query)$/i;
/** Code gets room; prose starts two lines tall and can be pulled taller. */
const rowsFor = (name: string) => (/^(sql|code|query)$/i.test(name) ? 4 : 2);

export function fieldKind(name: string, schema: JsonSchema): FieldKind {
  if (Array.isArray(schema.enum)) return "choice";
  if (schema.anyOf) {
    const literal = schema.anyOf.find((s) => ["string", "number", "integer", "boolean"].includes(typeOf(s) ?? ""));
    return literal && schema.anyOf.some(isBinding) ? "dynamic" : "json";
  }
  if (isBinding(schema)) return "binding";
  switch (typeOf(schema)) {
    case "string":
      return LONG.test(name) ? "longText" : "text";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return schema.properties && Object.keys(schema.properties).length > 0 ? "object" : "json";
    case "array":
      return schema.items ? "list" : "json";
    default:
      return "json";
  }
}

/** A starting value for a field that is being added: the first choice, zero, empty, or an object with its required parts. */
export function defaultFor(schema: JsonSchema): unknown {
  if (schema.const !== undefined) return schema.const;
  if (Array.isArray(schema.enum)) return schema.enum[0];
  if (schema.anyOf) return defaultFor(schema.anyOf[0]!);
  switch (typeOf(schema)) {
    case "string":
      return "";
    case "number":
    case "integer":
      return schema.minimum ?? (schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + 1 : 0);
    case "boolean":
      return false;
    case "array":
      return Array.from({ length: schema.minItems ?? 0 }, () => defaultFor(schema.items ?? {}));
    case "object":
      return Object.fromEntries((schema.required ?? []).map((key) => [key, defaultFor(schema.properties?.[key] ?? {})]));
    default:
      return null;
  }
}

/** First sentence of a description, as plain text: the field's hint. A sentence ends at a full stop after a word and before a capital, so "e.g." does not end one. */
export const fieldHint = (text?: string) => (text ?? "").split(/(?<=[a-z0-9)]{2}\.)\s+(?=[A-Z])/)[0]?.replace(/`/g, "") ?? "";

interface FieldProps {
  name: string;
  schema: JsonSchema;
  value: unknown;
  required: boolean;
  /** `undefined` removes the prop. */
  onChange: (value: unknown) => void;
}

/**
 * Controls for an object's props, drawn from its JSON Schema: a list for an
 * enum, a box for text, a number field, a checkbox, a value-or-binding switch
 * for dynamic values, nested groups and lists. Every change produces the
 * whole object again, so the form and the JSON beside it are one value.
 */
export function SchemaForm({ schema, value, onChange, skip = [] }: { schema: JsonSchema; value: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void; skip?: string[] }) {
  const required = new Set(schema.required ?? []);
  // The envelope keys of A2UI (`@catalogId`, `@accessibility`, `@metadata`) are not props, so they are not offered here.
  const entries = Object.entries(schema.properties ?? {})
    .filter(([key, s]) => !skip.includes(key) && !key.startsWith("@") && s.const === undefined);
  return (
    <div className="schema-form">
      {entries.map(([key, s]) => (
        <Field
          key={key}
          name={key}
          schema={s}
          value={value[key]}
          required={required.has(key)}
          onChange={(next) => {
            const copy = { ...value };
            if (next === undefined) delete copy[key];
            else copy[key] = next;
            onChange(copy);
          }}
        />
      ))}
    </div>
  );
}

function Field({ name, schema, value, required, onChange }: FieldProps) {
  const id = useId();
  const kind = fieldKind(name, schema);
  const about = fieldHint(schema.description);
  const label = (
    <span className="schema-label">
      <code>{name}</code>
      {!required && <span className="hint"> optional</span>}
    </span>
  );
  const help = about ? (
    <span className="schema-help" id={`${id}-help`}>
      {about}
    </span>
  ) : null;
  const described = about ? `${id}-help` : undefined;

  // An optional group or list that is not set yet is added with a button, so the form stays short.
  if (value === undefined && (kind === "object" || kind === "list" || kind === "json") && !required) {
    return (
      <div className="schema-field schema-unset">
        {label}
        <button type="button" className="btn small" onClick={() => onChange(defaultFor(schema))} aria-label={`Add ${name}`}>
          Add
        </button>
        {help}
      </div>
    );
  }

  const remove =
    !required && value !== undefined && (kind === "object" || kind === "list" || kind === "json") ? (
      <button type="button" className="btn small" onClick={() => onChange(undefined)} aria-label={`Remove ${name}`}>
        Remove
      </button>
    ) : null;

  switch (kind) {
    case "choice":
      return (
        <div className="schema-field">
          <label htmlFor={id}>{label}</label>
          <select id={id} aria-describedby={described} value={value === undefined ? "" : JSON.stringify(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : JSON.parse(e.target.value))}>
            {(!required || value === undefined) && <option value="">{required ? "Choose…" : "Not set"}</option>}
            {(schema.enum ?? []).map((option) => (
              <option key={JSON.stringify(option)} value={JSON.stringify(option)}>
                {String(option)}
              </option>
            ))}
          </select>
          {help}
        </div>
      );
    case "text":
    case "longText":
      return (
        <div className="schema-field">
          <label htmlFor={id}>{label}</label>
          {kind === "longText" ? (
            <textarea id={id} aria-describedby={described} rows={rowsFor(name)} className="schema-code" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value === "" && !required ? undefined : e.target.value)} />
          ) : (
            <input id={id} aria-describedby={described} type="text" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value === "" && !required ? undefined : e.target.value)} />
          )}
          {help}
        </div>
      );
    case "number":
      return (
        <div className="schema-field">
          <label htmlFor={id}>{label}</label>
          <input
            id={id}
            aria-describedby={described}
            type="number"
            min={schema.minimum}
            max={schema.maximum}
            step={typeOf(schema) === "integer" ? 1 : "any"}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(e.target.value === "" ? (required ? defaultFor(schema) : undefined) : Number(e.target.value))}
          />
          {help}
        </div>
      );
    case "boolean":
      return (
        <div className="schema-field schema-check">
          <input id={id} aria-describedby={described} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked ? true : required ? false : undefined)} />
          <label htmlFor={id}>{label}</label>
          {help}
        </div>
      );
    case "binding":
      return (
        <div className="schema-field">
          <label htmlFor={id}>
            {label} <span className="hint">data model path</span>
          </label>
          <input
            id={id}
            aria-describedby={described}
            type="text"
            placeholder="/path"
            value={(value as { "@path"?: string } | undefined)?.["@path"] ?? ""}
            onChange={(e) => onChange(e.target.value === "" && !required ? undefined : { "@path": e.target.value })}
          />
          {help}
        </div>
      );
    case "dynamic":
      return <DynamicField name={name} schema={schema} value={value} required={required} onChange={onChange} label={label} help={help} />;
    case "object":
      return (
        <fieldset className="schema-group">
          <legend>
            {label} {remove}
          </legend>
          {help}
          <SchemaForm schema={schema} value={(value as Record<string, unknown>) ?? {}} onChange={onChange} />
        </fieldset>
      );
    case "list":
      return <ListField name={name} schema={schema} value={Array.isArray(value) ? value : []} onChange={onChange} label={label} help={help} remove={remove} />;
    default:
      return <JsonField id={id} value={value} onChange={onChange} label={label} help={help} remove={remove} />;
  }
}

/** A literal value, or a binding to the data model; a function call is edited as JSON. */
function DynamicField({ name, schema, value, required, onChange, label, help }: FieldProps & { label: ReactNode; help: ReactNode }) {
  const id = useId();
  const literal = schema.anyOf!.find((s) => ["string", "number", "integer", "boolean"].includes(typeOf(s) ?? ""))!;
  const mode = value && typeof value === "object" ? ("@path" in value ? "path" : "call") : "value";
  return (
    <div className="schema-field">
      <div className="schema-row">
        <label htmlFor={id}>{label}</label>
        <select
          className="schema-mode"
          aria-label={`How ${name} is given`}
          value={mode}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "path") onChange({ "@path": `/${name}` });
            else if (next === "call") onChange({ "@call": "formatNumber", args: {} });
            else onChange(required ? defaultFor(literal) : undefined);
          }}
        >
          <option value="value">Value</option>
          <option value="path">Bound to data</option>
          <option value="call">Function</option>
        </select>
      </div>
      {mode === "value" &&
        (fieldKind(name, literal) === "number" ? (
          <input id={id} type="number" value={typeof value === "number" ? value : ""} onChange={(e) => onChange(e.target.value === "" && !required ? undefined : Number(e.target.value))} />
        ) : fieldKind(name, literal) === "boolean" ? (
          <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        ) : LONG.test(name) ? (
          <textarea id={id} rows={rowsFor(name)} className="schema-code" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value === "" && !required ? undefined : e.target.value)} />
        ) : (
          <input id={id} type="text" value={typeof value === "string" || typeof value === "number" ? String(value) : ""} onChange={(e) => onChange(e.target.value === "" && !required ? undefined : e.target.value)} />
        ))}
      {mode === "path" && (
        <input id={id} type="text" placeholder="/path" value={(value as { "@path": string })["@path"]} onChange={(e) => onChange({ "@path": e.target.value })} />
      )}
      {mode === "call" && <JsonField id={id} value={value} onChange={onChange} />}
      {help}
    </div>
  );
}

function ListField({ name, schema, value, onChange, label, help, remove }: { name: string; schema: JsonSchema; value: unknown[]; onChange: (v: unknown) => void; label: ReactNode; help: ReactNode; remove: ReactNode }) {
  const items = schema.items ?? {};
  const full = schema.maxItems !== undefined && value.length >= schema.maxItems;
  const atLeast = schema.minItems ?? 0;
  const set = (index: number, next: unknown) => onChange(value.map((v, i) => (i === index ? next : v)));
  return (
    <fieldset className="schema-group">
      <legend>
        {label} {remove}
      </legend>
      {help}
      {value.length === 0 && <p className="hint">None yet.</p>}
      <ol className="schema-list">
        {value.map((item, index) => (
          <li key={index}>
            <div className="schema-item">
              {fieldKind(name, items) === "object" ? (
                <SchemaForm schema={items} value={(item as Record<string, unknown>) ?? {}} onChange={(next) => set(index, next)} />
              ) : (
                <Field name={`${name} ${index + 1}`} schema={items} value={item} required onChange={(next) => set(index, next)} />
              )}
              <button type="button" className="btn small" disabled={value.length <= atLeast} onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label={`Remove ${name} ${index + 1}`}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn small" disabled={full} onClick={() => onChange([...value, defaultFor(items)])} aria-label={`Add to ${name}`}>
        Add
      </button>
    </fieldset>
  );
}

/** A raw JSON box for shapes the form does not draw. The value changes only when the text parses. */
function JsonField({ id, value, onChange, label, help, remove }: { id: string; value: unknown; onChange: (v: unknown) => void; label?: ReactNode; help?: ReactNode; remove?: ReactNode }) {
  return (
    <div className="schema-field">
      {label && (
        <div className="schema-row">
          <label htmlFor={id}>
            {label} <span className="hint">JSON</span>
          </label>
          {remove}
        </div>
      )}
      <textarea
        id={id}
        rows={3}
        className="schema-code"
        defaultValue={JSON.stringify(value, null, 2)}
        key={JSON.stringify(value)}
        onBlur={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
            e.target.removeAttribute("aria-invalid");
          } catch {
            e.target.setAttribute("aria-invalid", "true");
          }
        }}
      />
      {help}
    </div>
  );
}
