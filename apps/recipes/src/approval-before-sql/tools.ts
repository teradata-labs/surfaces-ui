import type { ApprovedRun, RunnableTool } from "@surfaces-ui/agent";
import { type DataSource, collect, toRows } from "@surfaces-ui/data";
import { ApprovalRisk } from "@surfaces-ui/proto";

const MAX_ROWS = 200;

/**
 * A `run_query` tool that shows the SQL to a person before it runs. The
 * person may edit it; whatever they allow is what runs, and only after the
 * agent has checked the answer (digest, expiry, reason, who decided).
 * Queries still go through the read-only DataSource.
 */
export function approvedQueryTool(dataSource: DataSource, sourceId: string): RunnableTool {
  return {
    name: "run_query",
    description: `Run one read-only SQL query on the "${sourceId}" source and get up to ${MAX_ROWS} rows back. A person reviews the SQL first and may change it.`,
    inputSchema: {
      type: "object",
      properties: { sql: { type: "string", description: "One SELECT or WITH statement" }, why: { type: "string", description: "What the answer is for, shown to the person" } },
      required: ["sql", "why"],
      additionalProperties: false,
    },
    approval: (input) => {
      const { sql, why } = input as { sql: string; why: string };
      return {
        title: "Run this query?",
        detail: why,
        sql,
        subject: { source: sourceId, rowLimit: MAX_ROWS },
        risk: ApprovalRisk.LOW,
        editable: true,
        // Ten minutes: after that the person is asked again.
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      };
    },
    run: async (_input, signal, approved?: ApprovedRun) => {
      // Run what the person allowed, never the model's original input.
      if (!approved) throw new Error("run_query only runs after a person allows it.");
      const result = await collect(dataSource.execute({ sourceId, query: { baseSql: approved.sql, page: { limit: MAX_ROWS, offset: 0n } } }, { signal }));
      return { ran: approved.sql, edited: approved.edited, allowedBy: approved.approvals.map((a) => a.decidedBy?.name), rows: toRows(result.table) };
    },
  };
}
