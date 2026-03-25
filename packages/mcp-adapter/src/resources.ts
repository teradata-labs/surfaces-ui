import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SURFACES_APPS,
  SURFACES_STYLESHEETS,
  SURFACES_DOCS,
  type AppId,
  type StylesheetId,
  type DocId,
  type ResourceId,
} from "./registry.js";
import type { SurfacesResource, SurfacesResourceContent } from "./types.js";

/** URI scheme for surfaces-ui resources. */
const URI_PREFIX = "ui://";

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
 * Returns the list of all surfaces-ui resources (apps, stylesheets, and docs).
 * Each entry conforms to the MCP resource list shape.
 */
export function getSurfacesResources(): SurfacesResource[] {
  const apps = Object.entries(SURFACES_APPS).map(([id, meta]) => ({
    uri: `${URI_PREFIX}${id}`,
    name: meta.name,
    description: meta.description,
    mimeType: meta.mimeType,
  }));

  const stylesheets = Object.entries(SURFACES_STYLESHEETS).map(([id, meta]) => ({
    uri: `${URI_PREFIX}${id}`,
    name: meta.name,
    description: meta.description,
    mimeType: meta.mimeType,
  }));

  const docs = Object.entries(SURFACES_DOCS).map(([id, meta]) => ({
    uri: `${URI_PREFIX}${id}`,
    name: meta.name,
    description: meta.description,
    mimeType: meta.mimeType,
  }));

  return [...apps, ...stylesheets, ...docs];
}

/**
 * Reads a surfaces-ui resource by its URI and returns the full content.
 * Handles apps (HTML), stylesheets (CSS), and documentation (Markdown).
 * Throws if the URI is not recognised or the file is missing.
 *
 * Query parameters (e.g., ?sql=...) are stripped before resource ID lookup.
 */
export function readSurfacesResource(uri: string): SurfacesResourceContent {
  // Strip query parameters and fragment before extracting resource ID
  const cleanUri = uri.split('?')[0]!.split('#')[0]!;
  const id = cleanUri.replace(URI_PREFIX, "") as ResourceId;

  // Check which registry the resource belongs to
  let meta: { filename: string; mimeType: string; name: string };
  let resourceType: 'app' | 'stylesheet' | 'doc';

  if (Object.hasOwn(SURFACES_APPS, id)) {
    meta = SURFACES_APPS[id as AppId];
    resourceType = 'app';
  } else if (Object.hasOwn(SURFACES_STYLESHEETS, id)) {
    meta = SURFACES_STYLESHEETS[id as StylesheetId];
    resourceType = 'stylesheet';
  } else if (Object.hasOwn(SURFACES_DOCS, id)) {
    meta = SURFACES_DOCS[id as DocId];
    resourceType = 'doc';
  } else {
    throw new Error(`Unknown surfaces-ui resource: "${id}"`);
  }

  const filePath = resolve(APPS_DIR, meta.filename);

  try {
    const text = readFileSync(filePath, "utf-8");
    return {
      uri,
      mimeType: meta.mimeType,
      text,
    };
  } catch {
    throw new Error(
      `Resource file "${meta.filename}" for "${id}" not found. Run "pnpm build" to generate resources.`,
    );
  }
}

/**
 * Returns true if the given URI belongs to the surfaces-ui scheme.
 * Useful for routing in servers that handle multiple resource types.
 */
export function isSurfacesUri(uri: string): boolean {
  return uri.startsWith(URI_PREFIX);
}

/**
 * Validates that all registered resources exist on disk.
 * Returns an array of resource IDs whose files are missing.
 * An empty array means all resources are present.
 */
export function validateBundles(): string[] {
  const missing: string[] = [];

  // Check apps
  for (const [id, meta] of Object.entries(SURFACES_APPS)) {
    const filePath = resolve(APPS_DIR, meta.filename);
    if (!existsSync(filePath)) {
      missing.push(id);
    }
  }

  // Check stylesheets
  for (const [id, meta] of Object.entries(SURFACES_STYLESHEETS)) {
    const filePath = resolve(APPS_DIR, meta.filename);
    if (!existsSync(filePath)) {
      missing.push(id);
    }
  }

  // Check docs
  for (const [id, meta] of Object.entries(SURFACES_DOCS)) {
    const filePath = resolve(APPS_DIR, meta.filename);
    if (!existsSync(filePath)) {
      missing.push(id);
    }
  }

  return missing;
}
