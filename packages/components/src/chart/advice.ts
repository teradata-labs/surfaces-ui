import type { ChartType } from "./option.js";

/** What a chart is about to draw, in the terms the advice needs. */
export interface ChartShape {
  type: ChartType;
  /** Distinct values on the x axis (or slices of a pie). */
  categories?: number;
  /** Series drawn, after any split. */
  series?: number;
  stacked?: boolean;
  /** True when a measure is on a second y scale. */
  rightAxis?: boolean;
  /** True when x is a date, time or number, so its order means something. */
  orderedX?: boolean;
  /** True when the value axis has been told to start somewhere other than zero. */
  truncatedAxis?: boolean;
  /** True when x is a numeric column grouped into bins (a histogram). */
  binned?: boolean;
  /** Where the legend was asked for, when it was; left out, the chart chooses. */
  legend?: "top" | "bottom" | "right" | "none";
}

export interface ChartAdvice {
  rule: "pie-slices" | "two-scales" | "bar-baseline" | "line-order" | "too-many-lines" | "stack-depth" | "bar-crowding" | "overlapping-areas" | "bars-over-time" | "pie-in-order" | "one-series-legend";
  message: string;
  /** What to draw instead. */
  instead: string;
}

/**
 * Checks a chart against the working rules of Edward Tufte and Stephen Few:
 * show the data honestly, compare like with like, and spend ink only on
 * data. It returns advice, not errors; a person or an agent decides.
 */
export function chartAdvice(shape: ChartShape): ChartAdvice[] {
  const advice: ChartAdvice[] = [];
  const { type, categories = 0, series = 1 } = shape;
  if (type === "pie" && categories > 5) {
    advice.push({ rule: "pie-slices", message: `${categories} slices are too many to compare by angle.`, instead: "A bar chart sorted by value." });
  }
  if (shape.rightAxis) {
    advice.push({
      rule: "two-scales",
      message: "Two y scales make heights look comparable when they are not.",
      instead: "Two charts stacked on the same x axis, or both measures indexed to a common start.",
    });
  }
  if (type === "bar" && shape.truncatedAxis) {
    advice.push({ rule: "bar-baseline", message: "A bar's length is its value, so the axis must start at zero.", instead: "Start at zero, or use a dot or line chart if the differences are small." });
  }
  if ((type === "line" || type === "area") && shape.orderedX === false) {
    advice.push({ rule: "line-order", message: "A line implies order between its points; these categories have none.", instead: "A bar chart." });
  }
  if (type === "line" && series > 5) {
    advice.push({ rule: "too-many-lines", message: `${series} lines cross too often to follow.`, instead: "Small multiples on one shared scale, or highlight one line and grey the rest." });
  }
  if (shape.stacked && series > 5) {
    advice.push({ rule: "stack-depth", message: `Only the bottom of ${series} stacked segments can be compared across bars.`, instead: "Keep the largest four and fold the rest into Other, or use small multiples." });
  }
  if (type === "bar" && !shape.stacked && categories * series > 40) {
    advice.push({ rule: "bar-crowding", message: "Too many bars to read individually.", instead: "The top values sorted by size, or a table." });
  }
  if (type === "area" && !shape.stacked && series > 1) {
    advice.push({ rule: "overlapping-areas", message: "Unstacked areas hide each other.", instead: "Lines, or a stacked area if the total matters." });
  }
  if (type === "bar" && shape.orderedX && !shape.binned && categories > 24) {
    advice.push({ rule: "bars-over-time", message: `${categories} bars in a row hide the trend they make.`, instead: "A line, with a time grain coarse enough for the decision." });
  }
  if (type === "pie" && shape.orderedX) {
    advice.push({ rule: "pie-in-order", message: "A pie puts its slices round a circle, so the order of these values is lost.", instead: "A line or bars, in the order of x." });
  }
  if (type !== "pie" && series === 1 && shape.legend && shape.legend !== "none") {
    advice.push({ rule: "one-series-legend", message: "A legend for one series repeats what the title says.", instead: "Leave the legend out and name the measure in the title." });
  }
  return advice;
}
