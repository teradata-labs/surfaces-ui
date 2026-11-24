import { Markdown } from "@surfaces-ui/components";
import { useEffect, useMemo, useState } from "react";

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
const REPO = "https://github.com/teradata-labs/surfaces-ui/blob/main/";

/** A guide's id is its path under `docs/` without `.md` (`recipes/analytics-chat`). */
const idOf = (file: string) => file.slice(PREFIX.length).replace(/\.md$/, "");

interface Guide {
  id: string;
  title: string;
}

/** The sections of the guide list, in reading order. Anything not named here is listed under its folder by name. */
const START = ["getting-started", "packages", "agent-integration", "styling", "accessibility"];
const TITLES: Record<string, string> = {
  "getting-started": "Getting started",
  packages: "Packages",
  "agent-integration": "Agent integration",
  styling: "Styling",
  accessibility: "Accessibility",
  "recipes/README": "All recipes",
  "components/README": "All app components",
  "catalog/patterns": "Human-in-the-loop patterns",
};

/** A guide's title: a name given above, or its first heading. */
const titleOf = (id: string) => TITLES[id] ?? /^#\s+(.+)$/m.exec(TEXTS[`${PREFIX}${id}.md`] ?? "")?.[1]?.replace(/[`*]/g, "").trim() ?? id;

function sections(): { label: string; guides: Guide[] }[] {
  const ids = Object.keys(TEXTS).map(idOf);
  const list = (pick: (id: string) => boolean) =>
    ids
      .filter(pick)
      .sort((a, b) => Number(b.endsWith("README")) - Number(a.endsWith("README")) || a.localeCompare(b))
      .map((id) => ({ id, title: titleOf(id) }));
  return [
    { label: "Start here", guides: START.filter((id) => ids.includes(id)).map((id) => ({ id, title: titleOf(id) })) },
    { label: "Recipes", guides: list((id) => id.startsWith("recipes/")) },
    { label: "App components", guides: list((id) => id.startsWith("components/")) },
    { label: "Patterns", guides: list((id) => id.startsWith("catalog/")) },
    { label: "More", guides: list((id) => !id.includes("/") && !START.includes(id)) },
  ].filter((section) => section.guides.length > 0);
}

/** The guide in the hash: `#docs?page=recipes/analytics-chat`. */
const pageFromHash = () => new URLSearchParams(location.hash.split("?")[1] ?? "").get("page") ?? START[0]!;

/** The site's own address of a guide, or of the catalog page for a component. */
const site = () => `${location.origin}${location.pathname}`;
const guideUrl = (id: string) => `${site()}#docs?page=${id}`;

/** Turns a path a guide links to into an address: another guide here, a component in Components, or the repository. */
function resolver(from: string) {
  const base = new URL(`https://docs.invalid/docs/${from}`);
  return (href: string): string | undefined => {
    if (href.startsWith("#")) return undefined;
    const url = new URL(href, base);
    if (url.origin !== base.origin) return undefined;
    const path = decodeURIComponent(url.pathname.slice(1));
    const component = /^docs\/catalog\/components\/(\w+)\.md$/.exec(path);
    if (component) return `${site()}?component=${component[1]}#catalog`;
    if (/^docs\/catalog\/components\/?$/.test(path)) return `${site()}#catalog`;
    const guide = /^docs\/(.+)\.md$/.exec(path)?.[1];
    if (guide && `${PREFIX}${guide}.md` in TEXTS) return guideUrl(guide);
    if (/^docs\/(recipes|components)\/?$/.test(path)) return guideUrl(`${path.slice(5).replace(/\/$/, "")}/README`);
    return `${REPO}${path}`;
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

/** Follows a link to a page of this site in this tab: another guide by its hash alone, keeping the data picked; a catalog page by its address. */
function openLink(href: string): boolean {
  if (!href.startsWith(site())) return false;
  const url = new URL(href);
  if (url.search) location.assign(href);
  else location.hash = url.hash;
  window.scrollTo({ top: 0 });
  return true;
}

export function DocsPage() {
  const all = useMemo(sections, []);
  const [page, setPage] = useState(pageFromHash);
  // A note left for whoever edits the file (`<!-- Generated by … -->`) is not part of the guide.
  const text = TEXTS[`${PREFIX}${page}.md`]?.replace(/<!--[\s\S]*?-->\s*/g, "");
  // The guide follows the address: a link, the list, Back and Forward all change the hash.
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
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
                <a href={`#docs?page=${guide.id}`} aria-current={guide.id === page ? "page" : undefined} onClick={() => window.scrollTo({ top: 0 })}>
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
