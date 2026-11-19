import { DEFAULT_PARAMS, type SeedParams } from "./types.js";

/**
 * Deterministic pseudo-random helpers as DuckDB macros. They use integer
 * arithmetic only, so the same parameters give the same data on every
 * DuckDB version and in the browser. Not for anything that needs real
 * randomness.
 *
 * - `sf_rnd(i, salt)`: a number in [0, 1).
 * - `sf_int(i, salt, lo, hi)`: a whole number from lo to hi.
 * - `sf_pick(list, i, salt)`: one item of a list.
 * - `sf_day(i, salt)`: a day within the covered period.
 * - `sf_ts(i, salt)`: a moment within the covered period, in UTC.
 */
export function prelude(params: SeedParams): string[] {
  const seed = Math.trunc(params.seed) % 100000;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.start)) throw new Error("start must be YYYY-MM-DD.");
  const days = Math.max(7, Math.min(3660, Math.trunc(params.days)));
  return [
    "SET TimeZone = 'UTC'",
    // Squaring modulo a prime is not linear, so draws with different salts are independent of each other.
    `CREATE OR REPLACE MACRO sf_mix(x) AS ((CAST(x AS BIGINT) % 2147483647) * (CAST(x AS BIGINT) % 2147483647) + 1013904223) % 2147483647`,
    `CREATE OR REPLACE MACRO sf_rnd(i, salt) AS sf_mix(sf_mix(((CAST(i AS BIGINT) + 1) * 1103515245 + CAST(salt AS BIGINT) * 2654435 + ${seed} * 97531) % 2147483647) + (CAST(i AS BIGINT) % 65521) * 31 + CAST(salt AS BIGINT) * 7919) / 2147483647.0`,
    `CREATE OR REPLACE MACRO sf_int(i, salt, lo, hi) AS CAST(lo + floor(sf_rnd(i, salt) * (hi - lo + 1)) AS BIGINT)`,
    `CREATE OR REPLACE MACRO sf_pick(list, i, salt) AS list[CAST(1 + floor(sf_rnd(i, salt) * len(list)) AS INTEGER)]`,
    `CREATE OR REPLACE MACRO sf_day(i, salt) AS DATE '${params.start}' + CAST(sf_int(i, salt, 0, ${days - 1}) AS INTEGER)`,
    `CREATE OR REPLACE MACRO sf_ts(i, salt) AS CAST(DATE '${params.start}' AS TIMESTAMP) + to_seconds(sf_int(i, salt, 0, ${days * 86400 - 1}))`,
  ];
}

export function withDefaults(params: Partial<SeedParams> = {}): SeedParams {
  const p = { ...DEFAULT_PARAMS, ...params };
  if (!(p.scale > 0 && p.scale <= 20)) throw new Error("scale must be above 0 and at most 20.");
  return p;
}

/** Row count for a table at this scale, never below 1. */
export const rows = (base: number, p: SeedParams) => Math.max(1, Math.round(base * p.scale));

const list = (items: string[]) => `[${items.map((s) => `'${s.replace(/'/g, "''")}'`).join(", ")}]`;

/** Invented names. Any match with a real person is chance. */
export const FIRST = list(["Ada", "Ben", "Chen", "Dara", "Eli", "Femi", "Gita", "Hugo", "Ines", "Jon", "Kemi", "Lars", "Maya", "Nico", "Olu", "Priya", "Quinn", "Rosa", "Sami", "Tara", "Uma", "Vik", "Wren", "Xia", "Yusuf", "Zoe", "Aria", "Bo", "Cleo", "Dev"]);
export const LAST = list(["Abara", "Brandt", "Castillo", "Dube", "Eriksen", "Fofana", "Garcia", "Hale", "Ito", "Jansen", "Kowal", "Lindqvist", "Mensah", "Novak", "Okafor", "Patel", "Quist", "Rossi", "Sato", "Torres", "Ueda", "Varga", "Walsh", "Xu", "Yilmaz", "Zhou", "Moreau", "Silva", "Nakamura", "Owusu"]);
export const CITIES = list(["Springfield", "Riverton", "Lakeside", "Fairview", "Greenville", "Maple Ridge", "Oakdale", "Brookfield", "Clearwater", "Hillcrest", "Westport", "Northgate"]);
export const REGIONS = list(["North", "South", "East", "West", "Central"]);
export const STREETS = list(["Elm St", "Oak Ave", "Pine Rd", "Cedar Ln", "Birch Way", "Willow Dr", "Ash Ct", "Maple St"]);
export { list };

/** A phone number in a range reserved for fiction (555-01xx). */
export const fakePhone = (i: string, salt: number) => `'+1-555-01' || lpad(CAST(sf_int(${i}, ${salt}, 0, 99) AS VARCHAR), 2, '0')`;
/** An address at example.com, which is reserved for examples. */
export const fakeEmail = (first: string, last: string, i: string) => `lower(${first}) || '.' || lower(${last}) || CAST(${i} AS VARCHAR) || '@example.com'`;
