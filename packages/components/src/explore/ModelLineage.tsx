import { type DatasetStanding, type Pipelines, datasetStanding, semanticDatasetProblems, thePipeline } from "@surfaces-ui/data";
import type { Pipeline, SemanticModel } from "@surfaces-ui/proto";
import { useEffect, useId, useState } from "react";
import { messageOf } from "../data/useRowWindow.js";
import { dateFormat } from "../locale/locale.js";
import { useOptionalPipelines } from "../pipeline/PipelineView.js";

export interface ModelLineageProps {
  /** A model whose rows are a pipeline's dataset (`model.dataset`). Anything else draws nothing. */
  model: Pick<SemanticModel, "sourceId" | "sql" | "grain" | "primaryKey" | "dataset">;
  /** Left out, the one from `PipelinesProvider`. Without either, only the dataset's name is shown. */
  pipelines?: Pipelines;
  /** One line, for above an explorer or a report; the full panel otherwise. */
  compact?: boolean;
  /** Offered when the model's grain or key differs from the dataset's: puts the dataset's in the draft. */
  onUseDataset?(standing: DatasetStanding): void;
  /** Opens the dataset in the pipeline view, when the host has one. */
  onOpenDataset?(pipelineId: string, dataset: string): void;
}

/** The pipeline and its latest run, read once per model; nothing is queried. */
function useStanding(model: ModelLineageProps["model"], pipelines: Pipelines | undefined) {
  const ref = model.dataset;
  const [state, setState] = useState<{ pipeline?: Pipeline; standing?: DatasetStanding; problem?: string; gone?: boolean }>({});
  useEffect(() => {
    if (!ref?.pipelineId || !pipelines) return setState({});
    const controller = new AbortController();
    const options = { signal: controller.signal };
    (async () => {
      let pipeline: Pipeline | undefined;
      try {
        pipeline = (await pipelines.getPipeline({ id: ref.pipelineId }, options)).pipeline;
      } catch {
        return !controller.signal.aborted && setState({ gone: true });
      }
      if (!pipeline) return setState({ gone: true });
      const dataset = pipeline.datasets.find((d) => d.name === ref.dataset);
      const runId = dataset?.lastRunId || pipeline.summary?.latestRun?.id;
      const run = runId ? (await pipelines.getRun({ pipelineId: ref.pipelineId, runId }, options).catch(() => undefined))?.run : undefined;
      if (!controller.signal.aborted) setState({ pipeline, standing: datasetStanding(pipeline, ref.dataset, run) });
    })().catch((error: unknown) => !controller.signal.aborted && setState({ problem: messageOf(error) }));
    return () => controller.abort();
  }, [pipelines, ref?.pipelineId, ref?.dataset]);
  return state;
}

const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateFormat({ dateStyle: "medium", timeStyle: "short" }).format(date);
};

/**
 * Where a model's rows come from when they are a pipeline's dataset: which
 * pipeline and dataset, when it was last built, how the latest run's checks
 * went (failing ones first, as counts), whether the key the model relies on
 * was checked, and what the dataset reads. Display only: it reads the
 * pipeline's definition and latest run, and runs nothing.
 */
export function ModelLineage(props: ModelLineageProps) {
  const { model, compact } = props;
  const pipelines = useOptionalPipelines(props.pipelines);
  const { pipeline, standing, problem, gone } = useStanding(model, pipelines);
  const id = useId();
  const ref = model.dataset;
  if (!ref?.pipelineId) return null;

  const name = standing?.pipelineName || ref.pipelineId;
  const problems = pipelines && (pipeline || gone) ? semanticDatasetProblems(model, pipeline) : [];
  const tone = gone || problems.length > 0 || standing?.state === "failed" || (standing?.failing ?? 0) > 0 ? "warn" : standing && !standing.built ? "warn" : "ok";
  const open = props.onOpenDataset && (
    <button type="button" className="sf-button" onClick={() => props.onOpenDataset?.(ref.pipelineId, ref.dataset)}>
      Open in the pipeline
    </button>
  );

  if (compact) {
    return (
      <p className="sf-lineage" data-compact data-tone={tone} role="note">
        <span className="sf-lineage-mark" aria-hidden="true">
          {tone === "ok" ? "✓" : "!"}
        </span>
        <span>
          Rows from <strong>{ref.dataset}</strong>, built by {thePipeline(name)}
          {standing?.builtAt ? ` · ${when(standing.builtAt)}` : standing && !standing.built ? " · not built yet" : ""}
          {standing &&
            standing.checks.length > 0 &&
            (standing.failing > 0
              ? ` · ${standing.failing} of ${standing.checks.length} checks failing`
              : standing.warnings > 0
                ? ` · ${standing.warnings} ${standing.warnings === 1 ? "warning" : "warnings"}, no check failing`
                : ` · checks passed`)}
          {gone && " · the pipeline is not there any more"}
          {problems.length > 0 && !gone && ` · ${problems.length === 1 ? "differs" : `${problems.length} differences`} from the dataset`}
        </span>
        {open}
      </p>
    );
  }

  return (
    <section className="sf-lineage" data-tone={tone} aria-labelledby={`${id}-title`}>
      <h4 id={`${id}-title`} className="sf-explore-heading">
        From a pipeline
      </h4>
      <p>
        The rows are the dataset <strong>{ref.dataset}</strong>, which {thePipeline(name)} builds on {model.sourceId}. Its grain and key are checked after every build.
      </p>
      {!pipelines && <p className="sf-explore-hint">How it was last built is shown where the pipelines can be read.</p>}
      {problem && <p className="sf-filter-problem">The pipeline could not be read: {problem}</p>}
      {standing && (
        <dl className="sf-lineage-facts">
          <dt>Last built</dt>
          <dd>{standing.builtAt ? when(standing.builtAt) : "Not built yet: the query has no table to read until the pipeline runs."}</dd>
          {standing.state === "failed" || standing.state === "running" || standing.state === "skipped" ? (
            <>
              <dt>Latest run</dt>
              <dd>{standing.state === "failed" ? "Failed. The table holds what the last good build left." : standing.state === "running" ? "Under way." : "Skipped, because something it reads failed."}</dd>
            </>
          ) : null}
          <dt>Grain</dt>
          <dd>{standing.grain || "Not declared."}</dd>
          <dt>Key</dt>
          <dd>{standing.primaryKey.length ? `${standing.primaryKey.join(", ")} · ${standing.keyChecked ? "checked unique and not empty by the latest run" : "not checked by the latest run"}` : "Not declared."}</dd>
          <dt>Reads</dt>
          <dd>{standing.inputs.length ? `${standing.inputs.join(", ")}${standing.inputsDeclared ? "" : " (worked out from its query)"}` : "Nothing named."}</dd>
          {standing.owner && (
            <>
              <dt>Owner</dt>
              <dd>{standing.owner}</dd>
            </>
          )}
        </dl>
      )}
      {standing && standing.checks.length > 0 && (
        <ul className="sf-lineage-checks" aria-label="Checks from the latest run">
          {standing.checks.map((check) => (
            <li key={check.name} data-failing={check.failedRecords > 0 || undefined}>
              <span aria-hidden="true">{check.failedRecords > 0 ? (check.severity === "warn" ? "!" : "✕") : "✓"}</span> <code>{check.name}</code>{" "}
              {check.failedRecords > 0 ? `${check.severity === "warn" ? "warns" : "fails"}: ${check.summary}` : "passed"}
            </li>
          ))}
        </ul>
      )}
      {gone && <p className="sf-filter-problem">{thePipeline(ref.pipelineId).replace(/^t/, "T")} is not there any more.</p>}
      {problems.length > 0 && !gone && (
        <div className="sf-filter-problem" role="alert">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {props.onUseDataset && standing && (
            <button type="button" className="sf-button" onClick={() => props.onUseDataset?.(standing)}>
              Use the dataset's grain and key
            </button>
          )}
        </div>
      )}
      {open}
    </section>
  );
}
