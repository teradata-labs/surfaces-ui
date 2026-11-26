import { SurfaceSection } from "@surfaces-ui/next";
import { A2UI_VERSION, type PageDocument, siteCatalog } from "@surfaces-ui/spec";
import type { Metadata } from "next";
import { essays } from "../../site";

export const metadata: Metadata = { title: "About · Field notes" };

/** One part of this page is Surfaces components; the rest is the app's own markup. */
const latest: PageDocument = {
  id: "latest",
  title: "Latest essays",
  catalogId: siteCatalog.id,
  a2ui: A2UI_VERSION,
  components: [
    { id: "root", component: "Section", heading: "Latest essays", level: 2, children: ["list"] },
    { id: "list", component: "Column", children: essays.map((essay) => `to-${essay.slug}`) },
    ...essays.map((essay) => ({ id: `to-${essay.slug}`, component: "Link", text: essay.title, url: `/essays/${essay.slug}` })),
  ],
};

export default function About() {
  return (
    <main>
      <h1>About these notes</h1>
      <p>Written by the app, styled by the app.</p>
      <SurfaceSection page={latest} />
      <p>And back to the app's own words.</p>
    </main>
  );
}
