import { SitePage, siteMetadata, siteParams } from "@surfaces-ui/next";
import type { Metadata } from "next";
import { essayBySlug, essays, site } from "../../site";

type Props = { params: Promise<{ route?: string[] }> };

// Only the site's own addresses exist; anything else is a 404 at build time.
export const dynamicParams = false;

export function generateStaticParams() {
  return siteParams(site, { "/essays/[slug]": () => essays.map((essay) => essay.slug) });
}

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return siteMetadata(site, params, {
    describe: (route, { slug }) => {
      const essay = route === "/essays/[slug]" && slug ? essayBySlug(slug) : undefined;
      return essay ? { title: essay.title, description: essay.summary } : undefined;
    },
  });
}

export default function Page({ params }: Props) {
  return <SitePage site={site} params={params} data={(_, { slug }) => (slug ? { essay: essayBySlug(slug) } : {})} />;
}
