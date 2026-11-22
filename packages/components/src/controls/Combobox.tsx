import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { numberFormat, label as text } from "../locale/locale.js";

/** One suggestion in a `Combobox`. */
export interface ComboboxOption {
  /** What choosing it puts in the box, and what `onPick` reports: an email, an id. */
  value: string;
  /** The words shown for it: a name. */
  label: string;
  /** A second line: the email under a name. */
  detail?: string;
}

export interface ComboboxProps {
  /** The field's name, shown above it. */
  label: string;
  /** The text in the box. The host holds it. */
  value: string;
  /** Every change to the text, typed or chosen. Search with it and pass back what matches as `options`. */
  onChange(value: string): void;
  /** The suggestions for the text as it is now, best first. The box does not filter them. */
  options: readonly ComboboxOption[];
  /** A suggestion was chosen; `onChange` has already had its value. */
  onPick?(option: ComboboxOption): void;
  /** Suggestions are being fetched. */
  loading?: boolean;
  /** The input's type: "text" (the default), "email" or "search". */
  type?: "text" | "email" | "search";
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** The input's name, when a form reads it. */
  name?: string;
  /** A sentence under the field. */
  help?: string;
  className?: string;
}

/**
 * A text box that suggests as a person types: a person to hand work to, a table, a tag. Anything may be typed; a
 * suggestion is a shortcut. The host searches (on its server, for a long list) and passes the matches in. The ARIA
 * 1.2 combobox: Down and Up move through the list, Enter chooses, Escape closes it and then clears the box.
 */
export function Combobox(props: ComboboxProps) {
  const { label, value, onChange, options, onPick, loading, type = "text", placeholder, required, disabled, name, help, className } = props;
  const id = useId();
  const listId = `${id}-list`;
  const helpId = `${id}-help`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const shown = open && (options.length > 0 || loading || value.trim() !== "");

  // New suggestions start with none of them active, so Enter keeps what was typed. Compared by value, so a host that
  // builds a fresh array on every render does not lose the person's place.
  const listed = options.map((option) => option.value).join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the suggestions themselves change.
  useEffect(() => setActive(-1), [listed]);

  const pick = (option: ComboboxOption) => {
    onChange(option.value);
    onPick?.(option);
    setOpen(false);
    setActive(-1);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else if (options.length > 0) setActive((at) => (at + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else if (options.length > 0) setActive((at) => (at <= 0 ? options.length - 1 : at - 1));
    } else if (event.key === "Enter") {
      const option = open ? options[active] : undefined;
      if (option) {
        event.preventDefault();
        pick(option);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (value) {
        event.preventDefault();
        onChange("");
      }
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };
  const count = options.length === 1 ? text("combobox.countOne") : text("combobox.count", { count: numberFormat().format(options.length) });

  return (
    <div
      ref={box}
      className={["sf-combobox", className].filter(Boolean).join(" ")}
      onBlur={(event) => {
        if (!box.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label className="sf-combobox-label" htmlFor={`${id}-input`}>
        {label}
      </label>
      <input
        id={`${id}-input`}
        className="sf-input"
        type={type}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${id}-option-${active}` : undefined}
        aria-describedby={help ? helpId : undefined}
        autoComplete="off"
        value={value}
        name={name}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {help && (
        <p id={helpId} className="sf-combobox-help">
          {help}
        </p>
      )}
      <div className="sf-combobox-popup" hidden={!shown}>
        {/* An empty listbox is not allowed; with no suggestions the popup says why instead. */}
        <ul id={listId} role="listbox" aria-label={label} className="sf-combobox-list" hidden={options.length === 0}>
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              className="sf-combobox-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
              onMouseMove={() => setActive(index)}
            >
              <span>{option.label}</span>
              {option.detail && <span className="sf-combobox-detail">{option.detail}</span>}
            </li>
          ))}
        </ul>
        {options.length === 0 && <p className="sf-combobox-note">{loading ? text("combobox.loading") : text("combobox.none")}</p>}
      </div>
      <span className="sf-visually-hidden" aria-live="polite">
        {shown && !loading ? (options.length > 0 ? count : text("combobox.none")) : ""}
      </span>
    </div>
  );
}
