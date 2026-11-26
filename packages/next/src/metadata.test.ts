import { describe, expect, it } from "vitest";
import { testSite } from "./fixture.js";
import { siteMetadata } from "./metadata.js";
import { ROUTE_DATA_KEY, preparePage } from "./prepare.js";
import { matchRoute } from "./routes.js";

describe("siteMetadata", () => {
  it("gives the home page its own title, description, canonical path and preview image", async () => {
    const meta = await siteMetadata(testSite, Promise.resolve({}), { resolveImage: (name) => `/images/${name}.jpg` });
    expect(meta).toEqual({
      title: { absolute: "Field notes" },
      description: "Notes from the field.",
      alternates: { canonical: "/" },
      openGraph: { title: "Field notes", description: "Notes from the field.", siteName: "Field notes", url: "/", images: ["/images/cover.jpg"] },
    });
  });

  it("puts the site's title after a page's, and lets the app describe a route from its values", async () => {
    const meta = await siteMetadata(testSite, { route: ["essays", "first-post"] }, { describe: (_, { slug }) => ({ title: `Essay ${slug}` }) });
    expect(meta.title).toBe("Essay first-post · Field notes");
    expect(meta.alternates).toEqual({ canonical: "/essays/first-post" });
  });

  it("never uses an image address that is not a link", async () => {
    const site = { ...testSite, pages: [{ ...testSite.pages[0]!, meta: { image: "javascript:alert(1)" } }] };
    expect((await siteMetadata(site, {})).openGraph).not.toHaveProperty("images");
  });

  it("says nothing for an address the site does not have", async () => {
    expect(await siteMetadata(testSite, { route: ["nope"] })).toEqual({});
  });
});

describe("preparePage", () => {
  it("puts the route's values and the app's data in the page, and the site's theme under its own", async () => {
    const match = matchRoute(testSite, ["essays", "first-post"])!;
    const { page } = await preparePage(testSite, match, { data: async (_, { slug }) => ({ essay: { title: `About ${slug}`, body: "Text." } }) });
    expect(page.data).toEqual({ essay: { title: "About first-post", body: "Text." }, [ROUTE_DATA_KEY]: { slug: "first-post" } });
    expect(page.theme).toEqual({ preset: "Ink" });
  });

  it("works out image addresses on the server, and keeps only links", async () => {
    const match = matchRoute(testSite, [])!;
    expect((await preparePage(testSite, match, { resolveImage: (name) => `/images/${name}.jpg` })).images).toEqual({ cover: "/images/cover.jpg" });
    expect((await preparePage(testSite, match, { resolveImage: () => "javascript:alert(1)" })).images).toEqual({});
    expect((await preparePage(testSite, match)).images).toEqual({});
  });
});
