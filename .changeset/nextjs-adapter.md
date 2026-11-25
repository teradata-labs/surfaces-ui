---
"@surfaces-ui/next": minor
"@surfaces-ui/spec": patch
"@surfaces-ui/components": patch
---

New package `@surfaces-ui/next`: serve site-catalog pages as the routes of a Next.js app (15 or later, App Router), with Next.js as a peer dependency. `siteParams` for `generateStaticParams`, `siteMetadata` for `generateMetadata`, and `SitePage`, a server component that matches the address (a 404 otherwise), fills the page from the app's data and the route's values, resolves image names on the server and draws it with `SiteSurface`, which renders to HTML on the server and moves between the site's pages through Next.js's router. Static export works.

`ThemeProvider` hydrates without a mismatch when the system asks for dark: the server and the first browser render both use light, then the system's choice is read (the CSS already followed it). In the site catalog a `Link` may be a path on the site, opened in place; `siteLink` is now exported from `@surfaces-ui/spec` as well as `@surfaces-ui/spec/react`.
