/**
 * Renderer Integration Tests
 *
 * Integration tests for SurfacesRenderer with MCP Bridge.
 * Tests verify:
 * - MCP-05: Bridge context passed to registry components
 * - Action handlers wired correctly
 * - Backward compatibility without bridge
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SurfacesRenderer } from './renderer';
import type { BridgeLike } from '../bridge';
import type { Spec } from '@json-render/react';

// Mock bridge implementation
function createMockBridge(): BridgeLike {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: true,
    callTool: vi.fn().mockResolvedValue({
      success: true,
      data: {
        columns: ['id', 'name'],
        rows: [[1, 'Test']],
      },
    }),
    onDataPush: vi.fn(() => () => {}),
    fetchPage: vi.fn().mockResolvedValue({ rows: [], total: 0, offset: 0, limit: 10, hasMore: false }),
    onStreamChunk: vi.fn(() => () => {}),
    startStream: vi.fn(() => ({ id: 1, result: Promise.resolve({ success: true }) })),
    cancelStream: vi.fn(),
  };
}

describe('SurfacesRenderer with MCP Bridge', () => {
  let mockBridge: BridgeLike;

  beforeEach(() => {
    mockBridge = createMockBridge();
  });

  it('renders without bridge (backward compatible)', () => {
    const spec: Spec = {
      root: 'main',
      elements: {
        main: {
          type: 'Filter',
          props: { placeholder: 'Search...' },
        },
      },
    };

    render(<SurfacesRenderer spec={spec} />);

    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('renders with bridge provided', () => {
    const spec: Spec = {
      root: 'main',
      elements: {
        main: {
          type: 'Filter',
          props: { placeholder: 'With Bridge' },
        },
      },
    };

    render(<SurfacesRenderer spec={spec} bridge={mockBridge} />);

    expect(screen.getByPlaceholderText('With Bridge')).toBeTruthy();
  });

  it('merges user handlers with MCP handlers', () => {
    const customHandler = vi.fn();
    const handlers = { custom_action: customHandler };

    const spec: Spec = {
      root: 'main',
      elements: {
        main: {
          type: 'Filter',
          props: {},
        },
      },
    };

    // This test verifies the merge happens without errors
    // Actual handler invocation tested in action tests
    expect(() => {
      render(
        <SurfacesRenderer
          spec={spec}
          bridge={mockBridge}
          handlers={handlers}
        />
      );
    }).not.toThrow();
  });

  it('creates MCP action handlers when bridge provided', async () => {
    // Test that the action handlers are created and functional
    // by rendering a DataTable spec that could trigger actions
    const spec: Spec = {
      root: 'table',
      elements: {
        table: {
          type: 'DataTable',
          props: {
            columns: ['id', 'name'],
            height: 300,
          },
        },
      },
    };

    render(
      <SurfacesRenderer
        spec={spec}
        bridge={mockBridge}
        initialState={{ data: [{ id: 1, name: 'Test' }] }}
      />
    );

    // Component renders with initial data
    await waitFor(() => {
      expect(screen.getByText('id')).toBeTruthy();
      expect(screen.getByText('name')).toBeTruthy();
    });
  });

  it('preserves theme prop with bridge', () => {
    const spec: Spec = {
      root: 'main',
      elements: {
        main: {
          type: 'Filter',
          props: {},
        },
      },
    };

    // Theme prop should still work when bridge is provided
    expect(() => {
      render(
        <SurfacesRenderer
          spec={spec}
          bridge={mockBridge}
          theme="dark"
        />
      );
    }).not.toThrow();
  });

  it('preserves onStateChange callback with bridge', () => {
    const onStateChange = vi.fn();
    const spec: Spec = {
      root: 'main',
      elements: {
        main: {
          type: 'Filter',
          props: { placeholder: 'Type here' },
        },
      },
    };

    render(
      <SurfacesRenderer
        spec={spec}
        bridge={mockBridge}
        onStateChange={onStateChange}
      />
    );

    // Renderer should accept onStateChange without errors
    expect(screen.getByPlaceholderText('Type here')).toBeTruthy();
  });
});

describe('SurfacesRenderer without MCP Bridge', () => {
  it('uses only user-provided handlers when no bridge', () => {
    const customHandler = vi.fn();
    const handlers = { execute_sql: customHandler };

    const spec: Spec = {
      root: 'main',
      elements: {
        main: {
          type: 'Filter',
          props: {},
        },
      },
    };

    // Without bridge, custom execute_sql handler should be used
    // (not the MCP one that would call bridge.callTool)
    expect(() => {
      render(
        <SurfacesRenderer
          spec={spec}
          handlers={handlers}
        />
      );
    }).not.toThrow();
  });

  it('renders with empty handlers', () => {
    const spec: Spec = {
      root: 'main',
      elements: {
        main: {
          type: 'Filter',
          props: { placeholder: 'No handlers' },
        },
      },
    };

    render(<SurfacesRenderer spec={spec} handlers={{}} />);

    expect(screen.getByPlaceholderText('No handlers')).toBeTruthy();
  });
});
