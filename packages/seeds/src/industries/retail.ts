import { CITIES, FIRST, LAST, REGIONS, STREETS, fakeEmail, fakePhone, list, prelude, rows, withDefaults } from "../sql.js";
import { withStarters } from "../starters.js";
import { refundsConversation } from "./retail-conversation.js";
import { retailLifecycleConversation } from "./retail-lifecycle.js";
import type { Seed, SeedForm, SeedPipeline, SeedTable } from "../types.js";

const tables: SeedTable[] = [
  {
    name: "stores",
    description: "Shops and the online store, with where they are and when they opened.",
    grain: "one row per store",
    primaryKey: ["store_id"],
    columns: [
      { name: "store_id", type: "INTEGER", description: "Store identifier." },
      { name: "store_name", type: "VARCHAR", description: "Name shown to customers." },
      { name: "format", type: "VARCHAR", description: "flagship, standard, outlet or online." },
      { name: "city", type: "VARCHAR", description: "City the store is in; Online for the web store." },
      { name: "region", type: "VARCHAR", description: "Sales region." },
      { name: "opened_on", type: "DATE", description: "Day the store opened." },
    ],
  },
  {
    name: "products",
    description: "Everything the business sells, with its list price and what it costs to buy in.",
    grain: "one row per product",
    primaryKey: ["product_id"],
    columns: [
      { name: "product_id", type: "INTEGER", description: "Product identifier." },
      { name: "sku", type: "VARCHAR", description: "Stock keeping unit code." },
      { name: "product_name", type: "VARCHAR", description: "Name as listed." },
      { name: "category", type: "VARCHAR", description: "Department." },
      { name: "brand", type: "VARCHAR", description: "Brand." },
      { name: "unit_price", type: "DECIMAL(10,2)", description: "List price in USD." },
      { name: "unit_cost", type: "DECIMAL(10,2)", description: "Cost to buy in, in USD." },
    ],
  },
  {
    name: "customers",
    description: "People who have bought something or joined the loyalty scheme. All invented.",
    grain: "one row per customer account",
    primaryKey: ["customer_id"],
    columns: [
      { name: "customer_id", type: "INTEGER", description: "Customer identifier." },
      { name: "first_name", type: "VARCHAR", description: "Given name.", pii: "name" },
      { name: "last_name", type: "VARCHAR", description: "Family name.", pii: "name" },
      { name: "email", type: "VARCHAR", description: "Email address; empty for some walk-in sign-ups.", pii: "email" },
      { name: "phone", type: "VARCHAR", description: "Phone number.", pii: "phone" },
      { name: "street", type: "VARCHAR", description: "Street address.", pii: "address" },
      { name: "city", type: "VARCHAR", description: "Home city." },
      { name: "region", type: "VARCHAR", description: "Home sales region." },
      { name: "birth_date", type: "DATE", description: "Date of birth.", pii: "birth_date" },
      { name: "signup_date", type: "DATE", description: "Day the account was created." },
      { name: "loyalty_tier", type: "VARCHAR", description: "none, silver, gold or platinum." },
    ],
  },
  {
    name: "orders",
    description: "Purchases, in a store or online. Amounts are on the order lines.",
    grain: "one row per order",
    primaryKey: ["order_id"],
    columns: [
      { name: "order_id", type: "INTEGER", description: "Order identifier." },
      { name: "customer_id", type: "INTEGER", description: "Who bought it." },
      { name: "store_id", type: "INTEGER", description: "Where it was bought." },
      { name: "ordered_at", type: "TIMESTAMP", description: "When it was paid for, UTC." },
      { name: "channel", type: "VARCHAR", description: "store, web or app." },
      { name: "status", type: "VARCHAR", description: "completed, cancelled or returned." },
    ],
    foreignKeys: [
      { column: "customer_id", table: "customers", references: "customer_id" },
      { column: "store_id", table: "stores", references: "store_id" },
    ],
  },
  {
    name: "order_items",
    description: "What was in each order: product, quantity, price paid and discount.",
    grain: "one row per order line",
    primaryKey: ["order_id", "line_no"],
    columns: [
      { name: "order_id", type: "INTEGER", description: "The order." },
      { name: "line_no", type: "INTEGER", description: "Line number within the order." },
      { name: "product_id", type: "INTEGER", description: "The product." },
      { name: "quantity", type: "INTEGER", description: "Units bought." },
      { name: "unit_price", type: "DECIMAL(10,2)", description: "Price per unit paid, before discount, USD." },
      { name: "discount", type: "DECIMAL(10,2)", description: "Discount on the line, USD." },
      { name: "line_amount", type: "DECIMAL(12,2)", description: "quantity × unit_price − discount, USD." },
    ],
    foreignKeys: [
      { column: "order_id", table: "orders", references: "order_id" },
      { column: "product_id", table: "products", references: "product_id" },
    ],
  },
  {
    name: "inventory",
    description: "Stock on hand for each product in each store at the end of the period.",
    grain: "one row per store and product",
    primaryKey: ["store_id", "product_id"],
    columns: [
      { name: "store_id", type: "INTEGER", description: "The store." },
      { name: "product_id", type: "INTEGER", description: "The product." },
      { name: "on_hand", type: "INTEGER", description: "Units in stock." },
      { name: "reorder_point", type: "INTEGER", description: "Reorder when stock falls to this." },
      { name: "counted_on", type: "DATE", description: "Day of the stock count." },
    ],
    foreignKeys: [
      { column: "store_id", table: "stores", references: "store_id" },
      { column: "product_id", table: "products", references: "product_id" },
    ],
  },
  {
    name: "returns",
    description: "Items brought back, with why and how much was refunded.",
    grain: "one row per returned order line",
    primaryKey: ["return_id"],
    columns: [
      { name: "return_id", type: "INTEGER", description: "Return identifier." },
      { name: "order_id", type: "INTEGER", description: "The original order." },
      { name: "line_no", type: "INTEGER", description: "The original line." },
      { name: "returned_on", type: "DATE", description: "Day it came back." },
      { name: "reason", type: "VARCHAR", description: "Why, as chosen at the till." },
      { name: "refund_amount", type: "DECIMAL(12,2)", description: "Refunded, USD." },
    ],
    foreignKeys: [{ column: "order_id", table: "orders", references: "order_id" }],
  },
];

const form: SeedForm = {
  id: "retail-store-visit",
  title: "Store visit report",
  description: "What a regional manager found on a visit. Kept with the store for follow-up.",
  table: "store_visits",
  fields: [
    { name: "store_id", label: "Store number", type: "integer", required: true, min: 1 },
    { name: "visited_on", label: "Visit date", type: "date", required: true },
    { name: "rating", label: "Overall", type: "choice", required: true, options: ["Good", "Needs work", "Poor"] },
    { name: "out_of_stock_items", label: "Items out of stock", type: "integer", min: 0, max: 500 },
    { name: "follow_up", label: "Needs a follow-up visit", type: "boolean" },
    { name: "notes", label: "Notes", type: "longtext", maxLength: 1000 },
  ],
};

const pipeline: SeedPipeline = {
  id: "retail-sales",
  name: "Retail sales pipeline",
  description: "Cleans order lines, then builds daily revenue by store and margin by category.",
  datasets: [
    {
      name: "sales_clean",
      kind: "view",
      layer: "silver",
      description: "Completed order lines with their store and product, with impossible quantities left out.",
      depends: ["orders", "order_items", "stores", "products"],
      grain: "one row per line of a completed order",
      primaryKey: ["order_id", "line_no"],
      columns: [
        { name: "order_id", type: "INTEGER", description: "The order." },
        { name: "line_no", type: "INTEGER", description: "Line number within the order." },
        { name: "channel", type: "VARCHAR", description: "Where the order was placed: store, web or app." },
        { name: "region", type: "VARCHAR", description: "The store's region." },
        { name: "category", type: "VARCHAR", description: "The product's category." },
        { name: "line_amount", type: "DECIMAL(12,2)", description: "What the line was sold for, USD." },
        { name: "line_cost", type: "DECIMAL", description: "Units × the product's unit cost, USD." },
      ],
      checks: [{ kind: "accepted_values", columns: ["channel"], values: ["store", "web", "app"] }],
      tags: ["sales"],
      owner: "Retail analytics",
      sql: "SELECT o.order_id, i.line_no, o.ordered_at, o.channel, o.store_id, s.region, i.product_id, p.category, i.quantity, i.line_amount, i.quantity * p.unit_cost AS line_cost FROM orders o JOIN order_items i ON i.order_id = o.order_id JOIN stores s ON s.store_id = o.store_id JOIN products p ON p.product_id = i.product_id WHERE o.status = 'completed'",
      expectations: [{ name: "positive_quantity", constraint: "quantity > 0", action: "drop" }],
    },
    {
      name: "daily_store_revenue",
      layer: "gold",
      description: "Revenue and orders per store per day.",
      depends: ["sales_clean"],
      grain: "one row per store per day",
      primaryKey: ["day", "store_id"],
      columns: [
        { name: "day", type: "DATE" },
        { name: "store_id", type: "INTEGER", description: "The store." },
        { name: "revenue", type: "DECIMAL", description: "Sum of line amounts, USD." },
        { name: "orders", type: "BIGINT", description: "Distinct orders." },
      ],
      checks: [
        { kind: "relationships", columns: ["store_id"], to: { table: "stores", column: "store_id" } },
        { kind: "row_count", min: 1 },
      ],
      tags: ["sales"],
      owner: "Retail analytics",
      sql: "SELECT CAST(ordered_at AS DATE) AS day, store_id, region, SUM(line_amount) AS revenue, COUNT(DISTINCT order_id) AS orders FROM sales_clean GROUP BY 1, 2, 3",
      expectations: [{ name: "revenue_not_negative", constraint: "revenue >= 0", action: "warn" }],
    },
    {
      name: "category_margin",
      layer: "gold",
      description: "Revenue, cost and margin by category and month.",
      depends: ["sales_clean"],
      grain: "one row per category per month",
      primaryKey: ["month", "category"],
      checks: [{ kind: "accepted_values", columns: ["category"], values: ["Apparel", "Footwear", "Home", "Beauty", "Electronics", "Grocery", "Toys", "Sports"] }],
      tags: ["finance"],
      owner: "Retail analytics",
      sql: "SELECT date_trunc('month', ordered_at) AS month, category, SUM(line_amount) AS revenue, SUM(line_cost) AS cost, SUM(line_amount) - SUM(line_cost) AS margin FROM sales_clean GROUP BY 1, 2",
    },
  ],
};

export const retail: Seed = {
  id: "retail",
  title: "Retail",
  industry: "Retail",
  description: "A chain of shops and a web store: customers, products, orders and their lines, stock and returns.",
  tables,
  issues: [
    { table: "customers", column: "email", kind: "nulls", description: "About 2% of customers have no email.", sql: "SELECT * FROM customers WHERE email IS NULL" },
    { table: "customers", kind: "duplicates", description: "A few customers were entered twice with the same email.", sql: "SELECT email, COUNT(*) AS n FROM customers WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1" },
    { table: "orders", column: "customer_id", kind: "orphans", description: "A handful of orders point at customers that do not exist.", sql: "SELECT o.* FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id WHERE c.customer_id IS NULL" },
    { table: "order_items", column: "quantity", kind: "out_of_range", description: "Some lines have a negative quantity, keyed in at the till instead of a return.", sql: "SELECT * FROM order_items WHERE quantity <= 0" },
  ],
  sql(params) {
    const p = withDefaults(params);
    const nCustomers = rows(2000, p);
    const nOrders = rows(12000, p);
    const nProducts = 300;
    return [
      ...prelude(p),
      `CREATE OR REPLACE TABLE stores AS
       SELECT CAST(i + 1 AS INTEGER) AS store_id,
         CASE WHEN i = 0 THEN 'Web store' ELSE sf_pick(${CITIES}, i, 1) || ' ' || sf_pick(['Central', 'Market', 'Park', 'Square', 'Mall'], i, 2) END AS store_name,
         CASE WHEN i = 0 THEN 'online' WHEN i < 4 THEN 'flagship' WHEN i % 7 = 0 THEN 'outlet' ELSE 'standard' END AS format,
         CASE WHEN i = 0 THEN 'Online' ELSE sf_pick(${CITIES}, i, 1) END AS city,
         sf_pick(${REGIONS}, i, 3) AS region,
         DATE '${p.start}' - CAST(sf_int(i, 4, 200, 4000) AS INTEGER) AS opened_on
       FROM range(40) r(i)`,
      `CREATE OR REPLACE TABLE products AS
       WITH base AS (
         SELECT i, sf_pick(['Apparel', 'Footwear', 'Home', 'Beauty', 'Electronics', 'Grocery', 'Toys', 'Sports'], i, 11) AS category, round(4 + pow(sf_rnd(i, 12), 2) * 300, 2) AS price FROM range(${nProducts}) r(i))
       SELECT CAST(i + 1 AS INTEGER) AS product_id,
         'SKU-' || lpad(CAST(i + 1 AS VARCHAR), 5, '0') AS sku,
         sf_pick(['Classic', 'Everyday', 'Pro', 'Essential', 'Studio', 'Trail', 'Urban', 'Comfort'], i, 13) || ' ' || lower(category) || ' item ' || CAST(i + 1 AS VARCHAR) AS product_name,
         category,
         sf_pick(['Northwind', 'Contoso', 'Fabrikam', 'Tailspin', 'Litware', 'Adatum'], i, 14) AS brand,
         CAST(price AS DECIMAL(10,2)) AS unit_price,
         CAST(round(price * (0.35 + sf_rnd(i, 15) * 0.35), 2) AS DECIMAL(10,2)) AS unit_cost
       FROM base`,
      `CREATE OR REPLACE TABLE customers AS
       WITH base AS (SELECT i, sf_pick(${FIRST}, i, 21) AS fn, sf_pick(${LAST}, i, 22) AS ln FROM range(${nCustomers}) r(i))
       SELECT CAST(i + 1 AS INTEGER) AS customer_id, fn AS first_name, ln AS last_name,
         CASE WHEN sf_rnd(i, 23) < 0.02 THEN NULL ELSE ${fakeEmail("fn", "ln", "i + 1")} END AS email,
         ${fakePhone("i", 24)} AS phone,
         CAST(sf_int(i, 25, 1, 999) AS VARCHAR) || ' ' || sf_pick(${STREETS}, i, 26) AS street,
         sf_pick(${CITIES}, i, 27) AS city,
         sf_pick(${REGIONS}, i, 28) AS region,
         DATE '${p.start}' - CAST(sf_int(i, 29, 6600, 29000) AS INTEGER) AS birth_date,
         DATE '${p.start}' - CAST(sf_int(i, 30, 0, 1500) AS INTEGER) AS signup_date,
         sf_pick(['none', 'none', 'none', 'silver', 'silver', 'gold', 'platinum'], i, 31) AS loyalty_tier
       FROM base
       UNION ALL
       -- Planted: the same people entered a second time.
       SELECT CAST(${nCustomers} + k + 1 AS INTEGER), sf_pick(${FIRST}, k * 97, 21), sf_pick(${LAST}, k * 97, 22),
         ${fakeEmail(`sf_pick(${FIRST}, k * 97, 21)`, `sf_pick(${LAST}, k * 97, 22)`, "k * 97 + 1")},
         ${fakePhone("k", 24)}, '1 Elm St', 'Springfield', 'North', DATE '1990-01-01', DATE '${p.start}', 'none'
       FROM range(6) r(k) WHERE sf_rnd(k * 97, 23) >= 0.02`,
      `CREATE OR REPLACE TABLE orders AS
       SELECT CAST(i + 1 AS INTEGER) AS order_id,
         CASE WHEN i < 5 THEN CAST(900000 + i AS INTEGER) ELSE CAST(1 + floor(pow(sf_rnd(i, 41), 1.6) * ${nCustomers}) AS INTEGER) END AS customer_id,
         CASE WHEN sf_rnd(i, 42) < 0.3 THEN 1 ELSE CAST(sf_int(i, 43, 2, 40) AS INTEGER) END AS store_id,
         sf_ts(i, 44) AS ordered_at,
         CASE WHEN sf_rnd(i, 42) < 0.3 THEN sf_pick(['web', 'app'], i, 45) ELSE 'store' END AS channel,
         CASE WHEN sf_rnd(i, 46) < 0.03 THEN 'cancelled' WHEN sf_rnd(i, 46) < 0.08 THEN 'returned' ELSE 'completed' END AS status
       FROM range(${nOrders}) r(i)`,
      `CREATE OR REPLACE TABLE order_items AS
       WITH lines AS (
         SELECT o.order_id, CAST(l.line AS INTEGER) AS line_no, CAST(1 + floor(pow(sf_rnd(o.order_id * 10 + l.line, 51), 1.4) * ${nProducts}) AS INTEGER) AS product_id,
           CASE WHEN sf_rnd(o.order_id * 10 + l.line, 52) < 0.004 THEN -1 ELSE CAST(sf_int(o.order_id * 10 + l.line, 53, 1, 4) AS INTEGER) END AS quantity,
           sf_rnd(o.order_id * 10 + l.line, 54) AS d
         FROM orders o, range(1, CAST(sf_int(o.order_id, 55, 2, 5) AS BIGINT)) l(line))
       SELECT order_id, line_no, lines.product_id, quantity, p.unit_price,
         CAST(CASE WHEN d < 0.2 THEN round(p.unit_price * quantity * 0.15, 2) ELSE 0 END AS DECIMAL(10,2)) AS discount,
         CAST(p.unit_price * quantity - CASE WHEN d < 0.2 THEN round(p.unit_price * quantity * 0.15, 2) ELSE 0 END AS DECIMAL(12,2)) AS line_amount
       FROM lines JOIN products p ON p.product_id = lines.product_id`,
      `CREATE OR REPLACE TABLE inventory AS
       SELECT s.store_id, p.product_id,
         CAST(sf_int(s.store_id * 1000 + p.product_id, 61, 0, 120) AS INTEGER) AS on_hand,
         CAST(sf_int(s.store_id * 1000 + p.product_id, 62, 5, 25) AS INTEGER) AS reorder_point,
         DATE '${p.start}' + ${p.days - 1} AS counted_on
       FROM stores s, products p WHERE s.store_id > 1 AND sf_rnd(s.store_id * 1000 + p.product_id, 63) < 0.6`,
      `CREATE OR REPLACE TABLE returns AS
       SELECT CAST(row_number() OVER (ORDER BY i.order_id, i.line_no) AS INTEGER) AS return_id, i.order_id, i.line_no,
         CAST(o.ordered_at AS DATE) + CAST(sf_int(i.order_id * 10 + i.line_no, 71, 1, 30) AS INTEGER) AS returned_on,
         sf_pick(['Wrong size', 'Damaged', 'Not as described', 'Changed mind', 'Arrived late'], i.order_id * 10 + i.line_no, 72) AS reason,
         i.line_amount AS refund_amount
       FROM order_items i JOIN orders o ON o.order_id = i.order_id
       WHERE o.status = 'returned' AND i.quantity > 0`,
    ];
  },
  forms: [form],
  pipelines: [pipeline],
  conversations: [refundsConversation(tables, pipeline), retailLifecycleConversation(tables, pipeline)],
  ...withStarters({
    sourceId: "retail",
    title: "Retail",
    tables,
    form,
    formContext: "After a store visit, record what you found. The report is kept with the store's other visits.",
    pipeline,
    explore: { table: "orders", sql: "SELECT * FROM orders", sorts: [{ column: "ordered_at", desc: true }] },
    model: ["customers", "orders", "order_items", "products", "stores", "returns"],
    dashboard: {
      title: "Retail sales",
      description: "Revenue, orders and basket size, by month, category and channel.",
      metrics: [
        { label: "Revenue", sql: "SELECT line_amount FROM order_items", column: "line_amount", aggregate: "sum", format: "currency" },
        { label: "Orders", sql: "SELECT order_id FROM orders WHERE status = 'completed'", column: "order_id", aggregate: "count_distinct", format: "compact" },
        { label: "Customers who bought", sql: "SELECT customer_id FROM orders", column: "customer_id", aggregate: "count_distinct", format: "compact" },
      ],
      trend: { label: "Revenue by month", sql: "SELECT o.ordered_at, i.line_amount FROM orders o JOIN order_items i ON i.order_id = o.order_id", x: "ordered_at", column: "line_amount", aggregate: "sum", format: "currency" },
      charts: [
        { label: "Revenue by category", sql: "SELECT p.category, i.line_amount FROM order_items i JOIN products p ON p.product_id = i.product_id", type: "bar", x: "category", y: [{ column: "line_amount", aggregate: "sum", label: "Revenue" }], yTitle: "Revenue (USD)" },
        { label: "Orders by month and channel", sql: "SELECT ordered_at, channel, order_id FROM orders", type: "line", x: "ordered_at", xGrain: "month", y: [{ column: "order_id", aggregate: "count", label: "Orders" }], splitBy: "channel" },
        { label: "Returns by reason", sql: "SELECT reason, return_id FROM returns", type: "bar", x: "reason", y: [{ column: "return_id", aggregate: "count", label: "Returns" }] },
        { label: "Order size", sql: "SELECT order_id, SUM(line_amount) AS order_total FROM order_items GROUP BY order_id", type: "bar", x: "order_total", xBins: 30, y: [{ aggregate: "count", label: "Orders" }] },
      ],
    },
  }),
};
