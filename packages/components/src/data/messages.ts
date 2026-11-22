/**
 * What a data component says to the people using the page when its query
 * answers with no rows or fails, written by whoever designs the page. Left
 * out, the component says its own. The engine's error text is never lost:
 * it stays on the alert as `data-error` (and in `onInfo` for `DataGrid`),
 * for developers, while people read `errorMessage`.
 */
export interface DataMessages {
  /** Shown in place of the component's own empty text when the query answers with no rows. */
  emptyMessage?: string;
  /** Shown in place of the engine's error text when the query fails. */
  errorMessage?: string;
}
