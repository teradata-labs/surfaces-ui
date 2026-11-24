/** Notices a view's readers should see: a filter it could not take, because its rows lack the column. */
const SHOWN = new Set(["FILTER_COLUMN_MISSING"]);

/** The notice messages from a result header that are for the people reading the view. */
export function dataNotes(notices: readonly { code: string; message: string }[] | undefined): string[] {
  return [...new Set((notices ?? []).filter((n) => SHOWN.has(n.code)).map((n) => n.message))];
}

/**
 * Says under a view what it was not filtered by, in words: a page-wide filter
 * on a column the view's rows lack is left out by the engine, and the view is
 * drawn without it rather than failing.
 */
export function DataNotes({ notes }: { notes: readonly string[] | undefined }) {
  if (!notes || notes.length === 0) return null;
  return (
    <span className="sf-data-note" role="note">
      {notes.join(" ")}
    </span>
  );
}
