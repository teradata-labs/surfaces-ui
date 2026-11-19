import { mix } from "./color.js";
import { resolveTheme } from "./derive.js";
import type { Theme } from "./theme.js";

/**
 * An ECharts theme object for one mode of a theme. Register it with
 * `echarts.registerTheme(name, echartsTheme(theme, mode))` or pass it to
 * `echarts.init(el, themeObject)`.
 *
 * It is a plain object with no dependency on ECharts, so it can be built on a
 * server or handed to an agent.
 */
export function echartsTheme(theme: Theme, mode: "light" | "dark"): Record<string, unknown> {
  const t = resolveTheme(theme);
  const c = t[mode];
  const textStyle = { color: c.text, fontFamily: t.fontFamily, fontSize: t.scale.fontSize - 2 };
  const axis = {
    axisLine: { show: true, lineStyle: { color: c.borderStrong } },
    axisTick: { show: false },
    axisLabel: { color: c.muted, fontFamily: t.fontFamily },
    splitLine: { show: true, lineStyle: { color: c.border } },
    splitArea: { show: false },
    nameTextStyle: { color: c.muted },
  };
  return {
    color: c.series,
    // Motion is short and eases out: marks settle, they do not bounce.
    animationDuration: 420,
    animationDurationUpdate: 280,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    backgroundColor: "transparent",
    textStyle,
    title: {
      textStyle: { color: c.text, fontFamily: t.fontFamily, fontWeight: 600 },
      subtextStyle: { color: c.muted, fontFamily: t.fontFamily },
    },
    legend: { textStyle: { color: c.muted, fontFamily: t.fontFamily }, inactiveColor: c.borderStrong },
    tooltip: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      textStyle: { color: c.text, fontFamily: t.fontFamily, fontSize: t.scale.fontSize - 1 },
      padding: [t.scale.unit * 2, t.scale.unit * 3],
      extraCssText: `border-radius: ${Math.min(t.radius, 12)}px; box-shadow: none;`,
      axisPointer: { lineStyle: { color: c.borderStrong }, crossStyle: { color: c.borderStrong } },
    },
    categoryAxis: { ...axis, splitLine: { show: false } },
    valueAxis: { ...axis, axisLine: { show: false } },
    timeAxis: { ...axis, splitLine: { show: false } },
    logAxis: { ...axis, axisLine: { show: false } },
    // Marks are thin, and fills that touch are kept apart by a sliver of the surface they sit on.
    // A name at the end of a line is text: it wears the text colour, and the line beside it carries the identity.
    line: { symbol: "circle", symbolSize: 6, lineStyle: { width: 2 }, smooth: false, emphasis: { scale: 1.6 }, endLabel: { color: c.text, fontFamily: t.fontFamily, textBorderWidth: 0 } },
    bar: { barMaxWidth: 40, itemStyle: { borderRadius: [Math.min(t.radius, 4), Math.min(t.radius, 4), 0, 0], borderColor: c.surface, borderWidth: 1 } },
    pie: { itemStyle: { borderColor: c.surface, borderWidth: 2 }, label: { color: c.text } },
    scatter: { symbolSize: 8, itemStyle: { borderColor: c.surface, borderWidth: 1 } },
    heatmap: { itemStyle: { borderColor: c.surface, borderWidth: 2 } },
    // Magnitude runs along one hue from faint to strong.
    visualMap: { textStyle: { color: c.muted }, inRange: { color: c.sequential } },
    dataZoom: {
      borderColor: c.border,
      backgroundColor: "transparent",
      dataBackground: { lineStyle: { color: c.borderStrong }, areaStyle: { color: c.border } },
      fillerColor: mix(c.background, c.accent, 0.2),
      handleStyle: { color: c.accent, borderColor: c.accent },
      textStyle: { color: c.muted },
    },
    toolbox: { iconStyle: { borderColor: c.muted }, emphasis: { iconStyle: { borderColor: c.accent } } },
  };
}
