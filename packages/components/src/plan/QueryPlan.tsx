import type { DataSource } from "@surfaces-ui/data";
import { useEffect, useState } from "react";
import { useDataSource } from "../data/DataSourceProvider.js";
import { type FilterInit, messageOf } from "../data/useRowWindow.js";

/** One step of a query plan. */
export interface PlanNode {
  name: string;
  /** Facts about the step, such as the table read, the join condition or the expected rows. */
  details: [string, string][];
  children: PlanNode[];
}

function toNode(raw: unknown): PlanNode | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const name = String(record.name ?? record["Node Type"] ?? record.operator ?? "").trim();
  if (!name) return undefined;
  const details: [string, string][] = [];
  const add = (key: string, value: unknown) => {
    if (value == null || value === "" || typeof value === "object") return;
    details.push([key, String(value)]);
  };
  const extra = record.extra_info;
  if (extra !== null && typeof extra === "object") for (const [key, value] of Object.entries(extra as Record<string, unknown>)) add(key, Array.isArray(value) ? value.join(", ") : value);
  for (const key of ["Relation Name", "Plan Rows", "Total Cost", "Filter", "Join Type"]) add(key, record[key]);
  const below = (record.children ?? record.Plans) as unknown;
  return { name, details, children: Array.isArray(below) ? below.map(toNode).filter((n): n is PlanNode => n !== undefined) : [] };
}

/**
 * Reads a structured plan (DuckDB's or Postgres's JSON) into steps. Returns
 * an empty list when the engine gave none or in a shape not recognised; the
 * plan text is then what there is to show.
 */
export function parsePlan(json: string): PlanNode[] {
  if (!json.trim()) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    const roots = Array.isArray(parsed) ? parsed : [parsed];
    return roots.map((root) => toNode((root as { Plan?: unknown })?.Plan ?? root)).filter((n): n is PlanNode => n !== undefined);
  } catch {
    return [];
  }
}

function Step({ node }: { node: PlanNode }) {
  return (
    <li>
      <span className="sf-plan-step">
        <strong>{node.name.replace(/_/g, " ")}</strong>
        {node.details.map(([key, value]) => (
          <span key={key} className="sf-plan-detail">
            {key}: {value}
          </span>
        ))}
      </span>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child, index) => (
            <Step key={index} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export interface QueryPlanProps {
  sourceId: string;
  /** The base SQL to explain. */
  sql: string;
  filters?: FilterInit[];
  dataSource?: DataSource;
  className?: string;
}

/**
 * How the engine intends to run a query, without running it: the steps as a
 * tree when the engine gives a structured plan, and the engine's own text
 * (for Teradata, its EXPLAIN) either way.
 */
export function QueryPlan(props: QueryPlanProps) {
  const { sourceId, sql, filters } = props;
  const dataSource = useDataSource(props.dataSource);
  const [state, setState] = useState<{ steps: PlanNode[]; text: string; executedSql: string; error?: string; loading: boolean }>({ steps: [], text: "", executedSql: "", loading: true });
  const key = JSON.stringify([sourceId, sql, filters], (_, v) => (typeof v === "bigint" ? `${v}n` : v));

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: undefined }));
    dataSource
      .explain({ sourceId, query: { baseSql: sql, filters } }, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setState({ steps: parsePlan(response.planJson), text: response.planText, executedSql: response.executedSql, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ steps: [], text: "", executedSql: "", error: messageOf(error), loading: false });
      });
    return () => controller.abort();
  }, [dataSource, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.error) {
    return (
      <p className="sf-search-error" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.loading) return <p className="sf-object-muted">Asking the engine for its plan…</p>;
  return (
    <div className={["sf-plan", props.className].filter(Boolean).join(" ")}>
      {state.steps.length > 0 && (
        <ul className="sf-plan-tree" aria-label="Plan steps, outermost first">
          {state.steps.map((step, index) => (
            <Step key={index} node={step} />
          ))}
        </ul>
      )}
      {state.text && (
        <details open={state.steps.length === 0}>
          <summary>The engine&apos;s plan text</summary>
          <pre tabIndex={0}>{state.text}</pre>
        </details>
      )}
      {state.steps.length === 0 && !state.text && <p className="sf-object-muted">The engine returned no plan.</p>}
    </div>
  );
}
