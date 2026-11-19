import { create } from "@bufbuild/protobuf";
import { type Pipelines, checkName, pipelineDigest } from "@surfaces-ui/data";
import { type Check, CheckKind, CheckSeverity, type Dataset, DatasetKind, type Pipeline, type PipelineDraft, PipelineDraftSchema } from "@surfaces-ui/proto";
import { useEffect, useId, useMemo, useState } from "react";
import { ItemControls, standardControls } from "../controls/ItemControls.js";
import type { ContextNote } from "../controls/context.js";
import { messageOf } from "../data/useRowWindow.js";
import { CodeBlock } from "../text/Markdown.js";
import { useOptionalPipelines } from "./PipelineView.js";

export interface DatasetDecision {
  approved: boolean;
  /** The version saved, when approved and saved. */
  version?: number;
  /** The digest of the pipeline as approved. */
  digest?: string;
  approvedBy?: string;
  note?: string;
}

export interface DatasetReviewProps {
  /** The whole pipeline as it would be with the change: what `propose_dataset` returns. */
  pipeline: PipelineDraft;
  /** The dataset under review. */
  dataset: string;
  /** The saved version the proposal was made against. A save made against an older one is refused. */
  expectedVersion: number;
  /** The digest the proposer computed. The one checked is worked out again from what is shown here. */
  digest?: string;
  proposedBy?: string;
  /** Who is reviewing, when the host knows; the person can change it. */
  approver?: string;
  /** Saves on approval. Defaults to the one in context; with none, or one whose pipelines are fixed, approval only reports. */
  pipelines?: Pipelines;
  /** Called once the person decides, after a save when there was one. */
  onDecide?(decision: DatasetDecision): void;
  /** What the person changed, for the agent's next turn. */
  onContext?(note: ContextNote): void;
  className?: string;
}

const KIND_TEXT: Record<number, string> = {
  [CheckKind.UNIQUE]: "never repeats",
  [CheckKind.NOT_NULL]: "is never empty",
  [CheckKind.RELATIONSHIPS]: "is found in",
  [CheckKind.ACCEPTED_VALUES]: "is one of",
  [CheckKind.ROW_COUNT]: "row count",
};

/** A check in words: "region is one of EU, US". */
export function checkText(check: Pick<Check, "kind" | "columns" | "toTable" | "toColumn" | "values" | "minRows" | "maxRows"> & { description?: string }): string {
  const columns = check.columns.join(", ");
  if (check.kind === CheckKind.UNSPECIFIED && check.description) return check.description;
  switch (check.kind) {
    case CheckKind.RELATIONSHIPS:
      return `${columns} is found in ${check.toTable}.${check.toColumn}`;
    case CheckKind.ACCEPTED_VALUES:
      return `${columns} is one of ${check.values.join(", ")}`;
    case CheckKind.ROW_COUNT:
      return check.minRows !== undefined && check.maxRows !== undefined
        ? `between ${check.minRows} and ${check.maxRows} rows`
        : check.minRows !== undefined
          ? `at least ${check.minRows} rows`
          : check.maxRows !== undefined
            ? `at most ${check.maxRows} rows`
            : "row count";
    default:
      return `${columns} ${KIND_TEXT[check.kind] ?? ""}`.trim();
  }
}

/** What differs between the saved dataset and the proposed one, in words. */
export function datasetChanges(before: Dataset | undefined, after: Dataset): string[] {
  if (!before) return ["New dataset"];
  const out: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (before.sql.trim() !== after.sql.trim()) out.push("Query");
  if (before.grain !== after.grain) out.push("Grain");
  if (!same(before.primaryKey, after.primaryKey)) out.push("Key");
  if (!same(before.inputs, after.inputs)) out.push("What it reads");
  if (!same(before.columns.map((c) => [c.name, c.type, c.description]), after.columns.map((c) => [c.name, c.type, c.description]))) out.push("Columns");
  const checks = (d: Dataset) => d.checks.filter((c) => !c.implied).map((c) => [c.kind, c.columns, c.toTable, c.toColumn, c.values, String(c.minRows), String(c.maxRows), c.severity]);
  if (!same(checks(before), checks(after))) out.push("Checks");
  if (before.description !== after.description) out.push("Description");
  if (before.kind !== after.kind || before.layer !== after.layer) out.push("Kind");
  return out;
}

/**
 * A proposed or changed pipeline dataset for a person to approve: its query,
 * what it reads, what one row is, its key, columns and checks, and what
 * changes from the saved version. The person can change the grain, the
 * descriptions and the checks, then approve or reject. Approving saves the
 * pipeline through the backend with the digest of exactly what is shown and
 * the version it was proposed against, so a stale or altered proposal is
 * refused; it builds nothing. Rejecting only reports.
 */
export function DatasetReview(props: DatasetReviewProps) {
  const pipelines = useOptionalPipelines(props.pipelines);
  const id = useId();
  const [draft, setDraft] = useState<PipelineDraft>(() => create(PipelineDraftSchema, props.pipeline));
  const [saved, setSaved] = useState<Pipeline | undefined>();
  const [approver, setApprover] = useState(props.approver ?? "");
  const [note, setNote] = useState("");
  const [digest, setDigest] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<{ text: string; error?: boolean } | undefined>();
  const [busy, setBusy] = useState(false);
  const [decided, setDecided] = useState(false);

  useEffect(() => setDraft(create(PipelineDraftSchema, props.pipeline)), [props.pipeline]);
  useEffect(() => {
    let live = true;
    void pipelineDigest(draft).then((d) => live && setDigest(d));
    return () => {
      live = false;
    };
  }, [draft]);
  useEffect(() => {
    if (!pipelines || props.expectedVersion === 0) return;
    let live = true;
    pipelines.getPipeline({ id: draft.id }).then(
      ({ pipeline }) => live && setSaved(pipeline),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [pipelines, draft.id, props.expectedVersion]);

  const index = draft.datasets.findIndex((d) => d.name.toLowerCase() === props.dataset.toLowerCase());
  const dataset = draft.datasets[index];
  const before = saved?.datasets.find((d) => d.kind !== DatasetKind.SOURCE && d.name.toLowerCase() === props.dataset.toLowerCase());
  const changes = useMemo(() => (dataset ? datasetChanges(before, dataset) : []), [before, dataset]);
  const edited = digest !== undefined && props.digest !== undefined && digest !== props.digest;
  const canSave = !!pipelines?.savePipeline;

  if (!dataset) {
    return (
      <p className="sf-surface-notice" role="note">
        The proposal has no dataset called {props.dataset}.
      </p>
    );
  }
  const name = dataset.name;
  const change = (next: Partial<Dataset>, summary: string) => {
    setDraft((current) => create(PipelineDraftSchema, { ...current, datasets: current.datasets.map((d, i) => (i === index ? { ...d, ...next } : d)) }));
    props.onContext?.({ kind: "field.changed", summary, subject: { pipeline: draft.id, dataset: name } });
  };
  const ownChecks = dataset.checks.filter((c) => !c.implied);

  const decide = async (approved: boolean) => {
    if (!approved) {
      setDecided(true);
      setOutcome({ text: "Rejected. Nothing was saved." });
      props.onDecide?.({ approved: false, ...(note ? { note } : {}) });
      return;
    }
    const by = approver.trim();
    if (!by) {
      setOutcome({ text: "Say who is approving it.", error: true });
      return;
    }
    const shown = await pipelineDigest(draft);
    if (!canSave) {
      setDecided(true);
      setOutcome({ text: "Approved. This page cannot save pipelines, so the approval was passed on." });
      props.onDecide?.({ approved: true, digest: shown, approvedBy: by, ...(note ? { note } : {}) });
      return;
    }
    setBusy(true);
    try {
      const { pipeline } = await pipelines!.savePipeline!({ pipeline: draft, expectedVersion: props.expectedVersion, approvedBy: by, approvalDigest: shown, note });
      setDecided(true);
      setOutcome({ text: `Saved as version ${pipeline?.version}. Nothing has been built yet; run the pipeline to build it.` });
      props.onDecide?.({ approved: true, version: pipeline?.version, digest: shown, approvedBy: by, ...(note ? { note } : {}) });
    } catch (error) {
      setOutcome({ text: messageOf(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={["sf-plan-review", "sf-dataset-review", props.className].filter(Boolean).join(" ")} aria-labelledby={`${id}-title`}>
      <header>
        <p className="sf-plan-review-title" id={`${id}-title`}>
          {before ? "Change" : "Add"} {name} in {draft.name || draft.id}
        </p>
        <p className="sf-plan-review-summary">
          {[dataset.description, dataset.kind === DatasetKind.VIEW ? "Built as a view" : "Built as a table", dataset.layer ? `${dataset.layer} layer` : undefined, `on ${draft.sourceId}`].filter(Boolean).join(" · ")}
        </p>
        {props.proposedBy && <p className="sf-plan-review-by">Proposed by {props.proposedBy}. Nothing is saved until you approve, and nothing is built until the pipeline runs.</p>}
        <p className="sf-dataset-review-changes">
          {changes.map((c) => (
            <span key={c} className="sf-schema-tag">
              {c === "New dataset" ? c : `${c} changed`}
            </span>
          ))}
        </p>
      </header>

      <div className="sf-dataset-review-body">
        <h4 className="sf-dataset-review-heading">Query</h4>
        <CodeBlock code={dataset.sql} language="sql" />
        {before && before.sql.trim() !== dataset.sql.trim() && (
          <details className="sf-plan-review-sql">
            <summary>The saved query</summary>
            <CodeBlock code={before.sql} language="sql" />
          </details>
        )}
        <p className="sf-plan-review-detail">
          {dataset.inputs.length > 0 ? `Reads ${dataset.inputs.join(", ")}.` : "What it reads is worked out from the query when it is saved."}
        </p>

        <label className="sf-dataset-review-field">
          <span>Grain: what one row is</span>
          <input className="sf-input" value={dataset.grain} disabled={decided} onChange={(event) => change({ grain: event.target.value }, `Changed the grain of ${name} to "${event.target.value}"`)} />
        </label>
        <p className="sf-plan-review-detail">
          {dataset.primaryKey.length > 0
            ? `Key: ${dataset.primaryKey.join(", ")}. After every build it is checked that no two rows share it and that it is never empty.`
            : "No key, so nothing checks that rows do not repeat."}
        </p>

        {dataset.columns.length > 0 && (
          <>
            <h4 className="sf-dataset-review-heading">Columns</h4>
            <table className="sf-dataset-review-columns">
              <thead>
                <tr>
                  <th scope="col">Column</th>
                  <th scope="col">Type</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody>
                {dataset.columns.map((column, i) => (
                  <tr key={column.name}>
                    <th scope="row">{column.name}</th>
                    <td>{column.type}</td>
                    <td>
                      <input
                        className="sf-input"
                        aria-label={`Description of ${column.name}`}
                        value={column.description}
                        disabled={decided}
                        onChange={(event) =>
                          change({ columns: dataset.columns.map((c, j) => (j === i ? { ...c, description: event.target.value } : c)) }, `Described ${name}.${column.name}`)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h4 className="sf-dataset-review-heading">Checks after each build</h4>
        {ownChecks.length === 0 ? (
          <p className="sf-plan-review-detail">No checks beyond the key.</p>
        ) : (
          <ul className="sf-dataset-review-checks">
            {ownChecks.map((check) => {
              const label = checkName(check);
              const warn = check.severity === CheckSeverity.WARN;
              return (
                <li key={label} className="sf-controls-host" data-controls="corner">
                  <span className="sf-dataset-review-check">
                    <code>{label}</code> {checkText(check)}
                  </span>
                  <label className="sf-dataset-review-severity">
                    <input
                      type="checkbox"
                      checked={!warn}
                      disabled={decided}
                      onChange={() =>
                        change(
                          { checks: dataset.checks.map((c) => (c === check ? { ...c, severity: warn ? CheckSeverity.FAIL : CheckSeverity.WARN } : c)) },
                          warn ? `${label} now stops what reads ${name}` : `${label} now only warns`,
                        )
                      }
                    />
                    Stops what reads it when it fails
                  </label>
                  {!decided && (
                    <ItemControls label={`Check ${label}`} controls={standardControls(`the check ${label}`, { remove: () => change({ checks: dataset.checks.filter((c) => c !== check) }, `Removed the check ${label} from ${name}`) })} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {outcome && (
        <p className="sf-plan-review-outcome" role={outcome.error ? "alert" : "status"}>
          {outcome.text}
        </p>
      )}
      {!decided && (
        <footer className="sf-plan-review-actions">
          <label className="sf-plan-review-note">
            Approved by
            <input className="sf-input" value={approver} onChange={(event) => setApprover(event.target.value)} autoComplete="name" />
          </label>
          <label className="sf-plan-review-note">
            Note (optional)
            <input className="sf-input" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button type="button" className="sf-button" data-variant="primary" disabled={busy} onClick={() => void decide(true)}>
            {canSave ? "Approve and save" : "Approve"}
          </button>
          <button type="button" className="sf-button" disabled={busy} onClick={() => void decide(false)}>
            Reject
          </button>
        </footer>
      )}
      {/* Below the buttons, so the fields do not move when it appears. */}
      {!decided && edited && <p className="sf-plan-review-detail">You changed the proposal; what you approve is what is shown here.</p>}
    </section>
  );
}
