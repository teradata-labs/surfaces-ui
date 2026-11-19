import type { ConversationScript, ScriptEvent } from "@surfaces-ui/spec";
import { pipelineGraph, titledChart } from "../starters.js";
import type { SeedPipeline, SeedTable } from "../types.js";

const SOURCE = "retail";
const AGENT = "the sample agent";

/**
 * Every order line with its order, product, store and any return: one row per
 * line, left joins so a line with no return (or a missing product) still
 * counts. The model's rows, written out for the report and the dashboard.
 */
export const ORDER_LINES =
  "SELECT i.order_id, i.line_no, o.ordered_at, o.channel, o.status, s.region, s.store_name, p.category, p.brand, i.quantity, i.line_amount, r.refund_amount, r.reason FROM order_items i LEFT JOIN orders o ON o.order_id = i.order_id LEFT JOIN products p ON p.product_id = i.product_id LEFT JOIN stores s ON s.store_id = o.store_id LEFT JOIN returns r ON r.order_id = i.order_id AND r.line_no = i.line_no";

/**
 * Counts the conversation states, each checked against the seed by its test
 * (`seeds.test.ts`), so the words never drift from the data.
 */
export const RETAIL_FACTS = {
  lines: 29876,
  orders: 12000,
  customers: 2006,
  negativeLines: 118,
  orphanOrders: 5,
  repeatedEmails: 6,
  missingEmails: 41,
  completedLinesKept: 27369,
  completedLinesDropped: 109,
};

const n = (value: number) => value.toLocaleString("en-US");

/** The fields of the order lines model, once: the semantic model proposes them and the report uses them. */
const FIELDS = [
  { id: "ordered", kind: "attribute", label: "Ordered", column: "ordered_at", grain: "month", by: AGENT },
  { id: "channel", kind: "attribute", label: "Channel", column: "channel", by: AGENT },
  { id: "region", kind: "attribute", label: "Region", column: "region", description: "The store's region.", by: AGENT },
  { id: "store", kind: "attribute", label: "Store", column: "store_name", by: AGENT },
  { id: "category", kind: "attribute", label: "Category", column: "category", by: AGENT },
  { id: "reason", kind: "attribute", label: "Return reason", column: "reason", description: "As chosen at the till; empty for a line that never came back.", by: AGENT },
  { id: "revenue", kind: "metric", label: "Revenue", column: "line_amount", aggregate: "sum", format: "currency", description: "What the lines were sold for, before refunds.", by: AGENT },
  { id: "refunded", kind: "metric", label: "Refunded", column: "refund_amount", aggregate: "sum", format: "currency", description: "Money given back for returned lines.", by: AGENT },
  { id: "units", kind: "metric", label: "Units", column: "quantity", aggregate: "sum", format: "compact", by: AGENT },
  { id: "lines", kind: "metric", label: "Lines", aggregate: "count", format: "compact", description: "Order lines.", by: AGENT },
  { id: "refund_rate", kind: "derived", label: "Refund rate", expression: "refunded / revenue", format: "percent", description: "Refunded as a share of revenue, worked out after summarising.", by: AGENT },
];

const filters = { "@path": "/filters" };
const rate = { expression: "refunded / revenue", terms: { refunded: { column: "refund_amount", aggregate: "sum" }, revenue: { column: "line_amount", aggregate: "sum" } }, label: "Refund rate" };

/**
 * "From the lake to a refund dashboard": the whole path in one conversation.
 * Connect the files (a plan the person approves; the credential stays on the
 * server), look at what is there and what is wrong with it (counted by the
 * database), review personal data, see the pipeline that cleans it and run it,
 * agree a semantic model in the join diagram, build a report from its fields,
 * and end with a dashboard to keep. Every number in the text is checked
 * against the seed by its test.
 */
export function retailLifecycleConversation(tables: SeedTable[], pipeline: SeedPipeline): ConversationScript {
  const graph = pipelineGraph(tables, pipeline);
  const customers = tables.find((t) => t.name === "customers")!;
  const datasetEvents: ScriptEvent[] = pipeline.datasets.map((dataset) => ({
    name: "open_dataset",
    where: { id: dataset.name },
    reply: [
      { text: `**${dataset.name}** (${dataset.layer ?? "dataset"}): ${dataset.description ?? ""} This is its definition on the server; running the pipeline builds it.` },
      { surface: { id: "dataset", components: [{ id: "root", component: "SqlProposal", sourceId: SOURCE, title: dataset.name, sql: dataset.sql }] } },
    ],
  }));

  return {
    id: "retail-lake-to-dashboard",
    title: "From the lake to a refund dashboard",
    description: "The whole path in one conversation: connect the files, check quality and personal data, run the pipeline that cleans them, agree a semantic model on the join diagram, build a report from its fields and keep a dashboard.",
    answeredBy: "a written sample (not a model)",
    turns: [
      {
        say: "Our sales exports land in the lake as Parquet. Connect them so I can work on refunds.",
        reply: [
          {
            steps: [
              { title: "List the export folders", tool: "list_files", detail: "s3://acme-lake/retail: orders, order_items, products, stores, returns, customers. Names only." },
              { title: "Read each folder's schema", tool: "inspect_files", detail: "Column names and types from the Parquet footers. No rows were read." },
            ],
          },
          { text: "Six folders, one table each. This is what connecting them means. Nothing happens until you approve it, and the credential is added on the server by you: I only ever see its name." },
          {
            surface: {
              id: "connect",
              components: [
                { id: "root", component: "Column", children: ["flow", "plan"] },
                {
                  id: "flow",
                  component: "StepFlow",
                  label: "Connect the retail exports",
                  steps: [
                    { id: "scope", title: "Agree what to connect", status: "current" },
                    { id: "secret", title: "Add the credential on the server", detail: "Set LAKE_KEY_ID and LAKE_SECRET. You do this; I never see them.", status: "pending" },
                    { id: "test", title: "Test that every table can be read", status: "pending" },
                    { id: "check", title: "Check quality and personal data", status: "pending" },
                  ],
                },
                {
                  id: "plan",
                  component: "PlanReview",
                  title: "Connect s3://acme-lake/retail",
                  summary: "One read-only connection and six tables. The server can read only under this folder.",
                  proposedBy: AGENT,
                  steps: [
                    { id: "connection", title: "Add an S3 connection named retail", kind: "Connect", affects: "s3://acme-lake/retail", detail: "Uses the secret LAKE, by name.", required: true },
                    { id: "sales", title: "Register orders, order_items, products, stores and returns", kind: "Connect", affects: "5 Parquet tables" },
                    {
                      id: "customers",
                      title: "Register customers",
                      kind: "Connect",
                      affects: "1 Parquet table",
                      risk: "medium",
                      detail: "Column names suggest personal data (names, email, phone, address, date of birth). It gets a personal data review before any report uses it.",
                    },
                  ],
                  action: { event: { name: "connect_decided" } },
                },
              ],
            },
          },
        ],
        suggestions: ["It's connected. What's in it, and is it clean?"],
      },
      {
        say: "It's connected. What's in it, and is it clean?",
        reply: [
          {
            steps: [
              { title: "List the tables", tool: "list_tables", detail: "retail: customers, inventory, order_items, orders, products, returns, stores" },
              { title: "Count the problems", tool: "query", detail: "One COUNT per check, run by the database. No values came back." },
            ],
          },
          { text: `Here is the source as the catalog sees it: ${n(RETAIL_FACTS.orders)} orders with ${n(RETAIL_FACTS.lines)} lines. Open a table to see its columns and keys.` },
          { surface: { id: "browse", components: [{ id: "root", component: "ObjectBrowser", sourceId: SOURCE, height: 300 }] } },
          {
            text: "Four things are wrong with it. Each fix below says how many rows it touches. The ones that leave rows out start unticked: they are yours to agree. The source files are never changed; the fixes go into the pipeline's cleaned view.",
          },
          {
            surface: {
              id: "cleaning",
              components: [
                { id: "root", component: "Column", children: ["plan"] },
                {
                  id: "plan",
                  component: "PlanReview",
                  title: "Clean the retail exports",
                  summary: "Fixes found by counting. The originals stay as they are; the pipeline applies what you approve.",
                  proposedBy: AGENT,
                  steps: [
                    {
                      id: "negative",
                      title: "Leave out lines with a quantity of zero or less",
                      kind: "Clean",
                      affects: `${n(RETAIL_FACTS.negativeLines)} of ${n(RETAIL_FACTS.lines)} lines`,
                      risk: "high",
                      detail: "Till corrections keyed in as negative sales. Refunds belong in returns, so these would count money back twice.",
                      sql: "SELECT * FROM order_items WHERE quantity <= 0",
                    },
                    {
                      id: "orphans",
                      title: "Flag orders whose customer does not exist",
                      kind: "Clean",
                      affects: `${n(RETAIL_FACTS.orphanOrders)} of ${n(RETAIL_FACTS.orders)} orders`,
                      risk: "medium",
                      detail: "Kept, so revenue stays whole; they will show under an unknown customer.",
                      sql: "SELECT o.* FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id WHERE c.customer_id IS NULL",
                    },
                    {
                      id: "repeats",
                      title: "Mark customers entered twice",
                      kind: "Clean",
                      affects: `${n(RETAIL_FACTS.repeatedEmails)} email addresses used by two customers`,
                      detail: "Both rows are kept and marked, for someone to merge by hand.",
                      sql: "SELECT email, COUNT(*) AS n FROM customers WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1",
                    },
                    { id: "email", title: "Treat a missing email as unknown", kind: "Clean", affects: `${n(RETAIL_FACTS.missingEmails)} of ${n(RETAIL_FACTS.customers)} customers`, sql: "SELECT * FROM customers WHERE email IS NULL" },
                  ],
                  action: { event: { name: "cleaning_decided" } },
                },
              ],
            },
          },
          { text: "And `customers` holds personal data. These treatments are what I propose before anyone else sees it. The refund work below needs no customer column at all." },
          {
            surface: {
              id: "personal",
              components: [
                { id: "root", component: "Column", children: ["review"] },
                {
                  id: "review",
                  component: "PiiReview",
                  table: "customers",
                  purpose: "Before customers is used in a report or shared beyond the analytics team.",
                  columns: customers.columns.map((c) => ({
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
        suggestions: ["Clean it in the pipeline and build what finance needs"],
      },
      {
        say: "Clean it in the pipeline and build what finance needs",
        reply: [
          { steps: [{ title: "Read the pipelines", tool: "list_pipelines", detail: `${pipeline.name}: ${pipeline.datasets.map((d) => d.name).join(", ")}` }] },
          {
            text: `**${pipeline.name}** is defined on the server. Its first step, \`sales_clean\`, keeps completed orders and drops lines without a positive quantity; the tables finance reads are built from it. Choose a node to see its query.`,
          },
          { surface: { id: "pipeline", components: [{ id: "root", component: "PipelineGraph", nodes: graph.nodes, edges: graph.edges, height: 300, action: { event: { name: "open_dataset" } } }] } },
          {
            text: `Its quality rule, counted on the source the way the pipeline counts it: of the ${n(RETAIL_FACTS.completedLinesKept + RETAIL_FACTS.completedLinesDropped)} lines on completed orders, ${n(RETAIL_FACTS.completedLinesDropped)} have no positive quantity and are dropped.`,
          },
          {
            surface: {
              id: "quality",
              components: [
                {
                  id: "root",
                  component: "ExpectationsPanel",
                  expectations: [{ name: "positive_quantity", dataset: "sales_clean", constraint: "quantity > 0", action: "drop", passedRecords: RETAIL_FACTS.completedLinesKept, failedRecords: RETAIL_FACTS.completedLinesDropped }],
                },
              ],
            },
          },
          {
            text: "Here it is live. **Run** builds its tables in the retail source, with a run history and the rule's counts from the engine. A full refresh asks first. Pipelines run where the dev server is running; in the browser alone this says so.",
          },
          { surface: { id: "live", components: [{ id: "root", component: "PipelineView", pipelineId: pipeline.id }] } },
        ],
        suggestions: ["Now model order lines so refunds mean the same everywhere"],
      },
      {
        say: "Now model order lines so refunds mean the same everywhere",
        reply: [
          { steps: [{ title: "Read the keys of order_items, orders, products, stores and returns", tool: "describe_table", detail: "Names, types, keys and declared joins. No values." }] },
          {
            text: "One row of this model is **one order line**, the level a refund is recorded at. `order_items` comes first, and every other table adds detail to a line, joined so that a line with no return still counts as revenue.",
          },
          {
            text: "The diagram marks the join to `returns` with ▲, because `return_id` is that table's key and nothing declares one return per line. Press **Check with the engine** on it: no line came back more than once, so it adds one row and the sums hold. Change anything, then save: nothing is kept until you do.",
          },
          {
            surface: {
              id: "model",
              components: [
                {
                  id: "root",
                  component: "SemanticModelEditor",
                  model: "order_lines",
                  create: { label: "Order lines", description: "Every line sold, with its order, product, store and any return, to measure revenue, refunds and the refund rate.", sourceId: SOURCE },
                  proposed: {
                    rows: {
                      grain: "One order line.",
                      primaryKey: ["order_id", "line_no"],
                      tables: ["order_items", "orders", "products", "stores", "returns"],
                      joins: [
                        { left: "order_items", right: "orders", keys: [{ leftColumn: "order_id", rightColumn: "order_id" }], type: "left" },
                        { left: "order_items", right: "products", keys: [{ leftColumn: "product_id", rightColumn: "product_id" }], type: "left" },
                        { left: "orders", right: "stores", keys: [{ leftColumn: "store_id", rightColumn: "store_id" }], type: "left" },
                        {
                          left: "order_items",
                          right: "returns",
                          keys: [
                            { leftColumn: "order_id", rightColumn: "order_id" },
                            { leftColumn: "line_no", rightColumn: "line_no" },
                          ],
                          type: "left",
                        },
                      ],
                    },
                    add: FIELDS,
                  },
                  proposedBy: AGENT,
                  action: { event: { name: "model_event" } },
                },
              ],
            },
          },
        ],
        suggestions: ["Build me a report on refunds from it"],
      },
      {
        say: "Build me a report on refunds from it",
        reply: [
          {
            text: "A report from the model's fields: the headline numbers, the refund rate by category and by month, and money refunded by reason. Every tile uses the same **Refund rate**, defined once as refunded ÷ revenue and worked out after summarising. Drag pills onto the shelves for another view, or ask in words. The view on the shelves now, stores by refund rate, is mine: **Add to report** if you want it.",
          },
          {
            surface: {
              id: "report",
              components: [
                {
                  id: "root",
                  component: "ReportBuilder",
                  sourceId: SOURCE,
                  sql: ORDER_LINES,
                  title: "Refunds",
                  fields: FIELDS,
                  tiles: [
                    { id: "headline", title: "This year", rows: [], values: ["revenue", "refunded", "refund_rate"], span: 3 },
                    { id: "by-category", rows: ["category"], values: ["refund_rate"], view: "chart", span: 2 },
                    { id: "by-reason", rows: ["reason"], values: ["refunded"], view: "table" },
                    { id: "by-month", rows: ["ordered"], values: ["refund_rate"], view: "chart", span: 2 },
                    { id: "by-channel", rows: ["channel"], values: ["revenue", "refund_rate"], view: "table" },
                  ],
                  draft: { rows: ["store"], values: ["refunded", "refund_rate"], view: "table" },
                  action: { event: { name: "report_ask" } },
                },
              ],
            },
          },
        ],
        suggestions: ["Make it a dashboard for the store managers"],
      },
      {
        say: "Make it a dashboard for the store managers",
        reply: [
          {
            text: "One page they can filter: pick a region or a channel above, or **click a bar**, and every number, chart and row below follows. The refund rate is worked out by the database for whatever is filtered, never averaged from rates.",
          },
          {
            surface: {
              id: "dashboard",
              data: { filters: [] },
              components: [
                { id: "root", component: "Column", children: ["title", "filters", "numbers", "bars", "trend", "lines"] },
                { id: "title", component: "Text", variant: "h2", text: "Refunds for store managers" },
                { id: "filters", component: "FilterBar", sourceId: SOURCE, sql: ORDER_LINES, filters, columns: ["region", "store_name", "channel", "category", "ordered_at"] },
                { id: "numbers", component: "Grid", columns: 3, children: ["revenue", "refunded", "refunded-trend"] },
                { id: "revenue", component: "Metric", sourceId: SOURCE, sql: ORDER_LINES, column: "line_amount", aggregate: "sum", label: "Revenue", format: "currency", filters },
                { id: "refunded", component: "Metric", sourceId: SOURCE, sql: ORDER_LINES, column: "refund_amount", aggregate: "sum", label: "Refunded", format: "currency", filters },
                { id: "refunded-trend", component: "Sparkline", sourceId: SOURCE, sql: ORDER_LINES, x: "ordered_at", grain: "month", column: "refund_amount", aggregate: "sum", label: "Refunded by month", format: "currency", filters },
                { id: "bars", component: "Grid", columns: 2, children: ["by-category", "by-region"] },
                ...titledChart("by-category", "Refund rate by category", { sourceId: SOURCE, sql: ORDER_LINES, type: "bar", x: "category", y: [rate], yFormat: "percent", height: 260, filters, select: filters, label: "Refund rate by category; click a bar to filter the page" }),
                ...titledChart("by-region", "Refund rate by region", { sourceId: SOURCE, sql: ORDER_LINES, type: "bar", x: "region", y: [rate], yFormat: "percent", height: 260, filters, select: filters, label: "Refund rate by region; click a bar to filter the page" }),
                ...titledChart("trend", "Refund rate by month", { sourceId: SOURCE, sql: ORDER_LINES, type: "line", x: "ordered_at", xGrain: "month", y: [rate], yFormat: "percent", height: 240, filters, label: "Refund rate by month" }),
                { id: "lines", component: "DataGrid", sourceId: SOURCE, sql: ORDER_LINES, sorts: [{ column: "refund_amount", desc: true }], filters, height: 300, label: "Order lines, largest refunds first" },
              ],
            },
          },
          { text: "Nothing has been saved: keeping the dashboard, and the model, is yours to do." },
        ],
        suggestions: [],
      },
    ],
    events: [
      {
        name: "connect_decided",
        where: { approved: "true" },
        reply: [
          { text: "Approved. Once the credential is set on the server, the sources it serves are listed here, each with a test that its tables can be read. In this playground the retail exports are already served, as `retail`." },
          { surface: { id: "sources", components: [{ id: "root", component: "SourceList" }] } },
        ],
      },
      { name: "connect_decided", reply: [{ text: "Not connected. Tell me what to change: a narrower folder, fewer tables, or leaving customers out." }] },
      { name: "cleaning_decided", reply: [{ text: "Recorded. The fixes you kept become the pipeline's cleaned view, a change someone adds to the server's pipeline definition. I send no SQL to run." }] },
      { name: "pii_decided", reply: [{ text: "Recorded with the table. Reports built from here leave customers out entirely; anything that later needs a customer column gets the treatments you chose." }] },
      ...datasetEvents,
      { name: "model_event", where: { model: "order_lines" }, reply: [{ text: "Saved **{{model}}** as version {{version}}. Every report given this model now reads its fields from it." }] },
      { name: "model_event", reply: [{ text: "This written sample cannot redraw the model from words. With a live agent, your words come back as a changed proposal in the same editor." }] },
      { name: "report_ask", reply: [{ text: "This written sample cannot change the report from words. With a live agent, your words come back as new pills or tiles in the same report." }] },
    ],
  };
}
