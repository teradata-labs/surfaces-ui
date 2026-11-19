import type { TraceEvent, TraceKind } from "./event.js";
import type { TraceFeed } from "./recorder.js";

export interface PerformanceTracksOptions {
  /** The group the tracks sit under in the Performance panel. Default "Surfaces UI". */
  trackGroup?: string;
}

const TRACK: Record<TraceKind, string> = { message: "Messages", component: "Components", problem: "Problems", state: "State", event: "Events", agent: "Agent turns", service: "Service calls" };
const COLOR: Record<TraceKind, string> = { message: "primary", component: "primary-light", problem: "error", state: "secondary", event: "secondary-light", agent: "tertiary", service: "tertiary-light" };

/**
 * Shows a feed's spans as custom tracks in the Performance panel of Chrome's
 * developer tools, through `performance.measure` with a `detail.devtools`
 * entry (Chrome's extensibility API for the panel). Each finished event is
 * measured once, on a track for its kind. Where the browser has no
 * `performance.measure`, or refuses the call, nothing happens. Returns a
 * function that stops it.
 */
export function performanceTracks(feed: TraceFeed, options: PerformanceTracksOptions = {}): () => void {
  const perf = (globalThis as { performance?: Performance }).performance;
  if (!perf || typeof perf.measure !== "function" || typeof perf.timeOrigin !== "number") return () => {};
  const trackGroup = options.trackGroup ?? "Surfaces UI";
  let last = 0;
  const waiting = new Set<number>();
  const measure = (event: TraceEvent) => {
    const start = Math.max(0, event.time - perf.timeOrigin);
    const properties: [string, string][] = [["status", event.status], ["trace", event.traceId]];
    if (event.surfaceId) properties.push(["surface", event.surfaceId]);
    if (event.componentId) properties.push(["component", event.componentId]);
    try {
      perf.measure(event.name, {
        start,
        end: start + (event.durationMs ?? 0),
        detail: { devtools: { dataType: "track-entry", track: TRACK[event.kind], trackGroup, color: event.status === "error" ? "error" : COLOR[event.kind], properties, tooltipText: `${event.name} (${event.status})` } },
      });
    } catch {
      // A browser that refuses the entry simply has no track.
    }
  };
  const read = () => {
    for (const event of feed.get().events) {
      if (event.seq <= last && !waiting.has(event.seq)) continue;
      if (event.seq > last) last = event.seq;
      // A span is measured when it ends.
      if (event.status === "running") waiting.add(event.seq);
      else {
        waiting.delete(event.seq);
        measure(event);
      }
    }
  };
  read();
  return feed.subscribe(read);
}
