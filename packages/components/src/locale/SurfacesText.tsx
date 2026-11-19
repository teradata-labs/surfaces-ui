import type { ReactNode } from "react";
import { type Labels, resetLabels, setLabels, setLocale } from "./locale.js";

export interface SurfacesTextProps {
  /** BCP 47 locale for every number and date the components write, such as "de-DE". Defaults to "en-US". */
  locale?: string;
  /** Words to use instead of the English defaults, by label name (see `defaultLabels`). */
  labels?: Partial<Labels>;
  children?: ReactNode;
}

/**
 * Sets the locale and the words for the components inside it. It applies
 * them as it renders, before its children render, so no effect or context is
 * needed. Both are page-wide: use one `SurfacesText` (or one locale) per page.
 * Words not given in `labels` go back to English, so it owns every label
 * while it is mounted.
 */
export function SurfacesText({ locale, labels, children }: SurfacesTextProps) {
  setLocale(locale ?? "en-US");
  resetLabels();
  if (labels) setLabels(labels);
  return <>{children}</>;
}
