/**
 * The locale every number and date in the components is written in, and the
 * words they show. Both are page-wide: one locale and one set of words per
 * page. A host sets them once, before the components render, with
 * `setLocale` and `setLabels` or the `SurfacesText` component.
 */

let current = "en-US";
const formats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * Sets the locale (a BCP 47 tag such as "de-DE") for every number and date the
 * components write. Platform forms with an underscore ("en_US", as iOS and
 * Android write them) are accepted.
 */
export function setLocale(locale: string): void {
  // Throws a RangeError on a malformed tag here rather than on the next render.
  current = Intl.getCanonicalLocales(locale.replaceAll("_", "-"))[0] ?? "en-US";
}

/** The locale numbers and dates are written in. Defaults to "en-US". */
export function getLocale(): string {
  return current;
}

/** A number format in the current locale, kept for reuse. Call it when formatting, not once at load, so a later `setLocale` applies. */
export function numberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${current}|${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(current, options);
    formats.set(key, format);
  }
  return format;
}

/** A date and time format in the current locale, kept for reuse. */
export function dateFormat(options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const key = `${current}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(current, options);
    dateFormats.set(key, format);
  }
  return format;
}

/**
 * Every word the data-display components show, in English. `{name}` marks a
 * value filled in when the words are shown. Replace any of them with
 * `setLabels`, for another language or plainer words.
 */
export const defaultLabels = {
  // Cell values
  "cell.null": "null",
  "cell.true": "true",
  "cell.false": "false",

  // DataGrid
  "grid.label": "Query result",
  "grid.sortAscending": "Sort ascending",
  "grid.sortDescending": "Sort descending",
  "grid.clearSorting": "Clear sorting",
  "grid.moveLeft": "Move left",
  "grid.moveRight": "Move right",
  "grid.hideColumn": "Hide column",
  "grid.showAllColumns": "Show all columns",
  "grid.showAllColumnsHidden": "Show all columns ({count} hidden)",
  "grid.resetWidth": "Reset width",
  "grid.resetWidthHint": "Double-click edge",
  "grid.resetLayout": "Reset column layout",
  "grid.copyColumnName": "Copy column name",
  "grid.sqlCountValues": "SQL: count each value",
  "grid.sqlRange": "SQL: range and missing values",
  "grid.copyValue": "Copy value",
  "grid.copyRowJson": "Copy row as JSON",
  "grid.filterToValue": "Filter to this value",
  "grid.leaveValueOut": "Leave this value out",
  "grid.copied": "Copied {what}.",
  "grid.copiedCell": "the cell",
  "grid.copiedRow": "the row",
  "grid.copiedColumnName": "the column name",
  "grid.copiedSql": "the SQL",
  "grid.copyFailed": "Could not copy: the browser refused access to the clipboard.",
  "grid.movedLeft": "Moved {name} left.",
  "grid.movedRight": "Moved {name} right.",
  "grid.moved": "Moved {name}.",
  "grid.columnMenu": "{name} column",
  "grid.cellMenu": "{name} cell",
  "grid.activeCellMenu": "Cell",
  "grid.failed": "Query failed",
  "grid.loading": "Loading…",
  "grid.rows": "{count} rows",
  "grid.rowsOne": "{count} row",
  "grid.noRows": "No rows match.",
  "grid.showHidden": "Show {count} hidden columns",
  "grid.showHiddenOne": "Show {count} hidden column",
  "grid.elapsed": "{ms} ms",
  "grid.asOf": "As of {time}",
  "grid.runAgain": "Run again",
  "grid.previous": "Previous",
  "grid.next": "Next",
  "grid.page": "Page {page} of {pages}",

  // PivotTable
  "pivot.label": "Pivot table",
  "pivot.loading": "Loading…",
  "pivot.choose": "Choose rows or columns and a measure.",
  "pivot.total": "Total",
  "pivot.none": "(none)",
  "pivot.truncated": "This pivot has more than {limit} cells, so some are missing. Add a filter or choose columns with fewer values.",
  "pivot.hiddenColumns": "Showing the first {shown} of {total} column values.",

  // Chart
  "chart.empty": "No data to chart.",
  "chart.description": "{type} chart of {measures} by {x}",
  "chart.coloursRepeat": "{count} series share {colours} colours, so some repeat. Filter, or split by a column with fewer values.",
  "chart.advice": "{message} Better: {instead}",
  "chart.sampleNote": "Showing a random sample of {count} rows.",
  "chart.firstNote": "Showing the first {count} points.",
  "chart.largestNote": "Showing the largest {count} points.",

  // Metric, Sparkline, BulletGraph
  "metric.loading": "…",
  "metric.none": "–",
  "sparkline.summary": "{label}: {now} now, from {first}; low {low}, high {high} over {count} {grain}s.",
  "sparkline.empty": "{label}: no data.",
  "bullet.loading": "{label}: loading.",
  "bullet.empty": "{label}: no data.",
  "bullet.reading": "{label}: {value}{band}{target}.",
  "bullet.targetMet": "; target {target}, met",
  "bullet.targetNotMet": "; target {target}, not met",
  "bullet.target": "Target {target}",

  // FilterBar
  "filter.active": "Active filters",
  "filter.remove": "Remove filter {filter}",
  "filter.form": "Add a filter",
  "filter.column": "Column",
  "filter.comparison": "Comparison",
  "filter.value": "Value",
  "filter.typeOrPick": "Type or pick a value",
  "filter.add": "Add filter",
  "filter.quickRange": "Quick date range",
  "filter.quickRangeChoose": "Quick range…",
  "filter.range7d": "Last 7 days",
  "filter.range30d": "Last 30 days",
  "filter.range90d": "Last 90 days",
  "filter.range12m": "Last 12 months",
  "filter.rangeMonth": "This month",
  "filter.rangeYear": "This year",
  "filter.isEmpty": "is empty",
  "filter.isNotEmpty": "is not empty",
  "filter.contains": "contains",
  "filter.is": "is",
  "filter.isNot": "is not",
  "filter.startsWith": "starts with",
  "filter.endsWith": "ends with",
  "filter.enterWholeNumber": "Enter a whole number.",
  "filter.enterNumber": "Enter a number.",
  "filter.enterTrueFalse": "Enter true or false.",
  "filter.enterDate": "Enter a date like 2026-01-31.",
  "filter.enterValue": "Enter a value.",

  // QueryResult
  "result.views": "Result view",
  "result.tabTable": "Table",
  "result.tabChart": "Chart",
  "result.tabPivot": "Pivot",
  "result.stopExport": "Stop export",
  "result.downloadCsv": "Download CSV",
  "result.copySql": "Copy SQL",
  "result.cancelQuery": "Cancel query",
  "result.format": "Format",
  "result.formatColumn": "Column to format",
  "result.chooseColumn": "Choose a column…",
  "result.howToShow": "How to show {column}",
  "result.asItIs": "As it is",
  "result.formatNumber": "Number",
  "result.formatCompact": "Short number (1.2M)",
  "result.formatCurrency": "Currency",
  "result.formatPercent": "Percent",
  "result.formatText": "Plain text",
  "result.formatDate": "Date only",
  "result.formatDatetime": "Date and time",
  "result.preparing": "Preparing the file…",
  "result.rowsSoFar": "{count} rows so far…",
  "result.saved": "Saved {count} rows.",
  "result.savedTruncated": "Saved {count} rows. The server's row limit was reached, so the file is not the whole result.",
  "result.exportStopped": "Export stopped.",
  "result.sqlCopied": "SQL copied.",
  "result.copyNotAllowed": "Copying is not allowed here.",
  "result.sqlSent": "SQL sent to the engine",
  "result.plan": "How the engine will run it",
  "result.stored": "The query ran once and its result was kept, so sorting, filtering and paging read the kept rows instead of running it again.",
  "result.chooseChart": "Choose columns to chart.",
  "result.choosePivot": "Choose what goes in the rows and the values.",
  "result.chartType": "Type",
  "result.slices": "Slices",
  "result.xAxis": "X axis",
  "result.yAxis": "Y axis",
  "result.every": "Every",
  "result.bins": "Bins",
  "result.binsEach": "each value",
  "result.binsAbout": "about {count}",
  "result.splitBy": "Split by",
  "result.nothing": "nothing",
  "result.legend": "Legend",
  "result.automatic": "automatic",
  "result.legendHidden": "hidden",
  "result.stack": "Stack",
  "result.plotEachRow": "Plot each row",
  "result.series": "Series {number}",
  "result.of": "of",
  "result.drawnAs": "Drawn as",
  "result.drawnAsChart": "chart type ({type})",
  "result.scale": "Scale",
  "result.leftAxis": "left axis",
  "result.rightAxis": "right axis",
  "result.removeSeries": "Remove series {number}",
  "result.remove": "Remove",
  "result.addSeries": "Add series",
  "result.rows": "Rows",
  "result.columns": "Columns",
  "result.none": "none",
  "result.datesBy": "Dates by",
  "result.values": "Values",
  "result.sum": "sum",
  "result.avg": "average",
  "result.median": "median",
  "result.count": "count of rows",
  "result.countDistinct": "distinct count",
  "result.min": "minimum",
  "result.max": "maximum",
  "result.stddev": "standard deviation",
  "result.p90": "90th percentile",

  // Form
  "form.submit": "Submit",
  "form.choose": "Choose…",
  "form.required": "(required)",
  "form.needsAttention": "Nothing was sent. {count} fields need attention.",
  "form.needsAttentionOne": "Nothing was sent. One field needs attention.",
  "form.sent": "Sent.",
  "form.notSaved": "The backend did not save it.",
  "form.saved": "Saved.",
  "form.couldNotSend": "Could not send: {error}",
  "form.sending": "Sending…",
  "form.connected": "Saved by the backend this page is connected to.",
  "form.notConnected": "Not connected to a backend: what you submit goes only to this page.",

  // StepFlow
  "flow.done": "Done",
  "flow.current": "In progress",
  "flow.waiting": "Waiting for you",
  "flow.pending": "Not started",
  "flow.failed": "Failed",
  "flow.skipped": "Skipped",
  "flow.count": "{done} of {total} done",

  // PlanReview
  "plan.riskLow": "Low risk",
  "plan.riskMedium": "Check this",
  "plan.riskHigh": "Changes or removes data",
  "plan.proposedBy": "Proposed by {who}. Nothing runs until you approve.",
  "plan.required": "Required",
  "plan.affects": "Affects: {what}",
  "plan.whatItWouldRun": "What it would run",
  "plan.approved": "Approved {count} of {total} steps.",
  "plan.rejected": "Rejected. Nothing was run.",
  "plan.decisionNote": " Note: {note}",
  "plan.noteLabel": "Note for the record (optional)",
  "plan.approve": "Approve {count} steps",
  "plan.approveOne": "Approve {count} step",
  "plan.reject": "Reject",

  // ActionReceipt
  "receipt.done": "Done",
  "receipt.partial": "Partly done",
  "receipt.failed": "Failed",
  "receipt.ran": "Ran",
  "receipt.by": "by {who}",
  "receipt.approved": "Approved",
  "receipt.noApproval": "No one approved this.",
  "receipt.whatChanged": "What changed",
  "receipt.what": "What",
  "receipt.before": "Before",
  "receipt.after": "After",
  "receipt.whatRan": "What ran",
  "receipt.cannotUndo": "This cannot be undone from here.",
  "receipt.undoClosed": "It could be undone until {time}; that time has passed.",
  "receipt.undoUntil": "Can be undone until {time}.",
  "receipt.undoRequested": "Undo requested. You will be asked to confirm it.",

  // ReportBuilder
  "report.untitled": "Untitled",
  "report.untitledReport": "Untitled report",
  "report.title": "Report title",
  "report.tileTitle": "Title of {title}",
  "report.tileControls": "{title} controls",
  "report.mode": "Mode",
  "report.build": "Build",
  "report.view": "View",
  "report.builder": "Build a view",
  "report.body": "Report",
  "report.changing": "Changing “{title}”.",
  "report.leaveAsItWas": "Leave it as it was",
  "report.leftAsItWas": "Left as it was.",
  "report.updateView": "Update view",
  "report.addToReport": "Add to report",
  "report.maxViews": "A report holds at most {max} views.",
  "report.needMeasure": "Put a metric on “Measure” first: a view needs something to measure.",
  "report.emptyBuild": "Nothing on the report yet. Make a view above and press “Add to report”; each one you add appears here, and they all follow the same filters.",
  "report.emptyView": "This report has no views yet. Switch to Build to make one.",
} as const;

/** The name of one replaceable word or sentence. A name not in `defaultLabels` is a type error. */
export type LabelKey = keyof typeof defaultLabels;
/** Every label, by name. */
export type Labels = Record<LabelKey, string>;

let labels: Labels = { ...defaultLabels };

/** Replaces some of the words. Names not given keep their current text. */
export function setLabels(partial: Partial<Labels>): void {
  const next = { ...labels };
  for (const [key, text] of Object.entries(partial)) {
    if (typeof text === "string" && key in defaultLabels) next[key as LabelKey] = text;
  }
  labels = next;
}

/** Puts every word back to its English default. */
export function resetLabels(): void {
  labels = { ...defaultLabels };
}

/** The text for a label, with each `{name}` replaced by `vars.name`. A name with no value is left as written. */
export function label(key: LabelKey, vars?: Record<string, string | number>): string {
  const text = labels[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}
