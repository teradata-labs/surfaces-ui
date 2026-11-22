import { type PageDocument, type SurfaceAction, extendCatalog, pageSurface, siteCatalog } from "@surfaces-ui/spec";
import { type ComponentRenderer, SurfaceView, siteRenderers } from "@surfaces-ui/spec/react";
import { type ReactNode, useMemo } from "react";
import { z } from "zod";
import { examplePages } from "../examples.js";
import { focusFor } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";
import { Screen } from "./Devices.js";
import { PERSONAS } from "./ShowcasePage.js";

/**
 * The home page is a page of the site catalog, drawn like any agent's page. Two parts are the playground's own and
 * added the documented way, with `extendCatalog`: the live dashboard over the picked data, and the data picker.
 */
export const homeCatalog = extendCatalog(siteCatalog, {
  id: "urn:surfaces:playground:home:v1",
  title: "Playground home",
  description: "The site catalog, with the playground's live dashboard and data picker.",
  components: {
    LiveDashboard: {
      description: "The first example dashboard, drawn live over the picked sample data.",
      props: {},
      example: { id: "dashboard", component: "LiveDashboard" },
    },
    SamplePicker: {
      description: "The playground's sample data picker.",
      props: { label: z.string().optional() },
      example: { id: "picker", component: "SamplePicker" },
    },
  },
});

/** What the person in the demo asks for, typed out before the dashboard builds. */
export const HOME_PROMPT = "Build me a dashboard: the headline numbers with their trend, the breakdowns, then the rows.";

const button = (id: string, label: string, area: string, primary = false) => [
  { id, component: "Button", child: `${id}-label`, ...(primary ? { variant: "primary" } : {}), action: { event: { name: "open", context: { area } } } },
  { id: `${id}-label`, component: "Text", text: label },
];

/** The home page as a document: what an agent with the site catalog would send to draw it. */
export function homePage(dashboard: string): PageDocument {
  return {
    id: "home",
    title: "Surfaces UI",
    catalogId: homeCatalog.id,
    components: [
      { id: "root", component: "Column", children: ["hero", "demo", "demo-foot", "roles"] },
      {
        id: "hero",
        component: "Hero",
        title: "Surfaces UI",
        lead: "Components for data work that people and agents build together. Query, chart, model and share, in your own app or in a chat, on any engine.",
        children: ["open-playground", "open-catalog", "open-showcase"],
      },
      ...button("open-playground", "Open the playground", "composer", true),
      ...button("open-catalog", "Browse components", "catalog"),
      ...button("open-showcase", "See the showcase", "showcase"),
      { id: "demo", component: "PromptReveal", prompt: HOME_PROMPT, label: dashboard, child: "devices" },
      { id: "devices", component: "DeviceFrame", title: "Playground", label: dashboard, child: "dashboard" },
      { id: "dashboard", component: "LiveDashboard" },
      { id: "demo-foot", component: "Row", justify: "center", align: "center", children: ["picker", "demo-hint"] },
      { id: "picker", component: "SamplePicker" },
      { id: "demo-hint", component: "Text", variant: "caption", text: "Every part is live: click, filter and scroll." },
      { id: "roles", component: "Section", heading: "Showcase", lead: "Setups for the people who work with data, each made from the same components.", children: ["role-cards"] },
      {
        id: "role-cards",
        component: "FeatureGrid",
        label: "Roles",
        items: PERSONAS.map((persona) => ({ id: persona.id, title: persona.name, line: persona.line })),
        action: { event: { name: "role" } },
      },
    ],
  };
}

export function HomePage({ source, onOpen, picker }: { source: ActiveSource; onOpen(area: string): void; picker?: ReactNode }) {
  const focus = useMemo(() => focusFor(source.sourceId, firstTable(source)), [source]);
  const dashboard = useMemo(() => examplePages(focus)[0]!, [focus]);
  const surface = useMemo(() => pageSurface(homePage(`${dashboard.title}, over the ${focus.title.toLowerCase()} sample`)), [dashboard, focus]);
  const renderers = useMemo<Record<string, ComponentRenderer>>(
    () => ({
      ...siteRenderers,
      LiveDashboard: () => <Screen page={dashboard} />,
      SamplePicker: () => picker ?? null,
    }),
    [dashboard, picker],
  );
  const act = (action: SurfaceAction) => {
    const context = action.context as { area?: string; id?: string };
    if (action.name === "open" && context.area) onOpen(context.area);
    if (action.name === "role" && context.id) onOpen(`showcase?persona=${context.id}`);
  };
  return (
    <div className="home">
      <SurfaceView surface={surface} catalog={homeCatalog} renderers={renderers} onAction={act} />
    </div>
  );
}
