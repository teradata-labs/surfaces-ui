/**
 * Framework-agnostic MCP resource types.
 *
 * These mirror MCP spec shapes but don't import from any SDK,
 * so any server framework can map them to its own types.
 */

export interface SurfacesResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface SurfacesResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}
