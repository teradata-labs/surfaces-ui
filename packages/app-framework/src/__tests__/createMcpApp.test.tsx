// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createMcpApp } from '../createMcpApp';
import type { BridgeLike } from '../types';

// Mock bridge that satisfies BridgeLike
function createMockBridge(): BridgeLike {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: true,
    callTool: vi.fn().mockResolvedValue({ success: true, data: {} }),
    onDataPush: vi.fn().mockReturnValue(() => {}),
    fetchPage: vi.fn().mockResolvedValue({ rows: [], total: 0, offset: 0, limit: 10, hasMore: false }),
    onStreamChunk: vi.fn().mockReturnValue(() => {}),
    startStream: vi.fn().mockReturnValue({ id: 1, result: Promise.resolve({ success: true }) }),
    cancelStream: vi.fn(),
  };
}

describe('createMcpApp', () => {
  let rootEl: HTMLDivElement;

  beforeEach(() => {
    rootEl = document.createElement('div');
    rootEl.id = 'root';
    document.body.appendChild(rootEl);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a component into #root with bridge and theme providers', async () => {
    const bridge = createMockBridge();
    const App = () => <div data-testid="app">Hello MCP</div>;

    let handle: ReturnType<typeof createMcpApp>;
    await act(async () => {
      handle = createMcpApp(App, { bridge });
    });

    expect(rootEl.innerHTML).toContain('Hello MCP');
    expect(bridge.connect).toHaveBeenCalled();

    await act(async () => {
      handle!.unmount();
    });
  });

  it('throws if root element is not found', () => {
    document.body.innerHTML = ''; // remove #root

    const bridge = createMockBridge();
    const App = () => <div>Test</div>;

    expect(() => createMcpApp(App, { bridge })).toThrow('Element #root not found');
  });

  it('supports custom rootId', async () => {
    rootEl.id = 'custom-root';

    const bridge = createMockBridge();
    const App = () => <div>Custom root</div>;

    let handle: ReturnType<typeof createMcpApp>;
    await act(async () => {
      handle = createMcpApp(App, { bridge, rootId: 'custom-root' });
    });

    expect(rootEl.innerHTML).toContain('Custom root');

    await act(async () => {
      handle!.unmount();
    });
  });

  it('unmount cleans up the React tree', async () => {
    const bridge = createMockBridge();
    const App = () => <div>Cleanup test</div>;

    let handle: ReturnType<typeof createMcpApp>;
    await act(async () => {
      handle = createMcpApp(App, { bridge });
    });

    expect(rootEl.innerHTML).toContain('Cleanup test');

    await act(async () => {
      handle!.unmount();
    });

    expect(rootEl.innerHTML).toBe('');
  });

  it('does not disconnect an externally-provided bridge on unmount', async () => {
    const bridge = createMockBridge();
    const App = () => <div>External bridge</div>;

    let handle: ReturnType<typeof createMcpApp>;
    await act(async () => {
      handle = createMcpApp(App, { bridge });
    });

    await act(async () => {
      handle!.unmount();
    });

    expect(bridge.disconnect).not.toHaveBeenCalled();
  });
});
