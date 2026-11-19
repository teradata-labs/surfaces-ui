import type { ConversationScript, ScriptEvent } from "@surfaces-ui/spec";
import { joinsOf, pipelineGraph, titledChart } from "../starters.js";
import type { SeedPipeline, SeedTable } from "../types.js";

const SOURCE = "telco";
const AGENT = "the sample agent";

/**
 * One row per subscriber with their plan, contract and, for those who left,
 * when and why. Region is written one way here, because the source has it in
 * two cases. The model's rows, written as a query: this conversation shows the
 * written-query path, where the other shows the join diagram.
 */
export const SUBSCRIBER_ROWS =
  "SELECT s.subscriber_id, s.joined_on, upper(substr(s.region, 1, 1)) || substr(s.region, 2) AS region, s.autopay, s.paperless, p.plan_name, p.plan_type, p.monthly_fee, c.contract_type, ch.churned_on, ch.reason AS churn_reason, ch.offered_retention FROM subscribers s LEFT JOIN plans p ON p.plan_id = s.plan_id LEFT JOIN contracts c ON c.subscriber_id = s.subscriber_id LEFT JOIN churn_events ch ON ch.subscriber_id = s.subscriber_id";

/** The same rows, only subscribers who left: for a trend by the month they left, which the others do not have. */
const LEAVERS = `SELECT * FROM (${SUBSCRIBER_ROWS}) leavers WHERE churned_on IS NOT NULL`;

/** The counts this conversation states, each checked against the seed by its test. */
export const TELCO_FACTS = {
  subscribers: 5000,
  churned: 1133,
  usageDays: 117777,
  negativeUsageDays: 44,
  tickets: 3040,
  ticketsResolvedEarly: 7,
  lowerCaseRegions: 156,
  regions: 5,
};

const n = (value: number) => value.toLocaleString("en-US");

const FIELDS = [
  { id: "joined", kind: "attribute", label: "Joined", column: "joined_on", grain: "month", by: AGENT },
  { id: "left_on", kind: "attribute", label: "Left", column: "churned_on", grain: "month", by: AGENT },
  { id: "region", kind: "attribute", label: "Region", column: "region", description: "Written one way; the source has some in lower case.", by: AGENT },
  { id: "plan_type", kind: "attribute", label: "Plan type", column: "plan_type", by: AGENT },
  { id: "plan", kind: "attribute", label: "Plan", column: "plan_name", by: AGENT },
  { id: "contract", kind: "attribute", label: "Contract", column: "contract_type", by: AGENT },
  { id: "autopay", kind: "attribute", label: "Autopay", column: "autopay", by: AGENT },
  { id: "reason", kind: "attribute", label: "Reason for leaving", column: "churn_reason", by: AGENT },
  { id: "subscribers", kind: "metric", label: "Subscribers", aggregate: "count", format: "compact", description: "Subscribers, whether or not they left.", by: AGENT },
  { id: "churned", kind: "metric", label: "Left", column: "churned_on", aggregate: "count", format: "compact", description: "Subscribers with a last day of service.", by: AGENT },
  { id: "fee", kind: "metric", label: "Average monthly fee", column: "monthly_fee", aggregate: "avg", format: "currency", by: AGENT },
  { id: "churn_rate", kind: "derived", label: "Churn rate", expression: "churned / subscribers", format: "percent", description: "Share of subscribers who left, worked out after summarising.", by: AGENT },
];

const filters = { "@path": "/filters" };
const rate = { expression: "churned / subscribers", terms: { churned: { column: "churned_on", aggregate: "count" }, subscribers: { column: "subscriber_id", aggregate: "count" } }, label: "Churn rate" };

/**
 * "Who is leaving, and why?": a CRM database and a usage bucket connected,
 * personal data reviewed, the join diagram showing which tables would double
 * count, a pipeline that summarises those first, a semantic model written as a
 * query, a report from its fields and a dashboard. Every number in the text is
 * checked against the seed by its test.
 */
export function telcoLifecycleConversation(tables: SeedTable[], pipeline: SeedPipeline): ConversationScript {
  const graph = pipelineGraph(tables, pipeline);
  const subscribers = tables.find((t) => t.name === "subscribers")!;
  const modelTables = ["subscribers", "plans", "contracts", "churn_events", "tickets", "payments"];
  const datasetEvents: ScriptEvent[] = pipeline.datasets.map((dataset) => ({
    name: "open_dataset",
    where: { id: dataset.name },
    reply: [
      { text: `**${dataset.name}** (${dataset.layer ?? "dataset"}): ${dataset.description ?? ""} This is its definition on the server; running the pipeline builds it.` },
      { surface: { id: "dataset", components: [{ id: "root", component: "SqlProposal", sourceId: SOURCE, title: dataset.name, sql: dataset.sql }] } },
    ],
  }));

  return {
    id: "telco-churn-end-to-end",
    title: "Who is leaving, and why?",
    description: "Connect a CRM database and a usage bucket, review personal data, see in the join diagram which tables would double count, clean and summarise them in a pipeline, write the model as a query, and build a churn report and dashboard.",
    answeredBy: "a written sample (not a model)",
    turns: [
      {
        say: "I need to understand churn. Subscribers are in our CRM database and daily usage is exported to a bucket.",
        reply: [
          { text: "Two places, so two connections. Both are read-only, and both use a credential you add on the server; I only name it. Nothing is connected until you approve." },
          {
            surface: {
              id: "connect",
              components: [
                { id: "root", component: "Column", children: ["flow", "plan"] },
                {
                  id: "flow",
                  component: "StepFlow",
                  label: "Connect churn data",
                  steps: [
                    { id: "scope", title: "Agree what to connect", status: "current" },
                    { id: "secret", title: "Add CRM_PASSWORD and USAGE_KEY_ID / USAGE_SECRET on the server", detail: "You do this; I never see them.", status: "pending" },
                    { id: "test", title: "Test each table", status: "pending" },
                    { id: "review", title: "Review personal data", status: "pending" },
                  ],
                },
                {
                  id: "plan",
                  component: "PlanReview",
                  title: "Connect the CRM and the usage exports",
                  summary: "A read-only Postgres catalog and one S3 folder.",
                  proposedBy: AGENT,
                  steps: [
                    { id: "crm", title: "Attach the CRM database read-only", kind: "Connect", affects: "subscribers, plans, contracts, tickets, payments, churn_events", detail: "Postgres, as a login that can only read; password from the secret CRM.", required: true },
                    { id: "usage", title: "Register daily usage from s3://acme-usage/daily", kind: "Connect", affects: "usage_daily (Parquet)", detail: "Secret USAGE, by name." },
                    { id: "pii", title: "Hold back names, email, phone and date of birth until reviewed", kind: "Govern", affects: "subscribers", risk: "medium" },
                  ],
                  action: { event: { name: "connect_decided" } },
                },
              ],
            },
          },
        ],
        suggestions: ["Approved. What personal data is in there?"],
      },
      {
        say: "Approved. What personal data is in there?",
        reply: [
          { steps: [{ title: "Read subscribers' columns", tool: "describe_table", detail: "Names and types only." }] },
          { text: "Five columns in `subscribers` name a person. Churn work needs none of them: the subscriber's number is enough to join on. These are the treatments I propose; you decide, and you confirm you may." },
          {
            surface: {
              id: "personal",
              components: [
                { id: "root", component: "Column", children: ["review"] },
                {
                  id: "review",
                  component: "PiiReview",
                  table: "subscribers",
                  purpose: "Analysing churn by plan, contract and region.",
                  columns: subscribers.columns.map((c) => ({
                    name: c.name,
                    type: c.type,
                    ...(c.pii ? { category: c.pii === "birth_date" ? "date_of_birth" : c.pii, basis: "name" } : {}),
                  })),
                  action: { event: { name: "pii_decided" } },
                },
              ],
            },
          },
        ],
        suggestions: ["How do these tables fit together?"],
      },
      {
        say: "How do these tables fit together?",
        reply: [
          { steps: [{ title: "Read keys and declared joins", tool: "describe_table", detail: modelTables.join(", ") }] },
          {
            text: "Rows come from `subscribers`, one per person, and every join keeps every subscriber. `plans` and `churn_events` add **1 per row**: their keys say so. `tickets` and `payments` are marked ▲: one subscriber has many of each, so joining them would repeat that subscriber and every count and sum on top would be wrong.",
          },
          {
            text: "`contracts` is marked ▲ too, because its key is `contract_id`. Press **Check with the engine** on it: no subscriber has more than one, so it is safe. `tickets` and `payments` get summarised to one row per subscriber first, which is what the pipeline does next. Change the joins if you like; **Use as query** sends me what you chose.",
          },
          {
            surface: {
              id: "joins",
              components: [{ id: "root", component: "ModelDiagram", sourceId: SOURCE, tables: modelTables, joins: joinsOf(tables, modelTables).map((j) =>
                    // Read every join from subscribers, so "left" keeps every subscriber.
                    j.right === "subscribers" ? { left: j.right, right: j.left, keys: j.keys.map((k) => ({ leftColumn: k.rightColumn, rightColumn: k.leftColumn })), declared: true, type: "left" } : { ...j, declared: true, type: "left" },
                  ), rowsFrom: true, suggest: false, height: 460, action: { event: { name: "use_model" } } }],
            },
          },
        ],
        suggestions: ["Clean it and summarise usage, tickets and payments"],
      },
      {
        say: "Clean it and summarise usage, tickets and payments",
        reply: [
          { steps: [{ title: "Count the problems", tool: "query", detail: "One COUNT per check, run by the database." }] },
          { text: "Three problems, each counted. Fixes go into the pipeline, never into the source." },
          {
            surface: {
              id: "cleaning",
              components: [
                { id: "root", component: "Column", children: ["plan"] },
                {
                  id: "plan",
                  component: "PlanReview",
                  title: "Clean the churn data",
                  proposedBy: AGENT,
                  steps: [
                    { id: "usage", title: "Treat negative data use as missing", kind: "Clean", affects: `${n(TELCO_FACTS.negativeUsageDays)} of ${n(TELCO_FACTS.usageDays)} days`, detail: "A billing system reset; these are not real usage.", sql: "SELECT * FROM usage_daily WHERE data_mb < 0" },
                    { id: "tickets", title: "Leave out resolution times for tickets closed before they opened", kind: "Clean", affects: `${n(TELCO_FACTS.ticketsResolvedEarly)} of ${n(TELCO_FACTS.tickets)} tickets`, risk: "medium", sql: "SELECT * FROM tickets WHERE resolved_at < opened_at" },
                    { id: "region", title: "Write region with a capital", kind: "Clean", affects: `${n(TELCO_FACTS.lowerCaseRegions)} of ${n(TELCO_FACTS.subscribers)} subscribers`, detail: `So there are ${TELCO_FACTS.regions} regions, not ten.`, sql: "SELECT region, COUNT(*) FROM subscribers GROUP BY region ORDER BY region" },
                  ],
                  action: { event: { name: "cleaning_decided" } },
                },
              ],
            },
          },
          {
            text: `**${pipeline.name}** sums usage over 30 days in \`usage_30d\` and builds \`churn_features\`, one row per subscriber with tickets and late payments counted, the training table for a churn model. Choose a node to see its query.`,
          },
          { surface: { id: "pipeline", components: [{ id: "root", component: "PipelineGraph", nodes: graph.nodes, edges: graph.edges, height: 280, action: { event: { name: "open_dataset" } } }] } },
          {
            surface: {
              id: "quality",
              components: [
                {
                  id: "root",
                  component: "ExpectationsPanel",
                  expectations: [{ name: "tenure_not_negative", dataset: "churn_features", constraint: "tenure_months >= 0", action: "warn", passedRecords: TELCO_FACTS.subscribers, failedRecords: 0 }],
                },
              ],
            },
          },
          { text: "Live: **Run** builds both in the telco source where the dev server is running." },
          { surface: { id: "live", components: [{ id: "root", component: "PipelineView", pipelineId: pipeline.id }] } },
        ],
        suggestions: ["Define churn once so everyone counts it the same way"],
      },
      {
        say: "Define churn once so everyone counts it the same way",
        reply: [
          {
            text: `One row is **one subscriber**, ${n(TELCO_FACTS.subscribers)} of them. This model's rows are a written query: the four tables that add one row each, with region written one way. **Churn rate** is subscribers who left over all subscribers, worked out after summarising, so it is right for any slice. The key, \`subscriber_id\`, is checked by the engine when you save.`,
          },
          {
            surface: {
              id: "model",
              components: [
                {
                  id: "root",
                  component: "SemanticModelEditor",
                  model: "subscriber_churn",
                  create: { label: "Subscriber churn", description: "Every subscriber with their plan, contract and whether and why they left.", sourceId: SOURCE },
                  proposed: { rows: { grain: "One subscriber.", primaryKey: ["subscriber_id"], sql: SUBSCRIBER_ROWS }, add: FIELDS },
                  proposedBy: AGENT,
                  action: { event: { name: "model_event" } },
                },
              ],
            },
          },
        ],
        suggestions: ["Build a churn report"],
      },
      {
        say: "Build a churn report",
        reply: [
          {
            text: `${n(TELCO_FACTS.churned)} of ${n(TELCO_FACTS.subscribers)} subscribers left. The report breaks the churn rate down by contract, plan type and region, with why people left. Every tile uses the one **Churn rate**.`,
          },
          {
            surface: {
              id: "report",
              components: [
                {
                  id: "root",
                  component: "ReportBuilder",
                  sourceId: SOURCE,
                  sql: SUBSCRIBER_ROWS,
                  title: "Churn",
                  fields: FIELDS,
                  tiles: [
                    { id: "headline", rows: [], values: ["subscribers", "churned", "churn_rate"], span: 3 },
                    { id: "by-contract", rows: ["contract"], values: ["churn_rate"], view: "chart", span: 2 },
                    { id: "by-reason", rows: ["reason"], values: ["churned"], view: "table" },
                    { id: "by-plan", rows: ["plan"], values: ["churn_rate"], view: "chart", span: 2 },
                    { id: "by-autopay", rows: ["autopay"], values: ["subscribers", "churn_rate"], view: "table" },
                  ],
                  draft: { rows: ["region"], values: ["churn_rate"], view: "chart" },
                  action: { event: { name: "report_ask" } },
                },
              ],
            },
          },
        ],
        suggestions: ["Turn it into a dashboard for the retention team"],
      },
      {
        say: "Turn it into a dashboard for the retention team",
        reply: [
          { text: "Filter by region, plan or contract above, or click a bar: every number and chart follows. Month-to-month contracts stand out." },
          {
            surface: {
              id: "dashboard",
              data: { filters: [] },
              components: [
                { id: "root", component: "Column", children: ["title", "filters", "numbers", "bars", "reasons"] },
                { id: "title", component: "Text", variant: "h2", text: "Churn for the retention team" },
                { id: "filters", component: "FilterBar", sourceId: SOURCE, sql: SUBSCRIBER_ROWS, filters, columns: ["region", "plan_type", "plan_name", "contract_type", "autopay", "joined_on"] },
                { id: "numbers", component: "Grid", columns: 3, children: ["subs", "left", "left-trend"] },
                { id: "subs", component: "Metric", sourceId: SOURCE, sql: SUBSCRIBER_ROWS, column: "subscriber_id", aggregate: "count", label: "Subscribers", format: "compact", filters },
                { id: "left", component: "Metric", sourceId: SOURCE, sql: SUBSCRIBER_ROWS, column: "churned_on", aggregate: "count", label: "Left", format: "compact", filters },
                { id: "left-trend", component: "Sparkline", sourceId: SOURCE, sql: LEAVERS, x: "churned_on", grain: "month", column: "subscriber_id", aggregate: "count", label: "Left by month", filters },
                { id: "bars", component: "Grid", columns: 3, children: ["by-contract", "by-type", "by-region"] },
                ...titledChart("by-contract", "Churn rate by contract", { sourceId: SOURCE, sql: SUBSCRIBER_ROWS, type: "bar", x: "contract_type", y: [rate], yFormat: "percent", height: 240, filters, select: filters, label: "Churn rate by contract; click a bar to filter the page" }),
                ...titledChart("by-type", "Churn rate by plan type", { sourceId: SOURCE, sql: SUBSCRIBER_ROWS, type: "bar", x: "plan_type", y: [rate], yFormat: "percent", height: 240, filters, select: filters, label: "Churn rate by plan type" }),
                ...titledChart("by-region", "Churn rate by region", { sourceId: SOURCE, sql: SUBSCRIBER_ROWS, type: "bar", x: "region", y: [rate], yFormat: "percent", height: 240, filters, select: filters, label: "Churn rate by region" }),
                ...titledChart("reasons", "Why people left", { sourceId: SOURCE, sql: LEAVERS, type: "bar", x: "churn_reason", y: [{ column: "churned_on", aggregate: "count", label: "Left" }], height: 240, filters, label: "Why people left" }),
              ],
            },
          },
          { text: "Nothing has been saved: keeping the dashboard and the model is yours to do." },
        ],
        suggestions: [],
      },
    ],
    events: [
      {
        name: "connect_decided",
        where: { approved: "true" },
        reply: [
          { text: "Approved. Once the credentials are set, the sources the server offers are listed here with a test per table. In this playground the churn data is already served, as `telco`." },
          { surface: { id: "sources", components: [{ id: "root", component: "SourceList" }] } },
        ],
      },
      { name: "connect_decided", reply: [{ text: "Not connected. Tell me what to change." }] },
      { name: "pii_decided", reply: [{ text: "Recorded with the table. The model below uses none of those columns." }] },
      { name: "use_model", reply: [{ text: "That is the query your joins make. Before I model it, the tables marked ▲ get summarised to one row per subscriber in the pipeline." }, { surface: { id: "joined", components: [{ id: "root", component: "SqlProposal", sourceId: SOURCE, title: "Your joins", sql: "{{sql}}" }] } }] },
      { name: "cleaning_decided", reply: [{ text: "Recorded. The fixes you kept go into the pipeline definition on the server; I send no SQL to run." }] },
      ...datasetEvents,
      { name: "model_event", where: { model: "subscriber_churn" }, reply: [{ text: "Saved **{{model}}** as version {{version}}. Every report given this model now reads churn from it." }] },
      { name: "model_event", reply: [{ text: "This written sample cannot redraw the model from words. With a live agent, your words come back as a changed proposal in the same editor." }] },
      { name: "report_ask", reply: [{ text: "This written sample cannot change the report from words. With a live agent, your words come back as new pills or tiles." }] },
    ],
  };
}
