/**
 * What Next.js passes a page as `params`: a promise since Next.js 15, the object itself before. Either is
 * accepted, so the same route file works on both.
 */
export type RouteParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

/** The catch-all segments out of `params`: `["essays", "first-post"]`, or none for the home page. */
export async function segmentsOf(params: RouteParams | undefined, param = "route"): Promise<string[]> {
  const value = (await params)?.[param];
  return value === undefined ? [] : typeof value === "string" ? [value] : value;
}
