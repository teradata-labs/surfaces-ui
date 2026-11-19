import type { MessageInitShape } from "@bufbuild/protobuf";
import type { Discovery } from "@surfaces-ui/data";
import { ContextFormat, type ContextPackSchema, RelationKind } from "@surfaces-ui/proto";
import { type DragEvent, useEffect, useId, useState } from "react";
import { messageOf } from "../data/useRowWindow.js";
import { SCHEMA_REF_MIME, type SchemaRef } from "../schema/SchemaExplorer.js";
import { fullCount, tableRef, useDiscovery } from "./shared.js";
import { ControlIcon } from "../controls/ItemControls.js";

export interface ContextDraftItem {
  sourceId: string;
  table: string;
  /** Columns to include. Empty includes all. */
  columns: string[];
  note: string;
  includeSampleRows: boolean;
}

export interface ContextDraftJoin {
  sourceId: string;
  left: string;
  right: string;
  keys: { leftColumn: string; rightColumn: string }[];
}

/** A context pack while it is being edited. */
export interface ContextDraft {
  id?: string;
  name: string;
  notes: string;
  items: ContextDraftItem[];
  joins: ContextDraftJoin[];
}

export const emptyContextDraft: ContextDraft = { name: "", notes: "", items: [], joins: [] };

/** Adds a table to a draft, or leaves it unchanged if it is already there. */
export function addToContext(draft: ContextDraft, sourceId: string, table: string): ContextDraft {
  if (draft.items.some((item) => item.sourceId === sourceId && item.table.toLowerCase() === table.toLowerCase())) return draft;
  return { ...draft, items: [...draft.items, { sourceId, table, columns: [], note: "", includeSampleRows: false }] };
}

/** Converts a draft into the message the Discovery interface takes. */
export function toContextPack(draft: ContextDraft): MessageInitShape<typeof ContextPackSchema> {
  return {
    id: draft.id ?? "",
    name: draft.name,
    notes: draft.notes,
    items: draft.items.map((item) => ({
      ref: tableRef(item.sourceId, item.table),
      columns: item.columns,
      note: item.note,
      includeSampleRows: item.includeSampleRows,
    })),
    joins: draft.joins.map((join) => ({ left: tableRef(join.sourceId, join.left), right: tableRef(join.sourceId, join.right), keys: join.keys })),
  };
}

export interface ContextBuilderProps {
  value: ContextDraft;
  onChange(draft: ContextDraft): void;
  /** Token budget for the meter. Defaults to 4,000. */
  tokenBudget?: number;
  /** Called after the pack is saved, with its ID. */
  onSaved?(id: string): void;
  discovery?: Discovery;
  className?: string;
}

interface Rendered {
  text: string;
  tokens: number;
  hasValues: boolean;
  missing: string[];
}

const sameJoin = (a: ContextDraftJoin, b: ContextDraftJoin) =>
  a.sourceId === b.sourceId && ((a.left === b.left && a.right === b.right) || (a.left === b.right && a.right === b.left));

/**
 * Assembles the data context an agent will work from: which tables and
 * columns, how they join, and notes. The preview is the exact text the agent
 * receives, with a size estimate, and warns when it contains data values.
 */
export function ContextBuilder(props: ContextBuilderProps) {
  const { value, onChange, tokenBudget = 4000 } = props;
  const discovery = useDiscovery(props.discovery);
  const id = useId();
  const [format, setFormat] = useState<ContextFormat>(ContextFormat.MARKDOWN);
  const [rendered, setRendered] = useState<Rendered | undefined>();
  const [columns, setColumns] = useState<Record<string, string[]>>({});
  const [suggested, setSuggested] = useState<ContextDraftJoin[]>([]);
  const [status, setStatus] = useState<{ message: string; error?: boolean } | undefined>();
  const [dragOver, setDragOver] = useState(false);

  const key = JSON.stringify(value);
  const tables = value.items.map((item) => `${item.sourceId}/${item.table}`).join(",");

  // Live preview: render the unsaved draft on the backend, shortly after each change.
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      discovery
        .renderContextPack({ target: { case: "pack", value: toContextPack(value) }, format })
        .then((response) => {
          if (current) {
            setRendered({
              text: response.text,
              tokens: response.tokenEstimate,
              hasValues: response.containsSampleValues,
              missing: response.missing.map((m) => m.table),
            });
          }
        })
        .catch((error: unknown) => current && setStatus({ message: messageOf(error), error: true }));
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [discovery, key, format]); // eslint-disable-line react-hooks/exhaustive-deps

  // Column lists and likely joins for the tables in the pack.
  useEffect(() => {
    let current = true;
    for (const item of value.items) {
      const name = `${item.sourceId}/${item.table}`;
      if (columns[name]) continue;
      discovery
        .getObject({ ref: tableRef(item.sourceId, item.table) })
        .then((response) => current && setColumns((previous) => ({ ...previous, [name]: response.profile?.columns.map((c) => c.name) ?? [] })))
        .catch(() => {});
    }
    Promise.all(
      value.items.map((item) =>
        discovery
          .getRelated({ ref: tableRef(item.sourceId, item.table), kinds: [RelationKind.JOIN] })
          .then((response) =>
            response.relations
              .filter((r) => value.items.some((other) => other.sourceId === item.sourceId && other.table === r.object?.ref?.table))
              .map((r): ContextDraftJoin => ({ sourceId: item.sourceId, left: item.table, right: r.object!.ref!.table, keys: r.keys.map((k) => ({ leftColumn: k.leftColumn, rightColumn: k.rightColumn })) })),
          )
          .catch(() => [] as ContextDraftJoin[]),
      ),
    ).then((found) => {
      if (!current) return;
      const unique: ContextDraftJoin[] = [];
      for (const join of found.flat()) if (!unique.some((u) => sameJoin(u, join))) unique.push(join);
      setSuggested(unique);
    });
    return () => {
      current = false;
    };
  }, [discovery, tables]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (index: number, patch: Partial<ContextDraftItem>) =>
    onChange({ ...value, items: value.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const move = (index: number, by: number) => {
    const items = [...value.items];
    const [item] = items.splice(index, 1);
    items.splice(index + by, 0, item!);
    onChange({ ...value, items });
  };
  const remove = (index: number) => {
    const gone = value.items[index]!;
    onChange({
      ...value,
      items: value.items.filter((_, i) => i !== index),
      joins: value.joins.filter((j) => !(j.sourceId === gone.sourceId && (j.left === gone.table || j.right === gone.table))),
    });
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    try {
      const ref = JSON.parse(event.dataTransfer.getData(SCHEMA_REF_MIME)) as SchemaRef;
      if (ref.sourceId && ref.table) onChange(addToContext(value, ref.sourceId, ref.table));
    } catch {
      // Not something this builder understands.
    }
  };

  const save = async () => {
    try {
      const response = await discovery.saveContextPack({ pack: toContextPack(value) });
      const saved = response.pack!;
      onChange({ ...value, id: saved.id });
      setStatus({ message: `Saved version ${saved.version}.` });
      props.onSaved?.(saved.id);
    } catch (error) {
      setStatus({ message: messageOf(error), error: true });
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rendered?.text ?? "");
      setStatus({ message: "Copied." });
    } catch {
      setStatus({ message: "Copying is not allowed here. Select the preview text instead.", error: true });
    }
  };

  const pending = suggested.filter((join) => !value.joins.some((existing) => sameJoin(existing, join)));
  const share = rendered ? Math.min(1, rendered.tokens / tokenBudget) : 0;
  const over = rendered !== undefined && rendered.tokens > tokenBudget;

  return (
    <div
      className={["sf-context", props.className].filter(Boolean).join(" ")}
      data-drag={dragOver || undefined}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(SCHEMA_REF_MIME)) {
          event.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={drop}
    >
      <label className="sf-context-field">
        <span>Name</span>
        <input className="sf-input" value={value.name} placeholder="e.g. Order analysis" onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </label>
      <label className="sf-context-field">
        <span>Notes for the agent</span>
        <textarea className="sf-input sf-context-notes" rows={2} value={value.notes} placeholder="Rules, units, things to avoid" onChange={(e) => onChange({ ...value, notes: e.target.value })} />
      </label>

      <ul className="sf-context-items" aria-label="Tables in this context">
        {value.items.map((item, index) => {
          const all = columns[`${item.sourceId}/${item.table}`] ?? [];
          const chosen = item.columns.length === 0 ? all : item.columns;
          return (
            <li key={`${item.sourceId}/${item.table}`} className="sf-context-item">
              <div className="sf-context-item-head">
                <strong>{item.table}</strong>
                <span className="sf-object-muted">{item.columns.length === 0 ? "all columns" : `${item.columns.length} of ${all.length} columns`}</span>
                <span className="sf-context-item-buttons">
                  <button type="button" className="sf-button" aria-label={`Move ${item.table} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ControlIcon icon="up" />
                  </button>
                  <button type="button" className="sf-button" aria-label={`Move ${item.table} down`} disabled={index === value.items.length - 1} onClick={() => move(index, 1)}>
                    <ControlIcon icon="down" />
                  </button>
                  <button type="button" className="sf-button" aria-label={`Remove ${item.table}`} onClick={() => remove(index)}>
                    <ControlIcon icon="close" />
                  </button>
                </span>
              </div>
              <input className="sf-input" aria-label={`Note about ${item.table}`} placeholder="Note about this table" value={item.note} onChange={(e) => update(index, { note: e.target.value })} />
              <details className="sf-context-columns">
                <summary>Choose columns</summary>
                <div className="sf-context-checks">
                  {all.map((column) => (
                    <label key={column}>
                      <input
                        type="checkbox"
                        checked={chosen.includes(column)}
                        onChange={(e) => {
                          const next = e.target.checked ? [...chosen, column] : chosen.filter((c) => c !== column);
                          // Everything selected is stored as "all", so new columns are included later.
                          update(index, { columns: next.length === all.length ? [] : all.filter((c) => next.includes(c)) });
                        }}
                      />
                      {column}
                    </label>
                  ))}
                </div>
                <label className="sf-context-sample">
                  <input type="checkbox" checked={item.includeSampleRows} onChange={(e) => update(index, { includeSampleRows: e.target.checked })} />
                  Include sample rows (only if this source allows data values)
                </label>
              </details>
            </li>
          );
        })}
      </ul>
      {value.items.length === 0 && <p className="sf-context-empty">Add tables from search or the schema tree, or drag them here.</p>}

      {(value.joins.length > 0 || pending.length > 0) && (
        <div className="sf-context-joins">
          <span className="sf-object-label">Joins</span>
          <ul>
            {value.joins.map((join) => (
              <li key={`${join.left}-${join.right}`}>
                <span>
                  {join.left} ⋈ {join.right} on {join.keys.map((k) => k.leftColumn).join(", ")}
                </span>
                <button type="button" className="sf-button" aria-label={`Remove join ${join.left} and ${join.right}`} onClick={() => onChange({ ...value, joins: value.joins.filter((j) => !sameJoin(j, join)) })}>
                  <ControlIcon icon="close" />
                </button>
              </li>
            ))}
            {pending.map((join) => (
              <li key={`s-${join.left}-${join.right}`} data-suggested>
                <span>
                  {join.left} ⋈ {join.right} on {join.keys.map((k) => k.leftColumn).join(", ")} <span className="sf-schema-tag">Inferred</span>
                </span>
                <button type="button" className="sf-button" onClick={() => onChange({ ...value, joins: [...value.joins, join] })}>
                  Add join
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="sf-context-preview-head">
        <span id={`${id}-preview`} className="sf-object-label">
          What the agent receives
        </span>
        <select className="sf-input" aria-label="Format" value={format} onChange={(e) => setFormat(Number(e.target.value) as ContextFormat)}>
          <option value={ContextFormat.MARKDOWN}>Markdown</option>
          <option value={ContextFormat.JSON}>JSON</option>
        </select>
      </div>
      <div className="sf-context-budget" data-over={over || undefined}>
        <span className="sf-meter" role="img" aria-label={`${rendered?.tokens ?? 0} of ${tokenBudget} tokens`}>
          <span style={{ inlineSize: `${Math.round(share * 100)}%` }} />
        </span>
        <span>
          About {fullCount.format(rendered?.tokens ?? 0)} of {fullCount.format(tokenBudget)} tokens{over ? " — over budget" : ""}
        </span>
      </div>
      {rendered?.hasValues && (
        <p className="sf-context-warning" role="status">
          This context includes actual data values (sample rows).
        </p>
      )}
      {rendered && rendered.missing.length > 0 && (
        <p className="sf-context-warning" role="status">
          Not found and left out: {rendered.missing.join(", ")}.
        </p>
      )}
      <pre className="sf-context-preview" tabIndex={0} aria-labelledby={`${id}-preview`}>
        {rendered?.text ?? ""}
      </pre>

      <div className="sf-context-actions">
        <button type="button" className="sf-button" data-variant="primary" disabled={value.name.trim() === "" || value.items.length === 0} onClick={() => void save()}>
          {value.id ? "Save new version" : "Save context"}
        </button>
        <button type="button" className="sf-button" disabled={!rendered} onClick={() => void copy()}>
          Copy
        </button>
        {status && (
          <span className={status.error ? "sf-filter-problem" : "sf-object-muted"} role="status">
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}


