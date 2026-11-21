import { z } from "zod";
import { type FunctionImpl, absolutePath, getPath } from "./dynamic.js";

export interface FunctionDefinition {
  description: string;
  args: z.ZodRawShape;
  returnType: "string" | "number" | "boolean" | "void";
  /** True for functions that act (open a link) instead of computing a value. */
  action?: boolean;
  implementation: FunctionImpl;
}

const number = (value: unknown) => (typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : Number(value));

/** Only http(s) links may be opened from agent-written UI. */
export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** Functions available to every Surfaces catalog. Names and arguments follow the A2UI basic catalog. */
export const standardFunctions: Record<string, FunctionDefinition> = {
  formatString: {
    description:
      'Builds text from a template. "${path}" is replaced by the data model value at that path. "${path|not chosen yet}" gives the words to use while there is no value there (nothing, or empty text), so a summary of a form never reads as a gap.',
    args: { value: z.string() },
    returnType: "string",
    implementation: (args, context) =>
      String(args.value ?? "").replace(/\$\{([^}]*)\}/g, (_, inner: string) => {
        // The first bar ends the path: what follows it stands in for a value that is not there.
        const bar = inner.indexOf("|");
        const path = bar === -1 ? inner : inner.slice(0, bar);
        const fallback = bar === -1 ? "" : inner.slice(bar + 1).trim();
        const found = getPath(context.data, absolutePath(path.trim(), context.scope));
        return found == null || typeof found === "object" || found === "" ? fallback : String(found);
      }),
  },
  formatNumber: {
    description: "Formats a number with grouping and a fixed number of decimals.",
    args: { value: z.unknown(), decimals: z.number().optional(), grouping: z.boolean().optional() },
    returnType: "string",
    implementation: (args) => {
      const value = number(args.value);
      if (!Number.isFinite(value)) return "";
      const decimals = typeof args.decimals === "number" ? args.decimals : undefined;
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals ?? 2,
        useGrouping: args.grouping !== false,
      }).format(value);
    },
  },
  formatCurrency: {
    description: "Formats a number as money in the given ISO 4217 currency.",
    args: { value: z.unknown(), currency: z.string() },
    returnType: "string",
    implementation: (args) => {
      const value = number(args.value);
      if (!Number.isFinite(value)) return "";
      try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: String(args.currency ?? "USD") }).format(value);
      } catch {
        return String(value);
      }
    },
  },
  formatDate: {
    description: 'Formats a date or time. "format" is "date", "time" or "datetime".',
    args: { value: z.unknown(), format: z.enum(["date", "time", "datetime"]).optional() },
    returnType: "string",
    implementation: (args) => {
      const date = new Date(args.value as string | number);
      if (Number.isNaN(date.getTime())) return "";
      const format = args.format ?? "date";
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: format === "time" ? undefined : "medium",
        timeStyle: format === "date" ? undefined : "short",
        timeZone: "UTC",
      }).format(date);
    },
  },
  openUrl: {
    description: "Opens a web link in a new tab. Only http and https links are allowed.",
    args: { url: z.string() },
    returnType: "void",
    action: true,
    implementation: (args) => {
      const url = safeUrl(args.url);
      if (url && typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
    },
  },
};
