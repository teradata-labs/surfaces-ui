import type { ReactNode } from "react";

/**
 * Small outline icons for a workspace's rail, drawn in the text colour. A
 * panel names one; a panel that names none gets its first letter instead, so
 * every button on the rail can be told apart.
 */
const PATHS = {
  surface: "M4 5h16v14H4z M4 10h16 M10 10v9",
  agent: "M4 5h16v11H10l-5 4v-4H4z",
  components: "M4 5h16v4H4z M4 12h11v3H4z M4 18h14v2H4z",
  table: "M3 5h18v14H3z M3 10h18 M3 15h18 M9 5v14",
  code: "M9 4c-2 0-3 1-3 3v2c0 1.2-.8 2.2-2 3 1.2.8 2 1.8 2 3v2c0 2 1 3 3 3 M15 4c2 0 3 1 3 3v2c0 1.2.8 2.2 2 3-1.2.8-2 1.8-2 3v2c0 2-1 3-3 3",
  data: "M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6 M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3",
  history: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 8v4l3 2",
  save: "M5 4h11l3 3v13H5z M8 4v5h7V4 M8 20v-6h8v6",
  search: "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M20 20l-4.6-4.6",
  map: "M6 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M18 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M10 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M8 6.4l8 1.2 M6.8 7.9l2.6 8.2 M16.8 9.6l-5.6 6.8",
  chart: "M4 4v16h16 M8 16v-5 M12 16V8 M16 16v-9",
  grid: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  settings: "M4 7h9 M19 7h1 M4 17h3 M13 17h7 M16 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M10 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  note: "M7 3h8l4 4v14H7z M15 3v4h4 M10 12h6 M10 16h6",
  folder: "M3 6h6l2 2h10v11H3z",
  people: "M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5 M16 4.4a3.5 3.5 0 0 1 0 6.2 M18 14c2 .9 3.5 3.2 3.5 6",
} as const;

export type WorkspaceIconName = keyof typeof PATHS;
export const WORKSPACE_ICONS = Object.keys(PATHS) as WorkspaceIconName[];

/** A panel's icon: the named drawing, the panel's own node, or the first letter of its title. */
export function WorkspaceIcon({ icon, title }: { icon?: WorkspaceIconName | ReactNode; title: string }) {
  if (typeof icon === "string" && icon in PATHS) {
    return (
      <svg className="sf-workspace-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d={PATHS[icon as WorkspaceIconName]} />
      </svg>
    );
  }
  if (icon !== undefined && icon !== null && typeof icon !== "string") return <span className="sf-workspace-icon">{icon}</span>;
  return (
    <span className="sf-workspace-icon sf-workspace-icon-letter" aria-hidden="true">
      {(title.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
