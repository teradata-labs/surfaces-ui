import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SURFACES_APPS, type AppId } from "./registry.js";
import type { SurfacesResource, SurfacesResourceContent } from "./types.js";

/** URI scheme for surfaces-ui resources. */
const URI_PREFIX = "surfaces-ui://apps/";

/**
 * Resolve the directory containing built HTML app bundles.
 * At runtime this is `<package-root>/apps/` — the copy-apps script
 * copies the built bundles there during `prebuild`.
 */
const APPS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../apps",
);

/**
 * Returns the list of all surfaces-ui app resources.
 * Each entry conforms to the MCP resource list shape.
 */
export function getSurfacesResources(): SurfacesResource[] {
  return Object.entries(SURFACES_APPS).map(([id, meta]) => ({
    uri: `${URI_PREFIX}${id}`,
    name: meta.name,
    description: meta.description,
    mimeType: meta.mimeType,
  }));
}

/**
 * Reads a surfaces-ui resource by its URI and returns the full content.
 * Throws if the URI is not recognised or the HTML bundle is missing.
 */
export function readSurfacesResource(uri: string): SurfacesResourceContent {
  const id = uri.replace(URI_PREFIX, "") as AppId;
  const meta = SURFACES_APPS[id];
  if (!meta) {
    throw new Error(`Unknown surfaces-ui app: "${id}"`);
  }

  const filePath = resolve(APPS_DIR, meta.filename);
  const text = readFileSync(filePath, "utf-8");

  return {
    uri,
    mimeType: meta.mimeType,
    text,
  };
}

/**
 * Returns true if the given URI belongs to the surfaces-ui scheme.
 * Useful for routing in servers that handle multiple resource types.
 */
export function isSurfacesUri(uri: string): boolean {
  return uri.startsWith(URI_PREFIX);
}
