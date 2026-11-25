# Sites: a site catalog, layouts, routes and a Next.js adapter

A plan for [#182](https://github.com/teradata-labs/surfaces-ui/issues/182). Step 1 is built. A first slice of step 6 is built ahead of steps 4 and 5: `@surfaces-ui/next` serves site-catalog pages as routes, rendered on the server, with static export (see below). Each step can land, and be useful, on its own.

## Why

Surfaces UI draws data products well: filters, numbers, charts and grids that an agent composes. It draws a landing page, a docs site or a blog poorly. In Surfaces Studio's pressure tests a splash page for Surfaces UI came out correct but plain, and a one-page social app drew its feed as a data table.

The look those pages need already exists, but only in one app: the playground's home, showcase and docs pages (`apps/playground/src/app.css`, 3,315 lines, `.home-*`, `.showcase-*`, `.docs-*`). No agent can reach it. Today Surfaces UI cannot build its own home page from its catalog.

This plan moves that look into the library and adds what a site needs beyond a page: layouts shared by pages, and routes.

## What is there now

The plan builds on these rather than beside them.

| Already in place | Where | What it means for this plan |
|---|---|---|
| `extendCatalog` | `packages/spec/src/catalog.ts` | A second catalog can be built from a base without copying it. |
| `PageDocument`, `validatePage`, `editPage`, `pageSurface` | `packages/spec/src/page.ts` | A site's pages are `PageDocument`s. Nothing that takes a page has to change. |
| Saved surfaces with a `SurfaceKind` | `proto/surfaces/v1/view.proto` | A site is stored as a saved surface of a new kind, versioned like a page or a conversation. |
| `App`, `Page`, `Panel`, `Layout` messages | `proto/surfaces/v1/view.proto` | The older panel-and-rectangle app model. It is not reused: a site holds `PageDocument`s, not panels. |
| `NavBar`, `SideNav` | `packages/components` | `NavBar` is not in the catalog yet. `SideNav` is, and sends a `navigate` event for an item without `href`. Both fold correctly in a container since #179 (#175). |
| `@surfaces-ui/page` (`mountPage`) | `packages/page` | One script and one stylesheet for plain HTML pages. Hash routing for a site belongs here. |
| Motion tokens | `packages/tokens/src/css.ts` | `--sf-duration-*` and `--sf-ease-*` exist and go to zero under reduced motion. No new motion tokens are needed. |
| `RowList`, `Message`, form checks, `visibleWhen` | `packages/spec` (#179) | `PostList` is a `RowList` of `PostCard`s; contact and sign-up forms use `Form`. |
| The Next.js embed recipe | `apps/recipes/src/nextjs-embed` | Loads Surfaces in the browser only (`ssr: false`), because `ThemeProvider` reads the system's mode. Rendering on the server is new work (step 5). |

Not there: an `Image` or `Media` component in the catalog. The proposal lists `Image` among the shared basics; it has to be added.

## Steps

### 1. Shared basics, and a `site` catalog

- **Split the basics out of `analyticsCatalog`.** Make a `basicsCatalog` holding the layout and content components both catalogs need (Text, Row, Column, Grid, Card, Divider, Button, Link, Markdown, the inputs and Form, Tabs, SideNav, ThemeSwitch). Then build `analyticsCatalog` as `extendCatalog(basicsCatalog, …)`. Its components, ids and generated docs must come out the same. That is the test of the split.
- **Add `siteCatalog = extendCatalog(basicsCatalog, …)`**, with these components, taken from the playground where it has them:

  | Component | From | Notes |
  |---|---|---|
  | `Hero` | `.home-hero`, `.home-title`, `.home-lead`, `.home-actions` | A fluid display title, a lead of at most 40rem, actions, and an optional media slot |
  | `Section` | `.home-section`, `.home-section-head` | An eyebrow, a heading, a lead, and roomy vertical rhythm |
  | `FeatureGrid` | `.home-personas`, `.home-persona` | Cards with an icon or media, a title and a line; responds to its container |
  | `DeviceFrame` | `.home-devices`, `.home-desktop*`, `.home-phone-*` | A desktop window or a phone around any child, a live surface included |
  | `PromptReveal` | `.home-prompt`, `.home-caret`, `.home-reveal` | A prompt typed out and its answer shown; shown finished under reduced motion |
  | `Showcase` | `.showcase-*` | A picker of named examples beside a stage showing the chosen one |
  | `NavBar`, `Footer` | the playground's top bar | `NavBar` wraps the existing component |
  | `Media` | new | An image or video with an aspect ratio, `alt` required, lazy by default |
  | `Quote`, `Callout` | new | Editorial blocks for essays and docs |
  | `PostCard`, `PostList` | new | A title, date, excerpt and tags; `PostList` is a `RowList` of them |

- **`DocsLayout` is left out of the catalog.** A side nav and a table of contents around an article is a layout (step 2), not a component.
- **Media addresses follow the `Markdown` rule.** An image is drawn only where the host gives its address (`resolveImage`, or a list of allowed origins). An agent cannot make a page load an address of its own choosing. Links go through `safeUrl`.
- Each new component gets the usual catalog entry, a renderer, a valid example, a test against `memoryDataSource`, a page from `pnpm docs:gen`, and a place in the playground's Components area.
- Move the styles out of `apps/playground/src/app.css` into `@surfaces-ui/components/styles.css` as `sf-site-*`. Then the playground's home page uses the library's components. That is the acceptance test for this step: **the playground's home page is drawn from `siteCatalog`.**

### 2. An editorial preset and the tokens it needs

- Add the type and spacing a site needs to `@surfaces-ui/tokens`: a display step above `large-title` with fluid sizing (`clamp`), and section spacing (steps larger than a dashboard uses).
- Make the backdrop glow tokens: the playground's radial gradients, mixed from the accent and series colours at a `--sf-glow` strength. Under `contrast: "more"` and `prefers-reduced-transparency` the glow is off, as the playground does today.
- Add a preset, **Editorial**, tested like the others: contrast for every level, series colours on its panes, and text over the glow at 4.5:1 checked against the glow's strongest point.

### 3. Patterns and skills for sites

- Add site patterns beside the human-in-the-loop ones: a landing page, a docs page, a changelog, a blog index and article, and a pricing page. Each is a valid surface an agent starts from, generated into `docs/catalog/site-patterns.md`.
- Add a `surfaces-site` plugin beside `surfaces-analytics`, with skills for landing-page design (one message per section, one primary action), docs-site structure, voice and copy, imagery and motion, and responsive, accessible sites (headings in order, link text that says where it goes, contrast over the glow). Skills state rules and point at the catalog. They do not restate props.

### 4. A site document, layouts and routes

The issue's comment replaces the first draft's `chrome` (a header and a footer) with **layouts**. This plan takes layouts.

```ts
interface SiteDocument {
  a2ui: "1.0";
  id: string;
  title: string;
  catalogId: string;                 // "site", "analytics", or a team's own
  theme?: ThemeRequest;              // as applyThemeRequest takes it
  layouts?: SiteLayout[];
  pages: Array<{
    route: string;                   // "/", "/pricing", "/essays/[slug]"
    page: PageDocument;
    layout?: string;                 // a layout id; none draws the page alone
    meta?: { title?: string; description?: string; image?: string };
    params?: ParamSource;            // where a dynamic route's values come from
  }>;
}

interface SiteLayout {
  id: string;
  preset?: "blank" | "site" | "app" | "docs" | "dashboard";
  regions: Partial<Record<"top" | "left" | "right" | "bottom", {
    page: PageDocument;              // the region's components
    size?: { value: number; unit: "px" | "fr" };
    sticky?: boolean;
    phone?: "drawer" | "stack" | "hide";
  }>>;
}
```

- **In `@surfaces-ui/spec`:** `SiteDocument`, `parseSite` (anything read from outside is checked before use, as `parseConversation` does), `validateSite`, `upgradeSite`, and `editSite` for route and layout edits. `validateSite` reports a page whose layout does not exist, two pages on one route, a route that is not a path, and a `navigate` or `Link` to a route that does not exist.
- **Links:** `navigate` takes `{ route }` or a page id, and a `Link`'s url may be a route. A route is resolved by the host's router, never by the component.
- **A layout is a shell with named regions** (`top`, `left`, `main`, `right`, `bottom`). Each region but `main` holds components shared by every page that uses the layout. A `SiteShell` component draws it with CSS grid areas and responds to its container, not the window: nothing in it is `position: fixed`, and on a phone `left` becomes a drawer opened from `top`, using `SideNav`'s dialog.
- **The presets** (Blank, Site, App, Docs, Dashboard) are starting layouts in the document, not fixed shells. Docs is the side nav and table of contents that `DocsLayout` was going to be.
- **`SideNav` and `NavBar` can list the site's pages** and mark the current one from the route, with no wiring.
- **A single page is a site with one route and no layout.** Nothing that takes a `PageDocument` today changes.
- **Stored as a saved surface:** add `SURFACE_KIND_SITE` to `SurfaceKind` in `view.proto` (`pnpm gen`). The document goes in as JSON, as pages and conversations do, so the library and the dev server keep versions with no new service.
- **`Workspace` stays what it is:** panels inside a page, not the frame of an app.

### 5. Running a site

- **`@surfaces-ui/page`:** `mountSite(element, site)` with hash routing, for a plain HTML site from one script and one stylesheet.
- **A React `SiteRouter`** for an app with no router of its own. The app gives it the location and a way to change it, so it never touches `window.history` itself.
- **Static export:** one HTML file per route, written from a site document by a CLI in `@surfaces-ui/page`.
- **Rendering on the server** is new work and has to come before the Next.js adapter. Text, `Hero`, `Section`, `NavBar`, `Footer` and `Media` must render to HTML with no browser, and the theme must reach that HTML as CSS (`themeCss` is already pure). A data component (`Chart`, `DataGrid` and the rest) stays a client component and draws in the browser.

### 6. Next.js: `@surfaces-ui/next`

**Built, a first slice:** `siteParams`, `siteMetadata`, `SitePage` and `SiteSurface`, over `SiteRoutes` (the `title`, `theme` and `pages` of the site document below, with no layouts), run with a real `next build` and static export in the recipe `apps/recipes/src/nextjs-site`. It needed no server rendering work beyond `ThemeProvider` (which read the system's mode while rendering): every site and basic component already renders to HTML with no browser. A `Link` in the site catalog takes a path on the site. Not yet: layouts as route groups, and the pilot.

A small adapter, so a site runs in an existing Next.js app by installing the library:

```tsx
// app/[[...route]]/page.tsx
import site from "@/site.json";
import { siteParams, siteMetadata, SitePage } from "@surfaces-ui/next";

export const generateStaticParams = () => siteParams(site);
export const generateMetadata = ({ params }) => siteMetadata(site, params);
export default function Page({ params }) {
  return <SitePage site={site} params={params} />;
}
```

- **Next.js does routing, building, metadata and hosting. Surfaces only draws pages.**
- **Each layout becomes a route group with its own `layout.tsx`.** That is the same idea in Next.js's terms.
- **The app supplies a dynamic route's values:** `siteParams(site, { essays: () => getEssays().map((e) => e.slug) })`. They can come from files, a CMS or a database. Surfaces does not become a CMS.
- **Static export (`output: 'export'`) works:** params and metadata are resolved at build time.
- **It lives beside Tailwind and an app's own CSS:** Surfaces' styles stay in their region (`scope="scoped"`, `styles.layer.css`), as the embed recipe does.
- **A recipe in `apps/recipes`, with a test,** builds a two-route site with static export.
- **The pilot** is the Next.js site named in #182: app router, static export, Tailwind, and essays from MDX with `[slug]` pages. The first slice there is the home page and the essays index drawn through `@surfaces-ui/next`, with essay pages left as they are. Then its MDX components are mapped to `Callout` and `Quote`.

## Order and size

| Step | Depends on | Size | Done when |
|---|---|---|---|
| 1. Basics split, site catalog | — | Large | The playground's home page is drawn from `siteCatalog`; the analytics catalog's generated docs are unchanged by the split |
| 2. Editorial preset | — (can run beside 1) | Medium | The preset passes every theme test, the glow included |
| 3. Patterns and skills | 1, 2 | Medium | An agent with the `surfaces-site` skills draws a landing page from a pattern, checked by hand once |
| 4. Site document and layouts | 1 | Large | `validateSite` and `SiteShell` are tested; the playground's docs area is one site with a Docs layout |
| 5. Running a site | 4 | Medium | `mountSite` and `SiteRouter` are tested; static export writes one file per route; the site components render on the server in a test |
| 6. Next.js adapter | 4, 5 | Medium | The recipe's test passes with static export, and the pilot's first slice runs |

Steps 1 and 2 can start together. Each step is its own PR, with a changeset, docs (`docs/getting-started.md`, `docs/agent-integration.md`, `llms.txt` and `AGENTS.md` where an exported API changes), and browser tests for anything a person interacts with.

## Surfaces Studio, after this lands

These changes are in the studio, not this repository. They are listed so the document's shape serves them.

- A new prototype is a data product or a website. That choice picks the catalog, the starting patterns and the skills, not a different structure.
- The page lane gets a route for each page, and an "Edit layout" mode that shows the regions outlined. A component can be moved into a region ("show on every page") and back.
- A change to a layout says how many pages share it before it is made.
- Present and review links open a route. A website's handoff carries the site document and the Next.js route file.
- The pressure tests grow site scenarios, and the splash page becomes the benchmark.

## Decisions

Settled in review of this plan.

1. **Split a `basicsCatalog` out of the analytics catalog.** Both catalogs are built on it, so a site agent is not offered a `PivotTable` and a data agent is not offered a `Hero`. A smaller catalog means a shorter prompt and fewer wrong picks. Extending `analyticsCatalog` would have been less work, but it would offer a site agent every data component.
2. **One Editorial preset.** The display step, section spacing and glow come with one preset, tested like the others. Adding them to all eight presets would multiply the contrast and glow tests by eight for looks most data products never use. A site that wants another look can still start from Editorial and change its accent and fonts.
3. **Each layout region is a `PageDocument`.** Every tool that reads, checks, edits or arranges a page then works on a region unchanged, and a region can be edited by itself ("show on every page" moves a component into one). A `Slot` marking `main` inside one layout page is closer to how Next.js writes a layout, but it would need new edit rules and a new check for exactly one slot.
4. **The host gives image addresses, through `resolveImage` or allowed origins.** This is the rule `Markdown` already follows: an agent cannot make a page load an address of its own choosing, which would leak who views it and could show anything. A host that wants stock or generated images supplies them from its own store.

## Not in this plan

- The studio running Next.js, or hosting and building sites.
- A content management system: a dynamic route's values come from the app.
- Nested layouts: a page uses one layout.
- Analytics or tracking for sites.
