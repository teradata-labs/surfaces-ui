import { type PageDocument, analyticsCatalog, basicsCatalog, siteCatalog, validatePage } from "@surfaces-ui/spec";

const CHECKED = [siteCatalog, basicsCatalog, analyticsCatalog];

/**
 * Stops on a page its catalog refuses, saying what is wrong and where (`where`: a route, or the page's id), so a
 * build never ships a broken page. A page of an app's own catalog is checked in the browser, by `SurfaceView`.
 */
export function assertPage(page: PageDocument, where: string): void {
  const catalog = CHECKED.find((c) => c.id === page.catalogId);
  if (!catalog) return;
  const issues = validatePage(page, catalog);
  if (issues.length) throw new Error(`The page ${where} does not fit the ${catalog.id} catalog: ${issues.map((i) => `${i.path} ${i.message}`).join("; ")}`);
}
