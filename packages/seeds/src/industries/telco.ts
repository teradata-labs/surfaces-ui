import { CITIES, FIRST, LAST, REGIONS, fakeEmail, fakePhone, prelude, rows, withDefaults } from "../sql.js";
import { withStarters } from "../starters.js";
import { telcoLifecycleConversation } from "./telco-lifecycle.js";
import type { Seed, SeedForm, SeedPipeline, SeedTable } from "../types.js";

const tables: SeedTable[] = [
  {
    name: "plans",
    description: "Mobile plans on sale, with their monthly fee and data allowance.",
    grain: "one row per plan",
    primaryKey: ["plan_id"],
    columns: [
      { name: "plan_id", type: "INTEGER", description: "Plan identifier." },
      { name: "plan_name", type: "VARCHAR", description: "Name as sold." },
      { name: "plan_type", type: "VARCHAR", description: "prepaid or postpaid." },
      { name: "monthly_fee", type: "DECIMAL(8,2)", description: "Monthly fee, USD." },
      { name: "data_gb", type: "INTEGER", description: "Data included per month, GB; 0 means unlimited." },
    ],
  },
  {
    name: "subscribers",
    description: "Customers with a line, their plan and how they pay. All invented.",
    grain: "one row per subscriber",
    primaryKey: ["subscriber_id"],
    columns: [
      { name: "subscriber_id", type: "INTEGER", description: "Subscriber identifier." },
      { name: "first_name", type: "VARCHAR", description: "Given name.", pii: "name" },
      { name: "last_name", type: "VARCHAR", description: "Family name.", pii: "name" },
      { name: "email", type: "VARCHAR", description: "Email address.", pii: "email" },
      { name: "phone_number", type: "VARCHAR", description: "The line's number.", pii: "phone" },
      { name: "birth_date", type: "DATE", description: "Date of birth.", pii: "birth_date" },
      { name: "city", type: "VARCHAR", description: "Billing city." },
      { name: "region", type: "VARCHAR", description: "Sales region." },
      { name: "joined_on", type: "DATE", description: "First day of service." },
      { name: "plan_id", type: "INTEGER", description: "Current plan." },
      { name: "autopay", type: "BOOLEAN", description: "Pays by automatic debit." },
      { name: "paperless", type: "BOOLEAN", description: "Gets bills by email." },
    ],
    foreignKeys: [{ column: "plan_id", table: "plans", references: "plan_id" }],
  },
  {
    name: "contracts",
    description: "The term each subscriber signed up to.",
    grain: "one row per subscriber contract",
    primaryKey: ["contract_id"],
    columns: [
      { name: "contract_id", type: "INTEGER", description: "Contract identifier." },
      { name: "subscriber_id", type: "INTEGER", description: "The subscriber." },
      { name: "contract_type", type: "VARCHAR", description: "month_to_month, one_year or two_year." },
      { name: "start_date", type: "DATE", description: "First day." },
      { name: "end_date", type: "DATE", description: "Last day; empty for month to month." },
    ],
    foreignKeys: [{ column: "subscriber_id", table: "subscribers", references: "subscriber_id" }],
  },
  {
    name: "usage_daily",
    description: "Each subscriber's data, calls and texts per day, over the last 30 days of the period.",
    grain: "one row per subscriber per day",
    primaryKey: ["subscriber_id", "usage_date"],
    columns: [
      { name: "subscriber_id", type: "INTEGER", description: "The subscriber." },
      { name: "usage_date", type: "DATE", description: "The day." },
      { name: "data_mb", type: "DOUBLE", description: "Data used, MB." },
      { name: "voice_minutes", type: "DOUBLE", description: "Minutes of calls." },
      { name: "sms_count", type: "INTEGER", description: "Texts sent." },
      { name: "dropped_calls", type: "INTEGER", description: "Calls that dropped." },
    ],
    foreignKeys: [{ column: "subscriber_id", table: "subscribers", references: "subscriber_id" }],
  },
  {
    name: "tickets",
    description: "Support contacts: what they were about, how they came in and how they ended.",
    grain: "one row per support ticket",
    primaryKey: ["ticket_id"],
    columns: [
      { name: "ticket_id", type: "INTEGER", description: "Ticket identifier." },
      { name: "subscriber_id", type: "INTEGER", description: "Who raised it." },
      { name: "opened_at", type: "TIMESTAMP", description: "When, UTC." },
      { name: "category", type: "VARCHAR", description: "billing, coverage, device, plan_change or cancellation." },
      { name: "channel", type: "VARCHAR", description: "phone, chat or store." },
      { name: "resolved_at", type: "TIMESTAMP", description: "When closed, UTC; empty while open." },
      { name: "satisfaction", type: "INTEGER", description: "Survey score 1 to 5; empty when not answered." },
    ],
    foreignKeys: [{ column: "subscriber_id", table: "subscribers", references: "subscriber_id" }],
  },
  {
    name: "payments",
    description: "Monthly bills and when they were paid.",
    grain: "one row per bill",
    primaryKey: ["payment_id"],
    columns: [
      { name: "payment_id", type: "INTEGER", description: "Payment identifier." },
      { name: "subscriber_id", type: "INTEGER", description: "Who was billed." },
      { name: "due_date", type: "DATE", description: "Due date." },
      { name: "paid_date", type: "DATE", description: "Day paid; empty if unpaid." },
      { name: "amount", type: "DECIMAL(8,2)", description: "Billed, USD." },
      { name: "method", type: "VARCHAR", description: "autopay, card, bank or cash." },
    ],
    foreignKeys: [{ column: "subscriber_id", table: "subscribers", references: "subscriber_id" }],
  },
  {
    name: "churn_events",
    description: "Subscribers who left, when and why. The label a churn model learns.",
    grain: "one row per subscriber who left",
    primaryKey: ["subscriber_id"],
    columns: [
      { name: "subscriber_id", type: "INTEGER", description: "Who left." },
      { name: "churned_on", type: "DATE", description: "Last day of service." },
      { name: "reason", type: "VARCHAR", description: "Reason given." },
      { name: "offered_retention", type: "BOOLEAN", description: "Was offered a deal to stay." },
    ],
    foreignKeys: [{ column: "subscriber_id", table: "subscribers", references: "subscriber_id" }],
  },
];

const form: SeedForm = {
  id: "telco-retention-call",
  title: "Retention call",
  description: "The outcome of a call to a subscriber the churn model flagged.",
  table: "retention_calls",
  fields: [
    { name: "subscriber_id", label: "Subscriber", type: "integer", required: true, min: 1 },
    { name: "reached", label: "Reached the subscriber", type: "boolean" },
    { name: "outcome", label: "Outcome", type: "choice", required: true, options: ["Staying", "Leaving", "Undecided", "No answer"] },
    { name: "offer", label: "Offer made", type: "choice", options: ["None", "Discount 10%", "Discount 20%", "Free upgrade", "Data boost"] },
    { name: "follow_up_on", label: "Follow up on", type: "date" },
    { name: "notes", label: "Notes", type: "longtext", maxLength: 1000 },
  ],
};

const pipeline: SeedPipeline = {
  id: "telco-churn",
  name: "Churn features pipeline",
  description: "Builds one row per subscriber with usage, support and payment behaviour and whether they left: the training table for a churn model.",
  datasets: [
    {
      name: "usage_30d",
      kind: "view",
      layer: "silver",
      description: "Usage per subscriber over the last 30 days.",
      depends: ["usage_daily"],
      grain: "one row per subscriber",
      primaryKey: ["subscriber_id"],
      checks: [{ kind: "relationships", columns: ["subscriber_id"], to: { table: "subscribers", column: "subscriber_id" } }],
      sql: "SELECT subscriber_id, SUM(data_mb) / 1024 AS data_gb, SUM(voice_minutes) AS voice_minutes, SUM(dropped_calls) AS dropped_calls FROM usage_daily GROUP BY subscriber_id",
    },
    {
      name: "churn_features",
      layer: "gold",
      description: "One row per subscriber: tenure, contract, plan fee, usage, tickets, late payments and the churn label.",
      depends: ["subscribers", "plans", "contracts", "usage_30d", "churn_events", "tickets", "payments"],
      grain: "one row per subscriber",
      primaryKey: ["subscriber_id"],
      columns: [
        { name: "subscriber_id", type: "INTEGER" },
        { name: "tenure_months", type: "BIGINT", description: "Months from joining to leaving, or to the end of 2025." },
        { name: "contract_type", type: "VARCHAR" },
        { name: "churned", type: "BOOLEAN", description: "Whether they left: the label a model learns." },
      ],
      checks: [{ kind: "accepted_values", columns: ["contract_type"], values: ["month_to_month", "one_year", "two_year"] }],
      tags: ["churn", "ml"],
      owner: "Customer analytics",
      sql: "SELECT s.subscriber_id, date_diff('month', s.joined_on, coalesce(ch.churned_on, DATE '2025-12-31')) AS tenure_months, c.contract_type, p.monthly_fee, s.autopay, coalesce(u.data_gb, 0) AS data_gb, coalesce(u.dropped_calls, 0) AS dropped_calls, (SELECT COUNT(*) FROM tickets t WHERE t.subscriber_id = s.subscriber_id) AS tickets, (SELECT COUNT(*) FROM payments y WHERE y.subscriber_id = s.subscriber_id AND (y.paid_date IS NULL OR y.paid_date > y.due_date)) AS late_payments, ch.subscriber_id IS NOT NULL AS churned FROM subscribers s JOIN plans p ON p.plan_id = s.plan_id JOIN contracts c ON c.subscriber_id = s.subscriber_id LEFT JOIN usage_30d u ON u.subscriber_id = s.subscriber_id LEFT JOIN churn_events ch ON ch.subscriber_id = s.subscriber_id",
      expectations: [{ name: "tenure_not_negative", constraint: "tenure_months >= 0", action: "warn" }],
    },
  ],
};

export const telco: Seed = {
  id: "telco",
  title: "Telco churn",
  industry: "Telecommunications",
  description: "A mobile operator's subscribers, plans, contracts, daily usage, support tickets, payments and who left.",
  tables,
  issues: [
    { table: "usage_daily", column: "data_mb", kind: "out_of_range", description: "A few days show negative data use from a billing system reset.", sql: "SELECT * FROM usage_daily WHERE data_mb < 0" },
    { table: "tickets", column: "resolved_at", kind: "inconsistent", description: "Some tickets were resolved before they were opened.", sql: "SELECT * FROM tickets WHERE resolved_at < opened_at" },
    { table: "subscribers", column: "region", kind: "inconsistent", description: "Region is sometimes in lower case.", sql: "SELECT region, COUNT(*) FROM subscribers GROUP BY region ORDER BY region" },
  ],
  sql(params) {
    const p = withDefaults(params);
    const n = rows(5000, p);
    return [
      ...prelude(p),
      `CREATE OR REPLACE TABLE plans AS
       SELECT * FROM (VALUES
         (1, 'Starter 5', 'prepaid', 15.00, 5), (2, 'Everyday 15', 'postpaid', 35.00, 15), (3, 'Plus 40', 'postpaid', 55.00, 40),
         (4, 'Unlimited', 'postpaid', 75.00, 0), (5, 'Unlimited Max', 'postpaid', 95.00, 0), (6, 'Pay as you go', 'prepaid', 10.00, 2)
       ) t(plan_id, plan_name, plan_type, monthly_fee, data_gb)`,
      `CREATE OR REPLACE TABLE subscribers AS
       WITH base AS (SELECT i, sf_pick(${FIRST}, i, 301) AS fn, sf_pick(${LAST}, i, 302) AS ln FROM range(${n}) r(i))
       SELECT CAST(i + 1 AS INTEGER) AS subscriber_id, fn AS first_name, ln AS last_name, ${fakeEmail("fn", "ln", "i + 1")} AS email,
         ${fakePhone("i", 303)} AS phone_number,
         DATE '${p.start}' - CAST(sf_int(i, 304, 6600, 29000) AS INTEGER) AS birth_date,
         sf_pick(${CITIES}, i, 305) AS city,
         CASE WHEN sf_rnd(i, 306) < 0.03 THEN lower(sf_pick(${REGIONS}, i, 307)) ELSE sf_pick(${REGIONS}, i, 307) END AS region,
         DATE '${p.start}' - CAST(sf_int(i, 308, 0, 2400) AS INTEGER) AS joined_on,
         CAST(sf_pick([1, 2, 2, 3, 3, 4, 4, 5, 6], i, 309) AS INTEGER) AS plan_id,
         sf_rnd(i, 310) < 0.55 AS autopay,
         sf_rnd(i, 311) < 0.6 AS paperless
       FROM base`,
      `CREATE OR REPLACE TABLE contracts AS
       SELECT CAST(subscriber_id AS INTEGER) AS contract_id, subscriber_id,
         sf_pick(['month_to_month', 'month_to_month', 'one_year', 'two_year'], subscriber_id, 321) AS contract_type,
         joined_on AS start_date,
         CASE sf_pick(['month_to_month', 'month_to_month', 'one_year', 'two_year'], subscriber_id, 321) WHEN 'one_year' THEN joined_on + 365 WHEN 'two_year' THEN joined_on + 730 END AS end_date
       FROM subscribers`,
      // Risk drives tickets, late payments and leaving, so the features carry signal.
      `CREATE OR REPLACE TABLE sf_risk AS
       SELECT s.subscriber_id,
         (CASE WHEN c.contract_type = 'month_to_month' THEN 0.3 WHEN c.contract_type = 'one_year' THEN 0.12 ELSE 0.06 END) + (CASE WHEN s.autopay THEN 0 ELSE 0.12 END) + (CASE WHEN p.monthly_fee > 70 THEN 0.08 ELSE 0 END) + sf_rnd(s.subscriber_id, 331) * 0.5 AS risk
       FROM subscribers s JOIN contracts c ON c.subscriber_id = s.subscriber_id JOIN plans p ON p.plan_id = s.plan_id`,
      `CREATE OR REPLACE TABLE churn_events AS
       SELECT subscriber_id, sf_day(subscriber_id, 341) AS churned_on,
         sf_pick(['Price', 'Coverage', 'Moved to a competitor', 'Customer service', 'Moving away', 'Device offer elsewhere'], subscriber_id, 342) AS reason,
         sf_rnd(subscriber_id, 343) < 0.4 AS offered_retention
       FROM sf_risk WHERE risk > 0.68`,
      `CREATE OR REPLACE TABLE usage_daily AS
       SELECT s.subscriber_id, DATE '${p.start}' + ${p.days - 30} + CAST(d.k AS INTEGER) AS usage_date,
         round(CASE WHEN sf_rnd(s.subscriber_id * 31 + d.k, 351) < 0.0005 THEN -500 ELSE (CASE WHEN p.data_gb = 0 THEN 900 ELSE p.data_gb * 30 END) * sf_rnd(s.subscriber_id * 31 + d.k, 352) * (CASE WHEN ch.subscriber_id IS NULL THEN 1 ELSE 0.4 END) END, 1) AS data_mb,
         round(sf_rnd(s.subscriber_id * 31 + d.k, 353) * 60, 1) AS voice_minutes,
         CAST(sf_int(s.subscriber_id * 31 + d.k, 354, 0, 25) AS INTEGER) AS sms_count,
         CAST(CASE WHEN sf_rnd(s.subscriber_id * 31 + d.k, 355) < (CASE WHEN ch.reason = 'Coverage' THEN 0.3 ELSE 0.04 END) THEN 1 ELSE 0 END AS INTEGER) AS dropped_calls
       FROM subscribers s JOIN plans p ON p.plan_id = s.plan_id LEFT JOIN churn_events ch ON ch.subscriber_id = s.subscriber_id, range(30) d(k)
       WHERE ch.churned_on IS NULL OR ch.churned_on >= DATE '${p.start}' + ${p.days - 30} + CAST(d.k AS INTEGER)`,
      `CREATE OR REPLACE TABLE tickets AS
       WITH t AS (
         SELECT r.subscriber_id, k, r.risk, sf_ts(r.subscriber_id * 7 + k, 361) AS opened_at
         FROM sf_risk r, range(CAST(floor(r.risk * 4 * sf_rnd(r.subscriber_id, 362)) AS BIGINT)) n(k))
       SELECT CAST(row_number() OVER (ORDER BY subscriber_id, k) AS INTEGER) AS ticket_id, subscriber_id, opened_at,
         sf_pick(['billing', 'billing', 'coverage', 'device', 'plan_change', 'cancellation'], subscriber_id * 7 + k, 363) AS category,
         sf_pick(['phone', 'phone', 'chat', 'store'], subscriber_id * 7 + k, 364) AS channel,
         CASE WHEN sf_rnd(subscriber_id * 7 + k, 365) < 0.05 THEN NULL WHEN sf_rnd(subscriber_id * 7 + k, 366) < 0.004 THEN opened_at - INTERVAL 1 HOUR ELSE opened_at + to_hours(sf_int(subscriber_id * 7 + k, 367, 1, 120)) END AS resolved_at,
         CASE WHEN sf_rnd(subscriber_id * 7 + k, 368) < 0.5 THEN NULL ELSE CAST(greatest(1, least(5, round(5 - risk * 4 + sf_rnd(subscriber_id * 7 + k, 369)))) AS INTEGER) END AS satisfaction
       FROM t`,
      `CREATE OR REPLACE TABLE payments AS
       SELECT CAST(row_number() OVER (ORDER BY s.subscriber_id, m.k) AS INTEGER) AS payment_id, s.subscriber_id,
         CAST(date_trunc('month', DATE '${p.start}') + to_months(m.k) + INTERVAL 14 DAY AS DATE) AS due_date,
         CASE WHEN sf_rnd(s.subscriber_id * 13 + m.k, 371) < r.risk * 0.08 THEN NULL
              ELSE CAST(date_trunc('month', DATE '${p.start}') + to_months(m.k) + INTERVAL 14 DAY AS DATE) + CAST(CASE WHEN s.autopay THEN 0 ELSE sf_int(s.subscriber_id * 13 + m.k, 372, -5, CAST(r.risk * 30 AS INTEGER)) END AS INTEGER) END AS paid_date,
         p.monthly_fee AS amount,
         CASE WHEN s.autopay THEN 'autopay' ELSE sf_pick(['card', 'bank', 'cash'], s.subscriber_id * 13 + m.k, 373) END AS method
       FROM subscribers s JOIN plans p ON p.plan_id = s.plan_id JOIN sf_risk r ON r.subscriber_id = s.subscriber_id LEFT JOIN churn_events ch ON ch.subscriber_id = s.subscriber_id,
         range(CAST(${Math.max(1, Math.floor(p.days / 30))} AS BIGINT)) m(k)
       WHERE ch.churned_on IS NULL OR ch.churned_on >= CAST(date_trunc('month', DATE '${p.start}') + to_months(m.k) AS DATE)`,
      "DROP TABLE sf_risk",
    ];
  },
  forms: [form],
  pipelines: [pipeline],
  conversations: [telcoLifecycleConversation(tables, pipeline)],
  ...withStarters({
    sourceId: "telco",
    title: "Telco churn",
    tables,
    form,
    formContext: "Record each retention call. Outcomes are compared later with who actually stayed.",
    pipeline,
    explore: { table: "subscribers", sql: "SELECT * FROM subscribers", sorts: [{ column: "joined_on", desc: true }] },
    model: ["subscribers", "plans", "contracts", "usage_daily", "tickets", "payments", "churn_events"],
    dashboard: {
      title: "Churn",
      description: "Who leaves, when and why, against contract type, support contacts and how people pay.",
      metrics: [
        { label: "Subscribers", sql: "SELECT subscriber_id FROM subscribers", column: "subscriber_id", aggregate: "count", format: "compact" },
        { label: "Left in the period", sql: "SELECT subscriber_id FROM churn_events", column: "subscriber_id", aggregate: "count", format: "compact" },
        { label: "Monthly revenue", sql: "SELECT p.monthly_fee FROM subscribers s JOIN plans p ON p.plan_id = s.plan_id LEFT JOIN churn_events c ON c.subscriber_id = s.subscriber_id WHERE c.subscriber_id IS NULL", column: "monthly_fee", aggregate: "sum", format: "currency" },
      ],
      trend: { label: "Leavers by month", sql: "SELECT churned_on, subscriber_id FROM churn_events", x: "churned_on", column: "subscriber_id", aggregate: "count", format: "number" },
      charts: [
        { label: "Churn rate by contract type", sql: "SELECT c.contract_type, CASE WHEN ch.subscriber_id IS NULL THEN 0.0 ELSE 1.0 END AS churned FROM contracts c LEFT JOIN churn_events ch ON ch.subscriber_id = c.subscriber_id", type: "bar", x: "contract_type", y: [{ column: "churned", aggregate: "avg", label: "Churn rate" }] },
        { label: "Why people left", sql: "SELECT reason, subscriber_id FROM churn_events", type: "bar", x: "reason", y: [{ column: "subscriber_id", aggregate: "count", label: "Leavers" }] },
        { label: "Support tickets by month and category", sql: "SELECT opened_at, category, ticket_id FROM tickets", type: "line", x: "opened_at", xGrain: "month", y: [{ column: "ticket_id", aggregate: "count", label: "Tickets" }], splitBy: "category" },
        { label: "Churn rate by plan", sql: "SELECT p.plan_name, CASE WHEN ch.subscriber_id IS NULL THEN 0.0 ELSE 1.0 END AS churned FROM subscribers s JOIN plans p ON p.plan_id = s.plan_id LEFT JOIN churn_events ch ON ch.subscriber_id = s.subscriber_id", type: "bar", x: "plan_name", y: [{ column: "churned", aggregate: "avg", label: "Churn rate" }] },
      ],
    },
  }),
};
