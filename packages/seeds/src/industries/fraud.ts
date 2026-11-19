import { FIRST, LAST, fakeEmail, list, prelude, rows, withDefaults } from "../sql.js";
import { withStarters } from "../starters.js";
import type { Seed, SeedForm, SeedPipeline, SeedTable } from "../types.js";

const COUNTRIES = list(["US", "US", "US", "US", "GB", "DE", "FR", "CA", "MX", "BR", "NG", "IN"]);

const tables: SeedTable[] = [
  {
    name: "accounts",
    description: "Bank accounts and who holds them. All invented.",
    grain: "one row per account",
    primaryKey: ["account_id"],
    columns: [
      { name: "account_id", type: "INTEGER", description: "Account identifier." },
      { name: "holder_name", type: "VARCHAR", description: "Account holder.", pii: "name" },
      { name: "email", type: "VARCHAR", description: "Contact email.", pii: "email" },
      { name: "account_number", type: "VARCHAR", description: "Account number, masked to the last four digits.", pii: "account_number" },
      { name: "home_country", type: "VARCHAR", description: "Country of residence, ISO code." },
      { name: "opened_on", type: "DATE", description: "Day opened." },
      { name: "kyc_status", type: "VARCHAR", description: "verified, pending or failed." },
      { name: "risk_segment", type: "VARCHAR", description: "low, medium or high, from onboarding." },
    ],
  },
  {
    name: "cards",
    description: "Payment cards issued on accounts.",
    grain: "one row per card",
    primaryKey: ["card_id"],
    columns: [
      { name: "card_id", type: "INTEGER", description: "Card identifier." },
      { name: "account_id", type: "INTEGER", description: "The account." },
      { name: "card_type", type: "VARCHAR", description: "debit, credit or virtual." },
      { name: "last4", type: "VARCHAR", description: "Last four digits.", pii: "account_number" },
      { name: "issued_on", type: "DATE", description: "Day issued." },
      { name: "status", type: "VARCHAR", description: "active, blocked or expired." },
    ],
    foreignKeys: [{ column: "account_id", table: "accounts", references: "account_id" }],
  },
  {
    name: "merchants",
    description: "Businesses that take card payments, with their category code and risk level.",
    grain: "one row per merchant",
    primaryKey: ["merchant_id"],
    columns: [
      { name: "merchant_id", type: "INTEGER", description: "Merchant identifier." },
      { name: "merchant_name", type: "VARCHAR", description: "Trading name." },
      { name: "mcc", type: "VARCHAR", description: "Merchant category code." },
      { name: "category", type: "VARCHAR", description: "What the code means." },
      { name: "country", type: "VARCHAR", description: "Where it trades, ISO code." },
      { name: "risk_level", type: "VARCHAR", description: "low, medium or high." },
    ],
  },
  {
    name: "devices",
    description: "Phones and browsers seen signing in to an account.",
    grain: "one row per device",
    primaryKey: ["device_id"],
    columns: [
      { name: "device_id", type: "INTEGER", description: "Device identifier." },
      { name: "account_id", type: "INTEGER", description: "The account it signed in to." },
      { name: "device_fingerprint", type: "VARCHAR", description: "Hashed fingerprint.", pii: "device_id" },
      { name: "device_type", type: "VARCHAR", description: "ios, android or web." },
      { name: "ip_country", type: "VARCHAR", description: "Country its traffic comes from." },
      { name: "first_seen", type: "TIMESTAMP", description: "First sign-in, UTC." },
    ],
    foreignKeys: [{ column: "account_id", table: "accounts", references: "account_id" }],
  },
  {
    name: "transactions",
    description: "Card payments, with how they were made and whether they were later confirmed as fraud.",
    grain: "one row per card transaction",
    primaryKey: ["txn_id"],
    columns: [
      { name: "txn_id", type: "BIGINT", description: "Transaction identifier." },
      { name: "card_id", type: "INTEGER", description: "The card." },
      { name: "merchant_id", type: "INTEGER", description: "The merchant." },
      { name: "device_id", type: "INTEGER", description: "The device, for card-not-present payments; empty in person." },
      { name: "txn_at", type: "TIMESTAMP", description: "When, UTC." },
      { name: "amount", type: "DECIMAL(12,2)", description: "Amount in the card's currency." },
      { name: "currency", type: "VARCHAR", description: "ISO currency code." },
      { name: "channel", type: "VARCHAR", description: "in_person, online or atm." },
      { name: "is_fraud", type: "BOOLEAN", description: "Confirmed fraud after investigation. The label a model would learn." },
    ],
    foreignKeys: [
      { column: "card_id", table: "cards", references: "card_id" },
      { column: "merchant_id", table: "merchants", references: "merchant_id" },
      { column: "device_id", table: "devices", references: "device_id" },
    ],
  },
  {
    name: "alerts",
    description: "Transactions a rule or model flagged for review, and what the reviewer decided.",
    grain: "one row per alert",
    primaryKey: ["alert_id"],
    columns: [
      { name: "alert_id", type: "INTEGER", description: "Alert identifier." },
      { name: "txn_id", type: "BIGINT", description: "The flagged transaction." },
      { name: "rule", type: "VARCHAR", description: "What flagged it." },
      { name: "score", type: "DOUBLE", description: "Risk score from 0 to 1." },
      { name: "created_at", type: "TIMESTAMP", description: "When raised, UTC." },
      { name: "status", type: "VARCHAR", description: "open, confirmed_fraud or false_positive." },
    ],
    foreignKeys: [{ column: "txn_id", table: "transactions", references: "txn_id" }],
  },
  {
    name: "chargebacks",
    description: "Payments a cardholder disputed, and how the dispute ended.",
    grain: "one row per chargeback",
    primaryKey: ["chargeback_id"],
    columns: [
      { name: "chargeback_id", type: "INTEGER", description: "Chargeback identifier." },
      { name: "txn_id", type: "BIGINT", description: "The disputed transaction." },
      { name: "reason_code", type: "VARCHAR", description: "Why it was disputed." },
      { name: "filed_on", type: "DATE", description: "Day filed." },
      { name: "amount", type: "DECIMAL(12,2)", description: "Amount disputed." },
      { name: "outcome", type: "VARCHAR", description: "won, lost or open." },
    ],
    foreignKeys: [{ column: "txn_id", table: "transactions", references: "txn_id" }],
  },
];

const form: SeedForm = {
  id: "fraud-case-review",
  title: "Review an alert",
  description: "An analyst's decision on a flagged transaction. It becomes a training label, so be exact.",
  table: "case_reviews",
  fields: [
    { name: "alert_id", label: "Alert", type: "integer", required: true, min: 1 },
    { name: "decision", label: "Decision", type: "choice", required: true, options: ["Fraud", "Not fraud", "Needs more information"] },
    { name: "amount_at_risk", label: "Amount at risk", type: "number", min: 0 },
    { name: "contacted_customer", label: "Customer contacted", type: "boolean" },
    { name: "note", label: "Note", type: "longtext", maxLength: 500, help: "What you checked, for the next reviewer." },
  ],
};

const pipeline: SeedPipeline = {
  id: "fraud-features",
  name: "Fraud features pipeline",
  description: "Builds per-transaction features (amount against the card's usual, foreign device, night time) and daily fraud rates by channel.",
  datasets: [
    {
      name: "txn_enriched",
      kind: "view",
      layer: "silver",
      description: "Transactions with their merchant, card and device, and whether the device's country differs from the account's.",
      sql: "SELECT t.txn_id, t.txn_at, t.amount, t.channel, t.is_fraud, m.category, m.risk_level, a.account_id, a.home_country, d.ip_country, d.ip_country IS NOT NULL AND d.ip_country <> a.home_country AS foreign_device, hour(t.txn_at) < 6 AS night FROM transactions t JOIN cards c ON c.card_id = t.card_id JOIN accounts a ON a.account_id = c.account_id JOIN merchants m ON m.merchant_id = t.merchant_id LEFT JOIN devices d ON d.device_id = t.device_id",
      expectations: [{ name: "positive_amount", constraint: "amount > 0", action: "drop" }],
    },
    {
      name: "card_baseline",
      layer: "silver",
      description: "Each account's median and 95th percentile payment.",
      sql: "SELECT account_id, median(amount) AS median_amount, quantile_cont(amount, 0.95) AS p95_amount, COUNT(*) AS txns FROM txn_enriched GROUP BY account_id",
    },
    {
      name: "fraud_rate_daily",
      layer: "gold",
      description: "Transactions, fraud and fraud rate per day and channel.",
      sql: "SELECT CAST(txn_at AS DATE) AS day, channel, COUNT(*) AS txns, SUM(CASE WHEN is_fraud THEN 1 ELSE 0 END) AS fraud, AVG(CASE WHEN is_fraud THEN 1.0 ELSE 0.0 END) AS fraud_rate FROM txn_enriched GROUP BY 1, 2",
    },
  ],
};

export const fraud: Seed = {
  id: "fraud",
  title: "Fraud detection",
  industry: "Financial services",
  description: "Card payments with accounts, cards, merchants and devices, the alerts raised on them, chargebacks, and a confirmed-fraud label.",
  tables,
  issues: [
    { table: "transactions", column: "amount", kind: "out_of_range", description: "A few transactions have an amount of zero or less.", sql: "SELECT * FROM transactions WHERE amount <= 0" },
    { table: "transactions", column: "currency", kind: "inconsistent", description: "Some currencies are lower case.", sql: "SELECT currency, COUNT(*) FROM transactions WHERE currency <> upper(currency) GROUP BY currency" },
    { table: "alerts", kind: "duplicates", description: "A few transactions were alerted twice by the same rule.", sql: "SELECT txn_id, rule, COUNT(*) AS n FROM alerts GROUP BY txn_id, rule HAVING COUNT(*) > 1" },
  ],
  sql(params) {
    const p = withDefaults(params);
    const nAccounts = rows(3000, p);
    const nTxns = rows(40000, p);
    return [
      ...prelude(p),
      `CREATE OR REPLACE TABLE accounts AS
       WITH base AS (SELECT i, sf_pick(${FIRST}, i, 201) AS fn, sf_pick(${LAST}, i, 202) AS ln FROM range(${nAccounts}) r(i))
       SELECT CAST(i + 1 AS INTEGER) AS account_id, fn || ' ' || ln AS holder_name, ${fakeEmail("fn", "ln", "i + 1")} AS email,
         '****' || lpad(CAST(sf_int(i, 203, 0, 9999) AS VARCHAR), 4, '0') AS account_number,
         sf_pick(${COUNTRIES}, i, 204) AS home_country,
         DATE '${p.start}' - CAST(sf_int(i, 205, 0, 2500) AS INTEGER) AS opened_on,
         sf_pick(['verified', 'verified', 'verified', 'verified', 'verified', 'pending', 'failed'], i, 206) AS kyc_status,
         sf_pick(['low', 'low', 'low', 'medium', 'medium', 'high'], i, 207) AS risk_segment
       FROM base`,
      `CREATE OR REPLACE TABLE cards AS
       SELECT CAST(row_number() OVER (ORDER BY a.account_id, n.k) AS INTEGER) AS card_id, a.account_id,
         sf_pick(['debit', 'debit', 'credit', 'virtual'], a.account_id * 3 + n.k, 211) AS card_type,
         lpad(CAST(sf_int(a.account_id * 3 + n.k, 212, 0, 9999) AS VARCHAR), 4, '0') AS last4,
         a.opened_on + CAST(sf_int(a.account_id * 3 + n.k, 213, 0, 300) AS INTEGER) AS issued_on,
         sf_pick(['active', 'active', 'active', 'active', 'active', 'blocked', 'expired'], a.account_id * 3 + n.k, 214) AS status
       FROM accounts a, range(CAST(sf_int(a.account_id, 215, 1, 2) AS BIGINT)) n(k)`,
      `CREATE OR REPLACE TABLE merchants AS
       WITH m AS (SELECT [{'mcc': '5411', 'cat': 'Grocery'}, {'mcc': '5812', 'cat': 'Restaurants'}, {'mcc': '5541', 'cat': 'Fuel'}, {'mcc': '5732', 'cat': 'Electronics'}, {'mcc': '5999', 'cat': 'Misc retail'}, {'mcc': '4829', 'cat': 'Money transfer'}, {'mcc': '7995', 'cat': 'Gambling'}, {'mcc': '5967', 'cat': 'Direct marketing'}, {'mcc': '4121', 'cat': 'Taxis and rideshare'}, {'mcc': '5311', 'cat': 'Department stores'}] AS codes)
       SELECT CAST(i + 1 AS INTEGER) AS merchant_id,
         sf_pick(['North', 'Blue', 'Quick', 'Prime', 'Corner', 'Metro', 'Star', 'Green'], i, 221) || ' ' || sf_pick(['Market', 'Express', 'Shop', 'Hub', 'Store', 'Pay', 'Online', 'Depot'], i, 222) || ' ' || CAST(i + 1 AS VARCHAR) AS merchant_name,
         codes[CAST(1 + floor(pow(sf_rnd(i, 223), 1.3) * len(codes)) AS INTEGER)].mcc AS mcc,
         codes[CAST(1 + floor(pow(sf_rnd(i, 223), 1.3) * len(codes)) AS INTEGER)].cat AS category,
         sf_pick(${COUNTRIES}, i, 224) AS country,
         CASE WHEN codes[CAST(1 + floor(pow(sf_rnd(i, 223), 1.3) * len(codes)) AS INTEGER)].mcc IN ('4829', '7995', '5967', '5732') THEN 'high' WHEN sf_rnd(i, 225) < 0.3 THEN 'medium' ELSE 'low' END AS risk_level
       FROM m, range(400) r(i)`,
      `CREATE OR REPLACE TABLE devices AS
       SELECT CAST(row_number() OVER (ORDER BY a.account_id, n.k) AS INTEGER) AS device_id, a.account_id,
         md5(CAST(a.account_id * 10 + n.k AS VARCHAR) || '${p.seed}') AS device_fingerprint,
         sf_pick(['ios', 'android', 'web'], a.account_id * 10 + n.k, 231) AS device_type,
         CASE WHEN n.k > 0 AND sf_rnd(a.account_id * 10 + n.k, 232) < 0.25 THEN sf_pick(${COUNTRIES}, a.account_id * 10 + n.k, 233) ELSE a.home_country END AS ip_country,
         CAST(a.opened_on AS TIMESTAMP) + to_days(sf_int(a.account_id * 10 + n.k, 234, 0, 400)) AS first_seen
       FROM accounts a, range(CAST(sf_int(a.account_id, 235, 1, 3) AS BIGINT)) n(k)`,
      `CREATE OR REPLACE TABLE transactions AS
       WITH ncards AS (SELECT COUNT(*) AS n FROM cards), ndev AS (SELECT COUNT(*) AS n FROM devices),
       base AS (
         SELECT i, CAST(1 + floor(sf_rnd(i, 241) * (SELECT n FROM ncards)) AS INTEGER) AS card_id,
           CAST(1 + floor(pow(sf_rnd(i, 242), 1.8) * 400) AS INTEGER) AS merchant_id,
           sf_pick(['in_person', 'in_person', 'in_person', 'online', 'online', 'atm'], i, 243) AS channel,
           sf_rnd(i, 244) < CASE sf_pick(['in_person', 'in_person', 'in_person', 'online', 'online', 'atm'], i, 243) WHEN 'online' THEN 0.032 WHEN 'atm' THEN 0.012 ELSE 0.005 END AS is_fraud
         FROM range(${nTxns}) r(i))
       SELECT CAST(i + 1 AS BIGINT) AS txn_id, b.card_id, b.merchant_id,
         CASE WHEN channel = 'online' THEN (SELECT min(d.device_id) FROM devices d JOIN cards c ON c.account_id = d.account_id WHERE c.card_id = b.card_id) END AS device_id,
         CASE WHEN is_fraud AND sf_rnd(i, 245) < 0.6 THEN CAST(sf_day(i, 246) AS TIMESTAMP) + to_minutes(sf_int(i, 247, 0, 359)) ELSE sf_ts(i, 246) END AS txn_at,
         CAST(CASE WHEN sf_rnd(i, 248) < 0.0008 THEN 0
                   WHEN is_fraud THEN round(150 + pow(sf_rnd(i, 249), 0.7) * 2400, 2)
                   ELSE round(2 + pow(sf_rnd(i, 249), 3) * 900, 2) END AS DECIMAL(12,2)) AS amount,
         CASE WHEN sf_rnd(i, 250) < 0.002 THEN 'usd' ELSE 'USD' END AS currency,
         channel, is_fraud
       FROM base b`,
      `CREATE OR REPLACE TABLE alerts AS
       WITH flagged AS (
         SELECT t.txn_id, t.txn_at, t.is_fraud, t.amount,
           CASE WHEN t.amount > 1000 THEN 'High amount' WHEN hour(t.txn_at) < 6 THEN 'Night-time spend' WHEN t.channel = 'online' THEN 'New device online' ELSE 'Velocity' END AS rule
         FROM transactions t
         WHERE (t.is_fraud AND sf_rnd(t.txn_id, 251) < 0.8) OR (NOT t.is_fraud AND (t.amount > 700 OR sf_rnd(t.txn_id, 252) < 0.01)))
       SELECT CAST(row_number() OVER (ORDER BY txn_id, dup) AS INTEGER) AS alert_id, txn_id, rule,
         round(CASE WHEN is_fraud THEN 0.55 + sf_rnd(txn_id, 253) * 0.45 ELSE sf_rnd(txn_id, 253) * 0.8 END, 3) AS score,
         txn_at + to_seconds(sf_int(txn_id, 254, 5, 600)) AS created_at,
         CASE WHEN sf_rnd(txn_id, 255) < 0.1 THEN 'open' WHEN is_fraud THEN 'confirmed_fraud' ELSE 'false_positive' END AS status
       FROM flagged, range(CASE WHEN sf_rnd(txn_id, 256) < 0.01 THEN 2 ELSE 1 END) d(dup)`,
      `CREATE OR REPLACE TABLE chargebacks AS
       SELECT CAST(row_number() OVER (ORDER BY txn_id) AS INTEGER) AS chargeback_id, txn_id,
         CASE WHEN is_fraud THEN sf_pick(['10.4 Card absent fraud', '10.5 Visa fraud monitoring'], txn_id, 261) ELSE sf_pick(['13.1 Not received', '13.3 Not as described', '12.6 Duplicate'], txn_id, 261) END AS reason_code,
         CAST(txn_at AS DATE) + CAST(sf_int(txn_id, 262, 5, 60) AS INTEGER) AS filed_on,
         amount,
         sf_pick(['won', 'lost', 'lost', 'open'], txn_id, 263) AS outcome
       FROM transactions WHERE (is_fraud AND sf_rnd(txn_id, 264) < 0.7) OR (NOT is_fraud AND sf_rnd(txn_id, 264) < 0.003)`,
    ];
  },
  forms: [form],
  pipelines: [pipeline],
  ...withStarters({
    sourceId: "fraud",
    title: "Fraud detection",
    tables,
    form,
    formContext: "Alerts waiting for a decision are in the alerts table with status open. Your decision becomes a label for the fraud model.",
    pipeline,
    explore: { table: "alerts", sql: "SELECT * FROM alerts WHERE status = 'open'", sorts: [{ column: "score", desc: true }] },
    model: ["accounts", "cards", "transactions", "merchants", "devices", "alerts", "chargebacks"],
    dashboard: {
      title: "Fraud monitoring",
      description: "Payments, confirmed fraud and alert quality by month, channel and merchant category.",
      metrics: [
        { label: "Payments", sql: "SELECT txn_id FROM transactions", column: "txn_id", aggregate: "count", format: "compact" },
        { label: "Fraud losses", sql: "SELECT amount FROM transactions WHERE is_fraud", column: "amount", aggregate: "sum", format: "currency" },
        { label: "Alerts that were fraud", sql: "SELECT CASE WHEN status = 'confirmed_fraud' THEN 1.0 ELSE 0.0 END AS hit FROM alerts WHERE status <> 'open'", column: "hit", aggregate: "avg", format: "percent" },
      ],
      trend: { label: "Fraud losses by month", sql: "SELECT txn_at, amount FROM transactions WHERE is_fraud", x: "txn_at", column: "amount", aggregate: "sum", format: "currency" },
      charts: [
        { label: "Fraud rate by channel", sql: "SELECT channel, CASE WHEN is_fraud THEN 1.0 ELSE 0.0 END AS fraud FROM transactions", type: "bar", x: "channel", y: [{ column: "fraud", aggregate: "avg", label: "Fraud rate" }] },
        { label: "Fraud losses by merchant category", sql: "SELECT m.category, t.amount FROM transactions t JOIN merchants m ON m.merchant_id = t.merchant_id WHERE t.is_fraud", type: "bar", x: "category", y: [{ column: "amount", aggregate: "sum", label: "Losses" }], yTitle: "Losses" },
        { label: "Alerts by month and outcome", sql: "SELECT created_at, status, alert_id FROM alerts", type: "line", x: "created_at", xGrain: "month", y: [{ column: "alert_id", aggregate: "count", label: "Alerts" }], splitBy: "status" },
        { label: "Alert scores", sql: "SELECT score FROM alerts", type: "bar", x: "score", xBins: 20, y: [{ aggregate: "count", label: "Alerts" }] },
      ],
    },
  }),
};
