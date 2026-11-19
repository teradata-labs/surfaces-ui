import { type SeriesOrderName, chartColors } from "./charts.js";
import type { Theme } from "./theme.js";

const charts = (order: SeriesOrderName): Theme["charts"] => ({ light: chartColors(order, "light"), dark: chartColors(order, "dark") });

/**
 * Built-in themes. `defaultTheme` is the first.
 *
 * The chrome is deliberately quiet: near-neutral surfaces with a slight tint
 * of the accent's family and one accent, so that the colour on a page is the
 * data. Each preset's charts open with the hue of its accent and then follow
 * an order tested for telling neighbours apart, so a page and its charts read
 * as one design.
 */
export const presets: readonly Theme[] = [
  {
    // Cool ink type on near-neutral greys with a trace of blue, one indigo accent.
    name: "Ink",
    light: { background: "#FBFBFC", surface: "#F0F0F2", text: "#141633", muted: "#565A78", accent: "#5B4FE0", onAccent: "#FFFFFF" },
    dark: { background: "#0C0C0F", surface: "#17181B", text: "#ECEDFB", muted: "#9EA2C2", accent: "#909AFE", onAccent: "#0C0C0F" },
    radius: 10,
    font: "system",
    density: "comfortable",
    charts: charts("Ink"),
  },
  {
    // The demo theme: deep blue-green surfaces in the dark and a bright teal accent, so charts carry the colour.
    name: "Aurora",
    light: { background: "#FAFCFC", surface: "#EFF3F3", text: "#0E2226", muted: "#4E6468", accent: "#07796F", onAccent: "#FFFFFF" },
    dark: { background: "#070B0C", surface: "#111517", text: "#E6F4F5", muted: "#93ABAF", accent: "#2FD3B5", onAccent: "#050B0D" },
    radius: 12,
    font: "system",
    density: "comfortable",
    charts: charts("Aurora"),
  },
  {
    // Natural greys with a warm yellow tint, like paper and sand, and a burnt orange accent with some brown in it.
    name: "Sand",
    light: { background: "#F9F9F6", surface: "#EFEEE9", text: "#201D11", muted: "#666046", accent: "#A55200", onAccent: "#FFFFFF" },
    dark: { background: "#13120F", surface: "#1D1D1A", text: "#F5F2E5", muted: "#B0A98E", accent: "#F99532", onAccent: "#14120A" },
    radius: 10,
    font: "system",
    density: "comfortable",
    charts: charts("Sand"),
  },
  {
    // A deep pink-purple accent on plum-tinted greys; in the dark the greys turn warm, toward wine.
    name: "Berry",
    light: { background: "#FBFAFB", surface: "#F1F0F1", text: "#261725", muted: "#695767", accent: "#9F2294", onAccent: "#FFFFFF" },
    dark: { background: "#100E0F", surface: "#1B191A", text: "#F7EDF2", muted: "#BCA2B0", accent: "#E375D6", onAccent: "#130C10" },
    radius: 14,
    font: "rounded",
    density: "comfortable",
    charts: charts("Berry"),
  },
  {
    // Cool slate greys and a clear blue accent, for the many brands that are blue.
    name: "Harbor",
    light: { background: "#FAFBFC", surface: "#EEF1F3", text: "#0F1F33", muted: "#4F5F74", accent: "#0066D6", onAccent: "#FFFFFF" },
    dark: { background: "#0A0C0F", surface: "#15181B", text: "#EAF1F8", muted: "#98AABD", accent: "#52A9FE", onAccent: "#090C11" },
    radius: 10,
    font: "system",
    density: "comfortable",
    charts: charts("Classic"),
  },
  {
    // Greys with a slight green tint, like moss on stone, and a green accent.
    name: "Moss",
    light: { background: "#F9FBFA", surface: "#EDF2EE", text: "#131C15", muted: "#506254", accent: "#15803D", onAccent: "#FFFFFF" },
    dark: { background: "#0C0E0B", surface: "#171916", text: "#EDF0E6", muted: "#A0A893", accent: "#7FD85E", onAccent: "#0C0E09" },
    radius: 12,
    font: "system",
    density: "comfortable",
    charts: charts("Moss"),
  },
  {
    // Black, white and greys only. The chrome has no hue at all: the accent is near-black
    // (near-white in dark) and magnitude is a grey ramp. Series keep the Classic hues, since greys cannot keep
    // eight series apart.
    name: "Mono",
    light: { background: "#FFFFFF", surface: "#EDEDED", text: "#000000", muted: "#2E2E2E", accent: "#1F1F1F", onAccent: "#FFFFFF" },
    dark: { background: "#000000", surface: "#1A1A1A", text: "#FFFFFF", muted: "#D6D6D6", accent: "#EDEDED", onAccent: "#000000" },
    radius: 6,
    font: "system",
    density: "compact",
    charts: {
      light: { ...chartColors("Classic", "light"), sequential: "#3D3D3D" },
      dark: { ...chartColors("Classic", "dark"), sequential: "#C2C2C2" },
    },
  },
  {
    // For people who need more contrast, whatever their system says: pure black and white, every edge drawn,
    // quieter labels darker, glass solid. The chrome has no colour at all (the accent is black, or white in the dark),
    // so the only colour on screen is the data.
    name: "High contrast",
    light: { background: "#FFFFFF", surface: "#F2F2F2", text: "#000000", muted: "#262626", accent: "#000000", onAccent: "#FFFFFF" },
    dark: { background: "#000000", surface: "#121212", text: "#FFFFFF", muted: "#E6E6E6", accent: "#FFFFFF", onAccent: "#000000" },
    radius: 8,
    font: "system",
    density: "comfortable",
    charts: {
      light: { ...chartColors("Classic", "light"), sequential: "#333333" },
      dark: { ...chartColors("Classic", "dark"), sequential: "#CCCCCC" },
    },
    contrast: "more",
  },
];

export const defaultTheme: Theme = presets[0]!;

export function presetByName(name: string): Theme | undefined {
  return presets.find((p) => p.name.toLowerCase() === name.toLowerCase());
}
