import { type Surface, type SurfaceMessage, applyMessage, setPath } from "@surfaces-ui/spec";
import { type JsonChange, type ReplayOptions, type ReplayState, type TraceEvent, replay, stepDiff } from "@surfaces-ui/trace";

/** The surface model's own functions, handed to the replay in `@surfaces-ui/trace`. */
export const SURFACE_REPLAY: ReplayOptions<Surface> = {
  apply: (surfaces, message) => applyMessage(surfaces, message as SurfaceMessage),
  setPath,
};

/**
 * The surfaces as they stood after the event numbered `seq`, or as they
 * stand now when it is left out: the recorded messages replayed through
 * `applyMessage`, with what a person typed and the controls they set. Pure.
 */
export const surfacesAt = (events: readonly TraceEvent[], seq?: number): ReplayState<Surface> => replay(events, seq, SURFACE_REPLAY);

/** What the step numbered `seq` changed, against the step before it. */
export const surfaceStepDiff = (events: readonly TraceEvent[], seq: number): JsonChange[] => stepDiff(events, seq, SURFACE_REPLAY);

/** A surface with the controls a person set written over its components' props, as the page showed it. */
export function withControls(surface: Surface, controls: Record<string, unknown> | undefined): Surface {
  if (!controls || Object.keys(controls).length === 0) return surface;
  const components = { ...surface.components };
  for (const [id, state] of Object.entries(controls)) {
    const component = components[id];
    if (component && state && typeof state === "object" && !Array.isArray(state)) components[id] = { ...component, ...(state as Record<string, unknown>) };
  }
  return { ...surface, components };
}
