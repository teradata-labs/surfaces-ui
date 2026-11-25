import { A2UI_VERSION, siteCatalog } from "@surfaces-ui/spec";
import type { SiteRoutes } from "./routes.js";

const page = (id: string, title: string, components: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
  id,
  title,
  catalogId: siteCatalog.id,
  a2ui: A2UI_VERSION,
  components: components as never,
  ...extra,
});

/** A small site for tests: a home page, a fixed page, and essays that take a slug. */
export const testSite: SiteRoutes = {
  title: "Field notes",
  theme: { preset: "Ink" },
  pages: [
    {
      route: "/",
      meta: { description: "Notes from the field.", image: "cover" },
      page: page("home", "Field notes", [
        { id: "root", component: "Column", children: ["hero", "picture"] },
        { id: "hero", component: "Hero", title: "Field notes", lead: "What we learned this year.", children: ["to-essays", "to-elsewhere"] },
        { id: "to-essays", component: "Link", text: "Read the essays", url: "/essays" },
        { id: "to-elsewhere", component: "Link", text: "Source", url: "https://example.com/source" },
        { id: "picture", component: "Media", src: "cover", alt: "A field at dawn" },
      ]),
    },
    {
      route: "/essays",
      page: page("essays", "Essays", [
        { id: "root", component: "Section", heading: "Essays", children: ["first"] },
        { id: "first", component: "Link", text: "The first essay", url: "/essays/first-post" },
      ]),
    },
    { route: "/essays/new", page: page("new", "Write an essay", [{ id: "root", component: "Text", text: "Coming soon." }]) },
    {
      route: "/essays/[slug]",
      page: page("essay", "Essay", [
        { id: "root", component: "Column", children: ["title", "body"] },
        { id: "title", component: "Text", variant: "h1", text: { "@path": "/essay/title" } },
        { id: "body", component: "Markdown", text: { "@path": "/essay/body" } },
      ]),
    },
  ],
};
