/**
 * The published site as HTML a search engine and a link preview can read without running the app: one file per page
 * (`chat/index.html`, `docs/styling/index.html`, `catalog/Chart/index.html`), each with its own title, description,
 * canonical address and preview card, and the page's words in the body: the guides and the component reference in
 * full, the other pages their name, what they are for and links to the rest. Where JavaScript runs those words are
 * hidden from the first paint and the app draws the page; the app replaces them when it starts.
 * Also `sitemap.xml`, `robots.txt` and a `404.html` that asks not to be indexed.
 *
 * Run by the build (`vite.config.ts`) after the app is written, through Vite so this file can use the library's own
 * `Markdown`, which renders as elements, never as HTML from the text.
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../../../packages/components/src/text/Markdown.js";
import { guideId, guideLink, guideSections, guideSummary, guideText, guideTitle, isGuideFile } from "./guides.js";
import { AREA_GROUPS, AREA_INFO, type AreaInfo, HOME_INFO, routePath, targetRoute } from "./routes.js";

export interface PrerenderInput {
  /** The built `index.html`, whose head and empty root each page fills in. */
  shell: string;
  /** Every Markdown file under `docs/`, by its path there (`styling.md`, `catalog/components/Chart.md`). */
  docs: Record<string, string>;
  /** Where the site is served, ending in `/`: `https://surfaces-ui.com/`. Canonical addresses and the sitemap use it. */
  siteUrl: string;
  /** The path the site is served from (`/`, or `/surfaces-ui/`). */
  base: string;
}

interface Page {
  /** The page's file, relative to the site: `chat/index.html`. */
  file: string;
  /** The page's path under the base: `chat/`. */
  path: string;
  title: string;
  description: string;
  body: ReactNode;
  /** Structured data for search engines, on the home page. */
  jsonLd?: object;
}

const SITE_NAME = "Surfaces UI";
const REPOSITORY = "https://github.com/teradata-labs/surfaces-ui";
const PREVIEW_IMAGE = "og.jpg";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** JSON in a script element, with nothing that could close the element. */
const scriptJson = (value: object) => JSON.stringify(value).replace(/</g, "\\u003c");

/** Every page the site has, and the files that list them. */
export function prerenderSite(input: PrerenderInput): Record<string, string> {
  const guides: Record<string, string> = {};
  const components: Record<string, string> = {};
  for (const [path, text] of Object.entries(input.docs)) {
    if (isGuideFile(path)) guides[guideId(path)] = text;
    const component = /^catalog\/components\/(\w+)\.md$/.exec(path)?.[1];
    if (component && component !== "README") components[component] = text;
  }
  const href = (target: string) => routePath(targetRoute(target), input.base);
  const pathOf = (target: string) => href(target).slice(input.base.length);
  const hasGuide = (id: string) => id in guides;
  const titleOf = (id: string) => guideTitle(id, guides[id]);
  const resolveLink = (from: string) => (link: string) => {
    const to = guideLink(from, link, hasGuide);
    if (!to) return undefined;
    return "target" in to ? new URL(pathOf(to.target), input.siteUrl).href : to.url;
  };
  const guideList = guideSections(Object.keys(guides), titleOf);

  const nav = (
    <nav aria-label={SITE_NAME}>
      <p>
        <a href={input.base}>{SITE_NAME}</a>
      </p>
      {AREA_GROUPS.map((group) => (
        <section key={group.label}>
          <h2>{group.label}</h2>
          <ul>
            {group.areas.map((area) => (
              <li key={area.id}>
                <a href={href(area.id)}>{area.label}</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
  const footer = (
    <footer>
      <p>
        Open source on <a href={REPOSITORY}>GitHub</a>. Install from npm as <code>@surfaces-ui/components</code>, or start an app with <code>npx create-surfaces my-app</code>.
      </p>
    </footer>
  );
  const frame = (main: ReactNode) => (
    <div className="prerender">
      {nav}
      <main>{main}</main>
      {footer}
    </div>
  );

  const areaPage = (area: AreaInfo, extra?: ReactNode): Page => ({
    file: `${pathOf(area.id)}index.html`,
    path: pathOf(area.id),
    title: `${area.label} · ${SITE_NAME}`,
    description: `${area.hint}.`,
    body: frame(
      <>
        <h1>{area.label}</h1>
        <p>{area.hint}.</p>
        {extra}
        <p>This page is interactive and runs in your browser; it loads a sample database the first time it opens.</p>
      </>,
    ),
  });

  const componentNames = Object.keys(components).sort();
  const guidesNav = (
    <nav aria-label="Guides">
      {guideList.map((section) => (
        <section key={section.label}>
          <h2>{section.label}</h2>
          <ul>
            {section.guides.map((guide) => (
              <li key={guide.id}>
                <a href={href(`docs?page=${guide.id}`)}>{guide.title}</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );

  const pages: Page[] = [
    {
      file: "index.html",
      path: "",
      title: `${SITE_NAME}: data and analytics components for people and agents`,
      description: HOME_INFO.hint,
      body: frame(
        <>
          <h1>{SITE_NAME}</h1>
          <p>{HOME_INFO.hint}</p>
          <p>
            Components for exploring schemas, writing SQL, grids that page through millions of rows, charts that follow Tufte and Few, pivot tables, chat
            threads where an agent draws live components, semantic models, pipelines and dashboards. Sorting, filtering and paging run in SQL on the engine;
            agents describe UI as A2UI messages checked against a catalog.
          </p>
          <h2>Start here</h2>
          <ul>
            {guideList[0]?.guides.map((guide) => (
              <li key={guide.id}>
                <a href={href(`docs?page=${guide.id}`)}>{guide.title}</a>
              </li>
            ))}
            <li>
              <a href={href("catalog")}>Every component, live</a>
            </li>
          </ul>
        </>,
      ),
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", name: SITE_NAME, url: input.siteUrl },
          {
            "@type": "SoftwareSourceCode",
            name: SITE_NAME,
            description: HOME_INFO.hint,
            url: input.siteUrl,
            codeRepository: REPOSITORY,
            programmingLanguage: "TypeScript",
            runtimePlatform: "React",
            license: `${REPOSITORY}/blob/main/LICENSE`,
          },
        ],
      },
    },
    ...AREA_INFO.filter((area) => area.id !== "home" && area.id !== "view" && area.id !== "docs" && area.id !== "catalog").map((area) => areaPage(area)),
    areaPage(
      AREA_INFO.find((a) => a.id === "catalog")!,
      <ul>
        {componentNames.map((name) => (
          <li key={name}>
            <a href={href(`catalog?component=${name}`)}>{name}</a>
          </li>
        ))}
      </ul>,
    ),
    ...componentNames.map((name): Page => {
      const text = components[name]!;
      return {
        file: `${pathOf(`catalog?component=${name}`)}index.html`,
        path: pathOf(`catalog?component=${name}`),
        title: `${name} component · ${SITE_NAME}`,
        description: guideSummary(text) || `The ${name} component: its props, the events it sends and an example.`,
        body: frame(<Markdown text={guideText(text)} headingStart={1} resolveLink={resolveLink(`catalog/components/${name}.md`)} />),
      };
    }),
    ...Object.keys(guides).map((id): Page => {
      const text = guides[id]!;
      return {
        file: `${pathOf(`docs?page=${id}`)}index.html`,
        path: pathOf(`docs?page=${id}`),
        title: `${titleOf(id)} · ${SITE_NAME}`,
        description: guideSummary(text) || `${titleOf(id)}, a guide to ${SITE_NAME}.`,
        body: frame(
          <>
            <article>
              <Markdown text={guideText(text)} headingStart={1} resolveLink={resolveLink(`${id}.md`)} />
            </article>
            {guidesNav}
          </>,
        ),
      };
    }),
  ];
  // `/docs/` itself opens on the first guide.
  const first = guideList[0]?.guides[0];
  if (first) {
    const page = pages.find((p) => p.path === pathOf(`docs?page=${first.id}`))!;
    pages.push({ ...page, file: `${pathOf("docs")}index.html`, path: pathOf("docs") });
  }

  const files: Record<string, string> = {};
  for (const page of pages) files[page.file] = pageHtml(input, page);
  files["404.html"] = pageHtml(input, { file: "404.html", path: "", title: `Not found · ${SITE_NAME}`, description: "", body: frame(<h1>There is no page here</h1>) }, { noindex: true });
  files["sitemap.xml"] = sitemap(input.siteUrl, pages.filter((p) => p.path !== pathOf("docs")));
  files["robots.txt"] = `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", input.siteUrl).href}\n`;
  return files;
}

/**
 * Where JavaScript runs, the app draws the page itself, so the plain words are hidden from the first paint and a person
 * never sees them flash by before the app (on a phone on 4G that was about seven seconds). They stay in the file for
 * search engines and link previews, which read the HTML, and are shown wherever JavaScript does not run.
 */
const HIDE_WHEN_SCRIPTED = `<script>document.documentElement.classList.add("sf-scripted")</script>`;

/** Plain styles for the words when no script runs: the system's own colours and fonts, light or dark as the reader's. */
const STYLE = `<style>.sf-scripted .prerender{display:none}.prerender{color-scheme:light dark;max-width:48rem;margin:0 auto;padding:1.5rem 1rem;font:1rem/1.6 system-ui,sans-serif;color:CanvasText;background:Canvas}.prerender nav ul{display:flex;flex-wrap:wrap;gap:.25rem 1rem;padding:0;list-style:none}.prerender nav h2{font-size:.875rem;margin:.75rem 0 .25rem}.prerender pre{overflow-x:auto}.prerender img{max-width:100%;height:auto}</style>`;

function pageHtml(input: PrerenderInput, page: Page, { noindex = false } = {}): string {
  const url = new URL(page.path, input.siteUrl).href;
  const image = new URL(PREVIEW_IMAGE, input.siteUrl).href;
  const head = [
    `<title>${escape(page.title)}</title>`,
    page.description && `<meta name="description" content="${escape(page.description)}" />`,
    noindex ? `<meta name="robots" content="noindex" />` : `<link rel="canonical" href="${escape(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    page.description && `<meta property="og:description" content="${escape(page.description)}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    `<meta property="og:image" content="${escape(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="A dashboard drawn with Surfaces UI on a desktop, a tablet and a phone" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    page.jsonLd && `<script type="application/ld+json">${scriptJson(page.jsonLd)}</script>`,
    HIDE_WHEN_SCRIPTED,
    STYLE,
  ]
    .filter(Boolean)
    .join("\n    ");
  const shell = input.shell.replace(/<title>[^<]*<\/title>/, head);
  if (shell === input.shell) throw new Error("The built index.html has no <title> to replace.");
  const body = renderToStaticMarkup(<>{page.body}</>);
  const filled = shell.replace(/<div id="root"><\/div>/, `<div id="root">${body}</div>`);
  if (filled === shell) throw new Error('The built index.html has no empty <div id="root"></div> to fill.');
  return filled;
}

function sitemap(siteUrl: string, pages: Page[]): string {
  const urls = pages.map((page) => `  <url><loc>${escape(new URL(page.path, siteUrl).href)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
