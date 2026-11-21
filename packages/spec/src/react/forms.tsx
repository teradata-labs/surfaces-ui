import type { JsonValue } from "@bufbuild/protobuf";
import { FieldInput, Form, type FormFieldSpec, type FormProps, formDefinition } from "@surfaces-ui/components";
import { checkSubmission } from "@surfaces-ui/data";
import { useId, useState } from "react";
import { type ComponentRenderer, type RenderProps, useInputCheck } from "./Surface.js";

type FormValues = NonNullable<FormProps["values"]>;

const text = (value: unknown): string => (value == null || typeof value === "object" ? "" : String(value));
const num = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

/**
 * One input bound to the data model at `value.path`. It checks itself by the rules a `Form` uses (required, a
 * range, a pattern) and says what is wrong beside the field, once the person has left it: nobody is told a field
 * is missing while they are still on their way to it. A Button that names it in `requires` waits for it, and a
 * press on that Button has it say what is wrong at once.
 */
function LooseInput({ type, extra, props, component, setData }: RenderProps & { type: FormFieldSpec["type"]; extra?: (props: Record<string, unknown>) => Partial<FormFieldSpec> }) {
  const [left, setLeft] = useState(false);
  const field: FormFieldSpec = {
    name: component.id,
    label: text(props.label),
    type,
    help: text(props.help) || undefined,
    placeholder: text(props.placeholder) || undefined,
    required: props.required === true || undefined,
    ...extra?.(props),
  };
  // A required yes-or-no box is one that must be ticked.
  const missing = field.type === "boolean" && field.required && props.value !== true;
  const problem = missing ? `${field.label} is required.` : checkSubmission(formDefinition("field", [{ ...field, name: "value" }]), { value: (props.value ?? null) as JsonValue }).errors[0]?.message;
  const check = useInputCheck(component.id, field.label, problem);
  const error = left || check.shown ? problem : undefined;
  return (
    <div className="sf-a2-field" ref={check.ref} onBlur={() => setLeft(true)}>
      <FieldInput field={field} value={props.value} error={error} onChange={(value) => setData(component.value, value)} />
    </div>
  );
}

function input(type: FormFieldSpec["type"], extra?: (props: Record<string, unknown>) => Partial<FormFieldSpec>): ComponentRenderer {
  return (args: RenderProps) => <LooseInput {...args} type={type} extra={extra} />;
}

function SliderView({ props, component, setData }: RenderProps) {
  const id = useId();
  const min = num(props.min) ?? 0;
  const max = num(props.max) ?? 100;
  const value = num(props.value) ?? min;
  return (
    <div className="sf-form-field">
      <label className="sf-form-label" htmlFor={id}>
        {text(props.label)}: <output htmlFor={id}>{value}</output>
      </label>
      <input
        id={id}
        className="sf-form-slider"
        type="range"
        min={min}
        max={max}
        step={num(props.step) ?? 1}
        value={value}
        aria-describedby={props.help ? `${id}-help` : undefined}
        onChange={(event) => setData(component.value, Number(event.target.value))}
      />
      {props.help != null && (
        <p id={`${id}-help`} className="sf-form-help">
          {text(props.help)}
        </p>
      )}
    </div>
  );
}

function FormView({ props, component, dispatch, setData }: RenderProps) {
  const bound = component.values != null;
  const formId = text(props.formId);
  return (
    <Form
      formId={formId}
      title={text(props.title) || undefined}
      description={text(props.description) || undefined}
      fields={(props.fields as FormFieldSpec[]) ?? []}
      submitLabel={text(props.submitLabel) || undefined}
      values={bound ? ((props.values && typeof props.values === "object" ? props.values : {}) as FormValues) : undefined}
      onValuesChange={bound ? (values) => setData(component.values, values) : undefined}
      onSubmit={(result) => dispatch(component.action, { formId, values: result.values, submissionId: result.submissionId ?? "" })}
    />
  );
}

export const formRenderers: Record<string, ComponentRenderer> = {
  TextField: input("text", (p) => ({ type: p.multiline === true ? "longtext" : "text", maxLength: num(p.maxLength), pattern: text(p.pattern) || undefined })),
  NumberField: input("number", (p) => ({ min: num(p.min), max: num(p.max), step: num(p.step) })),
  ChoicePicker: input("choice", (p) => ({ options: Array.isArray(p.options) ? (p.options as unknown[]).map(text) : [] })),
  CheckBox: input("boolean"),
  DateTimeInput: input("date", (p) => ({ type: p.mode === "datetime" ? "datetime" : "date" })),
  Slider: SliderView,
  Form: FormView,
};
