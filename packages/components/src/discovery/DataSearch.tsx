import type { Discovery } from "@surfaces-ui/data";
import { CertificationStatus, type DataObject, ObjectKind, SearchMode, type SearchHit } from "@surfaces-ui/proto";
import { type ReactNode, useEffect, useId, useState } from "react";
import { messageOf } from "../data/useRowWindow.js";
import { CertificationBadge, FORMAT_LABEL, compactCount, kindLabel, useDiscovery } from "./shared.js";

export interface DataSearchProps {
  /** Called when a result is chosen. */
  onOpen?(object: DataObject): void;
  /** Extra controls on each result, e.g. "Add to context". */
  renderActions?(object: DataObject): ReactNode;
  /** Limit the search to these sources. */
  sourceIds?: string[];
  /** Results per page. Defaults to 25. */
  pageSize?: number;
  /**
   * How tall the whole search is, in pixels or as a CSS length. With it the
   * results scroll inside and the search box stays in view; without it the
   * list is as long as its results.
   */
  height?: number | string;
  discovery?: Discovery;
  className?: string;
}

type Scope = "all" | "tables" | "columns";
const SCOPES: { id: Scope; label: string; kinds: ObjectKind[] }[] = [
  { id: "all", label: "Everything", kinds: [] },
  { id: "tables", label: "Tables", kinds: [ObjectKind.TABLE] },
  { id: "columns", label: "Columns", kinds: [ObjectKind.COLUMN] },
];
const MODES: { id: SearchMode; label: string }[] = [
  { id: SearchMode.UNSPECIFIED, label: "Best match" },
  { id: SearchMode.KEYWORD, label: "Exact words" },
  { id: SearchMode.SEMANTIC, label: "By meaning" },
];

/**
 * Finds tables and columns by what they are called or what they mean. Each
 * result says why it matched. Ranking, embeddings and indexing all happen in
 * the Discovery backend.
 */
export function DataSearch(props: DataSearchProps) {
  const { pageSize = 25 } = props;
  const discovery = useDiscovery(props.discovery);
  const id = useId();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [mode, setMode] = useState<SearchMode>(SearchMode.UNSPECIFIED);
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [state, setState] = useState<{ hits: SearchHit[]; next: string; total: number; modeUsed: SearchMode; loading: boolean; error?: string }>({
    hits: [],
    next: "",
    total: 0,
    modeUsed: SearchMode.UNSPECIFIED,
    loading: true,
  });

  const sources = JSON.stringify(props.sourceIds ?? []);
  const run = (pageToken: string, append: boolean, signal: { cancelled: boolean }) =>
    discovery
      .search({ query, mode, kinds: SCOPES.find((s) => s.id === scope)!.kinds, sourceIds: props.sourceIds, pageSize, pageToken, certificationStatuses: certifiedOnly ? [CertificationStatus.CERTIFIED] : [] })
      .then((response) => {
        if (signal.cancelled) return;
        setState((previous) => ({
          hits: append ? [...previous.hits, ...response.hits] : response.hits,
          next: response.nextPageToken,
          total: Number(response.total),
          modeUsed: response.modeUsed,
          loading: false,
        }));
      })
      .catch((error: unknown) => {
        if (!signal.cancelled) setState((previous) => ({ ...previous, loading: false, error: messageOf(error) }));
      });

  useEffect(() => {
    const signal = { cancelled: false };
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    const timer = setTimeout(() => void run("", false, signal), query ? 200 : 0);
    return () => {
      signal.cancelled = true;
      clearTimeout(timer);
    };
  }, [discovery, query, scope, mode, sources, pageSize, certifiedOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const fellBack = mode === SearchMode.SEMANTIC && state.modeUsed === SearchMode.KEYWORD && !state.loading;

  return (
    <div className={["sf-search", props.className].filter(Boolean).join(" ")} data-fixed={props.height !== undefined || undefined} style={props.height !== undefined ? { height: props.height } : undefined}>
      <div className="sf-search-controls" role="search">
        <input
          className="sf-input sf-search-input"
          type="search"
          placeholder="Search tables and columns, e.g. customer revenue"
          aria-label="Search data"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="sf-input" aria-label="Show" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
          {SCOPES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select className="sf-input" aria-label="Match" value={mode} onChange={(e) => setMode(Number(e.target.value) as SearchMode)}>
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <label className="sf-search-check">
          <input type="checkbox" checked={certifiedOnly} onChange={(e) => setCertifiedOnly(e.target.checked)} />
          <span>Certified only</span>
        </label>
      </div>

      <p className="sf-search-status" aria-live="polite" id={`${id}-status`}>
        {state.error
          ? ""
          : state.loading
            ? "Searching…"
            : `${state.total} ${state.total === 1 ? "result" : "results"}${fellBack ? " · search by meaning is not available here, so these are word matches" : ""}`}
      </p>
      {state.error && (
        <p className="sf-search-error" role="alert">
          {state.error}
        </p>
      )}

      {/* With a height the list scrolls, so it can be focused and moved through with the keyboard. */}
      <ul className="sf-search-results" aria-labelledby={`${id}-status`} aria-busy={state.loading} tabIndex={props.height !== undefined ? 0 : undefined}>
        {state.hits.map((hit) => {
          const object = hit.object!;
          return (
            <li key={`${object.ref?.sourceId}/${object.name}`} className="sf-search-hit">
              <button type="button" className="sf-search-open" onClick={() => props.onOpen?.(object)}>
                <span className="sf-search-title">
                  <span className="sf-search-name">{object.name}</span>
                  <CertificationBadge certification={object.certification} />
                  <span className="sf-schema-tag">{kindLabel(object)}</span>
                  {object.ref?.kind === ObjectKind.TABLE && FORMAT_LABEL[object.format] && <span className="sf-schema-tag">{FORMAT_LABEL[object.format]}</span>}
                  {object.nativeType && <span className="sf-schema-meta">{object.nativeType.toLowerCase()}</span>}
                  {object.rowCount !== undefined && <span className="sf-schema-meta">{compactCount.format(Number(object.rowCount))} rows</span>}
                </span>
                {object.description && <span className="sf-search-description">{object.description}</span>}
                {hit.reasons.length > 0 && <span className="sf-search-reasons">{hit.reasons.join(" · ")}</span>}
              </button>
              {query && <span className="sf-search-score" aria-hidden="true" style={{ inlineSize: `${Math.round(hit.score * 100)}%` }} />}
              {props.renderActions && <span className="sf-search-actions">{props.renderActions(object)}</span>}
            </li>
          );
        })}
      </ul>
      {!state.loading && !state.error && state.hits.length === 0 && <p className="sf-search-empty">Nothing matches{query ? ` “${query}”` : ""}. Try fewer or different words.</p>}
      {state.next && (
        <button type="button" className="sf-button sf-search-more" onClick={() => void run(state.next, true, { cancelled: false })}>
          Show more
        </button>
      )}
    </div>
  );
}
