// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { SitePage } = await import("./SitePage.js");
const { testSite } = await import("./fixture.js");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const essayData = async (_: string, { slug }: Record<string, string>) => ({ essay: { title: `About ${slug}`, body: "Some **bold** text." } });

/** What the server sends: the element SitePage returns, rendered to HTML. */
async function serve(route: string[]) {
  const element = await SitePage({ site: testSite, params: Promise.resolve({ route }), data: essayData, resolveImage: (name) => `/images/${name}.jpg` });
  return { element, html: renderToString(element) };
}

/** The browser: the server's HTML, then React taking it over. */
async function hydrate(route: string[]) {
  const { element, html } = await serve(route);
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const errors: unknown[] = [];
  const logged = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));
  await act(async () => {
    hydrateRoot(container, element, { onRecoverableError: (error) => errors.push(error) });
  });
  logged.mockRestore();
  return { container, errors };
}

beforeEach(() => push.mockReset());
afterEach(() => {
  document.body.innerHTML = "";
});

describe("SitePage", () => {
  it("renders the page to HTML on the server, themed, with its images resolved there", async () => {
    const { html } = await serve([]);
    expect(html).toContain("Field notes");
    expect(html).toContain("What we learned this year.");
    expect(html).toContain('href="/essays"');
    expect(html).toContain('src="/images/cover.jpg"');
    expect(html).toContain("--sf-color-bg");
    expect(html).not.toMatch(/role="alert"/);
  });

  it("fills a route's page from the app's data and the route's values", async () => {
    const { html } = await serve(["essays", "first-post"]);
    expect(html).toContain("About first-post");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("is Next.js's 404 for an address the site does not have", async () => {
    await expect(serve(["pricing"])).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("stops on a page the catalog refuses, saying what is wrong", async () => {
    const broken = { ...testSite, pages: [{ route: "/", page: { ...testSite.pages[0]!.page, components: [{ id: "root", component: "Marquee" }] as never } }] };
    await expect(SitePage({ site: broken, params: {} })).rejects.toThrow(/does not fit the .* catalog: .*Marquee/);
  });
});

describe("SiteSurface in the browser", () => {
  it("hydrates the server's HTML with no mismatch", async () => {
    for (const route of [[], ["essays"], ["essays", "first-post"]]) {
      const { errors } = await hydrate(route);
      expect(errors, route.join("/")).toEqual([]);
      document.body.innerHTML = "";
    }
  });

  it("moves to a path on the site through the router, and leaves every other link to the browser", async () => {
    const { container } = await hydrate([]);
    const click = (name: string, init: MouseEventInit = {}) => {
      const link = [...container.querySelectorAll("a")].find((a) => a.textContent === name)!;
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
      link.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(click("Read the essays")).toBe(true);
    expect(push).toHaveBeenCalledWith("/essays");
    push.mockReset();
    expect(click("Read the essays", { metaKey: true })).toBe(false);
    expect(click("Source")).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
