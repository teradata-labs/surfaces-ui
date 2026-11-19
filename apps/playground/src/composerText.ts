import { type JsonRenderSpec, type SurfaceMessage, analyticsCatalog, fromJsonRender } from "@surfaces-ui/spec";

export const pretty = (value: unknown) => JSON.stringify(value, null, 2);

/** What a message does, in a few words, for the stepper. */
export function describe(message: unknown): string {
  if (!message || typeof message !== "object") return "Not a message";
  const m = message as Record<string, Record<string, unknown> | undefined>;
  if (m.createSurface) return `Create surface "${String(m.createSurface.surfaceId)}"`;
  if (m.updateComponents) {
    const count = Array.isArray(m.updateComponents.components) ? m.updateComponents.components.length : 0;
    return `Update ${count} component${count === 1 ? "" : "s"} on "${String(m.updateComponents.surfaceId)}"`;
  }
  if (m.updateDataModel) return `Set data ${String(m.updateDataModel.path ?? "/")} on "${String(m.updateDataModel.surfaceId)}"`;
  if (m.deleteSurface) return `Delete surface "${String(m.deleteSurface.surfaceId)}"`;
  return "Unknown message";
}

/** Parses the editor's text: an array of messages, or one message. */
export function parseMessages(text: string): { messages: SurfaceMessage[] } | { error: string } {
  try {
    const value = JSON.parse(text) as unknown;
    if (Array.isArray(value)) return { messages: value as SurfaceMessage[] };
    if (value && typeof value === "object") return { messages: [value as SurfaceMessage] };
    return { error: "Write a JSON array of A2UI messages." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function parseSpec(text: string): { messages: SurfaceMessage[] } | { error: string } {
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "A json-render spec is an object with root and elements." };
    const spec = value as JsonRenderSpec;
    if (typeof spec.root !== "string" || !spec.elements || typeof spec.elements !== "object") return { error: "A json-render spec needs a root key and an elements object." };
    return { messages: fromJsonRender(spec, analyticsCatalog, { surfaceId: "main" }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

