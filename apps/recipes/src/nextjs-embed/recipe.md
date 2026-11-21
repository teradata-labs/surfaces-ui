# Embed in a Next.js app

Put a query result into a page of an existing Next.js app, themed only in its own region, talking to your data server from the browser. The component is ordinary React with `"use client"` at the top; the page loads it in the browser only.

The panel:

{{file: SurfacesPanel.tsx}}

Notes on it:

- `"use client"` is needed. The library's components use state, effects and the browser, and its packages do not mark themselves as client code, so import them only from files that start with it.
- `scope="scoped"` puts the theme's `--sf-*` variables on the panel's own element instead of on `:root`, so the rest of your app keeps its look. `storage={null}` keeps the theme in memory; leave it out to remember a person's choice in `localStorage`.
- `connectDataSource` talks to a server that implements the Surfaces services, such as `surfaces-dev`. To use your own API instead, pass any `DataSource` as `dataSource` (see "Bring your own backend").
- `baseUrl` is read in the browser. Never put a credential in it; the data server resolves credentials by name on its side.
- To draw what an agent sends instead of a fixed result, render `SurfaceView` from `@surfaces-ui/spec/react` with `lazyAnalyticsRenderers`, which keeps the charts and editors out of the first load until something is drawn.

The rest lives in your Next.js app. These files have **not been run here**; they are written for the App Router.

Load the stylesheet once, in the root layout:

```tsx
// app/layout.tsx
import "@surfaces-ui/components/styles.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Load the panel in the browser only. In the App Router, `next/dynamic` with `ssr: false` must be called from a client component, so give it a small file of its own:

```tsx
// app/orders/PanelLoader.tsx
"use client";

import dynamic from "next/dynamic";

export const OrdersPanel = dynamic(() => import("../../components/SurfacesPanel").then((m) => m.SurfacesPanel), {
  ssr: false,
  loading: () => <p>Loading orders…</p>,
});
```

```tsx
// app/orders/page.tsx
import { OrdersPanel } from "./PanelLoader";

export default function OrdersPage() {
  return (
    <main>
      <h1>Orders</h1>
      <OrdersPanel baseUrl={process.env.NEXT_PUBLIC_SURFACES_URL ?? ""} sourceId="retail" sql="SELECT * FROM orders" />
    </main>
  );
}
```

The packages are published as compiled ES modules, so `transpilePackages` should not be needed. If your build reports untranspiled syntax from them, or you point Next.js at the packages' source in a workspace, list them:

```ts
// next.config.ts
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@surfaces-ui/components", "@surfaces-ui/client-connect", "@surfaces-ui/data", "@surfaces-ui/tokens"],
};

export default config;
```

If the data server is on another origin, it must allow your app's origin for CORS, or put it behind a route in your app so the browser calls the same origin.

The test renders the panel in jsdom with `memoryDataSource` passed as `dataSource`, and checks that it draws the rows and that the theme is scoped to the panel. It does not run inside Next.js, and Next.js itself has not been run for this recipe: the layout, loader, page and config above are unverified.

{{file: panel.test.tsx}}
