import { Markdown } from "@surfaces-ui/components";
import { useEffect, useMemo, useState } from "react";
import { START, guideId, guideLink, guideSections, guideText, guideTitle } from "../guides.js";
import { go, hrefOf, onRoute, parseRoute, routeParam } from "../routes.js";

/**
 * The repository's written guides, drawn on the site with the library's own `Markdown`: getting started, agent
 * integration, accessibility, the recipes and the app components. The pages are the files in `docs/`, read when the
 * site is built, so the site and the repository never disagree. A link between guides opens the guide here; a link to a
 * catalog component opens its page in Components; a link into the code goes to the repository.
 */

// The guides' text is part of this area's own chunk, loaded the first time Docs is opened (App loads it lazily).
const TEXTS = import.meta.glob<string>(["../../../../docs/*.md", "../../../../docs/recipes/*.md", "../../../../docs/components/*.md", "../../../../docs/catalog/patterns.md", "!../../../../docs/plan.md"], {
  query: "?raw",
  import: "default",
  eager: true,
});
// Images are files of the site; each is fetched only when a guide shows it.
const IMAGES = import.meta.glob<string>("../../../../docs/images/*.{png,jpg,gif,svg}", { query: "?url", import: "default", eager: true });

const PREFIX = "../../../../docs/";
const idOf = (file: string) => guideId(file.slice(PREFIX.length));
const textOf = (id: string) => TEXTS[`${PREFIX}${id}.md`];
const titleOf = (id: string) => guideTitle(id, textOf(id));

const sections = () => guideSections(Object.keys(TEXTS).map(idOf), titleOf);

/** The guide the address names: `/docs/recipes/analytics-chat/`. */
const pageFromHash = () => routeParam("page") ?? START[0]!;

/** The site's own address of a guide, or of the catalog page for a component. */
const site = () => `${location.origin}${import.meta.env.BASE_URL}`;
const absolute = (target: string) => `${location.origin}${hrefOf(target)}`;

/** Turns a path a guide links to into an address: another guide here, a component in Components, or the repository. */
function resolver(from: string) {
  return (href: string): string | undefined => {
    const to = guideLink(from, href, (id) => textOf(id) !== undefined);
    if (!to) return undefined;
    return "target" in to ? absolute(to.target) : to.url;
  };
}

function imageResolver(from: string) {
  const base = new URL(`https://docs.invalid/docs/${from}`);
  return (src: string): string | undefined => {
    const url = new URL(src, base);
    const found = IMAGES[`../../../..${decodeURIComponent(url.pathname)}`];
    return found ? new URL(found, location.href).href : undefined;
  };
}

/** Follows a link to a page of this site in this tab, without loading the page again, keeping the data picked. */
function openLink(href: string): boolean {
  if (!href.startsWith(site())) return false;
  const url = new URL(href);
  go(parseRoute(url.pathname, url.search, import.meta.env.BASE_URL));
  return true;
}

export function DocsPage() {
  const all = useMemo(sections, []);
  const [page, setPage] = useState(pageFromHash);
  const raw = textOf(page);
  const text = raw === undefined ? undefined : guideText(raw);
  // The guide follows the address: a link, the list, Back and Forward all change the hash.
  useEffect(() => {
    return onRoute(() => setPage(pageFromHash()));
  }, []);

  const current = all.flatMap((s) => s.guides).find((g) => g.id === page);
  useEffect(() => {
    document.title = `${current?.title ?? "Docs"} · Surfaces UI`;
  }, [current]);

  const list = (
    <nav className="docs-nav" aria-label="Guides">
      {all.map((section) => (
        <section key={section.label}>
          <h2>{section.label}</h2>
          <ul>
            {section.guides.map((guide) => (
              <li key={guide.id}>
                <a href={hrefOf(`docs?page=${guide.id}`)} aria-current={guide.id === page ? "page" : undefined}>
                  {guide.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );

  return (
    // The outer box is measured; the frame inside it is laid out, since a box cannot answer its own size query.
    <div className="docs">
      <div className="docs-frame">
      {/* On a wide screen the list sits beside the guide; on a narrow one it folds into a disclosure above it. */}
      <div className="docs-side">{list}</div>
      <details className="docs-fold" key={page}>
        <summary>All guides</summary>
        {list}
      </details>
      <article className="docs-article">
        {text === undefined ? (
          <p className="sf-muted">There is no guide called “{page}”. Pick one from the list.</p>
        ) : (
          <Markdown text={text} headingStart={1} resolveLink={resolver(`${page}.md`)} resolveImage={imageResolver(`${page}.md`)} openLink={openLink} />
        )}
      </article>
      </div>
    </div>
  );
}
