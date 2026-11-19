import { type DataRef, FileBrowser, type FilePlace, ObjectBrowser } from "@surfaces-ui/components";
import { useId, useState } from "react";

export interface DataPanelProps {
  /** The source whose tables and storage are browsed. */
  sourceId?: string;
  sourceLabel?: string;
  /** Show the Tables tab. Default true when there is a source. */
  tables?: boolean;
  /** Show the Files tab. Default true. */
  files?: boolean;
  /** Extra places for the Files tab, such as folders already opened. */
  places?: FilePlace[];
  /** Offer a folder from the person's own computer. Default true. */
  local?: boolean;
  /** Hand tables, columns and files to the message being written. Names only. */
  onAttach(refs: DataRef[]): void;
  height?: number;
}

/** Tables and files to attach to a message, in two tabs. */
export function DataPanel({ sourceId, sourceLabel, tables = !!sourceId, files = true, places, local = true, onAttach, height = 320 }: DataPanelProps) {
  const tabs = [tables && sourceId ? ("tables" as const) : undefined, files ? ("files" as const) : undefined].filter((t) => t !== undefined);
  const [tab, setTab] = useState<"tables" | "files">(tabs[0] ?? "files");
  const id = useId();
  if (tabs.length === 0) return <p className="sf-chat-data-empty">Choose a data connection to browse its tables.</p>;
  const shown = tabs.includes(tab) ? tab : tabs[0]!;
  return (
    <div className="sf-chat-data">
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Data" className="sf-chat-tabs">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`${id}-${t}`}
              aria-selected={t === shown}
              aria-controls={`${id}-${t}-panel`}
              tabIndex={t === shown ? 0 : -1}
              className="sf-chat-tab"
              onClick={() => setTab(t)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  const next = tabs[(tabs.indexOf(t) + 1) % tabs.length]!;
                  setTab(next);
                  document.getElementById(`${id}-${next}`)?.focus();
                }
              }}
            >
              {t === "tables" ? "Tables" : "Files"}
            </button>
          ))}
        </div>
      )}
      <div role={tabs.length > 1 ? "tabpanel" : undefined} id={`${id}-${shown}-panel`} aria-labelledby={tabs.length > 1 ? `${id}-${shown}` : undefined}>
        {shown === "tables" && sourceId ? (
          <ObjectBrowser key={sourceId} sourceId={sourceId} height={height} attachLabel="Add to message" onAttach={(refs) => onAttach(refs)} />
        ) : (
          <FileBrowser key={sourceId ?? "local"} sourceId={sourceId} sourceLabel={sourceLabel} places={places} local={local} height={height} attachLabel="Add to message" onAttach={(refs) => onAttach(refs)} />
        )}
      </div>
    </div>
  );
}
