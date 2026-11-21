import { describe, expect, it } from "vitest";
import {
  GLASS,
  CVD_TARGET,
  HUES,
  RETIRED_HUES,
  SERIES_ORDERS,
  glassBackdrops,
  glassOver,
  mixOklab,
  rgbChannels,
  stepByContrast,
  DISTANCE_FLOOR,
  LEGEND_FLOOR,
  LEGEND_SLOTS,
  RETIRED_ORDERS,
  type HueName,
  type SeriesOrderName,
  currentSeries,
  SERIES_ORDER_NAMES,
  chartColors,
  checkSeries,
  currentHue,
  colorDistance,
  contrast,
  divergingRamp,
  luminance,
  presetByName,
  seriesOrderOf,
  sequentialRamp,
  withCharts,
  defaultTheme,
  echartsTheme,
  ensureContrast,
  normalizeHex,
  parseTheme,
  presets,
  readableOn,
  resolveColors,
  resolveTheme,
  themeCss,
  themeVars,
  withAccent,
} from "./index.js";
import { toOklab } from "./color.js";

describe("color", () => {
  it("normalizes short and lower-case hex", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(() => normalizeHex("blue")).toThrow();
  });

  it("computes WCAG contrast", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#777777")).toBe(1);
  });

  it("picks readable text and reaches a requested contrast", () => {
    expect(readableOn("#102030")).toBe("#FFFFFF");
    expect(readableOn("#FFE680")).toBe("#000000");
    expect(contrast(ensureContrast("#FFF2A8", "#FFFFFF", 4.5), "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ensureContrast("#1A1040", "#000000", 4.5), "#000000")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("presets", () => {
  it("have unique names", () => {
    expect(new Set(presets.map((p) => p.name)).size).toBe(presets.length);
  });

  for (const preset of presets) {
    for (const mode of ["light", "dark"] as const) {
      it(`${preset.name} ${mode} meets WCAG AA`, () => {
        const c = resolveColors(preset[mode], preset.charts[mode]);
        expect(contrast(c.text, c.background)).toBeGreaterThanOrEqual(7);
        expect(contrast(c.text, c.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c.muted, c.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c.muted, c.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
        for (const ground of [c.background, c.surface, c.accentSoft]) expect(contrast(c.accentText, ground)).toBeGreaterThanOrEqual(4.5);
        // Status colours are written as text, on the page and on cards.
        for (const s of [c.success, c.warning, c.danger, c.info]) {
          expect(contrast(s, c.background)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(s, c.surface)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(c.focus, c.background)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe("colour ranges", () => {
  for (const preset of presets) {
    for (const mode of ["light", "dark"] as const) {
      it(`${preset.name} ${mode}: every level reads at the contrast it promises`, () => {
        const c = resolveColors(preset[mode], preset.charts[mode]);
        const atLeast = (fg: string, grounds: string[], ratio: number, what: string) => {
          for (const g of grounds) expect(contrast(fg, g), `${what} on ${g}`).toBeGreaterThanOrEqual(ratio);
        };
        expect(c.bg[0]).toBe(c.background);
        expect(c.bg[1]).toBe(c.surface);
        expect(c.label[0]).toBe(c.text);
        // Primary, secondary and tertiary text pass AA on every background level.
        for (const [i, label] of c.label.slice(0, 3).entries()) atLeast(label, c.bg, 4.5, `label-${i + 1}`);
        // Quaternary is for disabled text and marks: 3:1 on the page and panes.
        atLeast(c.label[3], [c.background, c.surface], 3, "label-4");
        // Each level is fainter than the one before it on the page.
        const onPage = c.label.map((l) => contrast(l, c.background));
        expect(onPage).toEqual([...onPage].sort((a, b) => b - a));
        // Fills sit behind controls, pressed or not: primary and secondary text read on all of them.
        atLeast(c.text, c.fill, 4.5, "text on fill");
        atLeast(c.muted, c.fill, 4.5, "muted on fill");
        const fills = c.fill.map((f) => contrast(f, c.background));
        expect(fills).toEqual([...fills].sort((a, b) => b - a));
        // Greys: the first marks at 3:1, the rest step toward the page.
        atLeast(c.gray[0], [c.background, c.surface], 3, "gray-1");
        const greys = c.gray.map((g) => contrast(g, c.background));
        expect(greys).toEqual([...greys].sort((a, b) => b - a));
        // The accent's hover and pressed states keep text on the accent readable.
        atLeast(c.onAccent, [c.accent, c.accentHover, c.accentPressed], 4.5, "on-accent");
      });

      it(`${preset.name} ${mode}: text on glass reads over the worst thing behind it`, () => {
        const c = resolveColors(preset[mode], preset.charts[mode]);
        const behind = glassBackdrops(c);
        const worst = (fg: string, alpha: number, dim?: string) => Math.min(...glassOver(c.glass.tint, alpha, behind, dim).map((g) => contrast(fg, g)));
        for (const alpha of [GLASS.regular, GLASS.thick]) {
          expect(worst(c.text, alpha)).toBeGreaterThanOrEqual(7);
          expect(worst(c.glass.muted, alpha)).toBeGreaterThanOrEqual(4.5);
        }
        // Clear glass carries icons and primary text only, over dimmed content.
        expect(worst(c.text, GLASS.clear, c.glass.dim)).toBeGreaterThanOrEqual(4.5);
        // With glass turned off the pane is solid and the theme's own contrast applies.
        expect(worst(c.text, 1)).toBeCloseTo(contrast(c.text, c.surface), 5);
      });
    }
  }

  it("generates a step by contrast in OKLab, keeping the tint", () => {
    const step = stepByContrast("#141633", "#FBFBFE", 4.5, ["#FBFBFE"]);
    expect(contrast(step, "#FBFBFE")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(step, "#FBFBFE")).toBeLessThan(4.7);
    expect(mixOklab("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mixOklab("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
    expect(rgbChannels("#0A0B18")).toBe("10 11 24");
  });

  it("emits the ranges and glass, and turns glass off where a person or browser asks", () => {
    const vars = themeVars(defaultTheme, "dark");
    for (const name of ["bg", "label", "fill"]) for (const i of [1, 2, 3, 4]) expect(vars[`--sf-color-${name}-${i}`]).toMatch(/^#[0-9A-F]{6}$/);
    expect(vars["--sf-color-gray-6"]).toMatch(/^#[0-9A-F]{6}$/);
    expect(vars["--sf-glass-regular"]).toBe("rgb(var(--sf-glass-tint) / var(--sf-glass-alpha-regular))");
    expect(vars["--sf-glass-tint"]).toBe(rgbChannels(defaultTheme.dark.surface));
    expect(vars["--sf-font-size-title-1"]).toBeDefined();
    const css = themeCss(defaultTheme);
    for (const query of ["@media (prefers-reduced-transparency: reduce)", "@media (prefers-contrast: more)", "@media (forced-colors: active)", "@supports not ((backdrop-filter: blur(1px))"]) {
      expect(css).toContain(query);
    }
    expect(css).toMatch(/prefers-reduced-transparency: reduce\) \{\n:root \{\n {2}--sf-glass-alpha-regular: 1;/);
    // The channels change with the mode; the glass layers are declared once and follow them.
    expect(css.match(/--sf-glass-regular:/g)).toHaveLength(1);
    expect(css.match(/--sf-glass-tint:/g)).toHaveLength(3);
  });

  it("times motion from tokens, and stops it for people who ask for none", () => {
    const vars = themeVars(defaultTheme, "light");
    expect(vars["--sf-duration"]).toBe("200ms");
    expect(vars["--sf-ease-spring"]).toMatch(/^cubic-bezier/);
    expect(themeCss(defaultTheme)).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\n:root \{\n {2}--sf-duration-fast: 0ms;\n {2}--sf-duration: 0ms;\n {2}--sf-duration-slow: 0ms;\n {2}--sf-duration-springy: 0ms;\n {2}--sf-press-scale: 1;/);
  });

  it("springs gummy where linear() easing exists, and with one overshoot where it does not", () => {
    const vars = themeVars(defaultTheme, "light");
    expect(vars["--sf-duration-springy"]).toBe("520ms");
    expect(vars["--sf-ease-gummy"]).toMatch(/^cubic-bezier/);
    expect(themeCss(defaultTheme)).toMatch(/@supports \(transition-timing-function: linear\(0, 1\)\) \{\n:root \{\n {2}--sf-ease-gummy: linear\(0, /);
  });

  it("holds thirteen hues, and every series hue reaches 3:1 on every preset's panes", () => {
    expect(Object.keys(HUES)).toHaveLength(13);
    const used = new Set(Object.values(SERIES_ORDERS).flat());
    for (const hue of used) {
      for (const preset of presets) {
        for (const mode of ["light", "dark"] as const) {
          for (const ground of [preset[mode].background, preset[mode].surface]) {
            expect(contrast(HUES[hue][mode], ground), `${hue} ${mode} on ${preset.name}`).toBeGreaterThanOrEqual(3);
          }
        }
      }
    }
  });
});

describe("more contrast", () => {
  const high = presetByName("High contrast")!;

  it("keeps the setting through parseTheme and refuses one it does not know", () => {
    expect(parseTheme(JSON.parse(JSON.stringify(high)), defaultTheme).contrast).toBe("more");
    expect(parseTheme({ name: "Mine" }, defaultTheme).contrast).toBeUndefined();
    expect(() => parseTheme({ contrast: "max" }, defaultTheme)).toThrow(/theme\.contrast/);
  });

  it("draws every edge at 3:1 and the quieter labels a level up", () => {
    for (const mode of ["light", "dark"] as const) {
      const c = resolveColors(high[mode], high.charts[mode], undefined, "more");
      expect(contrast(c.border, c.background)).toBeGreaterThanOrEqual(3);
      expect(contrast(c.borderStrong, c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.label[2], c.background)).toBeGreaterThanOrEqual(7);
      expect(contrast(c.label[3], c.background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("outlines panes and makes glass solid for the theme, and for a person who asks for more contrast", () => {
    const standard = themeCss(defaultTheme);
    expect(standard).toContain("--sf-color-edge: transparent;");
    expect(standard).toMatch(/@media \(prefers-contrast: more\) \{\n:root \{[^}]*--sf-color-edge: var\(--sf-color-border-strong\);/);
    const css = themeCss(high);
    const last = css.lastIndexOf("--sf-color-edge: var(--sf-color-border-strong);");
    expect(css.slice(0, last).lastIndexOf("@media")).toBeLessThan(css.slice(0, last).lastIndexOf("}\n}"));
    expect(css).toMatch(/:root \{\n[^@]*--sf-glass-alpha-regular: 1;[^@]*--sf-color-edge: var\(--sf-color-border-strong\);/);
  });
});

describe("parseTheme", () => {
  it("fills missing fields from the fallback", () => {
    const t = parseTheme({ name: "Mine", light: { accent: "#f00" } }, defaultTheme);
    expect(t.light.accent).toBe("#FF0000");
    expect(t.light.background).toBe(defaultTheme.light.background);
    expect(t.dark).toEqual(defaultTheme.dark);
  });

  it("clamps radius and rejects bad values with a path", () => {
    expect(parseTheme({ radius: 99 }, defaultTheme).radius).toBe(28);
    expect(parseTheme({ radius: -4 }, defaultTheme).radius).toBe(0);
    expect(() => parseTheme({ font: "comic" }, defaultTheme)).toThrow(/theme\.font/);
    expect(() => parseTheme({ dark: { text: "white" } }, defaultTheme)).toThrow(/theme\.dark\.text/);
    expect(() => parseTheme("nope", defaultTheme)).toThrow();
  });

  it("round-trips every preset", () => {
    for (const p of presets) expect(parseTheme(JSON.parse(JSON.stringify(p)), defaultTheme)).toEqual(p);
  });
});

describe("withAccent", () => {
  it.each(["#FFFF00", "#000000", "#FFFFFF", "#7A1FA2", "#00C2A8"])("%s stays usable in both modes", (accent) => {
    const t = withAccent(defaultTheme, accent);
    expect(t.name).toBe("Custom");
    for (const mode of ["light", "dark"] as const) {
      expect(contrast(t[mode].accent, t[mode].background)).toBeGreaterThanOrEqual(3);
      expect(contrast(t[mode].onAccent, t[mode].accent)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("themeCss", () => {
  it("emits light by default, dark by system and by attribute", () => {
    const css = themeCss(defaultTheme);
    expect(css).toContain(`:root {`);
    expect(css).toContain(`--sf-color-bg: ${defaultTheme.light.background};`);
    expect(css).toContain(`@media (prefers-color-scheme: dark)`);
    expect(css).toContain(`:root:not([data-theme="light"])`);
    expect(css).toContain(`:root[data-theme="dark"]`);
    expect(css).toContain(`--sf-color-bg: ${defaultTheme.dark.background};`);
    expect(css).toContain(`--sf-radius: ${defaultTheme.radius}px;`);
  });

  it("scopes to a selector", () => {
    const css = themeCss(defaultTheme, { selector: ".panel" });
    expect(css).toContain(`.panel[data-theme="dark"]`);
    expect(css).not.toContain(":root");
  });

  it("exposes the same variables for both modes", () => {
    expect(Object.keys(themeVars(defaultTheme, "light"))).toEqual(Object.keys(themeVars(defaultTheme, "dark")));
    expect(themeVars(presetByName("Mono")!, "dark")["--sf-row-height"]).toBe("28px");
  });
});

describe("echartsTheme", () => {
  it("uses the theme's series colours and text colour", () => {
    const e = echartsTheme(defaultTheme, "dark") as { color: string[]; textStyle: { color: string } };
    expect(e.color).toEqual(resolveColors(defaultTheme.dark, defaultTheme.charts.dark).series);
    expect(e.color).toEqual(defaultTheme.charts.dark.series);
    expect(e.textStyle.color).toBe(defaultTheme.dark.text);
  });
});

describe("chart colours", () => {
  it("measures how alike two colours look, with and without colour blindness", () => {
    expect(colorDistance("#2A78D6", "#2A78D6")).toBe(0);
    // Red and green are far apart to most eyes and close with red-green colour blindness.
    expect(colorDistance("#E34948", "#008300")).toBeGreaterThan(30);
    expect(colorDistance("#D03B3B", "#5A8F00", "deutan")).toBeLessThan(colorDistance("#D03B3B", "#5A8F00"));
  });

  for (const order of SERIES_ORDER_NAMES) {
    for (const mode of ["light", "dark"] as const) {
      it(`${order} ${mode}: neighbouring series can be told apart, colour blind or not`, () => {
        const surface = mode === "light" ? "#FCFCFB" : "#1A1A19";
        const issues = checkSeries(chartColors(order, mode).series, surface);
        expect(issues.filter((i) => i.severity === "error")).toEqual([]);
        // Nothing sits in the "close, so label it" band either.
        expect(issues.filter((i) => /colour blindness/.test(i.message))).toEqual([]);
      });
    }
  }

  for (const preset of presets) {
    for (const mode of ["light", "dark"] as const) {
      it(`${preset.name} ${mode}: charts hold up on its own surfaces and open with its accent's hue or grey`, () => {
        const { series, sequential, diverging } = preset.charts[mode];
        for (const surface of [preset[mode].surface, preset[mode].background]) {
          expect(checkSeries(series, surface).filter((i) => i.severity === "error")).toEqual([]);
        }
        expect(seriesOrderOf(series, mode)).toBeDefined();
        // Magnitude takes the first series hue, or a grey for a preset whose chrome has no hue (Mono).
        const [, a, b] = toOklab(preset[mode].accent);
        if (Math.hypot(a, b) < 0.01) expect(Math.hypot(...toOklab(sequential).slice(1))).toBeLessThan(0.01);
        else expect(sequential).toBe(series[0]);
        expect(colorDistance(diverging[0], diverging[1])).toBeGreaterThan(DISTANCE_FLOOR);
        const c = resolveColors(preset[mode], preset.charts[mode]);
        // Magnitude: each step is further from the surface than the last.
        const away = c.sequential.map((step) => contrast(step, c.surface));
        expect(away).toEqual([...away].sort((a, b) => a - b));
        expect(away.at(-1)!).toBeGreaterThanOrEqual(3);
        // Two-sided: the middle is the step nearest the surface, and the ends are the poles.
        expect(c.diverging).toHaveLength(7);
        expect(c.diverging[0]).toBe(diverging[0].toUpperCase());
        expect(c.diverging[6]).toBe(diverging[1].toUpperCase());
        const middle = contrast(c.diverging[3]!, c.surface);
        expect(c.diverging.every((step) => contrast(step, c.surface) >= middle)).toBe(true);
      });
    }
  }

  for (const order of SERIES_ORDER_NAMES) {
    it(`${order}: any two of the first five series can be told apart, neighbours or not, and no two are blues`, () => {
      const hues: readonly HueName[] = SERIES_ORDERS[order];
      for (const mode of ["light", "dark"] as const) {
        const first = hues.slice(0, LEGEND_SLOTS).map((hue) => HUES[hue][mode]);
        for (let i = 0; i < first.length; i++) {
          for (let j = i + 1; j < first.length; j++) {
            expect(colorDistance(first[i]!, first[j]!), `${hues[i]} and ${hues[j]}, ${mode}`).toBeGreaterThanOrEqual(LEGEND_FLOOR);
            // With red-green colour blindness too: the hues differ in lightness where their hue would fall together.
            for (const kind of ["protan", "deutan"] as const) expect(colorDistance(first[i]!, first[j]!, kind), `${hues[i]} and ${hues[j]}, ${mode}, ${kind}`).toBeGreaterThanOrEqual(CVD_TARGET);
          }
        }
      }
      // Blue, indigo and purple are one colour with red-green colour blindness and close without it.
      expect(hues.slice(0, LEGEND_SLOTS).filter((hue) => hue === "blue" || hue === "indigo" || hue === "purple").length).toBeLessThanOrEqual(1);
    });
  }

  it("moves a theme saved with the hues as they used to be to their current steps, and keeps colours a person chose", () => {
    const old = { ...HUES, ...RETIRED_HUES[0] } as typeof HUES;
    for (const name of SERIES_ORDER_NAMES) {
      for (const mode of ["light", "dark"] as const) {
        expect(currentSeries(SERIES_ORDERS[name].map((hue) => old[hue][mode]), mode), `${name} ${mode}`).toEqual(chartColors(name, mode).series);
      }
    }
    expect(currentHue(RETIRED_HUES[0]!.green!.light, "light")).toBe(HUES.green.light);
    expect(currentHue("#123456", "light")).toBe("#123456");
    expect(currentSeries(["#123456", "#654321"], "light")).toEqual(["#123456", "#654321"]);
  });

  it("warns when two of the first five differ only to an eye with full colour vision", () => {
    // Red and green at one lightness: far apart to most eyes, one colour with red-green colour blindness.
    const issues = checkSeries(["#217BF4", "#B27805", "#DE3B3D", "#9D57DE", "#029B29"], "#FFFFFF");
    expect(issues.filter((i) => i.severity === "warning" && /colour blindness/.test(i.message)).map((i) => i.slots)).toContainEqual([3, 5]);
  });

  it("flags two colours among the first five that are alike even when they are not neighbours", () => {
    // What a stack of five drew before: blue first and indigo third, red second and orange fourth.
    const issues = checkSeries([HUES.blue.dark, HUES.red.dark, HUES.indigo.dark, HUES.orange.dark, HUES.teal.dark], "#1A1A19");
    expect(issues.filter((i) => i.severity === "error").map((i) => i.slots)).toEqual([[1, 3], [2, 4]]);
    expect(issues[0]!.message).toMatch(/legend/);
  });

  it("flags palettes whose neighbours collide or that fade into the background", () => {
    const issues = checkSeries(["#2A78D6", "#2F7FDD", "#D03B3B", "#5A8F00", "#F2E9A0"], "#FFFFFF");
    expect(issues.map((i) => [i.severity, i.slots])).toEqual([
      ["error", [1, 2]],
      ["error", [3, 4]],
      ["warning", [5]],
    ]);
    expect(issues[1]!.message).toMatch(/colour blindness/);
  });

  it("builds ramps that work on light and dark surfaces", () => {
    const light = sequentialRamp("#2A78D6", "#FFFFFF");
    const dark = sequentialRamp("#3987E5", "#121211");
    expect(light).toHaveLength(7);
    expect(light[3]).toBe("#2A78D6");
    expect(luminance(light[0]!)).toBeGreaterThan(luminance(light[6]!));
    expect(luminance(dark[0]!)).toBeLessThan(luminance(dark[6]!));
    expect(divergingRamp(["#E34948", "#2A78D6"], "#FFFFFF", 5)).toHaveLength(5);
  });

  it("carries chart colours through the theme, its variables and the chart library's theme", () => {
    const dusk = presetByName("Ink")!;
    const vars = themeVars(dusk, "light");
    expect(vars["--sf-series-1"]).toBe("#696BF4");
    expect(vars["--sf-sequential-7"]).toBeDefined();
    expect(vars["--sf-diverging-4"]).toBeDefined();
    const chart = echartsTheme(dusk, "dark") as { color: string[]; visualMap: { inRange: { color: string[] } } };
    expect(chart.color[0]).toBe(HUES.indigo.dark);
    expect(chart.visualMap.inRange.color).toHaveLength(7);

    const custom = withCharts(dusk, { ...dusk.charts, light: { ...dusk.charts.light, series: ["#111111", "#777777", "#BBBBBB"] } });
    expect(custom.name).toBe("Custom");
    expect(themeVars(custom, "light")["--sf-series-3"]).toBe("#BBBBBB");
    expect(themeVars(custom, "light")["--sf-series-4"]).toBeUndefined();
  });

  it("checks chart colours from untrusted themes and fills in those saved before charts were themed", () => {
    const old = { name: "Old", light: defaultTheme.light, dark: defaultTheme.dark, radius: 4, font: "system", density: "compact" };
    expect(parseTheme(old, defaultTheme).charts).toEqual(defaultTheme.charts);
    expect(() => parseTheme({ charts: { light: { series: ["#123456"] } } }, defaultTheme)).toThrow("theme.charts.light.series must be a list of 2 to 12 colours");
    expect(() => parseTheme({ charts: { dark: { series: ["#123456", "url(x)"] } } }, defaultTheme)).toThrow("theme.charts.dark.series[1]");
    expect(parseTheme({ charts: { light: { series: ["#abc", "#DEF"] } } }, defaultTheme).charts.light.series).toEqual(["#AABBCC", "#DDEEFF"]);
  });
});

describe("target size", () => {
  it("keeps every pressable thing at or above the WCAG 2.2 minimum, larger for touch", async () => {
    const { TARGET_MIN, TARGET_MIN_TOUCH, themeCss } = await import("./css.js");
    expect(TARGET_MIN).toBeGreaterThanOrEqual(24);
    expect(TARGET_MIN_TOUCH).toBeGreaterThanOrEqual(44);
    const css = themeCss(defaultTheme);
    expect(css).toContain("--sf-target-min: 24px;");
    expect(css).toMatch(/@media \(pointer: coarse\) \{\n:root \{\n {2}--sf-target-min: 44px;/);
  });

  it("sizes controls by density, never under the minimum", async () => {
    const { TARGET_MIN, themeVars } = await import("./css.js");
    const size = (density: "comfortable" | "compact") => Number.parseInt(themeVars({ ...defaultTheme, density }, "light")["--sf-control-size"]!, 10);
    expect(size("compact")).toBeGreaterThanOrEqual(TARGET_MIN);
    expect(size("comfortable") - size("compact")).toBeGreaterThanOrEqual(8);
  });
});

describe("code colours", () => {
  it("reads at 4.5:1 on the background and the surface in every preset and mode", () => {
    for (const theme of presets) {
      for (const mode of ["light", "dark"] as const) {
        const c = resolveTheme(theme)[mode];
        for (const [token, color] of Object.entries(c.code)) {
          expect(contrast(color, c.background), `${theme.name} ${mode} ${token}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(color, c.surface), `${theme.name} ${mode} ${token}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("takes a theme's own colours, keeps them readable, and refuses unknown tokens", () => {
    const theme = parseTheme({ code: { dark: { keyword: "#FF00FF", string: "#111111" } } }, presets[0]!);
    const dark = resolveTheme(theme).dark;
    expect(dark.code.keyword).toBe(ensureContrast(ensureContrast("#FF00FF", dark.background, 4.5), dark.surface, 4.5));
    expect(contrast(dark.code.string, dark.background)).toBeGreaterThanOrEqual(4.5);
    expect(themeVars(theme, "dark")["--sf-code-keyword"]).toBe(dark.code.keyword);
    expect(() => parseTheme({ code: { light: { bogus: "#000000" } } }, presets[0]!)).toThrow(/not a code token/);
  });
});

describe("retired series orders", () => {
  it("moves a theme saved with Aurora's old order to its current one, and keeps colours a person chose", () => {
    const old = ["teal", "orange", "blue", "red", "indigo", "amber", "purple", "green"] as const;
    const saved = { ...presets.find((p) => p.name === "Aurora")!, charts: { light: { ...chartColors("Aurora", "light"), series: old.map((h) => HUES[h].light) }, dark: { ...chartColors("Aurora", "dark"), series: old.map((h) => HUES[h].dark) } } };
    const parsed = parseTheme(saved, defaultTheme);
    expect(parsed.charts.dark.series).toEqual(chartColors("Aurora", "dark").series);
    expect(parsed.charts.dark.series[2]).toBe(HUES.magenta.dark);
    const chosen = { ...saved, charts: { light: { ...saved.charts.light, series: [HUES.blue.light, HUES.red.light] }, dark: { ...saved.charts.dark, series: [HUES.blue.dark, HUES.red.dark] } } };
    expect(parseTheme(chosen, defaultTheme).charts.dark.series).toEqual([HUES.blue.dark, HUES.red.dark]);
  });
});

describe("retired series orders, all of them", () => {
  it("moves every order's earlier form to its current one, in both modes", () => {
    for (const [name, earlier] of Object.entries(RETIRED_ORDERS) as [SeriesOrderName, HueName[][]][]) {
      for (const hues of earlier) {
        for (const mode of ["light", "dark"] as const) {
          expect(currentSeries(hues.map((hue) => HUES[hue][mode]), mode), `${name} ${mode}`).toEqual(chartColors(name, mode).series);
        }
      }
    }
  });
});

describe("retired preset greys", () => {
  it("moves a saved Sand or Ink with the old greys to the current ones, keeping its accent", () => {
    const sand = presets.find((p) => p.name === "Sand")!;
    const saved = { ...sand, light: { ...sand.light, background: "#F8F9F5", surface: "#ECEFE6", text: "#1C1E18", muted: "#5D6255" }, dark: { ...sand.dark, background: "#11130F", surface: "#1B1E18", text: "#F1F3EC", muted: "#A6AB9D", onAccent: "#11130F", accent: "#FF0000" } };
    const loaded = parseTheme(JSON.parse(JSON.stringify(saved)), defaultTheme);
    expect(loaded.light).toEqual(sand.light);
    expect(loaded.dark).toEqual({ ...sand.dark, accent: "#FF0000" });
    const ink = presets.find((p) => p.name === "Ink")!;
    const oldInk = { ...ink, dark: { ...ink.dark, background: "#0A0B18", surface: "#141629", onAccent: "#0A0B18" } };
    expect(parseTheme(JSON.parse(JSON.stringify(oldInk)), defaultTheme).dark).toEqual(ink.dark);
  });

  it("moves every preset saved with its earlier greys to its current ones", () => {
    for (const preset of presets)
      for (const mode of ["light", "dark"] as const) {
        const now = preset[mode];
        // Today's greys load unchanged.
        expect(parseTheme(JSON.parse(JSON.stringify(preset)), defaultTheme)[mode], `${preset.name} ${mode}`).toEqual(now);
      }
    const aurora = presets.find((p) => p.name === "Aurora")!;
    const before = { ...aurora, dark: { ...aurora.dark, background: "#050B0D", surface: "#0D1619", onAccent: "#050B0D" } };
    expect(parseTheme(JSON.parse(JSON.stringify(before)), defaultTheme).dark).toEqual(aurora.dark);
  });

  it("leaves greys a person changed alone", () => {
    const sand = presets.find((p) => p.name === "Sand")!;
    const edited = { ...sand, dark: { ...sand.dark, background: "#11130F", surface: "#222222", text: "#F1F3EC", muted: "#A6AB9D", onAccent: "#11130F" } };
    expect(parseTheme(JSON.parse(JSON.stringify(edited)), defaultTheme).dark.surface).toBe("#222222");
  });
});
