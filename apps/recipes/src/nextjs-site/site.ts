import type { SiteRoutes } from "@surfaces-ui/next";
import { A2UI_VERSION, siteCatalog } from "@surfaces-ui/spec";

/** The essays. In a real app they come from MDX files, a CMS or a database; Surfaces only asks for them. */
export const essays = [
  { slug: "reading-a-chart", title: "Reading a chart", summary: "What to look at first.", body: "Start with the **axis**, then the shape." },
  { slug: "one-number", title: "One number", summary: "When a headline figure is enough.", body: "A number needs a *comparison* beside it." },
];

export const essayBySlug = (slug: string) => essays.find((essay) => essay.slug === slug);

const page = (id: string, title: string, components: Record<string, unknown>[], data?: unknown) => ({
  id,
  title,
  catalogId: siteCatalog.id,
  a2ui: A2UI_VERSION,
  components: components as never,
  ...(data === undefined ? {} : { data }),
});

/** Three routes: the home page, the list of essays, and a page for each essay. */
export const site: SiteRoutes = {
  title: "Field notes",
  theme: { preset: "Ink" },
  pages: [
    {
      route: "/",
      meta: { description: "Notes on reading data." },
      page: page("home", "Field notes", [
        { id: "root", component: "Hero", title: "Field notes", lead: "Notes on reading data.", children: ["to-essays"] },
        { id: "to-essays", component: "Link", text: "Read the essays", url: "/essays" },
      ]),
    },
    {
      route: "/essays",
      page: page(
        "essays",
        "Essays",
        [
          { id: "root", component: "Section", heading: "Essays", children: ["list"] },
          { id: "list", component: "Column", children: essays.map((essay) => `to-${essay.slug}`) },
          ...essays.map((essay) => ({ id: `to-${essay.slug}`, component: "Link", text: essay.title, url: `/essays/${essay.slug}` })),
        ],
      ),
    },
    {
      route: "/essays/[slug]",
      page: page("essay", "Essay", [
        { id: "root", component: "Column", children: ["title", "body", "back"] },
        // The page is the whole document, so its title is a Hero: the one <h1>.
        { id: "title", component: "Hero", align: "start", title: { "@path": "/essay/title" }, lead: { "@path": "/essay/summary" } },
        { id: "body", component: "Markdown", text: { "@path": "/essay/body" } },
        { id: "back", component: "Link", text: "All essays", url: "/essays" },
      ]),
    },
  ],
};
