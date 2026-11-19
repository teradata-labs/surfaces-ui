import { FIRST, LAST, fakePhone, list, prelude, rows, withDefaults } from "../sql.js";
import { withStarters } from "../starters.js";
import type { Seed, SeedForm, SeedPipeline, SeedTable } from "../types.js";

const DEPOTS = list(["Riverton", "Lakeside", "Northgate", "Fairview", "Westport"]);

const tables: SeedTable[] = [
  {
    name: "vehicles",
    description: "Trucks and vans in the fleet.",
    grain: "one row per vehicle",
    primaryKey: ["vehicle_id"],
    columns: [
      { name: "vehicle_id", type: "INTEGER", description: "Vehicle identifier." },
      { name: "plate", type: "VARCHAR", description: "Registration plate." },
      { name: "make", type: "VARCHAR", description: "Manufacturer." },
      { name: "vehicle_type", type: "VARCHAR", description: "van, box_truck or tractor." },
      { name: "model_year", type: "INTEGER", description: "Model year." },
      { name: "capacity_kg", type: "INTEGER", description: "Payload, kg." },
      { name: "depot", type: "VARCHAR", description: "Home depot." },
    ],
  },
  {
    name: "drivers",
    description: "People who drive for the fleet. All invented.",
    grain: "one row per driver",
    primaryKey: ["driver_id"],
    columns: [
      { name: "driver_id", type: "INTEGER", description: "Driver identifier." },
      { name: "first_name", type: "VARCHAR", description: "Given name.", pii: "name" },
      { name: "last_name", type: "VARCHAR", description: "Family name.", pii: "name" },
      { name: "license_number", type: "VARCHAR", description: "Driving licence number.", pii: "government_id" },
      { name: "phone", type: "VARCHAR", description: "Phone number.", pii: "phone" },
      { name: "hired_on", type: "DATE", description: "Start date." },
      { name: "depot", type: "VARCHAR", description: "Home depot." },
    ],
  },
  {
    name: "routes",
    description: "Delivery routes run from each depot.",
    grain: "one row per route",
    primaryKey: ["route_id"],
    columns: [
      { name: "route_id", type: "INTEGER", description: "Route identifier." },
      { name: "route_name", type: "VARCHAR", description: "Name." },
      { name: "depot", type: "VARCHAR", description: "Where it starts." },
      { name: "planned_km", type: "DOUBLE", description: "Planned distance, km." },
      { name: "planned_minutes", type: "INTEGER", description: "Planned duration." },
    ],
  },
  {
    name: "stops",
    description: "The stops on each route, in order.",
    grain: "one row per stop on a route",
    primaryKey: ["route_id", "stop_seq"],
    columns: [
      { name: "route_id", type: "INTEGER", description: "The route." },
      { name: "stop_seq", type: "INTEGER", description: "Order on the route." },
      { name: "stop_name", type: "VARCHAR", description: "Customer or place." },
      { name: "lat", type: "DOUBLE", description: "Latitude." },
      { name: "lon", type: "DOUBLE", description: "Longitude." },
      { name: "window_minutes", type: "INTEGER", description: "Delivery window length." },
    ],
    foreignKeys: [{ column: "route_id", table: "routes", references: "route_id" }],
  },
  {
    name: "trips",
    description: "Each time a route was driven: by whom, in what, how long it took and whether it was on time.",
    grain: "one row per trip",
    primaryKey: ["trip_id"],
    columns: [
      { name: "trip_id", type: "INTEGER", description: "Trip identifier." },
      { name: "route_id", type: "INTEGER", description: "The route." },
      { name: "vehicle_id", type: "INTEGER", description: "The vehicle." },
      { name: "driver_id", type: "INTEGER", description: "The driver." },
      { name: "scheduled_start", type: "TIMESTAMP", description: "Planned start, UTC." },
      { name: "actual_start", type: "TIMESTAMP", description: "Actual start, UTC." },
      { name: "actual_end", type: "TIMESTAMP", description: "Actual end, UTC." },
      { name: "distance_km", type: "DOUBLE", description: "Distance driven." },
      { name: "fuel_l", type: "DOUBLE", description: "Fuel used, litres." },
      { name: "on_time", type: "BOOLEAN", description: "Finished within 15 minutes of plan." },
      { name: "status", type: "VARCHAR", description: "completed or cancelled." },
    ],
    foreignKeys: [
      { column: "route_id", table: "routes", references: "route_id" },
      { column: "vehicle_id", table: "vehicles", references: "vehicle_id" },
      { column: "driver_id", table: "drivers", references: "driver_id" },
    ],
  },
  {
    name: "gps_events",
    description: "Telematics events during trips: position pings and driving events.",
    grain: "one row per telematics event",
    primaryKey: ["event_id"],
    columns: [
      { name: "event_id", type: "BIGINT", description: "Event identifier." },
      { name: "trip_id", type: "INTEGER", description: "The trip." },
      { name: "event_at", type: "TIMESTAMP", description: "When, UTC." },
      { name: "event_type", type: "VARCHAR", description: "ping, harsh_brake, speeding or idle." },
      { name: "speed_kph", type: "DOUBLE", description: "Speed, km/h." },
      { name: "lat", type: "DOUBLE", description: "Latitude.", pii: "location" },
      { name: "lon", type: "DOUBLE", description: "Longitude.", pii: "location" },
    ],
    foreignKeys: [{ column: "trip_id", table: "trips", references: "trip_id" }],
  },
  {
    name: "maintenance",
    description: "Work done on vehicles: planned servicing and breakdowns.",
    grain: "one row per work order",
    primaryKey: ["work_id"],
    columns: [
      { name: "work_id", type: "INTEGER", description: "Work order identifier." },
      { name: "vehicle_id", type: "INTEGER", description: "The vehicle." },
      { name: "opened_on", type: "DATE", description: "Day opened." },
      { name: "closed_on", type: "DATE", description: "Day closed." },
      { name: "category", type: "VARCHAR", description: "service, tyres, brakes, engine or electrical." },
      { name: "unplanned", type: "BOOLEAN", description: "A breakdown, not scheduled work." },
      { name: "cost", type: "DECIMAL(10,2)", description: "Cost, USD." },
    ],
    foreignKeys: [{ column: "vehicle_id", table: "vehicles", references: "vehicle_id" }],
  },
];

const form: SeedForm = {
  id: "transport-incident",
  title: "Report an incident",
  description: "A driver or dispatcher's report of something that went wrong on a trip.",
  table: "incidents",
  fields: [
    { name: "trip_id", label: "Trip", type: "integer", required: true, min: 1 },
    { name: "occurred_at", label: "When it happened", type: "datetime", required: true },
    { name: "kind", label: "What happened", type: "choice", required: true, options: ["Delay", "Vehicle fault", "Damaged goods", "Collision", "Access problem", "Other"] },
    { name: "minutes_lost", label: "Minutes lost", type: "integer", min: 0, max: 1440 },
    { name: "vehicle_usable", label: "Vehicle still usable", type: "boolean" },
    { name: "description", label: "What happened", type: "longtext", required: true, maxLength: 1000 },
  ],
};

const pipeline: SeedPipeline = {
  id: "transport-ops",
  name: "Fleet operations pipeline",
  description: "Cleans trips and telematics, then builds on-time performance by route and a safety score per driver.",
  datasets: [
    {
      name: "trips_clean",
      kind: "view",
      layer: "silver",
      description: "Completed trips with their duration, leaving out trips that end before they start.",
      sql: "SELECT trip_id, route_id, vehicle_id, driver_id, actual_start, actual_end, date_diff('minute', actual_start, actual_end) AS minutes, distance_km, fuel_l, on_time FROM trips WHERE status = 'completed'",
      expectations: [{ name: "ends_after_start", constraint: "actual_end > actual_start", action: "drop" }],
    },
    {
      name: "route_performance",
      layer: "gold",
      description: "Trips, on-time rate and fuel per 100 km by route and month.",
      sql: "SELECT date_trunc('month', actual_start) AS month, route_id, COUNT(*) AS trips, AVG(CASE WHEN on_time THEN 1.0 ELSE 0.0 END) AS on_time_rate, 100 * SUM(fuel_l) / SUM(distance_km) AS litres_per_100km FROM trips_clean GROUP BY 1, 2",
    },
    {
      name: "driver_safety",
      layer: "gold",
      description: "Harsh braking and speeding events per 100 km by driver, with impossible speeds left out.",
      sql: "SELECT t.driver_id, SUM(t.distance_km) AS km, 100.0 * COUNT(*) FILTER (WHERE g.event_type IN ('harsh_brake', 'speeding')) / SUM(t.distance_km) AS events_per_100km FROM trips_clean t JOIN gps_events g ON g.trip_id = t.trip_id WHERE g.speed_kph < 200 GROUP BY t.driver_id",
    },
  ],
};

export const transportation: Seed = {
  id: "transportation",
  title: "Transportation",
  industry: "Transportation and logistics",
  description: "A delivery fleet: vehicles, drivers, routes and stops, trips with telematics events, and maintenance.",
  tables,
  issues: [
    { table: "gps_events", column: "speed_kph", kind: "out_of_range", description: "A few telematics readings show impossible speeds from GPS glitches.", sql: "SELECT * FROM gps_events WHERE speed_kph > 200" },
    { table: "trips", column: "actual_end", kind: "inconsistent", description: "Some trips end before they start.", sql: "SELECT * FROM trips WHERE actual_end <= actual_start" },
    { table: "maintenance", column: "closed_on", kind: "nulls", description: "Some work orders were never closed.", sql: "SELECT * FROM maintenance WHERE closed_on IS NULL" },
  ],
  sql(params) {
    const p = withDefaults(params);
    const nTrips = rows(6000, p);
    return [
      ...prelude(p),
      `CREATE OR REPLACE TABLE vehicles AS
       SELECT CAST(i + 1 AS INTEGER) AS vehicle_id,
         chr(CAST(65 + sf_int(i, 401, 0, 25) AS INTEGER)) || chr(CAST(65 + sf_int(i, 402, 0, 25) AS INTEGER)) || '-' || lpad(CAST(sf_int(i, 403, 0, 9999) AS VARCHAR), 4, '0') AS plate,
         sf_pick(['Ford', 'Mercedes', 'Volvo', 'Isuzu', 'Ram'], i, 404) AS make,
         sf_pick(['van', 'van', 'van', 'box_truck', 'box_truck', 'tractor'], i, 405) AS vehicle_type,
         CAST(sf_int(i, 406, 2014, 2025) AS INTEGER) AS model_year,
         CAST(CASE sf_pick(['van', 'van', 'van', 'box_truck', 'box_truck', 'tractor'], i, 405) WHEN 'van' THEN 1500 WHEN 'box_truck' THEN 6000 ELSE 20000 END AS INTEGER) AS capacity_kg,
         sf_pick(${DEPOTS}, i, 407) AS depot
       FROM range(120) r(i)`,
      `CREATE OR REPLACE TABLE drivers AS
       SELECT CAST(i + 1 AS INTEGER) AS driver_id, sf_pick(${FIRST}, i, 411) AS first_name, sf_pick(${LAST}, i, 412) AS last_name,
         'D' || lpad(CAST(sf_int(i, 413, 0, 99999999) AS VARCHAR), 8, '0') AS license_number,
         ${fakePhone("i", 414)} AS phone,
         DATE '${p.start}' - CAST(sf_int(i, 415, 30, 4000) AS INTEGER) AS hired_on,
         sf_pick(${DEPOTS}, i, 416) AS depot
       FROM range(160) r(i)`,
      `CREATE OR REPLACE TABLE routes AS
       SELECT CAST(i + 1 AS INTEGER) AS route_id, sf_pick(${DEPOTS}, i, 421) || ' ' || sf_pick(['North', 'South', 'East', 'West', 'Loop', 'Express'], i, 422) || ' ' || CAST(i + 1 AS VARCHAR) AS route_name,
         sf_pick(${DEPOTS}, i, 421) AS depot,
         round(40 + sf_rnd(i, 423) * 260, 1) AS planned_km,
         CAST(90 + sf_rnd(i, 423) * 420 AS INTEGER) AS planned_minutes
       FROM range(60) r(i)`,
      `CREATE OR REPLACE TABLE stops AS
       SELECT r.route_id, CAST(s.k + 1 AS INTEGER) AS stop_seq,
         sf_pick(['Warehouse', 'Market', 'Clinic', 'School', 'Depot', 'Shop', 'Office', 'Site'], r.route_id * 40 + s.k, 431) || ' ' || CAST(r.route_id * 40 + s.k AS VARCHAR) AS stop_name,
         round(41.5 + sf_rnd(r.route_id * 40 + s.k, 432) * 1.5, 5) AS lat,
         round(-88.5 + sf_rnd(r.route_id * 40 + s.k, 433) * 2, 5) AS lon,
         CAST(sf_pick([30, 60, 60, 120], r.route_id * 40 + s.k, 434) AS INTEGER) AS window_minutes
       FROM routes r, range(CAST(sf_int(r.route_id, 435, 5, 25) AS BIGINT)) s(k)`,
      `CREATE OR REPLACE TABLE trips AS
       WITH base AS (
         SELECT i, CAST(sf_int(i, 441, 1, 60) AS INTEGER) AS route_id, CAST(sf_day(i, 442) AS TIMESTAMP) + to_minutes(sf_int(i, 443, 300, 660)) AS scheduled_start,
           sf_int(i, 444, -10, 25) AS late_start, sf_rnd(i, 445) AS slow
         FROM range(${nTrips}) r(i))
       SELECT CAST(i + 1 AS INTEGER) AS trip_id, b.route_id, CAST(sf_int(i, 446, 1, 120) AS INTEGER) AS vehicle_id, CAST(sf_int(i, 447, 1, 160) AS INTEGER) AS driver_id,
         scheduled_start,
         scheduled_start + to_minutes(late_start) AS actual_start,
         CASE WHEN sf_rnd(i, 448) < 0.003 THEN scheduled_start - INTERVAL 30 MINUTE ELSE scheduled_start + to_minutes(late_start + CAST(r.planned_minutes * (0.85 + slow * 0.45) AS BIGINT)) END AS actual_end,
         round(r.planned_km * (0.95 + sf_rnd(i, 449) * 0.15), 1) AS distance_km,
         round(r.planned_km * (0.95 + sf_rnd(i, 449) * 0.15) * (0.09 + sf_rnd(i, 450) * 0.08), 1) AS fuel_l,
         late_start + r.planned_minutes * (0.85 + slow * 0.45) - r.planned_minutes <= 15 AS on_time,
         CASE WHEN sf_rnd(i, 451) < 0.02 THEN 'cancelled' ELSE 'completed' END AS status
       FROM base b JOIN routes r ON r.route_id = b.route_id`,
      `CREATE OR REPLACE TABLE gps_events AS
       SELECT CAST(row_number() OVER (ORDER BY t.trip_id, e.k) AS BIGINT) AS event_id, t.trip_id,
         t.actual_start + to_minutes(e.k * 12) AS event_at,
         CASE WHEN sf_rnd(t.trip_id * 50 + e.k, 461) < 0.03 THEN 'harsh_brake' WHEN sf_rnd(t.trip_id * 50 + e.k, 461) < 0.06 THEN 'speeding' WHEN sf_rnd(t.trip_id * 50 + e.k, 461) < 0.1 THEN 'idle' ELSE 'ping' END AS event_type,
         CASE WHEN sf_rnd(t.trip_id * 50 + e.k, 462) < 0.0005 THEN 320 + sf_rnd(t.trip_id, 463) * 100 ELSE round(sf_rnd(t.trip_id * 50 + e.k, 464) * 110, 1) END AS speed_kph,
         round(41.5 + sf_rnd(t.trip_id * 50 + e.k, 465) * 1.5, 5) AS lat,
         round(-88.5 + sf_rnd(t.trip_id * 50 + e.k, 466) * 2, 5) AS lon
       FROM trips t, range(CAST(least(12, greatest(1, date_diff('minute', t.actual_start, t.actual_end) / 12)) AS BIGINT)) e(k)
       WHERE t.status = 'completed'`,
      `CREATE OR REPLACE TABLE maintenance AS
       SELECT CAST(row_number() OVER (ORDER BY v.vehicle_id, w.k) AS INTEGER) AS work_id, v.vehicle_id,
         sf_day(v.vehicle_id * 20 + w.k, 471) AS opened_on,
         CASE WHEN sf_rnd(v.vehicle_id * 20 + w.k, 472) < 0.04 THEN NULL ELSE sf_day(v.vehicle_id * 20 + w.k, 471) + CAST(sf_int(v.vehicle_id * 20 + w.k, 473, 0, 9) AS INTEGER) END AS closed_on,
         sf_pick(['service', 'service', 'tyres', 'brakes', 'engine', 'electrical'], v.vehicle_id * 20 + w.k, 474) AS category,
         sf_rnd(v.vehicle_id * 20 + w.k, 475) < 0.25 + (2025 - v.model_year) * 0.03 AS unplanned,
         CAST(round(150 + pow(sf_rnd(v.vehicle_id * 20 + w.k, 476), 2) * 6000, 2) AS DECIMAL(10,2)) AS cost
       FROM vehicles v, range(CAST(sf_int(v.vehicle_id, 477, 2, 10) AS BIGINT)) w(k)`,
    ];
  },
  forms: [form],
  pipelines: [pipeline],
  ...withStarters({
    sourceId: "transportation",
    title: "Transportation",
    tables,
    form,
    formContext: "Report delays, faults and damage as they happen; dispatch reviews them daily.",
    pipeline,
    explore: { table: "trips", sql: "SELECT * FROM trips", sorts: [{ column: "scheduled_start", desc: true }] },
    model: ["trips", "routes", "stops", "vehicles", "drivers", "gps_events", "maintenance"],
    dashboard: {
      title: "Fleet operations",
      description: "Trips, on-time delivery, fuel and breakdowns by month, depot and vehicle type.",
      metrics: [
        { label: "Trips", sql: "SELECT trip_id FROM trips WHERE status = 'completed'", column: "trip_id", aggregate: "count", format: "compact" },
        { label: "On time", sql: "SELECT CASE WHEN on_time THEN 1.0 ELSE 0.0 END AS on_time FROM trips WHERE status = 'completed'", column: "on_time", aggregate: "avg", format: "percent" },
        { label: "Distance", sql: "SELECT distance_km FROM trips WHERE status = 'completed'", column: "distance_km", aggregate: "sum", format: "compact" },
      ],
      trend: { label: "Trips by month", sql: "SELECT actual_start, trip_id FROM trips WHERE status = 'completed'", x: "actual_start", column: "trip_id", aggregate: "count", format: "number" },
      charts: [
        { label: "On-time rate by depot", sql: "SELECT r.depot, CASE WHEN t.on_time THEN 1.0 ELSE 0.0 END AS on_time FROM trips t JOIN routes r ON r.route_id = t.route_id WHERE t.status = 'completed'", type: "bar", x: "depot", y: [{ column: "on_time", aggregate: "avg", label: "On time" }] },
        { label: "Maintenance cost by category", sql: "SELECT category, cost FROM maintenance", type: "bar", x: "category", y: [{ column: "cost", aggregate: "sum", label: "Cost" }], yTitle: "Cost (USD)" },
        { label: "Breakdowns by month", sql: "SELECT opened_on, work_id FROM maintenance WHERE unplanned", type: "line", x: "opened_on", xGrain: "month", y: [{ column: "work_id", aggregate: "count", label: "Breakdowns" }] },
        { label: "Trip length", sql: "SELECT distance_km FROM trips WHERE status = 'completed'", type: "bar", x: "distance_km", xBins: 25, y: [{ aggregate: "count", label: "Trips" }] },
      ],
    },
  }),
};
