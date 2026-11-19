import { type DataRef, FileBrowser, type FileItem, type FilePlace, fileSize } from "@surfaces-ui/components";
import { useState } from "react";
import type { SeedWorkingCopy } from "./areas/SeedsPanel.js";
import type { ActiveSource } from "./source.js";

const READABLE = new Set(["parquet", "csv", "json"]);

/**
 * Folders and files beside the tables: the picked source's storage (where
 * the backend can list it) and folders opened from this computer. A file
 * can be handed to a chat by name. A Parquet, CSV or JSON file from this
 * computer can be loaded as a table when DuckDB runs in this page; with the
 * dev server it stays in the browser, and the panel says so.
 */
export function FilesPanel({ source, onAttach, attachLabel, height = 420 }: { source: ActiveSource; onAttach?(refs: DataRef[]): void; attachLabel?: string; height?: number }) {
  const [status, setStatus] = useState<{ text: string; error?: boolean }>({ text: "" });
  const label = source.sources.find((s) => s.id === source.sourceId)?.label ?? source.sourceId;
  const copy = (source as ActiveSource & { seedCopy?: SeedWorkingCopy }).seedCopy;
  const canLoad = source.kind === "browser" && !!copy;

  const loadLocal = async (item: FileItem) => {
    if (!item.file || !copy) return;
    setStatus({ text: `Loading ${item.name}…` });
    try {
      const names = await copy.addFiles(source.sourceId, [item.file]);
      setStatus({ text: `Loaded ${item.name} as table ${names.join(", ")} in ${label}, in this page only. Every area can query it now.` });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true });
    }
  };

  const open = (item: FileItem, place: FilePlace) => {
    const about = [item.format ? item.format.toUpperCase() : "", fileSize(item.size)].filter(Boolean).join(", ");
    if (place.origin === "local") {
      if (item.format && READABLE.has(item.format) && canLoad) return void loadLocal(item);
      return setStatus({
        text:
          item.format && READABLE.has(item.format)
            ? `${item.name} (${about}) is on this computer and stays in this browser. The dev server cannot read it: add it to a source in surfaces.config.ts, or stop the server to load it into DuckDB in this page.`
            : `${item.name}${about ? ` (${about})` : ""} is not a Parquet, CSV or JSON file, so it cannot be loaded as a table.`,
      });
    }
    setStatus({
      text: item.table
        ? `${item.name} is read by the table ${item.table}.`
        : item.format
          ? `${item.name} (${about}) is not a table yet. Add a table entry for it to this source in surfaces.config.ts to query it; Sources has a wizard that writes the entry.`
          : `${item.name}${about ? ` (${about})` : ""}: ${item.path}`,
    });
  };

  return (
    <div className="files-panel">
      <FileBrowser
        key={source.sourceId}
        sourceId={source.sourceId}
        sourceLabel={`${label} storage`}
        local
        height={height}
        onOpen={open}
        onAttach={onAttach ? (refs) => onAttach(refs) : undefined}
        attachLabel={attachLabel}
        renderActions={(item, place) =>
          place.origin === "local" && canLoad && item.format && READABLE.has(item.format) ? (
            <button type="button" className="sf-button" onClick={() => void loadLocal(item)}>
              Load
            </button>
          ) : null
        }
      />
      {status.text && (
        <p className={status.error ? "catalog-error" : "hint"} role={status.error ? "alert" : "status"}>
          {status.text}
        </p>
      )}
      <p className="hint">
        Only names, sizes and dates are listed, never what a file holds. A folder from this computer is read by this browser and nothing is uploaded.
        {onAttach ? " Drag files onto the message box, or use Shift+Enter, to say what a message is about." : ""}
      </p>
    </div>
  );
}
