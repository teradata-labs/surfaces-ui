/**
 * NLGenerator - Natural Language to UI Generation Component
 *
 * Provides a complete interface for:
 * 1. Entering natural language prompts
 * 2. Streaming generation with progress
 * 3. Validation error display
 * 4. Rendering the generated spec
 */
import * as React from 'react';
import { useSpecStream } from './stream';
import { SpecValidationError } from './fallback';
import { getExamplesForComponent } from './prompts';

export interface NLGeneratorProps {
  /** Base URL for the generate-ui API (defaults to window.location.origin) */
  baseUrl?: string;
  /** Include explanation of component choices */
  includeExplanation?: boolean;
  /** Callback when generation completes with valid spec */
  onSpecGenerated?: (spec: Record<string, unknown>, explanation?: string | null) => void;
  /** Callback when generation fails */
  onError?: (error: string) => void;
  /** Render function for the generated spec */
  renderSpec?: (spec: Record<string, unknown>) => React.ReactNode;
  /** Initial prompt to show in input */
  initialPrompt?: string;
  /** Placeholder text for prompt input */
  placeholder?: string;
  /** Show example prompts section */
  showExamples?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * NLGenerator component for natural language UI generation.
 *
 * @example
 * ```tsx
 * <NLGenerator
 *   onSpecGenerated={(spec) => console.log('Generated:', spec)}
 *   renderSpec={(spec) => <SurfacesRenderer spec={spec} data={data} />}
 * />
 * ```
 */
export function NLGenerator({
  baseUrl,
  includeExplanation = false,
  onSpecGenerated,
  onError,
  renderSpec,
  initialPrompt = '',
  placeholder = 'Describe the UI you want to generate...',
  showExamples = true,
  className = '',
}: NLGeneratorProps): React.ReactElement {
  const [prompt, setPrompt] = React.useState(initialPrompt);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const { state, generate, abort, reset } = useSpecStream({
    baseUrl,
    includeExplanation,
    onComplete: (result) => {
      if (result.spec && result.validation?.valid) {
        onSpecGenerated?.(result.spec, result.explanation);
      }
    },
    onError,
  });

  const handleSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !state.isStreaming) {
      generate(prompt.trim());
    }
  }, [prompt, state.isStreaming, generate]);

  const handleExampleClick = React.useCallback((examplePrompt: string) => {
    setPrompt(examplePrompt);
    inputRef.current?.focus();
  }, []);

  const handleRetry = React.useCallback(() => {
    if (prompt.trim()) {
      generate(prompt.trim());
    }
  }, [prompt, generate]);

  // Example prompts for quick start
  const examplePrompts = React.useMemo(() => [
    ...getExamplesForComponent('TableWithFilters').slice(0, 1),
    ...getExamplesForComponent('Chart').slice(0, 1),
    ...getExamplesForComponent('SQLResultsDisplay').slice(0, 1),
  ], []);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="nl-prompt" className="text-sm font-medium text-foreground">
          Describe the UI you want
        </label>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            id="nl-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            rows={2}
            disabled={state.isStreaming}
            className="flex-1 min-h-[60px] px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 resize-none"
            aria-describedby={showExamples ? 'nl-examples' : undefined}
          />
          <div className="flex flex-col gap-1">
            <button
              type="submit"
              disabled={!prompt.trim() || state.isStreaming}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {state.isStreaming ? 'Generating...' : 'Generate'}
            </button>
            {state.isStreaming && (
              <button
                type="button"
                onClick={abort}
                className="px-4 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Example Prompts */}
      {showExamples && !state.isStreaming && !state.spec && (
        <div id="nl-examples" className="text-xs text-muted-foreground">
          <span className="font-medium">Try:</span>{' '}
          {examplePrompts.map((ex, i) => (
            <React.Fragment key={i}>
              {i > 0 && ' | '}
              <button
                type="button"
                onClick={() => handleExampleClick(ex.prompt)}
                className="text-primary hover:underline"
              >
                "{ex.prompt}"
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Progress Indicator */}
      {state.isStreaming && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg
              className="animate-spin h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating UI specification...
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${state.progress * 100}%` }}
              role="progressbar"
              aria-label="UI generation progress"
              aria-valuenow={Math.round(state.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          {state.rawText && (
            <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-24">
              {state.rawText.slice(-200)}...
            </pre>
          )}
        </div>
      )}

      {/* Explanation */}
      {state.explanation && !state.isStreaming && (
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          <div className="font-medium text-foreground mb-1">Why these components?</div>
          <p className="text-muted-foreground">{state.explanation}</p>
        </div>
      )}

      {/* Error Display */}
      {state.error && !state.isStreaming && (
        <SpecValidationError
          errors={state.validation?.errors || [{ path: 'root', message: state.error, code: 'generation_error' }]}
          originalPrompt={prompt}
          onRetry={handleRetry}
        />
      )}

      {/* Rendered Spec */}
      {state.spec && !state.isStreaming && !state.error && (
        <div className="border border-border rounded-lg overflow-hidden">
          {renderSpec ? (
            renderSpec(state.spec)
          ) : (
            <pre className="p-4 text-xs bg-muted overflow-x-auto">
              {JSON.stringify(state.spec, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Reset Button */}
      {(state.spec || state.error) && !state.isStreaming && (
        <button
          type="button"
          onClick={() => {
            reset();
            setPrompt('');
          }}
          className="self-start text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear and start over
        </button>
      )}
    </div>
  );
}
