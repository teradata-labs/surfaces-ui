import { type AgentBackend, type AgentEvent, agentEvent, checkApproval, scriptedAgent, withDigest } from "@surfaces-ui/agent";
import type { DataSource } from "@surfaces-ui/data";
import { type ApprovalAnswer, ApprovalKind, type ApprovalRequest, ApprovalRisk, StepStatus } from "@surfaces-ui/proto";
import { A2UI_VERSION, analyticsCatalog } from "@surfaces-ui/spec";
import { scriptedModelProposal } from "./demoModel.js";
import type { DataFocus } from "./focus.js";

type Component = Record<string, unknown>;

/** The starter that makes the scripted agent ask for approval. */
export const ARCHIVE_STARTER = "Archive the oldest records";

type Aggregate = DataFocus["measure"]["aggregate"];

/** SQL text for an aggregate, for proposals a person reads. DuckDB spelling. */
function aggregateSql(aggregate: Aggregate, column?: string): string {
  const col = column ? `"${column}"` : "*";
  if (aggregate === "count_distinct") return `COUNT(DISTINCT ${col})`;
  if (aggregate === "count") return `COUNT(${col})`;
  return `${aggregate.toUpperCase()}(${col})`;
}

/** A column name for a label: "Paid by payer" becomes paid_by_payer. */
const alias = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "value";

/** The table a single-table query reads, for the scripted archive request. */
const tableOf = (sql: string) => /\bFROM\s+("?)([A-Za-z_][\w.]*)\1/i.exec(sql)?.[2];

/** A pending approval and what it was about. */
interface Pending {
  request: ApprovalRequest;
  table: string;
}

/** Fills the fields a client may leave out, so `checkApproval` gets a whole answer. */
function wholeAnswer(value: Partial<ApprovalAnswer>): ApprovalAnswer {
  return {
    $typeName: "surfaces.v1.ApprovalAnswer",
    id: value.id ?? "",
    allow: value.allow ?? false,
    answer: value.answer ?? "",
    decidedBy: value.decidedBy,
    decidedAt: value.decidedAt ?? "",
    reason: value.reason ?? "",
    digest: value.digest ?? "",
    ...(value.editedSql !== undefined ? { editedSql: value.editedSql } : {}),
    ...(value.editedSubject !== undefined ? { editedSubject: value.editedSubject } : {}),
  } as ApprovalAnswer;
}

/**
 * A stand-in for an agent, so the chat page works with nothing installed. It
 * is not a model: it matches words in the message and replies with a fixed
 * script, drawing real components over the page's data source. Every reply
 * is built from the picked dataset's focus (its measures, trend and
 * breakdowns), so it works on every seed. A real agent (Loom or any other)
 * plugs in through the same AgentBackend interface.
 */
export function demoAgent(dataSource: DataSource, focus: DataFocus): AgentBackend {
  const { sourceId, measure, trend, breakdown } = focus;
  const pending = new Map<string, Pending>();

  const surface = (id: string, components: Component[]): AgentEvent[] => [
    agentEvent.surface({ version: A2UI_VERSION, createSurface: { surfaceId: id, catalogId: analyticsCatalog.id } }),
    agentEvent.surface({ version: A2UI_VERSION, updateComponents: { surfaceId: id, components } as never }),
  ];
  const step = (id: string, title: string, detail = ""): AgentEvent[] => [
    agentEvent.step({ id, title, status: StepStatus.RUNNING, tool: "catalog" }),
    agentEvent.step({ id, title, status: StepStatus.DONE, detail, durationMs: 40n }),
  ];
  const measureY = breakdown.y[0]!;
  const measureLabel = measureY.label ?? measure.label;

  /** The pivot's second dimension: another chart over the same query, or the split of a split chart. */
  const pivotColumns = (() => {
    const same = focus.charts.find((c) => c.sql === breakdown.sql && c.x !== breakdown.x && !c.xGrain && !c.xBins);
    if (same) return [same.x];
    const split = focus.charts.find((c) => c.sql === breakdown.sql && c.splitBy && c.splitBy !== breakdown.x);
    return split?.splitBy ? [split.splitBy] : [];
  })();

  return scriptedAgent(async function* (request, turn) {
    const input = request.input;
    const said = input?.case === "text" ? input.value.toLowerCase() : "";
    const action = input?.case === "action" ? input.value : undefined;
    const context = (action?.context ?? {}) as Record<string, unknown>;
    const id = `t${turn}`;

    if (input?.case === "approval") {
      const answer = wholeAnswer(input.value as Partial<ApprovalAnswer>);
      const waiting = pending.get(answer.id);
      if (!waiting) {
        yield agentEvent.text("I have no request waiting with that id, so nothing was done. This is a **scripted demo**.");
      } else {
        pending.delete(answer.id);
        const check = await checkApproval(waiting.request, answer);
        if (!check.ok) {
          yield* step("s1", "Check the approval", check.message);
          yield agentEvent.text(`The approval did not pass its check (${check.code}): ${check.message} Nothing was run.`);
        } else if (!check.allow) {
          yield agentEvent.text(`Understood: not archiving${check.record.reason ? ` (“${check.record.reason}”)` : ""}. Nothing was changed.`);
        } else {
          yield* step("s1", "Check the approval", `Digest matches what was approved${check.edited ? " (edited by the person)" : ""}.`);
          yield agentEvent.text(
            "The approval checked out: the digest matches the SQL you saw. **This is a scripted demo, so nothing ran and nothing was changed.** Queries in this playground are read-only; a real agent would run this through a pipeline or service of its own and then send an `ActionReceipt`.",
          );
          const by = check.record.decidedBy?.name || check.record.decidedBy?.id || "you";
          yield* surface(id, [
            { id: "root", component: "Column", children: ["badge", "facts", "sql"] },
            { id: "badge", component: "Badge", text: "Scripted demo: nothing ran", tone: "warning" },
            {
              id: "facts",
              component: "KeyValue",
              items: [
                { label: "Table", value: waiting.table },
                { label: "Approved by", value: by },
                { label: "Reason", value: check.record.reason || "None given" },
                { label: "Edited before approval", value: check.edited ? "Yes" : "No" },
                { label: "Would have run", value: "Nothing ran: this agent is a script" },
              ],
            },
            { id: "sql", component: "CodeBlock", language: "sql", code: check.sql },
          ]);
        }
      }
    } else if (action?.name === "use_model") {
      yield agentEvent.text("Here is the query for the model you drew. It has not been run.");
      yield* surface(id, [{ id: "root", component: "SqlProposal", sourceId, title: "Joined tables", sql: String(context.sql ?? "") }]);
    } else if (action?.name === "decide") {
      yield agentEvent.text(`Noted: I will use **${String(context.label ?? context.choice)}** from here on.`);
    } else if (/archiv|delete|clean up|remove old/.test(said)) {
      const table = tableOf(trend.sql) ?? focus.table;
      const sql = [
        `CREATE TABLE IF NOT EXISTS ${table}_archive AS SELECT * FROM ${table} WHERE false;`,
        `INSERT INTO ${table}_archive`,
        `SELECT * FROM ${table}`,
        `WHERE "${trend.x}" < (SELECT MIN("${trend.x}") + INTERVAL 90 DAY FROM ${table});`,
        `DELETE FROM ${table}`,
        `WHERE "${trend.x}" < (SELECT MIN("${trend.x}") + INTERVAL 90 DAY FROM ${table});`,
      ].join("\n");
      const init = await withDigest({
        id: `approval-${id}`,
        kind: ApprovalKind.PERMISSION,
        title: `Archive the first 90 days of ${table}`,
        detail: `Copies the oldest rows of ${table} (by ${trend.x}) into ${table}_archive, then deletes them from ${table}. Scripted demo: even if you approve, nothing runs.`,
        sql,
        subject: { table, column: trend.x, window: "first 90 days of data", destination: `${table}_archive` },
        risk: ApprovalRisk.IRREVERSIBLE,
        editable: true,
        reasonRequired: true,
        approvalsRequired: 1,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        basis: `${table} in ${sourceId}, as of ${new Date().toISOString()}`,
      });
      const approval: ApprovalRequest = {
        $typeName: "surfaces.v1.ApprovalRequest",
        options: [],
        approvals: [],
        ...init,
      } as ApprovalRequest;
      pending.set(approval.id, { request: approval, table });
      yield agentEvent.text("Deleting rows cannot be undone, so I need your approval first. You can edit the SQL; give a reason and type the confirmation word.");
      yield agentEvent.approval(init);
      yield agentEvent.done("demo-session", "scripted demo (not a model)");
      return;
    } else if (action && typeof context.model === "string" && typeof context.version === "number") {
      yield agentEvent.text(`Saved: **${context.model}** is at version ${context.version}. Every Explorer and ReportBuilder given \`model: "${context.model}"\` now takes its fields from it. Open it on the Semantic models page to explore it.`);
    } else if (action && typeof context.text === "string") {
      yield agentEvent.text(`You asked: “${context.text}”. **This is a scripted demo, so it cannot redraft the model.** Change the draft directly (the joins, what one row is, the key and every field can be edited), or pick a model above and ask again.`);
    } else if (/semantic|new model|draft a model|a model of|model for/.test(said)) {
      const by = "the scripted demo";
      yield* step("s1", "Read the tables and their declared keys", "names, types and foreign keys only");
      const proposal = await scriptedModelProposal(dataSource, sourceId, by);
      if (!proposal) {
        yield agentEvent.text("There are no tables in this source to model.");
      } else {
        yield agentEvent.text(
          `A draft model of **${proposal.label.toLowerCase()}**: their rows, with the detail of ${proposal.rows.tables.slice(1).join(", ") || "nothing else"} joined on the keys the tables declare. ${proposal.add.length} fields are drafted from the columns' names and types${proposal.personal.length ? `, leaving out ${proposal.personal.join(", ")}, which may hold personal data` : ""}. Check the joins, what one row is and the key (the engine checks it when you save), change what you like, then save. **Scripted demo:** the draft follows a fixed recipe, not judgement.`,
        );
        yield* surface(id, [
          {
            id: "root",
            component: "SemanticModelEditor",
            model: proposal.name,
            create: { label: proposal.label, ...(proposal.description ? { description: proposal.description } : {}), sourceId },
            proposed: { rows: proposal.rows, add: proposal.add },
            proposedBy: by,
            action: { event: { name: "model_saved" } },
          },
        ]);
      }
    } else if (/model|relat|join|diagram/.test(said)) {
      const { tables } = await dataSource.listTables({ sourceId, pageSize: 6 });
      const names = tables.map((t) => t.ref?.table ?? "").filter(Boolean);
      yield* step("s1", "Read the catalog", names.join(", "));
      yield agentEvent.text("These tables are in the source. Dashed lines are joins **inferred** from column names; drag a column onto another table's column to add your own, then press *Use as query*.");
      yield* surface(id, [{ id: "root", component: "ModelDiagram", sourceId, tables: names, height: 340, action: { event: { name: "use_model" } } }]);
    } else if (/pivot|cross|by .* and/.test(said)) {
      yield* step("s1", `Summarise ${breakdown.label.toLowerCase()}`, `${breakdown.sql}\n-- grouped in the database`);
      yield agentEvent.text(
        pivotColumns.length > 0
          ? `${measureLabel} by ${breakdown.x} and ${pivotColumns[0]}. The totals are worked out by the database.`
          : `${measureLabel} by ${breakdown.x}. This query has one dimension to group by; the totals are worked out by the database.`,
      );
      yield* surface(id, [
        { id: "root", component: "PivotTable", sourceId, sql: breakdown.sql, rows: [breakdown.x], columns: pivotColumns, measures: [{ column: measureY.column, aggregate: measureY.aggregate, label: measureLabel }], height: 300 },
      ]);
    } else if (/chart|trend|plot|graph|measure|revenue|over time/.test(said)) {
      yield* step("s1", `Summarise ${trend.label.toLowerCase()}`, trend.sql);
      yield agentEvent.text(`${trend.label}, as a line on one scale, with the headline number and its trend above it. Everything is summarised in the database.`);
      yield* surface(id, [
        { id: "root", component: "Column", children: ["numbers", "chart"] },
        { id: "numbers", component: "Grid", columns: 2, children: ["headline", "spark"] },
        { id: "headline", component: "Metric", sourceId, sql: measure.sql, ...(measure.column ? { column: measure.column } : {}), aggregate: measure.aggregate, label: measure.label, ...(measure.format ? { format: measure.format } : {}) },
        { id: "spark", component: "Sparkline", sourceId, sql: trend.sql, x: trend.x, grain: "month", ...(trend.column ? { column: trend.column } : {}), aggregate: trend.aggregate, label: trend.label, ...(trend.format ? { format: trend.format } : {}) },
        {
          id: "chart",
          component: "Chart",
          sourceId,
          sql: trend.sql,
          // Change over time is a line on one scale, grouped by month in the database.
          type: "line",
          x: trend.x,
          xGrain: "month",
          y: [{ ...(trend.column ? { column: trend.column } : {}), aggregate: trend.aggregate, label: trend.label }],
          height: 300,
        },
      ]);
    } else if (/bar|breakdown|compare|categor/.test(said)) {
      yield agentEvent.text(`${breakdown.label}, largest first, starting at zero.`);
      yield* surface(id, [
        { id: "root", component: "Chart", sourceId, sql: breakdown.sql, type: "bar", x: breakdown.x, y: breakdown.y, ...(breakdown.yTitle ? { yTitle: breakdown.yTitle } : {}), height: 300 },
      ]);
    } else if (/table|rows|grid|records/.test(said)) {
      yield agentEvent.text(`The rows of \`${focus.table}\`. Sorting and paging run in the database.`);
      yield* surface(id, [{ id: "root", component: "DataGrid", sourceId, sql: focus.rowsSql, height: 300 }]);
    } else if (/brows|explor|what data|tables/.test(said)) {
      yield agentEvent.text("Here is everything in the source. Open a table to see its columns and joins.");
      yield* surface(id, [{ id: "root", component: "ObjectBrowser", sourceId, height: 320 }]);
    } else if (/sql|query/.test(said)) {
      const value = alias(measureLabel);
      yield agentEvent.text("I would run this. It only runs if you press **Run**.");
      yield* surface(id, [
        {
          id: "root",
          component: "SqlProposal",
          sourceId,
          title: breakdown.label,
          sql: `SELECT "${breakdown.x}", ${aggregateSql(measureY.aggregate, measureY.column)} AS ${value}\nFROM (${breakdown.sql}) AS q\nGROUP BY "${breakdown.x}"\nORDER BY ${value} DESC`,
        },
      ]);
    } else if (/decid|choose|which/.test(said)) {
      const options = focus.metrics.slice(0, 6).map((m, i) => ({ id: alias(m.label), label: m.label, description: `${m.aggregate.replace("_", " ")}${m.column ? ` of ${m.column}` : ""}`, ...(i === 0 ? { recommended: true } : {}) }));
      if (options.length < 2) options.push({ id: "trend", label: trend.label, description: "The trend over time" });
      yield* surface(id, [
        {
          id: "root",
          component: "DecisionCard",
          title: "Which measure should I lead with?",
          detail: `${focus.title} has several headline numbers.`,
          options,
          action: { event: { name: "decide" } },
        },
      ]);
    } else {
      yield agentEvent.text(
        `This is a **scripted demo**, not a model. It shows that any component can appear in a conversation, over **${focus.title}**. Ask for one of these:\n\n- the data **model** and its joins\n- a **chart** of ${trend.label.toLowerCase()}\n- a **breakdown**: ${breakdown.label.toLowerCase()}\n- a **pivot** of ${measureLabel.toLowerCase()}\n- the **table** of rows\n- **browse** the data\n- a **SQL** proposal\n- a **decision**\n- **archive** the oldest records (asks for approval; nothing runs)`,
      );
    }
    yield agentEvent.usage({ inputTokens: 900n, outputTokens: 180n, contextTokens: BigInt(1200 + turn * 700), contextLimit: 16000n });
    yield agentEvent.suggestions(["Show the data model", `Chart ${trend.label.toLowerCase()}`, `Pivot ${measureLabel.toLowerCase()}`, "Propose some SQL"]);
    yield agentEvent.done("demo-session", "scripted demo (not a model)");
  }, 60);
}
