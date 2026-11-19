import type { Discovery } from "@surfaces-ui/data";
import { CertificationStatus, type ColumnProfile as ColumnProfileMessage, type DataObject, DescriptionOrigin, type ObjectProfile, type Relation, RelationKind } from "@surfaces-ui/proto";
import { type ReactNode, useEffect, useState } from "react";
import { messageOf } from "../data/useRowWindow.js";
import { DataGrid } from "../grid/DataGrid.js";
import { CertificationBadge, FORMAT_LABEL, ORIGIN_LABEL, type ObjectRefInit, certificationText, fullCount, useDiscovery } from "./shared.js";

export interface ObjectDetailProps {
  /** The table to show. */
  objectRef: ObjectRefInit;
  /** Called when a related object is chosen. */
  onOpen?(object: DataObject): void;
  /** Controls beside the title, e.g. "Add to context". */
  renderActions?(object: DataObject): ReactNode;
  /**
   * Show a preview of the table's rows. Only shown when the source allows
   * data values, and needs a DataSourceProvider above.
   */
  showSampleRows?: boolean;
  /**
   * The name of the person using the page, if they may certify data. Setting
   * it shows the controls to certify, deprecate or clear the mark, and the
   * name is recorded with the decision. Who is allowed is the host's call.
   */
  certifier?: string;
  discovery?: Discovery;
  className?: string;
}

const RELATION_LABEL: Partial<Record<RelationKind, string>> = {
  [RelationKind.JOIN]: "Joins with",
  [RelationKind.SIMILAR]: "Similar to",
  [RelationKind.UPSTREAM]: "Built from",
  [RelationKind.DOWNSTREAM]: "Feeds",
  [RelationKind.USED_BY_QUERY]: "Used by",
};

export interface ColumnProfileProps {
  column: ColumnProfileMessage;
  /** Rows in the table, to turn counts into shares. */
  rowCount: number | undefined;
}

/** One column's statistics: how full it is, how varied, and its range or most common values when those may be shown. */
export function ColumnProfile({ column, rowCount }: ColumnProfileProps) {
  const filled = rowCount && column.nullCount !== undefined ? 1 - Number(column.nullCount) / rowCount : undefined;
  const top = column.topValues.slice(0, 3);
  const most = Math.max(1, ...top.map((t) => Number(t.count)));
  return (
    <>
      <td className="sf-object-fill">
        {filled === undefined ? (
          <span className="sf-object-muted">–</span>
        ) : (
          <span className="sf-meter" role="img" aria-label={`${Math.round(filled * 100)}% filled`}>
            <span style={{ inlineSize: `${Math.round(filled * 100)}%` }} />
            <em>{Math.round(filled * 100)}%</em>
          </span>
        )}
      </td>
      <td className="sf-object-number">{column.distinctCount === undefined ? (
          "–"
        ) : (
          <span title={column.distinctCountEstimated ? "An estimate" : undefined}>
            {column.distinctCountEstimated ? "~" : ""}
            {fullCount.format(Number(column.distinctCount))}
          </span>
        )}</td>
      <td className="sf-object-values">
        {column.sampleValuesWithheld ? (
          <span className="sf-object-muted">Withheld</span>
        ) : top.length > 0 ? (
          <span className="sf-top-values">
            {top.map((value) => (
              <span key={value.value} className="sf-top-value" title={`${value.value}: ${fullCount.format(Number(value.count))}`}>
                <span style={{ inlineSize: `${Math.round((Number(value.count) / most) * 100)}%` }} />
                <em>{value.value}</em>
              </span>
            ))}
          </span>
        ) : column.min !== undefined && column.min !== "" ? (
          <span>
            {column.min} → {column.max}
          </span>
        ) : (
          <span className="sf-object-muted">–</span>
        )}
      </td>
    </>
  );
}

/**
 * Everything known about one table: its description and who wrote it, its
 * columns with statistics, and the tables it relates to. A generated
 * description is only a proposal until a person accepts or edits it.
 */
export function ObjectDetail(props: ObjectDetailProps) {
  const discovery = useDiscovery(props.discovery);
  const key = JSON.stringify(props.objectRef);
  const [profile, setProfile] = useState<ObjectProfile | undefined>();
  const [relations, setRelations] = useState<Relation[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [draft, setDraft] = useState<{ text: string; proposed: string; by: string } | undefined>();
  const [busy, setBusy] = useState(false);
  const [certifying, setCertifying] = useState<{ status: CertificationStatus; note: string } | undefined>();

  useEffect(() => {
    let current = true;
    setProfile(undefined);
    setRelations([]);
    setError(undefined);
    setDraft(undefined);
    setCertifying(undefined);
    // Names and types first, then statistics, so the page is useful immediately.
    discovery
      .getObject({ ref: props.objectRef })
      .then((response) => {
        if (current) setProfile((existing) => existing ?? response.profile);
      })
      .catch((e: unknown) => current && setError(messageOf(e)));
    discovery
      .getObject({ ref: props.objectRef, includeProfile: true })
      .then((response) => current && setProfile(response.profile))
      .catch(() => {});
    discovery
      .getRelated({ ref: props.objectRef })
      .then((response) => current && setRelations(response.relations))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [discovery, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <p className="sf-search-error" role="alert">
        {error}
      </p>
    );
  }
  if (!profile?.object) return <p className="sf-object-muted">Loading…</p>;

  const object = profile.object;
  const rows = profile.rowCount === undefined ? undefined : Number(profile.rowCount);

  const suggest = async () => {
    setBusy(true);
    try {
      const response = await discovery.describe({ ref: props.objectRef });
      setDraft({ text: response.description, proposed: response.description, by: response.generatedBy });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const edited = draft.text.trim() !== draft.proposed.trim() || draft.by === "";
      const response = await discovery.saveDescription({
        ref: props.objectRef,
        description: draft.text,
        origin: edited ? DescriptionOrigin.HUMAN : DescriptionOrigin.GENERATED,
      });
      if (response.object) setProfile({ ...profile, object: response.object });
      setDraft(undefined);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const certify = async (status: CertificationStatus, note: string) => {
    setBusy(true);
    try {
      const response = await discovery.setCertification({ ref: props.objectRef, status, setBy: props.certifier ?? "", note });
      if (response.object) setProfile({ ...profile, object: response.object });
      setCertifying(undefined);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const mark = object.certification?.status ? object.certification : undefined;

  return (
    <article className={["sf-object", props.className].filter(Boolean).join(" ")}>
      <header className="sf-object-head">
        <div>
          <h3 className="sf-object-title">
            {object.name} <CertificationBadge certification={object.certification} />
          </h3>
          <p className="sf-object-facts">
            {[object.ref?.sourceId, FORMAT_LABEL[object.format], rows === undefined ? undefined : `${fullCount.format(rows)} rows`, `${profile.columns.length} columns`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {props.renderActions && <div className="sf-object-actions">{props.renderActions(object)}</div>}
      </header>

      {(mark || props.certifier) && (
        <section className="sf-object-certification" aria-label="Certification">
          {mark && <p>{certificationText(mark)}</p>}
          {props.certifier &&
            (certifying ? (
              <>
                <label className="sf-object-label" htmlFor="sf-object-cert-note">
                  {certifying.status === CertificationStatus.DEPRECATED ? "What should people use instead?" : "Why is it certified? (optional)"}
                </label>
                <input
                  id="sf-object-cert-note"
                  className="sf-input"
                  value={certifying.note}
                  onChange={(e) => setCertifying({ ...certifying, note: e.target.value })}
                />
                <div className="sf-object-buttons">
                  <button type="button" className="sf-button" data-variant="primary" disabled={busy} onClick={() => void certify(certifying.status, certifying.note)}>
                    {certifying.status === CertificationStatus.DEPRECATED ? "Mark as deprecated" : "Certify"} as {props.certifier}
                  </button>
                  <button type="button" className="sf-button" onClick={() => setCertifying(undefined)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="sf-object-buttons">
                {mark?.status !== CertificationStatus.CERTIFIED && (
                  <button type="button" className="sf-button" onClick={() => setCertifying({ status: CertificationStatus.CERTIFIED, note: "" })}>
                    Certify…
                  </button>
                )}
                {mark?.status !== CertificationStatus.DEPRECATED && (
                  <button type="button" className="sf-button" onClick={() => setCertifying({ status: CertificationStatus.DEPRECATED, note: "" })}>
                    Deprecate…
                  </button>
                )}
                {mark && (
                  <button type="button" className="sf-button" disabled={busy} onClick={() => void certify(CertificationStatus.UNSPECIFIED, "")}>
                    Remove mark
                  </button>
                )}
              </div>
            ))}
        </section>
      )}

      <section className="sf-object-description" aria-label="Description">
        {draft ? (
          <>
            <label className="sf-object-label" htmlFor="sf-object-draft">
              {draft.by === "placeholder"
                ? "Proposed description (a summary of the facts; no language model is connected)"
                : draft.by
                  ? `Proposed description, generated by ${draft.by}`
                  : "Description"}
            </label>
            <textarea id="sf-object-draft" className="sf-input sf-object-draft" rows={3} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
            <div className="sf-object-buttons">
              <button type="button" className="sf-button" data-variant="primary" disabled={busy || draft.text.trim() === ""} onClick={() => void save()}>
                Save description
              </button>
              <button type="button" className="sf-button" onClick={() => setDraft(undefined)}>
                Discard
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={object.description ? undefined : "sf-object-muted"}>{object.description || "No description yet."}</p>
            <div className="sf-object-buttons">
              {object.description && ORIGIN_LABEL[object.descriptionOrigin] && <span className="sf-schema-tag">{ORIGIN_LABEL[object.descriptionOrigin]}</span>}
              <button type="button" className="sf-button" disabled={busy} onClick={() => void suggest()}>
                Suggest a description
              </button>
              <button type="button" className="sf-button" onClick={() => setDraft({ text: object.description, proposed: object.description, by: "" })}>
                {object.description ? "Edit" : "Write one"}
              </button>
            </div>
          </>
        )}
      </section>

      <section aria-label="Columns">
        {!profile.sampleValuesAllowed && (
          <p className="sf-object-policy">Data values are withheld for this source, so ranges and common values are not shown.</p>
        )}
        <div className="sf-object-table" tabIndex={0} role="region" aria-label="Column statistics">
          <table>
            <thead>
              <tr>
                <th scope="col">Column</th>
                <th scope="col">Type</th>
                <th scope="col">Filled</th>
                <th scope="col" className="sf-object-number">
                  Distinct
                </th>
                <th scope="col">Values</th>
              </tr>
            </thead>
            <tbody>
              {profile.columns.map((column) => (
                <tr key={column.name}>
                  <th scope="row">
                    {column.name}
                    {column.description && <span className="sf-object-column-note">{column.description}</span>}
                  </th>
                  <td className="sf-object-type">{column.nativeType.toLowerCase()}</td>
                  <ColumnProfile column={column} rowCount={rows} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {relations.length > 0 && (
        <section aria-label="Related tables">
          <h4 className="sf-object-label">Related</h4>
          <ul className="sf-object-related">
            {relations.map((relation, i) => (
              <li key={`${relation.kind}-${relation.object?.name}-${i}`}>
                <button type="button" className="sf-object-relation" onClick={() => relation.object && props.onOpen?.(relation.object)}>
                  <span className="sf-object-muted">{RELATION_LABEL[relation.kind] ?? "Related to"}</span> <strong>{relation.object?.name}</strong> <CertificationBadge certification={relation.object?.certification} />
                  <span className="sf-object-muted"> · {relation.reason}</span>
                  {relation.inferred ? <span className="sf-schema-tag">Inferred</span> : relation.kind === RelationKind.JOIN && <span className="sf-schema-tag">Declared</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {props.showSampleRows && profile.sampleValuesAllowed && object.ref && (
        <section aria-label="Sample rows">
          <h4 className="sf-object-label">Rows</h4>
          <DataGrid sourceId={object.ref.sourceId} sql={`SELECT * FROM ${object.ref.table}`} height={260} label={`Rows of ${object.name}`} />
        </section>
      )}
    </article>
  );
}
