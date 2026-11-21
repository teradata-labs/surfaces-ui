import { describe, expect, it } from "vitest";
import { HUES } from "./charts.js";
import { presetByName } from "./presets.js";
import { applyThemeRequest } from "./request.js";
import { defaultTheme } from "./presets.js";

describe("applyThemeRequest", () => {
  it("switches preset and mode, and leaves the rest alone", () => {
    const result = applyThemeRequest({ preset: "aurora", mode: "dark" }, defaultTheme);
    expect(result).toEqual({ theme: presetByName("Aurora"), mode: "dark", problems: [] });
    expect(applyThemeRequest({}, defaultTheme)).toEqual({ theme: defaultTheme, problems: [] });
  });

  it("changes single settings on top of the current theme", () => {
    const { theme, problems } = applyThemeRequest({ radius: 99, font: "mono", density: "compact", seriesOrder: "Berry", accent: "#0E7C66" }, defaultTheme);
    expect(problems).toEqual([]);
    expect(theme).toMatchObject({ name: "Custom", radius: 28, font: "mono", density: "compact" });
    expect(theme.charts.light.series[0]).toBe(HUES.magenta.light);
    expect(theme.light.accent).toBe("#0E7C66");
    expect(theme.light.background).toBe(defaultTheme.light.background);
  });

  it("refuses what it does not understand and says so, keeping the rest", () => {
    const { theme, mode, problems } = applyThemeRequest({ preset: "Neon", accent: "red", font: "comic" as never, mode: "dim" as never, density: "compact" }, defaultTheme);
    expect(theme.density).toBe("compact");
    expect(theme.light).toEqual(defaultTheme.light);
    expect(mode).toBeUndefined();
    expect(problems).toHaveLength(4);
    expect(problems[0]).toContain("There is no theme called Neon.");
  });
});
