import { create, type JsonObject, type JsonValue } from "@bufbuild/protobuf";
import { type FieldConditionSpec, type Forms, checkSubmission, fieldAsked, fieldCondition } from "@surfaces-ui/data";
import { FieldType, FormDefinitionSchema } from "@surfaces-ui/proto";
import { type FormEvent, type ReactNode, createContext, useContext, useId, useRef, useState } from "react";
import { label as text } from "../locale/locale.js";

const FormsContext = createContext<Forms | undefined>(undefined);

/** Supplies where forms send their submissions. Without it a form only reports what was entered. */
export function FormsProvider({ forms, children }: { forms: Forms; children: ReactNode }) {
  return <FormsContext.Provider value={forms}>{children}</FormsContext.Provider>;
}

export function useOptionalForms(override?: Forms): Forms | undefined {
  const context = useContext(FormsContext);
  return override ?? context;
}

export type FormFieldKind = "text" | "longtext" | "number" | "integer" | "boolean" | "date" | "datetime" | "choice";

/** One field of a form: what it holds and the rules it must meet. The same rules are checked again by the backend. */
export interface FormFieldSpec {
  /** The key the value is sent and stored under. */
  name: string;
  label: string;
  type: FormFieldKind;
  required?: boolean;
  /** For "choice". */
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  /** A regular expression the whole text must match. */
  pattern?: string;
  /** A sentence under the field, outside the label. */
  help?: string;
  placeholder?: string;
  /** Asked for only while another field of the form holds this: `{ field: "kind", equals: "Table" }`. Not drawn, not required and sent as null otherwise. */
  visibleWhen?: FieldConditionSpec;
}

const KIND_TYPE: Record<FormFieldKind, FieldType> = {
  text: FieldType.TEXT,
  longtext: FieldType.TEXT,
  number: FieldType.NUMBER,
  integer: FieldType.INTEGER,
  boolean: FieldType.BOOLEAN,
  date: FieldType.DATE,
  datetime: FieldType.DATETIME,
  choice: FieldType.CHOICE,
};

/** The fields as the backend's form definition, so the browser checks exactly what the server will. */
export function formDefinition(formId: string, fields: FormFieldSpec[]) {
  return create(FormDefinitionSchema, {
    id: formId,
    fields: fields.map((f) => ({ name: f.name, label: f.label, type: KIND_TYPE[f.type], required: f.required ?? false, options: f.options ?? [], min: f.min, max: f.max, maxLength: f.maxLength, pattern: f.pattern ?? "", help: f.help ?? "", visibleWhen: fieldCondition(f.visibleWhen) })),
  });
}

export interface FieldInputProps {
  field: FormFieldSpec;
  value: unknown;
  onChange(value: JsonValue): void;
  error?: string;
  disabled?: boolean;
}

/** One labelled input of the right kind, with its help and its error tied to it for assistive technology. */
export function FieldInput({ field, value, onChange, error, disabled }: FieldInputProps) {
  const id = useId();
  const describedBy = [field.help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const common = { id, name: field.name, disabled, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, required: field.required };
  const str = value == null ? "" : String(value);
  let input: ReactNode;
  switch (field.type) {
    case "longtext":
      input = <textarea {...common} className="sf-input sf-form-textarea" value={str} maxLength={field.maxLength} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "number":
    case "integer":
      input = (
        <input
          {...common}
          className="sf-input"
          type="number"
          inputMode={field.type === "integer" ? "numeric" : "decimal"}
          value={str}
          min={field.min}
          max={field.max}
          step={field.step ?? (field.type === "integer" ? 1 : "any")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
      break;
    case "boolean":
      return (
        <div className="sf-form-field sf-form-check">
          <input {...common} required={undefined} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <label htmlFor={id}>{field.label}</label>
          {field.help && <p id={`${id}-help`} className="sf-form-help">{field.help}</p>}
          {error && <p id={`${id}-error`} className="sf-form-error" role="alert">{error}</p>}
        </div>
      );
    case "date":
      input = <input {...common} className="sf-input" type="date" value={str} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "datetime":
      input = <input {...common} className="sf-input" type="datetime-local" value={str.replace(/Z$/, "").slice(0, 16)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")} />;
      break;
    case "choice":
      input =
        (field.options?.length ?? 0) <= 4 ? (
          <div role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={describedBy} className="sf-form-choices">
            {(field.options ?? []).map((option) => (
              <label key={option} className="sf-form-choice">
                <input type="radio" name={`${id}-${field.name}`} value={option} checked={str === option} disabled={disabled} onChange={() => onChange(option)} />
                {option}
              </label>
            ))}
          </div>
        ) : (
          <select {...common} className="sf-input" value={str} onChange={(e) => onChange(e.target.value)}>
            <option value="">{text("form.choose")}</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      break;
    default:
      input = <input {...common} className="sf-input" type="text" value={str} maxLength={field.maxLength} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <div className="sf-form-field">
      <label id={`${id}-label`} htmlFor={field.type === "choice" && (field.options?.length ?? 0) <= 4 ? undefined : id} className="sf-form-label">
        {field.label}
        {field.required && <span className="sf-form-required"> {text("form.required")}</span>}
      </label>
      {input}
      {field.help && (
        <p id={`${id}-help`} className="sf-form-help">
          {field.help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="sf-form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export interface FormResult {
  /** Stored by the backend, with its id. */
  submissionId?: string;
  /** What was sent, after checking: numbers as numbers, times in UTC. */
  values: JsonObject;
}

export interface FormProps {
  /** The form as the backend knows it. With a `Forms` backend, submissions go there under this id. */
  formId: string;
  fields: FormFieldSpec[];
  title?: string;
  description?: string;
  submitLabel?: string;
  /** The values; leave out to let the form keep its own. */
  values?: JsonObject;
  onValuesChange?(values: JsonObject): void;
  /** Called after the values pass every check (and, with a backend, after it stored them). */
  onSubmit?(result: FormResult): void;
  /** Where to send submissions. Defaults to `FormsProvider`; without either, the form only calls `onSubmit`. */
  forms?: Forms;
  /** Lay the fields out yourself; the form still checks and submits them. */
  children?: ReactNode;
  /** Clear the form after a successful submission. Default true. */
  resetOnSubmit?: boolean;
  className?: string;
}

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "saved"; text: string } | { kind: "rejected"; text: string };

/**
 * A form that checks what a person entered against its fields and submits
 * it. The same rules run again in the backend, which decides where the
 * values are stored; this component never names a table or writes SQL.
 * Errors are shown beside each field and announced; nothing is sent while
 * any field is wrong.
 */
export function Form(props: FormProps) {
  const { formId, fields, title, description, submitLabel = text("form.submit"), onSubmit, children } = props;
  const forms = useOptionalForms(props.forms);
  const [own, setOwn] = useState<JsonObject>({});
  const values = props.values ?? own;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const key = useRef(0);
  const headingId = useId();

  const setValues = (next: JsonObject) => {
    if (props.values === undefined) setOwn(next);
    props.onValuesChange?.(next);
  };
  const change = (name: string, value: JsonValue) => {
    setValues({ ...values, [name]: value });
    if (errors[name]) setErrors(({ [name]: _gone, ...rest }) => rest);
  };

  const definition = formDefinition(formId, fields);
  // Fields that wait on another are drawn only while it holds what they wait for.
  const asked = fields.filter((_, index) => fieldAsked(definition, definition.fields[index]!, values));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (status.kind === "sending") return;
    const checked = checkSubmission(definition, values);
    if (checked.errors.length > 0) {
      setErrors(Object.fromEntries(checked.errors.map((e) => [e.field, e.message])));
      setStatus({ kind: "rejected", text: checked.errors.length === 1 ? text("form.needsAttentionOne") : text("form.needsAttention", { count: checked.errors.length }) });
      return;
    }
    setErrors({});
    if (!forms) {
      onSubmit?.({ values: checked.values });
      setStatus({ kind: "saved", text: text("form.sent") });
      if (props.resetOnSubmit !== false) setValues({});
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const response = await forms.submit({ formId, values: checked.values, idempotencyKey: `${formId}-${Date.now()}-${key.current++}` });
      if (!response.submission) {
        setErrors(Object.fromEntries(response.fieldErrors.map((e) => [e.field, e.message])));
        setStatus({ kind: "rejected", text: response.message || text("form.notSaved") });
        return;
      }
      setStatus({ kind: "saved", text: response.message || text("form.saved") });
      onSubmit?.({ submissionId: response.submission.id, values: (response.submission.values ?? checked.values) as JsonObject });
      if (props.resetOnSubmit !== false) setValues({});
    } catch (error) {
      setStatus({ kind: "rejected", text: text("form.couldNotSend", { error: error instanceof Error ? error.message : String(error) }) });
    }
  };

  return (
    <form className={["sf-form", props.className].filter(Boolean).join(" ")} onSubmit={submit} noValidate aria-labelledby={title ? headingId : undefined}>
      {title && (
        <p id={headingId} className="sf-form-title">
          {title}
        </p>
      )}
      {description && <p className="sf-form-help">{description}</p>}
      {children ?? asked.map((field) => <FieldInput key={field.name} field={field} value={values[field.name]} error={errors[field.name]} disabled={status.kind === "sending"} onChange={(v) => change(field.name, v)} />)}
      {children && Object.keys(errors).length > 0 && (
        <ul className="sf-form-error" role="alert">
          {Object.entries(errors).map(([name, message]) => (
            <li key={name}>
              {fields.find((f) => f.name === name)?.label ?? name}: {message}
            </li>
          ))}
        </ul>
      )}
      <div className="sf-form-actions">
        <button type="submit" className="sf-button" data-variant="primary" disabled={status.kind === "sending"} aria-busy={status.kind === "sending" || undefined}>
          {status.kind === "sending" ? text("form.sending") : submitLabel}
        </button>
        <p className={status.kind === "rejected" ? "sf-form-error" : "sf-form-status"} role="status" aria-live="polite">
          {status.kind === "saved" || status.kind === "rejected" ? status.text : ""}
        </p>
      </div>
      <p className="sf-form-help">{forms ? text("form.connected") : text("form.notConnected")}</p>
    </form>
  );
}
