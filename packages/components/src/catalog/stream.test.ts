/**
 * Tests for streaming spec compilation hook (TEST-03)
 *
 * Verifies NL generation flow: prompt → streamed spec → progressive UI updates
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSpecStream } from './stream';

// Mock fetch for streaming JSONL responses
global.fetch = vi.fn();

// Valid json-render spec fixture for testing
const validSpec = {
  root: 'table1',
  elements: {
    table1: {
      type: 'DataTable',
      props: {
        columns: ['id', 'name'],
      },
    },
  },
};

describe('useSpecStream Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful Streaming', () => {
    it('streams spec chunks progressively', async () => {
      // TEST-03: NL generation flow (prompt → spec → rendered UI)
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('{"chunk": "{\\"root\\": "}\n')
          );
          controller.enqueue(
            new TextEncoder().encode('{"chunk": "\\"table1\\", \\"elements\\": {\\"table1\\":"}\n')
          );
          controller.enqueue(
            new TextEncoder().encode('{"chunk": "{\\"type\\": \\"DataTable\\"}}"}\n')
          );
          controller.enqueue(
            new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
          );
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() => useSpecStream());

      await act(async () => {
        await result.current.generate('show table');
      });

      await waitFor(() => {
        expect(result.current.state.spec).toBeTruthy();
      });

      // Verify progressive updates occurred
      expect(result.current.state.rawText).toContain('DataTable');
      expect(result.current.state.progress).toBe(1);
      expect(result.current.state.error).toBeNull();
    });

    it('updates progress based on chunk accumulation', async () => {
      const progressUpdates: number[] = [];

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"chunk": "{"}\n'));
          setTimeout(() => {
            controller.enqueue(
              new TextEncoder().encode('{"chunk": "\\"root\\""}\n')
            );
            setTimeout(() => {
              controller.enqueue(
                new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
              );
              controller.close();
            }, 50);
          }, 50);
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() => useSpecStream());

      // Start generation but don't await
      act(() => {
        result.current.generate('test');
      });

      // Capture progress at different intervals
      await waitFor(() => expect(result.current.state.progress).toBeGreaterThan(0), { timeout: 200 });
      progressUpdates.push(result.current.state.progress);

      await waitFor(() => expect(result.current.state.progress).toBe(1), { timeout: 500 });
      progressUpdates.push(result.current.state.progress);

      // Progress should increase over time
      expect(progressUpdates[0]).toBeLessThan(progressUpdates[1]);
    });

    it('handles explanation chunks before spec', async () => {
      // Phase 07-03: Dual-call approach with explanation first
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              '{"explanation": "I chose DataTable because..."}\n'
            )
          );
          controller.enqueue(
            new TextEncoder().encode(
              '{"chunk": "{\\"root\\": \\"table1\\"}"}\n'
            )
          );
          controller.enqueue(
            new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
          );
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() =>
        useSpecStream({ includeExplanation: true })
      );

      await act(async () => {
        await result.current.generate('test');
      });

      await waitFor(() => {
        expect(result.current.state.explanation).toBeTruthy();
      });

      expect(result.current.state.explanation).toContain('I chose DataTable');
    });

    it('validates final spec before completion', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('{"chunk": "{\\"root\\": \\"table1\\"}"}\n')
          );
          controller.enqueue(
            new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
          );
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() => useSpecStream());

      await act(async () => {
        await result.current.generate('test');
      });

      await waitFor(() => {
        expect(result.current.state.validation).toBeTruthy();
      });

      // Validation should have occurred
      expect(result.current.state.validation).not.toBeNull();
    });

    it('calls onComplete callback when streaming finishes', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
          );
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const onComplete = vi.fn();
      const { result } = renderHook(() =>
        useSpecStream({ onComplete })
      );

      await act(async () => {
        await result.current.generate('test');
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          isStreaming: false,
          spec: expect.any(Object),
        })
      );
    });

    it('calls onChunk callback for each chunk', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"chunk": "{"}\n'));
          controller.enqueue(new TextEncoder().encode('{"chunk": "}"}\n'));
          controller.enqueue(
            new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
          );
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const onChunk = vi.fn();
      const { result } = renderHook(() =>
        useSpecStream({ onChunk })
      );

      await act(async () => {
        await result.current.generate('test');
      });

      await waitFor(() => {
        expect(onChunk).toHaveBeenCalled();
      });

      // Should have been called at least twice (for chunk messages)
      expect(onChunk.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSpecStream());

      await act(async () => {
        await result.current.generate('test');
      });

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy();
      });

      expect(result.current.state.error).toContain('Network error');
      expect(result.current.state.isStreaming).toBe(false);
    });

    it('handles HTTP error responses', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useSpecStream());

      await act(async () => {
        await result.current.generate('test');
      });

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy();
      });

      expect(result.current.state.error).toContain('500');
    });

    it('handles malformed JSONL chunks gracefully', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          // Invalid JSON followed by valid spec
          controller.enqueue(new TextEncoder().encode('not-valid-json\n'));
          controller.enqueue(
            new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
          );
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() => useSpecStream());

      await act(async () => {
        await result.current.generate('test');
      });

      // Should complete successfully, ignoring malformed chunks
      await waitFor(() => {
        expect(result.current.state.spec).toBeTruthy();
      });

      expect(result.current.state.error).toBeNull();
    });

    it('handles error chunks in stream', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('{"error": "Generation failed"}\n')
          );
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() => useSpecStream());

      await act(async () => {
        await result.current.generate('test');
      });

      await waitFor(() => {
        expect(result.current.state.error).toBeTruthy();
      });

      expect(result.current.state.error).toContain('Generation failed');
    });

    it('calls onError callback on failure', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Test error'));

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useSpecStream({ onError })
      );

      await act(async () => {
        await result.current.generate('test');
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(onError).toHaveBeenCalledWith('Test error');
    });
  });

  describe('Cancellation', () => {
    it('cancels stream via abort method', async () => {
      const mockAbort = vi.fn();
      const mockStream = new ReadableStream({
        start(controller) {
          setTimeout(() => controller.close(), 2000); // Long stream
        },
      });

      (global.fetch as any).mockImplementation((url, options) => {
        options?.signal?.addEventListener('abort', mockAbort);
        return Promise.resolve({ ok: true, body: mockStream });
      });

      const { result } = renderHook(() => useSpecStream());

      await act(async () => {
        result.current.generate('test');
      });

      // Start streaming
      await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

      // Cancel via abort method
      act(() => {
        result.current.abort();
      });

      // Verify AbortController called
      await waitFor(() => expect(mockAbort).toHaveBeenCalled());
      expect(result.current.state.isStreaming).toBe(false);
    });

    it('cancels stream via unmount', async () => {
      const mockAbort = vi.fn();
      const mockStream = new ReadableStream({
        start(controller) {
          setTimeout(() => controller.close(), 2000); // Long stream
        },
      });

      (global.fetch as any).mockImplementation((url, options) => {
        options?.signal?.addEventListener('abort', mockAbort);
        return Promise.resolve({ ok: true, body: mockStream });
      });

      const { result, unmount } = renderHook(() => useSpecStream());

      await act(async () => {
        result.current.generate('test');
      });

      // Start streaming
      await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

      // Cancel by unmounting
      unmount();

      // Verify AbortController called
      await waitFor(() => expect(mockAbort).toHaveBeenCalled());
    });

    it('stops streaming when aborted', async () => {
      const mockAbort = vi.fn();
      let resolveAfterAbort: any;
      const afterAbortPromise = new Promise(resolve => {
        resolveAfterAbort = resolve;
      });

      const mockStream = new ReadableStream({
        async start(controller) {
          // Wait for abort signal
          await afterAbortPromise;
          // This should not be processed because we aborted
          controller.enqueue(
            new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
          );
          controller.close();
        },
      });

      (global.fetch as any).mockImplementation((url, options) => {
        options?.signal?.addEventListener('abort', () => {
          mockAbort();
          // Release the stream to continue (simulating real abort behavior)
          resolveAfterAbort();
        });
        return Promise.resolve({ ok: true, body: mockStream });
      });

      const { result } = renderHook(() => useSpecStream());

      // Start generation
      act(() => {
        result.current.generate('test');
      });

      // Wait for streaming to start
      await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

      // Abort
      act(() => {
        result.current.abort();
      });

      // Verify abort was called
      await waitFor(() => expect(mockAbort).toHaveBeenCalled());

      // Verify streaming stopped
      expect(result.current.state.isStreaming).toBe(false);
    });
  });

  describe('State Management', () => {
    it('resets state on new generation', async () => {
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        const mockStream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
            );
            controller.close();
          },
        });
        return Promise.resolve({ ok: true, body: mockStream });
      });

      const { result } = renderHook(() => useSpecStream());

      // First generation
      await act(async () => {
        await result.current.generate('test 1');
      });

      await waitFor(() => {
        expect(result.current.state.spec).toBeTruthy();
      }, { timeout: 1000 });

      expect(result.current.state.spec).not.toBeNull();
      expect(callCount).toBe(1);

      // Second generation should reset and call again
      await act(async () => {
        await result.current.generate('test 2');
      });

      await waitFor(() => {
        expect(callCount).toBe(2);
      }, { timeout: 1000 });

      // Verify state was reset and generation completed again
      expect(result.current.state.isStreaming).toBe(false);
      expect(result.current.state.progress).toBe(1);
      expect(result.current.state.spec).toBeTruthy();
    });

    it('resets state via reset method', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
          );
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() => useSpecStream());

      await act(async () => {
        await result.current.generate('test');
      });

      await waitFor(() => {
        expect(result.current.state.spec).toBeTruthy();
      });

      // Reset state
      act(() => {
        result.current.reset();
      });

      expect(result.current.state.spec).toBeNull();
      expect(result.current.state.rawText).toBe('');
      expect(result.current.state.progress).toBe(0);
      expect(result.current.state.error).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('uses custom baseUrl', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
          );
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() =>
        useSpecStream({ baseUrl: 'http://custom.example.com' })
      );

      await act(async () => {
        await result.current.generate('test');
      });

      // Verify fetch was called with custom base URL
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('http://custom.example.com/api/generate-ui'),
        expect.any(Object)
      );
    });

    it('includes explanation param when requested', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(`{"spec": ${JSON.stringify(validSpec)}}\n`)
          );
          controller.close();
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        body: mockStream,
      });

      const { result } = renderHook(() =>
        useSpecStream({ includeExplanation: true })
      );

      await act(async () => {
        await result.current.generate('test');
      });

      // Verify fetch was called with explain param
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('explain=true'),
        expect.any(Object)
      );
    });
  });
});
