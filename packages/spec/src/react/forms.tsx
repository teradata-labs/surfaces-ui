import { FieldInput, Form, type FormFieldSpec, type FormProps } from "@surfaces-ui/components";
import { useId } from "react";
import type { ComponentRenderer, RenderProps } from "./Surface.js";

type FormValues = NonNullable<FormProps["values"]>;

const text = (value: unknown): string => (value == null || typeof value === "object" ? "" : String(value));
const num = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

/** One input bound to the data model at `value.path`. */
function input(type: FormFieldSpec["type"], extra?: (props: Record<string, unknown>) => Partial<FormFieldSpec>): ComponentRenderer {
  return ({ props, component, setData }: RenderProps) => (
    <FieldInput
      field={{ name: component.id, label: text(props.label), type, help: text(props.help) || undefined, placeholder: text(props.placeholder) || undefined, ...extra?.(props) }}
      value={props.value}
      onChange={(value) => setData(component.value, value)}
    />
  );
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
  TextField: input("text", (p) => ({ type: p.multiline === true ? "longtext" : "text", maxLength: num(p.maxLength) })),
  NumberField: input("number", (p) => ({ min: num(p.min), max: num(p.max), step: num(p.step) })),
  ChoicePicker: input("choice", (p) => ({ options: Array.isArray(p.options) ? (p.options as unknown[]).map(text) : [] })),
  CheckBox: input("boolean"),
  DateTimeInput: input("date", (p) => ({ type: p.mode === "datetime" ? "datetime" : "date" })),
  Slider: SliderView,
  Form: FormView,
};
