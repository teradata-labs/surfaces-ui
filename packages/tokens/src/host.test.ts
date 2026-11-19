import { describe, expect, it } from "vitest";
import { hostStyleVariables, presetByName, presets, themeFromHostStyles } from "./index.js";

describe("host styles", () => {
  it("round-trips a preset through the variables a host shares", () => {
    for (const preset of presets) {
      const back = themeFromHostStyles(hostStyleVariables(preset, "dark"), presets[0]!);
      expect(back.charts.dark.series, preset.name).toEqual(preset.charts.dark.series);
      expect(back.radius).toBe(preset.radius);
    }
  });

  it("takes the nearest preset's surfaces and charts with the host's own accent", () => {
    const theme = themeFromHostStyles({ "--color-ring-primary": "#12C8A8", "--border-radius-md": "6px" }, presets[0]!);
    expect(theme.charts).toEqual(presetByName("Aurora")!.charts);
    expect(theme.dark.background).toBe(presetByName("Aurora")!.dark.background);
    expect(theme.radius).toBe(6);
  });

  it("keeps the base theme when the host shares no usable accent", () => {
    expect(themeFromHostStyles(undefined, presets[0]!)).toBe(presets[0]);
    expect(themeFromHostStyles({ "--color-ring-primary": "var(--x)" }, presets[0]!)).toBe(presets[0]);
  });
});
