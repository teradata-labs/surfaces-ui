import React, { createContext, useContext } from 'react';

/** Analytics provider interface that consumers implement */
export interface AnalyticsConfig {
  /** Track a named event with optional properties */
  trackEvent: (name: string, properties?: Record<string, unknown>) => void;
  /** Track feature usage (e.g., for Pendo) */
  trackFeatureUsage: (feature: string, source?: string) => void;
  /** Identify a user */
  identify?: (userId: string, traits?: Record<string, unknown>) => void;
}

const AnalyticsContext = createContext<AnalyticsConfig | null>(null);

/**
 * Provider for injecting analytics into components.
 * If not provided, all analytics calls are silently ignored.
 */
export function AnalyticsProvider({
  config,
  children,
}: {
  config: AnalyticsConfig;
  children: React.ReactNode;
}) {
  return React.createElement(AnalyticsContext.Provider, { value: config }, children);
}

/**
 * Hook to access analytics. Returns null if no provider is configured.
 * Components should use optional chaining: analytics?.trackEvent('name')
 */
export function useAnalytics(): AnalyticsConfig | null {
  return useContext(AnalyticsContext);
}
