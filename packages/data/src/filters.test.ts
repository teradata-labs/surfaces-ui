import { FilterOperator } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { type FilterSpec, filterWords, filtersExcept, filtersFromSpec, filtersToSpec, chosenValues, joinRelative, selectValues, sinceLabel, sinceStart, splitRelative, toggleValueFilter } from "./filters.js";

const now = new Date("2026-11-15T14:30:00Z");
const day = (date: Date | undefined) => date?.toISOString().slice(0, 10);

describe("relative date ranges", () => {
  it("start at the beginning of a day, so they move once a day at most", () => {
    expect(["7d", "30d", "4w", "3m", "1y", "12m"].map((r) => day(sinceStart(r, now)))).toEqual(["2026-11-08", "2026-10-16", "2026-10-18", "2026-08-15", "2025-11-15", "2025-11-15"]);
    expect(["week", "month", "quarter", "year"].map((r) => day(sinceStart(r, now)))).toEqual(["2026-11-09", "2026-11-01", "2026-10-01", "2026-01-01"]);
    expect(sinceStart("30d", now)?.getTime()).toBe(sinceStart("30d", new Date("2026-11-15T23:59:59Z"))?.getTime());
    expect([sinceStart("soon", now), sinceStart("30", now), sinceStart("", now)]).toEqual([undefined, undefined, undefined]);
  });

  it("are named in words", () => {
    expect(["30d", "1w", "12m", "month", "year"].map(sinceLabel)).toEqual(["Last 30 days", "Last week", "Last 12 months", "This month", "This year"]);
  });

  it("become 'on or after' when the query is sent, and are refused when they make no sense", () => {
    const [filter] = filtersFromSpec([{ column: "ordered_at", op: "since", values: ["30d"] }], now);
    expect(filter).toEqual({ column: "ordered_at", operator: FilterOperator.GTE, values: [{ kind: { case: "temporalValue", value: "2026-10-16" } }] });
    // The same list a day later asks for a later start: nothing was frozen.
    expect(filtersFromSpec([{ column: "ordered_at", op: "since", values: ["30d"] }], new Date("2026-11-16T01:00:00Z"))[0]!.values).toEqual([{ kind: { case: "temporalValue", value: "2026-10-17" } }]);
    expect(() => filtersFromSpec([{ column: "ordered_at", op: "since", values: ["whenever"] }], now)).toThrow(/needs one range/);
    expect(() => filtersFromSpec([{ column: "ordered_at", op: "since" }], now)).toThrow(/needs one range/);
    // A fixed "on or after" read back from a query stays "gte"; it is never mistaken for a relative range.
    expect(filtersToSpec([filter!])).toEqual([{ column: "ordered_at", op: "gte", values: ["2026-10-16"] }]);
  });

  it("are kept apart from fixed filters for editing and joined again", () => {
    const list: FilterSpec[] = [
      { column: "region", op: "eq", values: ["EU"] },
      { column: "ordered_at", op: "since", values: ["30d"] },
    ];
    const { fixed, relative } = splitRelative(list);
    expect(fixed).toEqual([list[0]]);
    expect(relative).toEqual({ ordered_at: "30d" });
    expect(joinRelative(fixed, relative)).toEqual(list);
  });
});

describe("a click on a value", () => {
  const list: FilterSpec[] = [
    { column: "ordered_at", op: "since", values: ["30d"] },
    { column: "status", op: "neq", values: ["cancelled"] },
  ];

  it("filters the column to it, replaces another value, and clears on a second click", () => {
    const eu = toggleValueFilter(list, "region", "EU");
    expect(eu).toEqual([...list, { column: "region", op: "eq", values: ["EU"] }]);
    // A second value is added, so two bars can be compared.
    const both = toggleValueFilter(eu, "region", "NA");
    expect(both).toEqual([...list, { column: "region", op: "in", values: ["EU", "NA"] }]);
    expect(chosenValues(both, "region")).toEqual(["EU", "NA"]);
    // Clicking a chosen value again takes it out; the last one out clears the column.
    expect(toggleValueFilter(both, "region", "EU")).toEqual([...list, { column: "region", op: "eq", values: ["NA"] }]);
    expect(toggleValueFilter(eu, "region", "EU")).toEqual(list);
    // A number and its text are the same bar.
    expect(toggleValueFilter([{ column: "year", op: "eq", values: [2026] }], "year", "2026")).toEqual([]);
    expect(selectValues(both, "region", [])).toEqual(list);
    // Other kinds of filter on the same column are a person's and are left alone.
    expect(toggleValueFilter(list, "status", "returned")).toEqual([...list, { column: "status", op: "eq", values: ["returned"] }]);
  });

  it("leaves a chart its own bars: filters on its column are left out of what it reads", () => {
    expect(filtersExcept([...list, { column: "region", op: "eq", values: ["EU"] }], "region")).toEqual(list);
    expect(filtersExcept(list, "status")).toEqual([list[0]]);
  });
});

describe("a filter in words", () => {
  it("reads as a person would say it", () => {
    expect(
      [
        { column: "region", op: "eq", values: ["South"] },
        { column: "amount", op: "between", values: [10, 20] },
        { column: "status", op: "in", values: ["open", "held"] },
        { column: "email", op: "is_null" },
        { column: "ordered_at", op: "since", values: ["30d"] },
        { column: "ordered_at", op: "since", values: ["month"] },
      ].map((f) => filterWords(f as FilterSpec)),
    ).toEqual(["region is South", "amount is between 10 and 20", "status is one of open, held", "email is empty", "ordered_at in the last 30 days", "ordered_at in this month"]);
  });
});
