import { type ReactNode, createContext, createElement, useContext, useEffect, useMemo } from "react";
import type { TraceScope } from "./event.js";
import type { Recorder } from "./recorder.js";
import { type TraceServiceOptions, traceService } from "./service.js";

const RecorderContext = createContext<Recorder | undefined>(undefined);
const ScopeContext = createContext<TraceScope | undefined>(undefined);

export interface TraceProviderProps {
  /** The recorder everything below traces itself to. `undefined` turns tracing off below this point. */
  recorder: Recorder | undefined;
  children?: ReactNode;
}

/**
 * Turns tracing on for everything below it. The library's providers and
 * hooks (`DataSourceProvider`, `DiscoveryProvider`, `PipelinesProvider`,
 * `SemanticsProvider`, `SurfaceView`, `useSurfaces`, `useChat`) look for a
 * recorder here and record what they do. With no provider they record
 * nothing and behave exactly as before.
 */
export function TraceProvider({ recorder, children }: TraceProviderProps) {
  return createElement(RecorderContext.Provider, { value: recorder }, createElement(ScopeContext.Provider, { value: undefined }, children));
}

/** The recorder above this component, if tracing is on. */
export const useRecorder = (): Recorder | undefined => useContext(RecorderContext);

/** Makes what is recorded below it a child of a span: a component of a surface, a turn. */
export function TraceScopeProvider({ scope, children }: { scope: TraceScope | undefined; children?: ReactNode }) {
  return createElement(ScopeContext.Provider, { value: scope }, children);
}

/** The scope this component is drawn in, if any. */
export const useTraceScope = (): TraceScope | undefined => useContext(ScopeContext);

/**
 * A backend as the component should call it: traced, in this component's
 * scope, when a recorder is above; the backend itself otherwise. The result
 * is the same object for as long as the backend, the recorder and the scope
 * are, so it is safe in a dependency list.
 */
export function useTraced<T extends object | undefined>(name: string, service: T, options?: TraceServiceOptions): T {
  const recorder = useContext(RecorderContext);
  const scope = useContext(ScopeContext);
  return useMemo(() => (recorder && service ? (traceService(name, service, recorder, { ...options, ...(scope ? { scope } : {}) }) as T) : service), [name, service, recorder, scope, options]);
}

/** Hands a backend to the recorder under a name while this component is mounted, so a tool can draw a recorded surface over the same data. */
export function useProvided(name: string, service: unknown): void {
  const recorder = useContext(RecorderContext);
  useEffect(() => (recorder && service ? recorder.provide(name, service) : undefined), [recorder, name, service]);
}
