import { useId } from "react";

/** One choice of a `SegmentedControl`. */
export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  /** Shown greyed and still reachable, for a choice that makes no sense right now. */
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  /** What is being chosen, for assistive technology: "Mode", "Preview mode". */
  label: string;
  /** The choices, in order. Two to eight; they share the width equally and one thumb slides between them. */
  options: readonly SegmentedOption<T>[];
  /** The chosen option's value. */
  value: T;
  onChange(value: T): void;
  /** "content" (the default) is as wide as its options need; "fill" takes its parent's width. */
  fit?: "content" | "fill";
  /** The radio group's name, when a form reads it. Made up otherwise. */
  name?: string;
  className?: string;
}

/**
 * A few equal choices of which exactly one holds, as one bar: build or view, chart or table, light or dark. A radio
 * group, so one tab stop with the arrow keys moving the choice; the chosen segment is a thumb that slides between
 * them. Use it for switching what is shown in place; for actions, use buttons.
 */
export function SegmentedControl<T extends string = string>(props: SegmentedControlProps<T>) {
  const { label, options, value, onChange, fit = "content", className } = props;
  const made = useId();
  const name = props.name ?? made;
  return (
    <div className={["sf-segmented", "sf-segmented-control", className].filter(Boolean).join(" ")} data-fit={fit} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className="sf-segment" data-checked={option.value === value || undefined} data-disabled={option.disabled || undefined}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            aria-disabled={option.disabled || undefined}
            onChange={() => {
              if (!option.disabled) onChange(option.value);
            }}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
