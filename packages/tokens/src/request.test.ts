import { describe, expect, it } from "vitest";
import { HUES } from "./charts.js";
import { presetByName } from "./presets.js";
import { applyThemeRequest, themeNames } from "./request.js";
import type { Theme } from "./theme.js";
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

  describe("with the host's own themes", () => {
    const brand: Theme = { ...defaultTheme, name: "Acme", light: { ...defaultTheme.light, accent: "#1976D2" }, radius: 4 };
    const impostor: Theme = { ...defaultTheme, name: "aurora", radius: 0 };
    const themes = [brand, impostor];

    it("chooses one by name, ignoring case, and keeps its name", () => {
      expect(applyThemeRequest({ preset: "acme" }, defaultTheme, { themes })).toEqual({ theme: brand, problems: [] });
      expect(applyThemeRequest({ preset: "Acme", radius: 8 }, defaultTheme, { themes }).theme).toMatchObject({ name: "Custom", radius: 8 });
    });

    it("never lets a host theme stand in for a built-in name", () => {
      expect(applyThemeRequest({ preset: "Aurora" }, defaultTheme, { themes }).theme).toBe(presetByName("Aurora"));
      expect(presetByName("AURORA", themes)).toBe(presetByName("Aurora"));
      expect(themeNames(themes)).toEqual([...themeNames(), "Acme"]);
    });

    it("is unknown without them, and names them when a request misses", () => {
      expect(applyThemeRequest({ preset: "Acme" }, defaultTheme).problems[0]).toContain("There is no theme called Acme.");
      expect(applyThemeRequest({ preset: "Neon" }, defaultTheme, { themes }).problems[0]).toMatch(/Choose from .*Ink.*, Acme\.$/);
    });
  });
});
