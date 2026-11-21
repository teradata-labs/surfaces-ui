import { create, type DescMessage, type JsonObject, type JsonValue, type MessageInitShape } from "@bufbuild/protobuf";
import {
  type FieldError,
  FieldErrorSchema,
  type FormDefinition,
  FormDefinitionSchema,
  type FormField,
  FieldType,
  type GetFormRequestSchema,
  type GetFormResponse,
  GetFormResponseSchema,
  type ListFormsRequestSchema,
  type ListFormsResponse,
  ListFormsResponseSchema,
  type ListSubmissionsRequestSchema,
  type ListSubmissionsResponse,
  ListSubmissionsResponseSchema,
  type Submission,
  SubmissionSchema,
  type SubmitRequestSchema,
  type SubmitResponse,
  SubmitResponseSchema,
} from "@surfaces-ui/proto";
import type { CallOptions } from "./datasource.js";

type Unary<Req extends DescMessage, Res> = (request: MessageInitShape<Req>, options?: CallOptions) => Promise<Res>;

/**
 * Where forms send what a person entered. Separate from DataSource because
 * it writes. Forms and where they store are defined by the backend; a
 * client names a form and sends values, never SQL, a table or a path.
 */
export interface Forms {
  listForms: Unary<typeof ListFormsRequestSchema, ListFormsResponse>;
  getForm: Unary<typeof GetFormRequestSchema, GetFormResponse>;
  /** Checks every value against its field; a submission with any error stores nothing. */
  submit: Unary<typeof SubmitRequestSchema, SubmitResponse>;
  /** Newest first. */
  listSubmissions: Unary<typeof ListSubmissionsRequestSchema, ListSubmissionsResponse>;
}

export interface CheckedValues {
  /** The values as they will be stored: numbers as numbers, dates as ISO text in UTC. */
  values: JsonObject;
  errors: FieldError[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function empty(value: JsonValue | undefined): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function checkField(field: FormField, value: JsonValue): { value?: JsonValue; error?: string } {
  switch (field.type) {
    case FieldType.NUMBER:
    case FieldType.INTEGER: {
      const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
      if (!Number.isFinite(n)) return { error: "Enter a number." };
      if (field.type === FieldType.INTEGER && !Number.isInteger(n)) return { error: "Enter a whole number." };
      if (field.min !== undefined && n < field.min) return { error: `Must be at least ${field.min}.` };
      if (field.max !== undefined && n > field.max) return { error: `Must be at most ${field.max}.` };
      return { value: n };
    }
    case FieldType.BOOLEAN:
      if (typeof value === "boolean") return { value };
      if (value === "true" || value === "false") return { value: value === "true" };
      return { error: "Must be yes or no." };
    case FieldType.DATE: {
      if (typeof value !== "string" || !DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return { error: "Enter a date as YYYY-MM-DD." };
      if (new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) return { error: "That date does not exist." };
      return { value };
    }
    case FieldType.DATETIME: {
      const t = typeof value === "string" ? Date.parse(value) : Number.NaN;
      if (Number.isNaN(t)) return { error: "Enter a date and time." };
      return { value: new Date(t).toISOString() };
    }
    case FieldType.CHOICE:
      if (typeof value !== "string" || !field.options.includes(value)) return { error: `Choose one of: ${field.options.join(", ")}.` };
      return { value };
    default: {
      if (typeof value !== "string") return { error: "Enter text." };
      if (field.maxLength !== undefined && value.length > field.maxLength) return { error: `At most ${field.maxLength} characters.` };
      if (field.pattern) {
        let re: RegExp | undefined;
        try {
          re = new RegExp(`^(?:${field.pattern})$`, "u");
        } catch {
          re = undefined;
        }
        if (re && !re.test(value)) return { error: "Not in the expected format." };
      }
      return { value };
    }
  }
}

/** A field's condition as config and the catalog write it: another field of the form, and what it must hold. */
export interface FieldConditionSpec {
  field: string;
  equals?: string | number | boolean;
  in?: (string | number | boolean)[];
}

/** A condition as the form definition carries it: the values written as text. */
export function fieldCondition(when: FieldConditionSpec | undefined): { field: string; values: string[] } | undefined {
  if (!when) return undefined;
  return { field: when.field, values: when.equals !== undefined ? [String(when.equals)] : (when.in ?? []).map(String) };
}

/**
 * True when a field is asked for, given what has been entered: it has no `visibleWhen`, or the field it waits on is
 * itself asked for and holds one of the values. The browser draws by this and every backend checks by it, so a
 * field nobody was shown is never required and never stored.
 */
export function fieldAsked(form: Pick<FormDefinition, "fields">, field: FormField, values: JsonObject | undefined, seen: ReadonlySet<string> = new Set()): boolean {
  const when = field.visibleWhen;
  if (!when) return true;
  const other = form.fields.find((f) => f.name === when.field);
  // A condition that names no field, or leads back to itself, asks nothing: the field is asked for.
  if (!other || seen.has(field.name)) return true;
  if (!fieldAsked(form, other, values, new Set(seen).add(field.name))) return false;
  const value = values?.[when.field];
  if (empty(value) || value === false) return false;
  return when.values.length === 0 || when.values.includes(String(value));
}

/**
 * Checks values against a form's fields. Unknown fields are errors, so a
 * client cannot write a column the form does not declare. Used by every
 * backend, so the browser and the server agree on what is valid.
 */
export function checkSubmission(form: FormDefinition, values: JsonObject | undefined): CheckedValues {
  const input = values ?? {};
  const out: JsonObject = {};
  const errors: FieldError[] = [];
  const known = new Set(form.fields.map((f) => f.name));
  for (const name of Object.keys(input)) {
    if (!known.has(name)) errors.push(create(FieldErrorSchema, { field: name, message: "This form has no such field." }));
  }
  for (const field of form.fields) {
    // A field that was not asked for holds nothing, whatever was sent for it.
    if (!fieldAsked(form, field, input)) {
      out[field.name] = null;
      continue;
    }
    const value = input[field.name];
    if (empty(value)) {
      if (field.required) errors.push(create(FieldErrorSchema, { field: field.name, message: `${field.label || field.name} is required.` }));
      else out[field.name] = null;
      continue;
    }
    const checked = checkField(field, value as JsonValue);
    if (checked.error) errors.push(create(FieldErrorSchema, { field: field.name, message: checked.error }));
    else out[field.name] = checked.value as JsonValue;
  }
  return { values: out, errors };
}

export interface MemoryFormsOptions {
  forms: MessageInitShape<typeof FormDefinitionSchema>[];
  /** Called after a submission is stored, for a host that wants to write it somewhere too. */
  onSubmit?(submission: Submission): void;
  now?(): Date;
  /** Makes submission ids. Defaults to sub-1, sub-2 and so on, which restart with the page. */
  newId?(): string;
}

/** Forms whose submissions are kept in memory. For tests, demos and hosts with no server. */
export function memoryForms(options: MemoryFormsOptions): Forms & { submissions(): Submission[] } {
  const forms = options.forms.map((f) => create(FormDefinitionSchema, f));
  const stored: Submission[] = [];
  const byKey = new Map<string, Submission>();
  const now = options.now ?? (() => new Date());
  let next = 1;
  const find = (id: string) => forms.find((f) => f.id === id);

  return {
    async listForms() {
      return create(ListFormsResponseSchema, { forms });
    },
    async getForm(request) {
      const form = find(request.id ?? "");
      if (!form) throw new Error(`No form "${request.id}".`);
      return create(GetFormResponseSchema, { form });
    },
    async submit(request) {
      const form = find(request.formId ?? "");
      if (!form) return create(SubmitResponseSchema, { message: `No form "${request.formId}".` });
      const key = request.idempotencyKey ?? "";
      const seen = key ? byKey.get(`${form.id}\u0000${key}`) : undefined;
      if (seen) return create(SubmitResponseSchema, { submission: seen, message: "Already received." });
      const checked = checkSubmission(form, request.values as JsonObject | undefined);
      if (checked.errors.length > 0) return create(SubmitResponseSchema, { fieldErrors: checked.errors, message: "Nothing was saved. Fix the fields marked." });
      const submission = create(SubmissionSchema, { id: options.newId?.() ?? `sub-${next++}`, formId: form.id, values: checked.values, submittedAt: now().toISOString(), surfaceId: request.surfaceId ?? "" });
      stored.unshift(submission);
      if (key) byKey.set(`${form.id}\u0000${key}`, submission);
      options.onSubmit?.(submission);
      return create(SubmitResponseSchema, { submission, message: "Saved." });
    },
    async listSubmissions(request) {
      const all = request.formId ? stored.filter((s) => s.formId === request.formId) : stored;
      const start = request.pageToken ? Number(request.pageToken) : 0;
      const size = request.pageSize || 100;
      const page = all.slice(start, start + size);
      return create(ListSubmissionsResponseSchema, { submissions: page, nextPageToken: start + size < all.length ? String(start + size) : "" });
    },
    submissions: () => [...stored],
  };
}

const FORM_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

/** A form as plain config: what `surfaces.config.ts` and the seeds declare. */
export interface FormSpec {
  id: string;
  title?: string;
  description?: string;
  /** Shown to people so they know where the data goes, such as a source and table name. */
  target?: string;
  fields: {
    name: string;
    label: string;
    type: "text" | "longtext" | "number" | "integer" | "boolean" | "date" | "datetime" | "choice";
    required?: boolean;
    options?: string[];
    min?: number;
    max?: number;
    maxLength?: number;
    pattern?: string;
    help?: string;
    /** Asked for only while another field of the form holds this. */
    visibleWhen?: FieldConditionSpec;
  }[];
}

const TYPES: Record<FormSpec["fields"][number]["type"], FieldType> = {
  text: FieldType.TEXT,
  longtext: FieldType.TEXT,
  number: FieldType.NUMBER,
  integer: FieldType.INTEGER,
  boolean: FieldType.BOOLEAN,
  date: FieldType.DATE,
  datetime: FieldType.DATETIME,
  choice: FieldType.CHOICE,
};

/** Turns form config into definitions any `Forms` backend serves. */
export function formDefinitions(forms: FormSpec[]): MessageInitShape<typeof FormDefinitionSchema>[] {
  return forms.map((form) => {
    if (!FORM_ID.test(form.id)) throw new Error(`Form id "${form.id}" must be lower case letters, digits and dashes.`);
    return {
      id: form.id,
      title: form.title ?? form.id,
      description: form.description ?? "",
      target: form.target ?? "",
      fields: form.fields.map((f) => {
        if (f.visibleWhen && (f.visibleWhen.field === f.name || !form.fields.some((other) => other.name === f.visibleWhen!.field))) throw new Error(`Form "${form.id}": field "${f.name}" waits on "${f.visibleWhen.field}", which is not another field of the form.`);
        return { ...f, type: TYPES[f.type], options: f.options ?? [], pattern: f.pattern ?? "", help: f.help ?? "", visibleWhen: fieldCondition(f.visibleWhen) };
      }),
    };
  });
}

