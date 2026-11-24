import { describe, expect, it } from "vitest";
import { AREA_GROUPS, legacyTarget, parseRoute, routePath, targetRoute } from "./routes.js";

const params = (route: { params: URLSearchParams }) => Object.fromEntries(route.params);

describe("parseRoute", () => {
  it("reads the area, a guide and a component from the path", () => {
    expect(parseRoute("/", "")).toMatchObject({ area: "home" });
    expect(parseRoute("/chat/", "")).toMatchObject({ area: "chat" });
    const guide = parseRoute("/docs/recipes/analytics-chat/", "");
    expect(guide.area).toBe("docs");
    expect(params(guide)).toEqual({ page: "recipes/analytics-chat" });
    expect(params(parseRoute("/catalog/Chart/", ""))).toEqual({ component: "Chart" });
  });

  it("keeps a page's own parameters and leaves the site's out", () => {
    const route = parseRoute("/library/", "?surface=s1&source=retail&theme=Ink");
    expect(params(route)).toEqual({ surface: "s1" });
  });

  it("reads a path under the base the site is served from, and sends anything unknown home", () => {
    expect(parseRoute("/surfaces-ui/chat/", "", "/surfaces-ui/").area).toBe("chat");
    expect(parseRoute("/nothing-here/", "").area).toBe("home");
  });
});

describe("routePath", () => {
  it("writes a path for every area, with a trailing slash", () => {
    for (const area of AREA_GROUPS.flatMap((g) => g.areas)) expect(routePath(targetRoute(area.id))).toBe(`/${area.id}/`);
    expect(routePath(targetRoute("home"))).toBe("/");
  });

  it("puts a guide and a component in the path and keeps the data picked", () => {
    expect(routePath(targetRoute("docs?page=recipes/analytics-chat"))).toBe("/docs/recipes/analytics-chat/");
    expect(routePath(targetRoute("catalog?component=Chart"), "/", new URLSearchParams("source=retail&x=1"))).toBe("/catalog/Chart/?source=retail");
    expect(routePath(targetRoute("library?surface=a b"), "/base/")).toBe("/base/library/?surface=a+b");
  });

  it("reads back what it writes", () => {
    for (const target of ["chat", "docs?page=styling", "catalog?component=DataGrid", "showcase?persona=analyst", "home"]) {
      const route = targetRoute(target);
      const path = routePath(route, "/base/");
      const [pathname = "", search = ""] = path.split("?");
      const back = parseRoute(pathname, search, "/base/");
      expect(back.area).toBe(route.area);
      expect(params(back)).toEqual(params(route));
    }
  });
});

describe("legacyTarget", () => {
  it("opens the page an address from before paths named", () => {
    expect(legacyTarget("", "#chat")?.area).toBe("chat");
    expect(params(legacyTarget("", "#docs?page=styling")!)).toEqual({ page: "styling" });
    expect(params(legacyTarget("?component=Chart", "#catalog")!)).toEqual({ component: "Chart" });
  });

  it("leaves an anchor on the page alone", () => {
    expect(legacyTarget("", "#section-2")).toBeUndefined();
    expect(legacyTarget("", "")).toBeUndefined();
  });
});
