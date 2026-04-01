export {
  getSurfacesResources,
  readSurfacesResource,
  isSurfacesUri,
  validateBundles,
} from "./resources.js";

export {
  SURFACES_APPS,
  SURFACES_STYLESHEETS,
  SURFACES_DOCS,
  type AppId,
  type StylesheetId,
  type DocId,
  type ResourceId,
} from "./registry.js";

export type { SurfacesResource, SurfacesResourceContent } from "./types.js";
