import { describe, expect, it } from "vitest";
import { prerenderSite } from "./prerender.js";

const shell = `<!doctype html><html><head><title>Surfaces UI</title><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>`;
const docs = {
  "getting-started.md": "# Getting started\n\nInstall the packages and draw your first grid. See [styling](styling.md) and the [Chart](catalog/components/Chart.md).\n",
  "styling.md": "<!-- Generated -->\n# Styling\n\nThe theme & its `--sf-*` variables.\n",
  "plan.md": "# The plan\n\nNot a guide.\n",
  "catalog/components/Chart.md": "# Chart\n\nA chart over a SQL query <with> aggregates.\n",
};
const site = (base = "/") => prerenderSite({ shell, docs, siteUrl: `https://example.test${base}`, base });

describe("prerenderSite", () => {
  it("writes a page for every area, guide and component, and none for the plan", () => {
    const files = site();
    for (const file of ["index.html", "chat/index.html", "catalog/index.html", "catalog/Chart/index.html", "docs/index.html", "docs/getting-started/index.html", "docs/styling/index.html"]) expect(files[file], file).toBeDefined();
    expect(files["docs/plan/index.html"]).toBeUndefined();
    expect(files["view/index.html"]).toBeUndefined();
  });

  it("gives each page its own title, description, canonical address and preview", () => {
    const page = site()["catalog/Chart/index.html"]!;
    expect(page).toContain("<title>Chart component · Surfaces UI</title>");
    expect(page).toContain('<meta name="description" content="A chart over a SQL query &lt;with&gt; aggregates." />');
    expect(page).toContain('<link rel="canonical" href="https://example.test/catalog/Chart/" />');
    expect(page).toContain('<meta property="og:image" content="https://example.test/og.jpg" />');
    expect(page).toContain('<script type="module" src="/assets/app.js"></script>');
  });

  it("puts the guide's words in the page, with links to other pages of the site, and leaves editors' notes out", () => {
    const files = site("/sub/");
    const guide = files["docs/getting-started/index.html"]!;
    expect(guide).toContain("Install the packages and draw your first grid.");
    expect(guide).toContain('href="https://example.test/sub/docs/styling/"');
    expect(guide).toContain('href="https://example.test/sub/catalog/Chart/"');
    expect(guide).toContain('href="/sub/chat/"');
    expect(files["docs/styling/index.html"]).not.toContain("Generated");
  });

  it("lists every page but the plain /docs/ in the sitemap, and keeps the 404 out of search", () => {
    const files = site();
    expect(files["sitemap.xml"]).toContain("<loc>https://example.test/catalog/Chart/</loc>");
    expect(files["sitemap.xml"]).not.toContain("<loc>https://example.test/docs/</loc>");
    expect(files["robots.txt"]).toContain("Sitemap: https://example.test/sitemap.xml");
    expect(files["404.html"]).toContain('<meta name="robots" content="noindex" />');
    expect(files["404.html"]).not.toContain("canonical");
  });

  it("describes the site to search engines on the home page", () => {
    const home = site()["index.html"]!;
    const json = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(home)![1]!);
    expect(json["@graph"].map((item: { "@type": string }) => item["@type"])).toEqual(["WebSite", "SoftwareSourceCode"]);
  });
});
