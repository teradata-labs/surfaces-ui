import { useTheme } from "@surfaces-ui/components";
import { type Mode, presets } from "@surfaces-ui/tokens";
import { useEffect, useId, useRef, useState } from "react";

const MODES: { mode: Mode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

/**
 * The site's appearance, from the top bar: a preset, light or dark, and the way to every theme and the editor.
 * A button opens it as a popover on glass; in the phone menu it opens in place. Escape, a press outside or
 * choosing a page closes it and puts focus back on the button.
 */
export function ThemeMenu({ onOpenArea }: { onOpenArea(area: "themes" | "theme"): void }) {
  const { theme, mode, resolvedMode, setTheme, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const current = presets.find((p) => p.name === theme.name);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div
      className="theme-menu"
      ref={root}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="theme-menu-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="theme-menu-swatch" aria-hidden="true" />
        <span>{theme.name || "Custom"}</span>
        <span className="theme-menu-mode">{resolvedMode === "dark" ? "Dark" : "Light"}</span>
      </button>
      {open && (
        <div className="theme-menu-panel" id={panelId} role="group" aria-label="Appearance">
          <fieldset className="theme-menu-group">
            <legend>Theme</legend>
            <div className="theme-menu-presets">
              {presets.map((preset) => {
                const accent = preset[resolvedMode].accent;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    className="theme-menu-preset"
                    aria-pressed={current?.name === preset.name}
                    onClick={() => setTheme(preset)}
                  >
                    <span className="theme-menu-dot" style={{ background: accent }} aria-hidden="true" />
                    {preset.name}
                  </button>
                );
              })}
            </div>
            {!current && <p className="theme-menu-note">A custom theme from the editor is in use.</p>}
          </fieldset>
          <fieldset className="theme-menu-group">
            <legend>Appearance</legend>
            <div className="sf-segmented">
              {MODES.map(({ mode: option, label }) => (
                <label key={option} className="sf-segment" data-checked={option === mode || undefined}>
                  <input type="radio" name={`${panelId}-mode`} value={option} checked={option === mode} onChange={() => setMode(option)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="theme-menu-links">
            <button
              type="button"
              className="theme-menu-link"
              onClick={() => {
                onOpenArea("themes");
                close();
              }}
            >
              All themes
            </button>
            <button
              type="button"
              className="theme-menu-link"
              onClick={() => {
                onOpenArea("theme");
                close();
              }}
            >
              Theme editor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
