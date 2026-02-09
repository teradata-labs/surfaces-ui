/**
 * McpBridgeProvider
 *
 * React context and provider that manages the McpBridge lifecycle.
 * Components use the `useMcpBridge` hook to access the bridge instance
 * and any render data pushed from the MCP host.
 */

import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { McpBridge } from './McpBridge';
import type { McpBridgeConfig, McpRenderData } from './types';

interface McpBridgeContextValue {
  /** The bridge instance for making tool calls. */
  bridge: BridgeLike;
  /** The latest render data pushed from the MCP host. */
  renderData: McpRenderData | null;
  /** Whether the bridge is currently connected and listening. */
  isConnected: boolean;
}

const McpBridgeContext = createContext<McpBridgeContextValue | null>(null);

/** Bridge interface that both McpBridge and McpAppsBridge implement. */
export interface BridgeLike {
  connect(): void;
  disconnect(): void;
  isConnected: boolean;
  callTool<T = unknown>(toolName: string, args?: Record<string, unknown>): Promise<{ success: boolean; data?: T; error?: string }>;
  onDataPush(callback: (data: McpRenderData) => void): () => void;
  fetchPage<T = unknown>(toolName: string, args: { offset: number; limit: number; filters?: Record<string, unknown> }): Promise<{ rows: T[]; total: number; offset: number; limit: number; hasMore: boolean }>;
  onStreamChunk(requestId: number, callback: (chunk: unknown) => void): () => void;
  startStream<T = unknown>(toolName: string, args?: Record<string, unknown>): { id: number; result: Promise<{ success: boolean; data?: T; error?: string }> };
  cancelStream(requestId: number): void;
  /** Open a link in the user's browser (MCP Apps only) */
  openLink?(url: string): Promise<{ success: boolean; error?: string }>;
}

export interface McpBridgeProviderProps {
  /** Optional configuration for the MCP bridge (ignored if bridge is provided). */
  config?: McpBridgeConfig;
  /** Optional pre-configured bridge instance (e.g., McpAppsBridge for MCP Apps). */
  bridge?: BridgeLike;
  /** Child components that will have access to the bridge. */
  children: React.ReactNode;
}

/**
 * Provider component that creates and manages an McpBridge instance.
 *
 * - Creates the McpBridge on mount and connects it
 * - Listens for render data pushes and stores them in state
 * - Disconnects the bridge on unmount
 * - Provides the bridge, renderData, and connection status via context
 *
 * @example
 * ```tsx
 * <McpBridgeProvider config={{ targetOrigin: 'https://host.example.com' }}>
 *   <MyComponent />
 * </McpBridgeProvider>
 * ```
 */
export function McpBridgeProvider({ config, bridge: externalBridge, children }: McpBridgeProviderProps) {
  const [renderData, setRenderData] = useState<McpRenderData | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Use a ref for the bridge so it persists across renders without
  // triggering re-creation. We only recreate if config changes identity.
  const bridgeRef = useRef<BridgeLike | null>(null);

  // Serialize config to detect meaningful changes
  const configKey = useMemo(
    () =>
      JSON.stringify({
        targetOrigin: config?.targetOrigin,
        timeout: config?.timeout,
        hasExternalBridge: !!externalBridge,
      }),
    [config?.targetOrigin, config?.timeout, externalBridge],
  );

  useEffect(() => {
    // Use external bridge if provided, otherwise create a new McpBridge
    const bridge = externalBridge ?? new McpBridge(config);
    bridgeRef.current = bridge;

    // Connect the bridge to start listening for messages
    bridge.connect();
    setIsConnected(bridge.isConnected);

    // Subscribe to render data pushed from the MCP host
    const unsubscribe = bridge.onDataPush((data) => {
      setRenderData(data);
    });

    return () => {
      unsubscribe();
      // Only disconnect if we created the bridge (not external)
      if (!externalBridge) {
        bridge.disconnect();
      }
      setIsConnected(false);
      bridgeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const contextValue = useMemo<McpBridgeContextValue>(
    () => ({
      bridge: bridgeRef.current!,
      renderData,
      isConnected,
    }),
    [renderData, isConnected],
  );

  // Don't render children until bridge is ready
  if (!bridgeRef.current) {
    return null;
  }

  return (
    <McpBridgeContext.Provider value={contextValue}>
      {children}
    </McpBridgeContext.Provider>
  );
}

/**
 * Hook to access the MCP bridge context.
 *
 * Must be used within a `<McpBridgeProvider>`. Throws if used outside the provider.
 *
 * @returns The bridge instance, latest render data, and connection status
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { bridge, renderData, isConnected } = useMcpBridge();
 *
 *   const handleClick = async () => {
 *     const result = await bridge.callTool('myTool', { key: 'value' });
 *     console.log(result);
 *   };
 *
 *   return <button onClick={handleClick}>Call Tool</button>;
 * }
 * ```
 */
export function useMcpBridge(): McpBridgeContextValue {
  const context = useContext(McpBridgeContext);
  if (!context) {
    throw new Error(
      'useMcpBridge must be used within a <McpBridgeProvider>. ' +
        'Wrap your component tree with <McpBridgeProvider> to provide the MCP bridge context.',
    );
  }
  return context;
}
