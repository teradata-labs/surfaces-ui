import { type PageDocument, analyticsCatalog } from "@surfaces-ui/spec";

const revenue = `SELECT o.ordered_at, o.channel, o.status, i.line_amount
FROM orders o JOIN order_items i ON i.order_id = o.order_id`;

/**
 * A dashboard as a plain document: catalog components and a root. An agent
 * can write or change one of these, and you can save it like any JSON.
 */
export const dashboard: PageDocument = {
  id: "sales",
  title: "Retail sales",
  catalogId: analyticsCatalog.id,
  components: [
    { id: "root", component: "Column", children: ["numbers", "charts", "orders"] },
    { id: "numbers", component: "Grid", columns: 2, children: ["revenue", "trend"] },
    { id: "revenue", component: "Metric", sourceId: "retail", sql: revenue, column: "line_amount", aggregate: "sum", label: "Revenue", format: "currency" },
    { id: "trend", component: "Sparkline", sourceId: "retail", sql: revenue, x: "ordered_at", grain: "month", column: "line_amount", aggregate: "sum", label: "Revenue by month", format: "currency" },
    { id: "charts", component: "Grid", columns: 2, children: ["by-channel", "by-month"] },
    {
      id: "by-channel",
      component: "Chart",
      sourceId: "retail",
      sql: revenue,
      type: "bar",
      x: "channel",
      y: [{ column: "line_amount", aggregate: "sum", label: "Revenue" }],
      yTitle: "Revenue",
      label: "Revenue by channel, largest first",
    },
    {
      id: "by-month",
      component: "Chart",
      sourceId: "retail",
      sql: revenue,
      type: "line",
      x: "ordered_at",
      xGrain: "month",
      y: [{ column: "line_amount", aggregate: "sum", label: "Revenue" }],
      yTitle: "Revenue",
      label: "Revenue by month",
    },
    { id: "orders", component: "DataGrid", sourceId: "retail", sql: "SELECT * FROM orders", height: 360 },
  ],
};
