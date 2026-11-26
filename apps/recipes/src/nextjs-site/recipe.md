# Serve a site's pages from Next.js

Serve pages written in the site catalog (by an agent or by hand) as the routes of a Next.js app, or as parts of pages you write yourself, with static export. `@surfaces-ui/next` works out the routes and metadata and draws each page. Next.js does the routing, building and hosting. Every page is rendered to HTML on the server, so its words, headings, links and theme are in the file before any script runs.

Install it beside `next` (15 or later, App Router), which it takes as a peer dependency:

```bash
npm install @surfaces-ui/next @surfaces-ui/spec @surfaces-ui/components
```

The site is a list of pages, each on a route. A segment in brackets (`[slug]`) takes values the app supplies. Surfaces does not store content: here the essays are a list, but they could come from MDX files, a CMS or a database.

{{file: site.ts}}

One optional catch-all route serves every page. Its params, metadata and page all come from the site:

{{file: app/[[...route]]/page.tsx}}

Notes on it:

- **`siteParams` lists every address** for `generateStaticParams`, with `[]` for the home page. A route that takes values when none were given is an error, so a static export never leaves a page out quietly. `dynamicParams = false` makes any other address a 404 at build time.
- **`SitePage` is a server component.** It finds the page, calls `notFound()` for an address the site does not have, and checks the page against its catalog. A page the catalog refuses stops the build with what is wrong.
- **`data` runs on the server.** What it returns is merged into the page's data, where the page binds to it (`{ "@path": "/essay/title" }`). The route's own values are also at `/@route` (`/@route/slug`). Only plain JSON reaches the browser.
- **`siteMetadata` writes the title** (the site's title after a page's, the home page's alone), the description, the canonical path and a link preview. `describe` gives a route that takes values its own title and description.
- **A link to a path on the site** (`"/essays"`) moves through Next.js's router without loading the page again. A link elsewhere opens in a new tab, as it does in any surface.
- **Images come from the app.** A `Media` names an image, and `resolveImage` on `SitePage` and `siteMetadata` turns the name into an address on the server. With neither that nor `imageOrigins`, a page loads no address an agent wrote (see the site catalog's rules).
- **The essay's title is a `Hero`**, not a `Text`: a page that is the whole document has one `<h1>`, and `Hero` draws it. `Text`'s heading variants start at `<h2>`, since inside a host's page the host owns the `<h1>`.

## A part of a page

You don't have to give Surfaces whole routes. `SurfaceSection` draws one page document as a part of a Next.js page you write yourself: your own markup around it, as many sections as you like on one page, each rendered on the server. It takes `data` (plain JSON, merged into the page's data), `theme`, `resolveImage` and `imageOrigins`. Each section is themed in its own region, so the rest of the page keeps your look. A section the catalog refuses stops the build with what is wrong, as a route does.

{{file: app/about/page.tsx}}

The `/about` folder sits beside the catch-all route, and Next.js serves it first, as it does any fixed route. A site can be all routes, all sections, or a mix of the two.

## Styles

The root layout loads the stylesheet. The layered form keeps Surfaces' rules below Tailwind's and your own:

{{file: app/layout.tsx}}

`turbopack.root` is needed only in a pnpm workspace like this repository, where the packages are linked from outside the app's folder. In an app of your own, `next.config` needs only `output: "export"`:

{{file: next.config.mjs}}

Each page is themed in its own region (`scope="scoped"`, kept in memory), unless your layout already has a `ThemeProvider`, in which case that one is used. Data components (`Chart`, `DataGrid` and the rest) need a `DataSourceProvider` from a client component in your layout, as in [Embed in a Next.js app](nextjs-embed.md). They draw once the page has loaded in the browser.

Relative imports in the app's own files are written without `.js`, as Next.js expects; Turbopack does not map `.js` onto a `.ts` file.

The test checks the routes and metadata every time. With `SURFACES_TEST_NEXT=1` it also runs a real `next build` (Next.js 16.4, Turbopack, static export) and reads the HTML written for every page, the about page included. The exported site has also been opened in Chromium: the routes and the about page hydrated with no errors, and links moved between pages without reloading.

{{file: site.test.ts}}

Not built yet: layouts shared by pages (a header and a side navigation on every page), which wait for the site document in [the sites plan](../plans/sites.md).
