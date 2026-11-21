import { PUBLISHED } from "./source.js";

/**
 * Google Analytics for the published site, and nowhere else: it loads only in a build made with
 * `VITE_SURFACES_PUBLISHED=1` and a `VITE_GA_MEASUREMENT_ID` (the repository variable `GA_MEASUREMENT_ID` in the Pages
 * workflow), so a local or self-hosted playground never calls Google. A visitor who sends Global Privacy Control or
 * Do Not Track is not counted.
 *
 * What is sent is which page of the playground was opened, never what a person typed, queried or loaded.
 */
const MEASUREMENT_ID = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GA_MEASUREMENT_ID ?? "";

/** The parts of a hash that name a page of the site. Anything else (a saved surface's id, say) is a person's own and is left out. */
const PAGE_KEYS = ["page", "persona", "component"];

/** A measurement id as Google writes one, so a mistyped variable loads nothing. */
export const isMeasurementId = (id: string): boolean => /^G-[A-Z0-9]{4,}$/.test(id);

/** The page a hash names, as a path: `#docs?page=getting-started.md&surface=x` is `/docs?page=getting-started.md`. */
export function pagePath(hash: string): string {
  const [area = "", query = ""] = hash.replace(/^#/, "").split("?");
  const given = new URLSearchParams(query);
  const kept = new URLSearchParams();
  for (const key of PAGE_KEYS) {
    const value = given.get(key);
    if (value) kept.set(key, value);
  }
  const text = kept.toString();
  return `/${area.replace(/[^\w-]/g, "")}${text ? `?${text}` : ""}`;
}

/** Whether the visitor has asked not to be tracked. */
export function optedOut(nav: { globalPrivacyControl?: boolean; doNotTrack?: string | null } = navigator): boolean {
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

/** Starts counting page views on the published site. Does nothing anywhere else. */
export function startAnalytics(): void {
  if (!PUBLISHED || !isMeasurementId(MEASUREMENT_ID) || optedOut()) return;
  const scope = window as unknown as { dataLayer?: unknown[] };
  const layer = (scope.dataLayer ??= []);
  // gtag reads the `arguments` object itself, so this cannot be an arrow function over a rest list.
  function gtag(..._args: unknown[]) {
    layer.push(arguments);
  }
  gtag("js", new Date());
  // The playground routes by hash, which Google does not follow, so each view is sent by hand.
  gtag("config", MEASUREMENT_ID, { send_page_view: false });
  const view = () => {
    const path = pagePath(location.hash);
    gtag("event", "page_view", { page_location: `${location.origin}${path}`, page_path: path, page_title: document.title });
  };
  view();
  window.addEventListener("hashchange", view);
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.append(script);
}
