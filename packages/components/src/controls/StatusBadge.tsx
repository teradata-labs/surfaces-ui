/** What a `StatusBadge` says about the thing it marks. */
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusBadgeProps {
  /** The status in a word or two: "On", "Turned off", "Admin". The words carry the meaning; the tone only backs them up. */
  label: string;
  /** "neutral" (the default), "info", "success", "warning" or "danger". */
  tone?: StatusTone;
  /** A sentence more, shown on hover and read after the label: "Turned off by Ana on 3 May". */
  description?: string;
  className?: string;
}

/**
 * A short status beside the thing it describes: an account on or turned off, a job running or failed. Marked by its
 * words and a shape as well as a colour, so it reads the same without colour. For data that is certified or
 * deprecated use `CertificationBadge`.
 */
export function StatusBadge({ label, tone = "neutral", description, className }: StatusBadgeProps) {
  return (
    <span className={["sf-status", className].filter(Boolean).join(" ")} data-tone={tone} title={description}>
      <span className="sf-status-mark" aria-hidden="true" />
      {label}
      {description && <span className="sf-visually-hidden">: {description}</span>}
    </span>
  );
}
