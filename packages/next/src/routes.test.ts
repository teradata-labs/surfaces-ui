import { describe, expect, it } from "vitest";
import { testSite } from "./fixture.js";
import { matchRoute, parseRoute, routePath, siteParams, siteProblems } from "./routes.js";

describe("routes", () => {
  it("reads fixed segments and values, and says what is wrong with anything else", () => {
    expect(parseRoute("/")).toEqual({ segments: [] });
    expect(parseRoute("/essays/[slug]")).toEqual({ segments: [{ kind: "fixed", name: "essays" }, { kind: "value", name: "slug" }] });
    expect(parseRoute("essays")).toMatchObject({ problem: expect.stringContaining('starts with "/"') });
    expect(parseRoute("/essays/")).toMatchObject({ problem: expect.stringContaining("without the") });
    expect(parseRoute("/docs/[...path]")).toMatchObject({ problem: expect.stringContaining("Catch-all") });
    expect(parseRoute("/a/../b")).toMatchObject({ problem: expect.stringContaining("not a path segment") });
    expect(parseRoute("/[a]/[a]")).toMatchObject({ problem: expect.stringContaining("twice") });
  });

  it("finds the page for an address, a fixed route before one with a value", () => {
    expect(matchRoute(testSite, undefined)?.entry.route).toBe("/");
    expect(matchRoute(testSite, [])?.entry.route).toBe("/");
    expect(matchRoute(testSite, ["essays"])?.entry.route).toBe("/essays");
    expect(matchRoute(testSite, ["essays", "new"])?.entry.route).toBe("/essays/new");
    expect(matchRoute(testSite, ["essays", "first-post"])).toMatchObject({ entry: { route: "/essays/[slug]" }, values: { slug: "first-post" } });
    expect(matchRoute(testSite, ["essays", "caf%C3%A9"])?.values).toEqual({ slug: "café" });
    expect(matchRoute(testSite, ["pricing"])).toBeUndefined();
    expect(matchRoute(testSite, ["essays", "a", "b"])).toBeUndefined();
    expect(matchRoute(testSite, ["essays", "%E0%A4%A"])).toBeUndefined();
  });

  it("reports routes that clash", () => {
    expect(siteProblems(testSite)).toEqual([]);
    const page = testSite.pages[0]!.page;
    const problems = siteProblems({ pages: [{ route: "/[a]", page }, { route: "/[b]", page }, { route: "/x", page }, { route: "/x", page }, { route: "x", page }] });
    expect(problems.map((p) => p.route)).toEqual(["/[b]", "/x", "x"]);
  });

  it("writes an address with its values encoded", () => {
    expect(routePath("/essays/[slug]", { slug: "a b" })).toBe("/essays/a%20b");
    expect(() => routePath("/essays/[slug]")).toThrow(/needs a value/);
  });

  it("lists every address for generateStaticParams, with the app's values", async () => {
    const params = await siteParams(testSite, { "/essays/[slug]": async () => ["first-post", "café"] });
    expect(params).toEqual([{ route: [] }, { route: ["essays"] }, { route: ["essays", "new"] }, { route: ["essays", "first-post"] }, { route: ["essays", "café"] }]);
    expect(await siteParams({ pages: [testSite.pages[1]!] }, {}, { param: "path" })).toEqual([{ path: ["essays"] }]);
  });

  it("refuses to leave a page out quietly", async () => {
    await expect(siteParams(testSite)).rejects.toThrow(/"\/essays\/\[slug\]" takes \[slug\]/);
    await expect(siteParams(testSite, { "/essays/[slug]": () => [], "/blog/[slug]": () => [] })).rejects.toThrow(/does not have: \/blog/);
    const two = { pages: [{ route: "/[year]/[slug]", page: testSite.pages[0]!.page }] };
    await expect(siteParams(two, { "/[year]/[slug]": () => ["x"] })).rejects.toThrow(/as an object/);
    expect(await siteParams(two, { "/[year]/[slug]": () => [{ year: "2026", slug: "x" }] })).toEqual([{ route: ["2026", "x"] }]);
  });
});
