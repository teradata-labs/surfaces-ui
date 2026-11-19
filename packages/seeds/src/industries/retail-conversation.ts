import type { ConversationScript, ScriptEvent, SurfaceComponent } from "@surfaces-ui/spec";
import { joinsOf, pipelineGraph } from "../starters.js";
import type { SeedPipeline, SeedTable } from "../types.js";

const SOURCE = "retail";

/** The five tables a refund has to pass through to reach a product and a store. */
const MODEL = ["returns", "order_items", "orders", "products", "stores"];

/** Every return with the line, order, product and store it belongs to. One row per return. */
export const RETURNS_JOINED =
  "SELECT r.returned_on, r.reason, r.refund_amount, p.category, s.region, s.store_name, o.channel FROM returns r JOIN order_items i ON i.order_id = r.order_id AND i.line_no = r.line_no JOIN orders o ON o.order_id = r.order_id JOIN products p ON p.product_id = i.product_id JOIN stores s ON s.store_id = o.store_id";

/** Refunds as a share of what each category sold: a left join, so lines that never came back still count as revenue. */
export const REFUND_SHARE =
  "SELECT p.category, SUM(i.line_amount) AS revenue, COALESCE(SUM(r.refund_amount), 0) AS refunded, COALESCE(SUM(r.refund_amount), 0) / SUM(i.line_amount) AS refund_share FROM order_items i JOIN products p ON p.product_id = i.product_id LEFT JOIN returns r ON r.order_id = i.order_id AND r.line_no = i.line_no GROUP BY p.category";

/** Returns and refunds per store. */
export const STORE_REFUNDS =
  "SELECT s.store_name, s.region, s.format, COUNT(*) AS returns, SUM(r.refund_amount) AS refunded FROM returns r JOIN orders o ON o.order_id = r.order_id JOIN stores s ON s.store_id = o.store_id GROUP BY s.store_name, s.region, s.format";

/**
 * Every order line with its product, store, channel, cost and what was
 * refunded on it (zero when it never came back). One row per line, wide
 * enough to explore: attributes to break down by, and sums that make rates
 * (refunds over revenue, margin) when divided after summarising.
 */
export const SALES_LINES =
  "SELECT o.ordered_at, o.channel, o.status, s.region, s.store_name, p.category, p.brand, i.quantity, i.line_amount, i.quantity * p.unit_cost AS line_cost, COALESCE(r.refund_amount, 0) AS refund_amount FROM order_items i JOIN orders o ON o.order_id = i.order_id JOIN products p ON p.product_id = i.product_id JOIN stores s ON s.store_id = o.store_id LEFT JOIN returns r ON r.order_id = i.order_id AND r.line_no = i.line_no";

const refunded = (id: string): SurfaceComponent => ({ id, component: "Metric", sourceId: SOURCE, sql: RETURNS_JOINED, column: "refund_amount", aggregate: "sum", label: "Refunded", format: "currency" });
const returned = (id: string): SurfaceComponent => ({ id, component: "Metric", sourceId: SOURCE, sql: RETURNS_JOINED, aggregate: "count", label: "Lines returned", format: "number" });
const byMonth = (id: string): SurfaceComponent => ({ id, component: "Sparkline", sourceId: SOURCE, sql: RETURNS_JOINED, x: "returned_on", grain: "month", column: "refund_amount", aggregate: "sum", label: "Refunds by month", format: "currency" });
const byCategory = (id: string): SurfaceComponent => ({
  id,
  component: "Chart",
  sourceId: SOURCE,
  sql: RETURNS_JOINED,
  type: "bar",
  x: "category",
  y: [{ column: "refund_amount", aggregate: "sum", label: "Refunded" }],
  yTitle: "Refunded, USD",
  height: 280,
  label: "Refunds by product category",
});
const shareByCategory = (id: string): SurfaceComponent => ({
  id,
  component: "Chart",
  sourceId: SOURCE,
  sql: REFUND_SHARE,
  type: "bar",
  x: "category",
  y: [{ column: "refund_share", aggregate: "max", label: "Refunded share of revenue" }],
  yTitle: "Refunds ÷ revenue",
  height: 280,
  label: "Refunds as a share of revenue, by product category",
});
const byReason = (id: string): SurfaceComponent => ({
  id,
  component: "Chart",
  sourceId: SOURCE,
  sql: RETURNS_JOINED,
  type: "bar",
  x: "reason",
  y: [{ column: "refund_amount", aggregate: "sum", label: "Refunded" }],
  yTitle: "Refunded, USD",
  height: 260,
  label: "Refunds by the reason given at the till",
});
const stores = (id: string, height: number): SurfaceComponent => ({ id, component: "DataGrid", sourceId: SOURCE, sql: STORE_REFUNDS, sorts: [{ column: "refunded", desc: true }], height, label: "Returns and refunds by store" });

/** A description card for one table: what it holds and its key, from the model's own descriptions. */
function tableCards(tables: SeedTable[]): SurfaceComponent[] {
  return MODEL.flatMap((name) => {
    const table = tables.find((t) => t.name === name);
    if (!table) return [];
    const keys = table.primaryKey.map((k) => `\`${k}\``).join(" + ");
    const links = (table.foreignKeys ?? []).filter((fk) => MODEL.includes(fk.table)).map((fk) => `\`${fk.column}\` → ${fk.table}`);
    const text = [`**${table.name}**`, table.description, `Key: ${keys || "none declared"}`, ...(links.length ? [`Points at: ${links.join(", ")}`] : [])].join("\n\n");
    return [
      { id: `card-${name}`, component: "Card", child: `about-${name}` },
      { id: `about-${name}`, component: "Markdown", text },
    ];
  });
}

/**
 * "Which products and stores drive our refunds?": a question that cannot be
 * answered from one table. The agent shows how the tables join, a person
 * agrees the joins on the diagram, and the answer arrives as numbers, charts
 * and a table, then as a dashboard to keep. Every query here is tested
 * against the seed, and the join is checked to keep each return exactly once.
 */
export function refundsConversation(tables: SeedTable[], pipeline: SeedPipeline): ConversationScript {
  const graph = pipelineGraph(tables, pipeline);
  const declared = joinsOf(tables, MODEL).map((join) => ({ ...join, declared: true }));
  // A return names its order and its line, but the source declares only the order as a key. The line is the agent's proposal.
  const proposed = { left: "returns", right: "order_items", keys: [{ leftColumn: "order_id", rightColumn: "order_id" }, { leftColumn: "line_no", rightColumn: "line_no" }], inferred: true };

  const datasetEvents: ScriptEvent[] = pipeline.datasets.map((dataset) => ({
    name: "open_dataset",
    where: { id: dataset.name },
    reply: [
      {
        text: `**${dataset.name}** (${dataset.layer ?? "dataset"}${dataset.kind === "view" ? ", a view" : ""}): ${dataset.description ?? ""}${
          dataset.name === "sales_clean" ? " It keeps completed orders only, which is why returned lines never reach the tables built from it." : ""
        } This is the query the pipeline is defined with; it has not been run here.`,
      },
      { surface: { id: "dataset", components: [{ id: "root", component: "SqlProposal", sourceId: SOURCE, title: dataset.name, sql: dataset.sql }] } },
    ],
  }));
  const sourceEvents: ScriptEvent[] = graph.nodes
    .filter((node) => node.kind === "source")
    .map((node) => ({
      name: "open_dataset",
      where: { id: node.id },
      reply: [
        { text: `**${node.name}** is a source table: ${tables.find((t) => t.name === node.name)?.description ?? ""}` },
        { surface: { id: "source", components: [{ id: "root", component: "ObjectDetail", sourceId: SOURCE, table: node.name }] } },
      ],
    }));

  return {
    id: "retail-refunds",
    title: "Which products and stores drive our refunds?",
    description: "A question that needs five tables: the agent shows how they join, a person agrees the joins, and the answer comes back as numbers, charts and a table, then as a dashboard to keep.",
    answeredBy: "a written sample (not a model)",
    turns: [
      {
        say: "Which products and stores drive our refunds?",
        reply: [
          {
            steps: [
              { title: "List the tables", tool: "list_tables", detail: "retail: customers, inventory, order_items, orders, products, returns, stores" },
              { title: "Read the keys of returns, order_items, orders, products and stores", tool: "describe_table", detail: "Names, types, keys and descriptions only. No values were read." },
            ],
          },
          {
            text: "Refunds are in `returns`, but a return only knows **which order line** came back. The product is on the line and the store is on the order, so answering this takes five tables. This is how they join:",
          },
          {
            surface: {
              id: "model",
              components: [
                { id: "root", component: "Column", children: ["diagram", "cards"] },
                { id: "diagram", component: "ModelDiagram", sourceId: SOURCE, tables: MODEL, joins: [...declared, proposed], height: 400, action: { event: { name: "use_model" } } },
                { id: "cards", component: "Grid", columns: 3, children: MODEL.map((name) => `card-${name}`) },
                ...tableCards(tables),
              ],
            },
          },
          {
            text: "Four of these joins are keys the source declares. The fifth, `returns` to `order_items` on the order **and** the line, is mine: the source only declares the order, and joining on that alone would count a return once for every line of its order. It stays marked *Inferred* until you confirm it.\n\nYou can drag a column onto another to add a join, or remove one beneath the diagram. **Use as query** sends me the model as you left it.",
          },
        ],
        suggestions: ["Use these joins to total the refunds"],
      },
      {
        say: "Use these joins to total the refunds",
        reply: [
          {
            steps: [
              { title: "Check the join keeps every return once", tool: "query", detail: "SELECT COUNT(*) over the join equals SELECT COUNT(*) FROM returns, so no return is dropped or counted twice." },
              { title: "Total the refunds", tool: "query", detail: "SUM(refund_amount), COUNT(*) and a sum per month, worked out by the database." },
            ],
          },
          { text: "The join keeps every return exactly once, so totals over it can be trusted. This is the query everything below reads from; run it to see the rows." },
          { surface: { id: "query", components: [{ id: "root", component: "SqlProposal", sourceId: SOURCE, title: "Returns with their product and store", sql: RETURNS_JOINED }] } },
          { surface: { id: "totals", components: [{ id: "root", component: "Grid", columns: 3, children: ["refunded", "returned", "trend"] }, refunded("refunded"), returned("returned"), byMonth("trend")] } },
          { text: "The trend sits beside the total so the number is read against something." },
        ],
        suggestions: ["Break refunds down by category and store"],
      },
      {
        say: "Break refunds down by category and store",
        reply: [
          { text: "By category, two ways. The first chart is money refunded. The second divides it by what the category sold, because a category can top the first chart only by being big." },
          {
            surface: {
              id: "breakdown",
              components: [
                { id: "root", component: "Column", children: ["categories", "reasons"] },
                { id: "categories", component: "Grid", columns: 2, children: ["amount", "share"] },
                byCategory("amount"),
                shareByCategory("share"),
                byReason("reasons"),
              ],
            },
          },
          { text: "And by store, largest first. The sort runs in the database; click a heading to change it, or open a column's menu to filter." },
          { surface: { id: "stores", components: [{ ...stores("root", 320) }] } },
        ],
        suggestions: ["Is there a pipeline that already builds this?"],
      },
      {
        say: "Is there a pipeline that already builds this?",
        reply: [
          { steps: [{ title: "Read the pipelines", tool: "list_pipelines", detail: `${pipeline.name}: ${pipeline.datasets.map((d) => d.name).join(", ")}` }] },
          {
            text: `Partly. **${pipeline.name}** already joins orders, lines, stores and products, but it never reads \`returns\`, and its first step keeps completed orders only. Refunds would need a dataset of their own beside \`category_margin\`. Choose a node to see what it holds.`,
          },
          { surface: { id: "pipeline", components: [{ id: "root", component: "PipelineGraph", nodes: graph.nodes, edges: graph.edges, height: 320, action: { event: { name: "open_dataset" } } }] } },
        ],
        suggestions: ["Make this a dashboard I can keep"],
      },
      {
        say: "Make this a dashboard I can keep",
        reply: [
          { text: "Here is the answer as one surface: the totals with their trend, both category charts, the reasons and the stores. It is a page document like any other, so it can be saved to the library, opened in the Playground and rearranged by hand or by asking." },
          {
            surface: {
              id: "dashboard",
              components: [
                { id: "root", component: "Column", children: ["title", "numbers", "charts", "reasons", "stores"] },
                { id: "title", component: "Text", variant: "h2", text: "Refunds by product and store" },
                { id: "numbers", component: "Grid", columns: 3, children: ["refunded", "returned", "trend"] },
                refunded("refunded"),
                returned("returned"),
                byMonth("trend"),
                { id: "charts", component: "Grid", columns: 2, children: ["amount", "share"] },
                byCategory("amount"),
                shareByCategory("share"),
                byReason("reasons"),
                stores("stores", 320),
              ],
            },
          },
          { text: "Nothing has been saved: saving is yours to do." },
        ],
        suggestions: [],
      },
    ],
    events: [
      {
        name: "use_model",
        reply: [
          { text: "This is the query for the model as you left it. It has not been run; press Run to see the rows." },
          { surface: { id: "model-query", components: [{ id: "root", component: "SqlProposal", sourceId: SOURCE, title: "The model as a query", sql: "{{sql}}" }] } },
        ],
      },
      ...datasetEvents,
      ...sourceEvents,
    ],
  };
}
