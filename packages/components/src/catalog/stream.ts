/**
 * Streaming Spec Compiler Client
 *
 * Consumes JSONL stream from /api/generate-ui endpoint and provides
 * progressive updates as the AI generates the UI specification.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { validateGeneratedSpec, type ValidationResult } from './validation';

export interface SpecStreamChunk {
  /** Partial text chunk from AI */
  chunk?: string;
  /** Complete spec when generation finishes */
  spec?: Record<string, unknown>;
  /** Error message if generation failed */
  error?: string;
  /** Explanation of component choices (if requested) */
  explanation?: string;
}

export interface SpecStreamState {
  /** Whether generation is in progress */
  isStreaming: boolean;
  /** Accumulated raw text from stream */
  rawText: string;
  /** Parsed spec (when complete) */
  spec: Record<string, unknown> | null;
  /** Validation result for the spec */
  validation: ValidationResult | null;
  /** Explanation of component choices */
  explanation: string | null;
  /** Error message if failed */
  error: string | null;
  /** Progress indicator (0-1) based on text length heuristic */
  progress: number;
}

export interface UseSpecStreamOptions {
  /** Base URL for API (defaults to window.location.origin) */
  baseUrl?: string;
  /** Include explanation of component choices */
  includeExplanation?: boolean;
  /** Callback when streaming completes */
  onComplete?: (result: SpecStreamState) => void;
  /** Callback on each chunk */
  onChunk?: (chunk: SpecStreamChunk) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * Hook for streaming UI spec generation with progressive updates.
 *
 * @example
 * ```tsx
 * const { state, generate, abort } = useSpecStream({
 *   onComplete: (result) => setSpec(result.spec)
 * });
 *
 * // Start generation
 * generate('Show sales data in a chart');
 *
 * // Render progress
 * {state.isStreaming && <ProgressBar value={state.progress} />}
 * {state.spec && <SurfacesRenderer spec={state.spec} />}
 * ```
 */
export function useSpecStream(options: UseSpecStreamOptions = {}) {
  const {
    baseUrl = typeof window !== 'undefined' ? window.location.origin : '',
    includeExplanation = false,
    onComplete,
    onChunk,
    onError,
  } = options;

  const [state, setState] = useState<SpecStreamState>({
    isStreaming: false,
    rawText: '',
    spec: null,
    validation: null,
    explanation: null,
    error: null,
    progress: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Start streaming UI generation for the given prompt.
   */
  const generate = useCallback(async (prompt: string) => {
    // Abort any existing request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    // Reset state
    setState({
      isStreaming: true,
      rawText: '',
      spec: null,
      validation: null,
      explanation: null,
      error: null,
      progress: 0,
    });

    const url = new URL('/api/generate-ui', baseUrl);
    url.searchParams.set('prompt', prompt);
    if (includeExplanation) {
      url.searchParams.set('explain', 'true');
    }

    try {
      const response = await fetch(url.toString(), {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let finalSpec: Record<string, unknown> | null = null;
      let finalExplanation: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const chunk: SpecStreamChunk = JSON.parse(line);

            onChunk?.(chunk);

            if (chunk.chunk) {
              accumulatedText += chunk.chunk;
              // Estimate progress based on typical spec size (500-2000 chars)
              const estimatedProgress = Math.min(accumulatedText.length / 1500, 0.95);

              if (mountedRef.current) {
                setState(prev => ({
                  ...prev,
                  rawText: accumulatedText,
                  progress: estimatedProgress,
                }));
              }
            }

            if (chunk.spec) {
              finalSpec = chunk.spec;
            }

            if (chunk.explanation) {
              finalExplanation = chunk.explanation;
            }

            if (chunk.error) {
              throw new Error(chunk.error);
            }
          } catch (parseError) {
            // Ignore JSON parse errors for partial chunks
            if (parseError instanceof SyntaxError) continue;
            throw parseError;
          }
        }
      }

      // Validate final spec
      const validation = finalSpec ? validateGeneratedSpec(finalSpec) : null;

      const finalState: SpecStreamState = {
        isStreaming: false,
        rawText: accumulatedText,
        spec: validation?.valid ? (validation.spec as Record<string, unknown>) : null,
        validation,
        explanation: finalExplanation,
        error: validation && !validation.valid
          ? `Validation failed: ${validation.errors[0]?.message}`
          : null,
        progress: 1,
      };

      if (mountedRef.current) {
        setState(finalState);
      }
      onComplete?.(finalState);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was aborted, don't update state
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: errorMessage,
          progress: 0,
        }));
      }
      onError?.(errorMessage);
    }
  }, [baseUrl, includeExplanation, onComplete, onChunk, onError]);

  /**
   * Abort the current streaming request.
   */
  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    if (mountedRef.current) {
      setState(prev => ({
        ...prev,
        isStreaming: false,
      }));
    }
  }, []);

  /**
   * Reset state to initial values.
   */
  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    if (mountedRef.current) {
      setState({
        isStreaming: false,
        rawText: '',
        spec: null,
        validation: null,
        explanation: null,
        error: null,
        progress: 0,
      });
    }
  }, []);

  return {
    state,
    generate,
    abort,
    reset,
  };
}

/**
 * Non-streaming spec generation (for simpler use cases).
 *
 * @param prompt - Natural language prompt
 * @param options - Fetch options
 * @returns Promise resolving to generation result
 */
export async function generateSpec(
  prompt: string,
  options: {
    baseUrl?: string;
    includeExplanation?: boolean;
  } = {}
): Promise<{
  spec: Record<string, unknown> | null;
  explanation: string | null;
  error: string | null;
  validation: ValidationResult | null;
}> {
  const {
    baseUrl = typeof window !== 'undefined' ? window.location.origin : '',
    includeExplanation = false,
  } = options;

  const url = new URL('/api/generate-ui', baseUrl);
  url.searchParams.set('prompt', prompt);
  if (includeExplanation) {
    url.searchParams.set('explain', 'true');
  }

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Collect all JSONL chunks
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());

    let spec: Record<string, unknown> | null = null;
    let explanation: string | null = null;

    for (const line of lines) {
      try {
        const chunk: SpecStreamChunk = JSON.parse(line);
        if (chunk.spec) spec = chunk.spec;
        if (chunk.explanation) explanation = chunk.explanation;
        if (chunk.error) throw new Error(chunk.error);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }

    const validation = spec ? validateGeneratedSpec(spec) : null;

    return {
      spec: validation?.valid ? (validation.spec as Record<string, unknown>) : null,
      explanation,
      error: validation && !validation.valid
        ? `Validation failed: ${validation.errors[0]?.message}`
        : null,
      validation,
    };
  } catch (error) {
    return {
      spec: null,
      explanation: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      validation: null,
    };
  }
}
