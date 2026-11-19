import { StaleSurfaceError, surfaceKindOf, surfaceKinds } from "@surfaces-ui/data";
import { type PageDocument, type SurfaceKindName, analyticsCatalog, surfaceKind, validatePage } from "@surfaces-ui/spec";
import { type FormEvent, useId, useMemo, useState } from "react";
import { documentOf, surfaceLink } from "./libraryLinks.js";
import type { ActiveSource } from "./source.js";

export interface SaveToLibraryProps {
  source: ActiveSource;
  /** The page as it is now. */
  page: PageDocument;
  /** The kind to file it under; defaults to what `surfaceKind` guesses from its components. */
  defaultKind?: SurfaceKindName;
  /** Tags offered at first, such as the dataset. */
  defaultTags?: string[];
  /** When an agent proposed the page, which one. A person still presses Save. */
  generatedBy?: string;
  /** Button text. */
  label?: string;
}

const parseTags = (text: string) => [...new Set(text.split(",").map((t) => t.trim()).filter(Boolean))];

/**
 * A "Save to library" button that opens a small form: title, kind, tags and
 * a note. The first save makes a new surface; later saves from the same form
 * add versions to it, and a save that lost a race says to reload.
 */
export function SaveToLibrary({ source, page, defaultKind, defaultTags = [], generatedBy = "", label = "Save to library" }: SaveToLibraryProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const guessed = useMemo(() => defaultKind ?? surfaceKind(page), [defaultKind, page]);
  const [title, setTitle] = useState(page.title);
  const [kind, setKind] = useState<SurfaceKindName>(guessed);
  const [tags, setTags] = useState(defaultTags.join(", "));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState<{ id: string; version: number } | undefined>();
  const issues = useMemo(() => validatePage(page, analyticsCatalog), [page]);

  const toggle = () => {
    if (!open) {
      setTitle((current) => current || page.title);
      setKind(guessed);
    }
    setOpen(!open);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || issues.length > 0) return;
    setBusy(true);
    setError(undefined);
    try {
      const { surface } = await source.library.saveSurface({
        surface: {
          id: saved?.id ?? "",
          kind: surfaceKindOf(kind),
          title: title.trim() || page.title || "Untitled",
          description: page.description ?? "",
          document: documentOf({ ...page, title: title.trim() || page.title }),
          tags: parseTags(tags),
          savedBy: "Playground user",
          generatedBy,
        },
        expectedVersion: saved?.version ?? 0,
        note: note.trim(),
      });
      if (surface) setSaved({ id: surface.id, version: surface.version });
      setNote("");
    } catch (failure) {
      setError(
        failure instanceof StaleSurfaceError
          ? `Someone saved a newer version (${failure.latest}) since this form last saved. Reload the library to see it, then save again.`
          : failure instanceof Error
            ? failure.message
            : String(failure),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="save-library">
      <button type="button" className="sf-button" aria-expanded={open} aria-controls={`${id}-form`} onClick={toggle}>
        {label}
      </button>
      {saved && (
        <p className="hint" role="status">
          Saved as version {saved.version}. <a href={surfaceLink(saved.id)}>Open in the library</a>
        </p>
      )}
      {open && (
        <form id={`${id}-form`} className="save-library-form" onSubmit={(e) => void submit(e)} aria-label="Save to library">
          <label>
            <span>Title</span>
            <input className="sf-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            <span>Kind</span>
            <select className="sf-input" value={kind} onChange={(e) => setKind(e.target.value as SurfaceKindName)}>
              {surfaceKinds.map((k) => (
                <option key={k.word} value={k.word}>
                  {k.label}
                  {k.word === guessed ? " (guessed)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tags</span>
            <input className="sf-input" value={tags} onChange={(e) => setTags(e.target.value)} aria-describedby={`${id}-tags`} />
            <span id={`${id}-tags`} className="hint">
              Separate tags with commas.
            </span>
          </label>
          <label>
            <span>Note</span>
            <input className="sf-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed" />
          </label>
          {issues.length > 0 && (
            <div className="save-library-issues" role="alert">
              <p>This page cannot be saved until the catalog accepts it:</p>
              <ul>
                {issues.slice(0, 6).map((issue) => (
                  <li key={`${issue.path}:${issue.message}`}>
                    <code>{issue.path}</code> {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p className="save-library-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="sf-button" data-variant="primary" disabled={busy || issues.length > 0}>
              {busy ? "Saving…" : saved ? `Save version ${saved.version + 1}` : "Save"}
            </button>
            <button type="button" className="sf-button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
