import { FIRST, LAST, prelude, rows, withDefaults } from "../sql.js";
import { withStarters } from "../starters.js";
import type { Seed, SeedForm, SeedPipeline, SeedTable } from "../types.js";

const tables: SeedTable[] = [
  {
    name: "plants",
    description: "Factories, where they are and when they started producing.",
    grain: "one row per plant",
    primaryKey: ["plant_id"],
    columns: [
      { name: "plant_id", type: "INTEGER", description: "Plant identifier." },
      { name: "plant_name", type: "VARCHAR", description: "Name." },
      { name: "country", type: "VARCHAR", description: "Country, ISO code." },
      { name: "opened_on", type: "DATE", description: "Day production started." },
    ],
  },
  {
    name: "lines",
    description: "Production lines in each plant and what they make.",
    grain: "one row per production line",
    primaryKey: ["line_id"],
    columns: [
      { name: "line_id", type: "INTEGER", description: "Line identifier." },
      { name: "plant_id", type: "INTEGER", description: "The plant." },
      { name: "line_name", type: "VARCHAR", description: "Name." },
      { name: "product_family", type: "VARCHAR", description: "What it makes." },
      { name: "rated_units_per_hour", type: "INTEGER", description: "Designed output." },
    ],
    foreignKeys: [{ column: "plant_id", table: "plants", references: "plant_id" }],
  },
  {
    name: "machines",
    description: "Machines on each line.",
    grain: "one row per machine",
    primaryKey: ["machine_id"],
    columns: [
      { name: "machine_id", type: "INTEGER", description: "Machine identifier." },
      { name: "line_id", type: "INTEGER", description: "The line." },
      { name: "machine_type", type: "VARCHAR", description: "press, cnc, welder, conveyor, oven or packer." },
      { name: "vendor", type: "VARCHAR", description: "Who made it." },
      { name: "installed_on", type: "DATE", description: "Day installed." },
    ],
    foreignKeys: [{ column: "line_id", table: "lines", references: "line_id" }],
  },
  {
    name: "work_orders",
    description: "Production runs: what was planned, made and scrapped, by shift.",
    grain: "one row per work order",
    primaryKey: ["work_order_id"],
    columns: [
      { name: "work_order_id", type: "INTEGER", description: "Work order identifier." },
      { name: "line_id", type: "INTEGER", description: "The line." },
      { name: "product_code", type: "VARCHAR", description: "Product made." },
      { name: "shift", type: "VARCHAR", description: "day, swing or night." },
      { name: "supervisor", type: "VARCHAR", description: "Shift supervisor responsible for the run.", pii: "name" },
      { name: "started_at", type: "TIMESTAMP", description: "Start, UTC." },
      { name: "ended_at", type: "TIMESTAMP", description: "End, UTC." },
      { name: "planned_qty", type: "INTEGER", description: "Units planned." },
      { name: "produced_qty", type: "INTEGER", description: "Units made, good and bad." },
      { name: "scrap_qty", type: "INTEGER", description: "Units scrapped." },
    ],
    foreignKeys: [{ column: "line_id", table: "lines", references: "line_id" }],
  },
  {
    name: "sensor_readings",
    description: "Hourly readings from each machine's sensors over the last 30 days of the period.",
    grain: "one row per machine per hour",
    primaryKey: ["machine_id", "reading_at"],
    columns: [
      { name: "machine_id", type: "INTEGER", description: "The machine." },
      { name: "reading_at", type: "TIMESTAMP", description: "Hour of the reading, UTC." },
      { name: "temperature_c", type: "DOUBLE", description: "Temperature, °C; empty when the sensor did not report." },
      { name: "vibration_mm_s", type: "DOUBLE", description: "Vibration velocity, mm/s." },
      { name: "pressure_bar", type: "DOUBLE", description: "Pressure, bar." },
      { name: "power_kw", type: "DOUBLE", description: "Power drawn, kW." },
    ],
    foreignKeys: [{ column: "machine_id", table: "machines", references: "machine_id" }],
  },
  {
    name: "inspections",
    description: "Quality checks on a sample from each work order.",
    grain: "one row per inspection",
    primaryKey: ["inspection_id"],
    columns: [
      { name: "inspection_id", type: "INTEGER", description: "Inspection identifier." },
      { name: "work_order_id", type: "INTEGER", description: "The work order sampled." },
      { name: "inspected_at", type: "TIMESTAMP", description: "When, UTC." },
      { name: "sample_size", type: "INTEGER", description: "Units checked." },
      { name: "defects", type: "INTEGER", description: "Units with a defect." },
      { name: "defect_type", type: "VARCHAR", description: "Most common defect; empty when none." },
      { name: "result", type: "VARCHAR", description: "pass or fail." },
    ],
    foreignKeys: [{ column: "work_order_id", table: "work_orders", references: "work_order_id" }],
  },
  {
    name: "downtime",
    description: "Periods a machine was stopped, and why.",
    grain: "one row per stoppage",
    primaryKey: ["downtime_id"],
    columns: [
      { name: "downtime_id", type: "INTEGER", description: "Stoppage identifier." },
      { name: "machine_id", type: "INTEGER", description: "The machine." },
      { name: "started_at", type: "TIMESTAMP", description: "Start, UTC." },
      { name: "ended_at", type: "TIMESTAMP", description: "End, UTC." },
      { name: "reason", type: "VARCHAR", description: "Why it stopped." },
      { name: "planned", type: "BOOLEAN", description: "Scheduled maintenance or changeover, not a fault." },
    ],
    foreignKeys: [{ column: "machine_id", table: "machines", references: "machine_id" }],
  },
];

const form: SeedForm = {
  id: "manufacturing-shift-handover",
  title: "Shift handover",
  description: "What the next shift needs to know about a line.",
  table: "shift_handovers",
  fields: [
    { name: "line_id", label: "Line", type: "integer", required: true, min: 1 },
    { name: "shift", label: "Shift ending", type: "choice", required: true, options: ["day", "swing", "night"] },
    { name: "units_made", label: "Units made", type: "integer", min: 0 },
    { name: "line_status", label: "Line status", type: "choice", required: true, options: ["Running", "Running slow", "Stopped"] },
    { name: "safety_issue", label: "Safety issue to pass on", type: "boolean" },
    { name: "notes", label: "Notes for the next shift", type: "longtext", maxLength: 1000 },
  ],
};

const pipeline: SeedPipeline = {
  id: "manufacturing-oee",
  name: "OEE pipeline",
  description: "Cleans work orders and stoppages, then builds overall equipment effectiveness (availability × performance × quality) per line and day.",
  datasets: [
    {
      name: "work_orders_clean",
      kind: "view",
      layer: "silver",
      description: "Work orders with run hours and good units, leaving out negative scrap.",
      sql: "SELECT w.work_order_id, w.line_id, CAST(w.started_at AS DATE) AS day, date_diff('minute', w.started_at, w.ended_at) / 60.0 AS run_hours, w.produced_qty, w.produced_qty - w.scrap_qty AS good_qty, w.scrap_qty, l.rated_units_per_hour FROM work_orders w JOIN lines l ON l.line_id = w.line_id",
      expectations: [{ name: "scrap_not_negative", constraint: "scrap_qty >= 0", action: "drop" }],
    },
    {
      name: "line_downtime_daily",
      layer: "silver",
      description: "Unplanned stopped hours per line and day.",
      sql: "SELECT m.line_id, CAST(d.started_at AS DATE) AS day, SUM(date_diff('minute', d.started_at, d.ended_at)) / 60.0 AS down_hours FROM downtime d JOIN machines m ON m.machine_id = d.machine_id WHERE NOT d.planned GROUP BY 1, 2",
    },
    {
      name: "oee_daily",
      layer: "gold",
      description: "Availability, performance, quality and OEE per line and day.",
      sql: "SELECT w.line_id, w.day, greatest(0, 1 - coalesce(MAX(d.down_hours), 0) / 24) AS availability, SUM(w.produced_qty) / NULLIF(SUM(w.run_hours * w.rated_units_per_hour), 0) AS performance, SUM(w.good_qty) / NULLIF(SUM(w.produced_qty), 0) AS quality, greatest(0, 1 - coalesce(MAX(d.down_hours), 0) / 24) * SUM(w.produced_qty) / NULLIF(SUM(w.run_hours * w.rated_units_per_hour), 0) * SUM(w.good_qty) / NULLIF(SUM(w.produced_qty), 0) AS oee FROM work_orders_clean w LEFT JOIN line_downtime_daily d ON d.line_id = w.line_id AND d.day = w.day GROUP BY 1, 2",
      expectations: [{ name: "oee_is_a_fraction", constraint: "oee BETWEEN 0 AND 1.2", action: "warn" }],
    },
  ],
};

export const manufacturing: Seed = {
  id: "manufacturing",
  title: "Manufacturing",
  industry: "Manufacturing",
  description: "Plants, lines and machines; production runs with scrap; hourly sensor readings; quality inspections and downtime.",
  tables,
  issues: [
    { table: "sensor_readings", column: "temperature_c", kind: "nulls", description: "Sensors sometimes fail to report; about 1% of temperatures are empty.", sql: "SELECT * FROM sensor_readings WHERE temperature_c IS NULL" },
    { table: "sensor_readings", column: "temperature_c", kind: "out_of_range", description: "A few readings of 999 °C are a sensor's error code, not a temperature.", sql: "SELECT * FROM sensor_readings WHERE temperature_c >= 999" },
    { table: "work_orders", column: "scrap_qty", kind: "out_of_range", description: "Some work orders have negative scrap from a correction keyed the wrong way.", sql: "SELECT * FROM work_orders WHERE scrap_qty < 0" },
  ],
  sql(params) {
    const p = withDefaults(params);
    const nOrders = rows(8000, p);
    return [
      ...prelude(p),
      `CREATE OR REPLACE TABLE plants AS
       SELECT * FROM (VALUES (1, 'Riverton Works', 'US', DATE '2004-03-01'), (2, 'Lakeside Assembly', 'US', DATE '2011-09-15'), (3, 'Monterrey Plant', 'MX', DATE '2016-05-02'), (4, 'Brno Plant', 'CZ', DATE '2019-01-14')) t(plant_id, plant_name, country, opened_on)`,
      `CREATE OR REPLACE TABLE lines AS
       SELECT CAST(i + 1 AS INTEGER) AS line_id, CAST(1 + i % 4 AS INTEGER) AS plant_id, 'Line ' || chr(CAST(65 + i AS INTEGER)) AS line_name,
         sf_pick(['Brackets', 'Housings', 'Valves', 'Panels', 'Gearboxes'], i, 501) AS product_family,
         CAST(sf_pick([120, 180, 240, 300, 400], i, 502) AS INTEGER) AS rated_units_per_hour
       FROM range(16) r(i)`,
      `CREATE OR REPLACE TABLE machines AS
       SELECT CAST(row_number() OVER (ORDER BY l.line_id, m.k) AS INTEGER) AS machine_id, l.line_id,
         sf_pick(['press', 'cnc', 'welder', 'conveyor', 'oven', 'packer'], l.line_id * 10 + m.k, 511) AS machine_type,
         sf_pick(['Kessler', 'Ortiz Industrial', 'Nordtek', 'Hanwa'], l.line_id * 10 + m.k, 512) AS vendor,
         DATE '${p.start}' - CAST(sf_int(l.line_id * 10 + m.k, 513, 100, 5000) AS INTEGER) AS installed_on
       FROM lines l, range(4) m(k)`,
      `CREATE OR REPLACE TABLE work_orders AS
       WITH base AS (
         SELECT i, CAST(sf_int(i, 521, 1, 16) AS INTEGER) AS line_id, sf_pick(['day', 'swing', 'night'], i, 522) AS shift,
           sf_day(i, 523) AS d, sf_int(i, 524, 4, 8) AS hours, sf_rnd(i, 525) AS eff
         FROM range(${nOrders}) r(i))
       SELECT CAST(i + 1 AS INTEGER) AS work_order_id, b.line_id,
         upper(left(l.product_family, 3)) || '-' || lpad(CAST(sf_int(i, 526, 1, 40) AS VARCHAR), 3, '0') AS product_code,
         shift,
         sf_pick(${FIRST}, b.line_id * 3 + CASE shift WHEN 'day' THEN 0 WHEN 'swing' THEN 1 ELSE 2 END, 520) || ' ' || sf_pick(${LAST}, b.line_id * 3 + CASE shift WHEN 'day' THEN 0 WHEN 'swing' THEN 1 ELSE 2 END, 519) AS supervisor,
         CAST(d AS TIMESTAMP) + to_hours(CASE shift WHEN 'day' THEN 6 WHEN 'swing' THEN 14 ELSE 22 END) AS started_at,
         CAST(d AS TIMESTAMP) + to_hours(CASE shift WHEN 'day' THEN 6 WHEN 'swing' THEN 14 ELSE 22 END + hours) AS ended_at,
         CAST(hours * l.rated_units_per_hour * 0.9 AS INTEGER) AS planned_qty,
         CAST(hours * l.rated_units_per_hour * (0.6 + eff * 0.35) * (CASE WHEN shift = 'night' THEN 0.92 ELSE 1 END) AS INTEGER) AS produced_qty,
         CAST(CASE WHEN sf_rnd(i, 527) < 0.004 THEN -sf_int(i, 528, 1, 20) ELSE hours * l.rated_units_per_hour * (0.6 + eff * 0.35) * (0.005 + pow(sf_rnd(i, 529), 3) * 0.08) END AS INTEGER) AS scrap_qty
       FROM base b JOIN lines l ON l.line_id = b.line_id`,
      `CREATE OR REPLACE TABLE sensor_readings AS
       SELECT m.machine_id, CAST(DATE '${p.start}' + ${p.days - 30} AS TIMESTAMP) + to_hours(h.k) AS reading_at,
         CASE WHEN sf_rnd(m.machine_id * 1000 + h.k, 531) < 0.01 THEN NULL
              WHEN sf_rnd(m.machine_id * 1000 + h.k, 532) < 0.0008 THEN 999.0
              ELSE round(CASE m.machine_type WHEN 'oven' THEN 180 WHEN 'welder' THEN 75 ELSE 45 END + sf_rnd(m.machine_id * 1000 + h.k, 533) * 12 + (CASE WHEN m.machine_id % 9 = 0 THEN h.k / 72.0 ELSE 0 END), 2) END AS temperature_c,
         round(1.5 + sf_rnd(m.machine_id * 1000 + h.k, 534) * 3 + (CASE WHEN m.machine_id % 9 = 0 THEN h.k / 120.0 ELSE 0 END), 2) AS vibration_mm_s,
         round(4 + sf_rnd(m.machine_id * 1000 + h.k, 535) * 2, 2) AS pressure_bar,
         round(10 + sf_rnd(m.machine_id * 1000 + h.k, 536) * 40, 2) AS power_kw
       FROM machines m, range(${30 * 24}) h(k)`,
      `CREATE OR REPLACE TABLE inspections AS
       SELECT CAST(row_number() OVER (ORDER BY w.work_order_id) AS INTEGER) AS inspection_id, w.work_order_id,
         w.ended_at - to_minutes(sf_int(w.work_order_id, 541, 5, 90)) AS inspected_at,
         CAST(50 AS INTEGER) AS sample_size,
         CAST(least(50, greatest(0, round(50.0 * greatest(w.scrap_qty, 0) / NULLIF(w.produced_qty, 0) + sf_rnd(w.work_order_id, 542) * 2))) AS INTEGER) AS defects,
         CASE WHEN least(50, greatest(0, round(50.0 * greatest(w.scrap_qty, 0) / NULLIF(w.produced_qty, 0) + sf_rnd(w.work_order_id, 542) * 2))) = 0 THEN NULL ELSE sf_pick(['Burr', 'Dimension out of tolerance', 'Surface scratch', 'Weld porosity', 'Missing part'], w.work_order_id, 543) END AS defect_type,
         CASE WHEN least(50, greatest(0, round(50.0 * greatest(w.scrap_qty, 0) / NULLIF(w.produced_qty, 0) + sf_rnd(w.work_order_id, 542) * 2))) > 2 THEN 'fail' ELSE 'pass' END AS result
       FROM work_orders w WHERE sf_rnd(w.work_order_id, 544) < 0.5`,
      `CREATE OR REPLACE TABLE downtime AS
       SELECT CAST(row_number() OVER (ORDER BY m.machine_id, s.k) AS INTEGER) AS downtime_id, m.machine_id,
         sf_ts(m.machine_id * 100 + s.k, 551) AS started_at,
         sf_ts(m.machine_id * 100 + s.k, 551) + to_minutes(sf_int(m.machine_id * 100 + s.k, 552, 10, 480)) AS ended_at,
         sf_pick(['Changeover', 'Planned maintenance', 'Jam', 'Tool wear', 'Overheating', 'No material', 'Electrical fault'], m.machine_id * 100 + s.k, 553) AS reason,
         sf_pick(['Changeover', 'Planned maintenance', 'Jam', 'Tool wear', 'Overheating', 'No material', 'Electrical fault'], m.machine_id * 100 + s.k, 553) IN ('Changeover', 'Planned maintenance') AS planned
       FROM machines m, range(CAST(sf_int(m.machine_id, 554, 10, 40) AS BIGINT)) s(k)`,
    ];
  },
  forms: [form],
  pipelines: [pipeline],
  ...withStarters({
    sourceId: "manufacturing",
    title: "Manufacturing",
    tables,
    form,
    formContext: "Hand over each line at the end of your shift. The next shift sees these first.",
    pipeline,
    explore: { table: "work_orders", sql: "SELECT * FROM work_orders", sorts: [{ column: "started_at", desc: true }] },
    model: ["plants", "lines", "machines", "work_orders", "inspections", "downtime"],
    dashboard: {
      title: "Production",
      description: "Output, scrap, inspection failures and downtime by month, line and cause.",
      metrics: [
        { label: "Units made", sql: "SELECT produced_qty FROM work_orders", column: "produced_qty", aggregate: "sum", format: "compact" },
        { label: "Scrap rate", sql: "SELECT CAST(scrap_qty AS DOUBLE) / NULLIF(produced_qty, 0) AS scrap_rate FROM work_orders WHERE scrap_qty >= 0", column: "scrap_rate", aggregate: "avg", format: "percent" },
        { label: "Inspections failed", sql: "SELECT CASE WHEN result = 'fail' THEN 1.0 ELSE 0.0 END AS failed FROM inspections", column: "failed", aggregate: "avg", format: "percent" },
      ],
      trend: { label: "Units by month", sql: "SELECT started_at, produced_qty FROM work_orders", x: "started_at", column: "produced_qty", aggregate: "sum", format: "compact" },
      charts: [
        { label: "Unplanned downtime by cause", sql: "SELECT reason, date_diff('minute', started_at, ended_at) / 60.0 AS hours FROM downtime WHERE NOT planned", type: "bar", x: "reason", y: [{ column: "hours", aggregate: "sum", label: "Hours" }], yTitle: "Hours stopped" },
        { label: "Units made by line", sql: "SELECT l.line_name, w.produced_qty FROM work_orders w JOIN lines l ON l.line_id = w.line_id", type: "bar", x: "line_name", y: [{ column: "produced_qty", aggregate: "sum", label: "Units" }] },
        { label: "Scrap by month and shift", sql: "SELECT started_at, shift, scrap_qty FROM work_orders WHERE scrap_qty >= 0", type: "line", x: "started_at", xGrain: "month", y: [{ column: "scrap_qty", aggregate: "sum", label: "Scrap" }], splitBy: "shift" },
        { label: "Defects found", sql: "SELECT defect_type, defects FROM inspections WHERE defect_type IS NOT NULL", type: "bar", x: "defect_type", y: [{ column: "defects", aggregate: "sum", label: "Defects" }] },
      ],
    },
  }),
};
