/**
 * Fallback UI Components for Invalid Specs
 *
 * When AI generates an invalid spec, these components provide graceful
 * degradation with user-friendly error display instead of crashing.
 */
import * as React from 'react';
import type { ValidationError } from './validation';

export interface SpecValidationErrorProps {
  errors: ValidationError[];
  originalPrompt?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Display validation errors in a user-friendly format.
 * Shows what went wrong and suggests fixes.
 */
export function SpecValidationError({
  errors,
  originalPrompt,
  onRetry,
  className = '',
}: SpecValidationErrorProps): React.ReactElement {
  return (
    <div
      className={`rounded-lg border border-destructive/50 bg-destructive/10 p-4 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-destructive">
            Unable to render UI specification
          </h3>

          <div className="mt-2 text-sm text-muted-foreground">
            <p>The AI-generated specification contains {errors.length} validation error{errors.length !== 1 ? 's' : ''}:</p>

            <ul className="mt-2 list-disc list-inside space-y-1">
              {errors.slice(0, 5).map((error, i) => (
                <li key={i} className="text-xs font-mono">
                  <span className="font-semibold">{error.path}</span>: {error.message}
                  {error.expected && (
                    <span className="text-muted-foreground/70">
                      {' '}(expected: {error.expected})
                    </span>
                  )}
                </li>
              ))}
              {errors.length > 5 && (
                <li className="text-xs text-muted-foreground/70">
                  ...and {errors.length - 5} more error{errors.length - 5 !== 1 ? 's' : ''}
                </li>
              )}
            </ul>
          </div>

          {originalPrompt && (
            <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
              <span className="font-medium">Original prompt:</span>{' '}
              <span className="text-muted-foreground">{originalPrompt}</span>
            </div>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Create a fallback json-render spec that displays validation errors.
 * Used when error recovery fails and we need to show something.
 */
export function createFallbackSpec(
  errors: ValidationError[],
  _originalPrompt?: string
): {
  root: string;
  elements: Record<string, { type: string; props: Record<string, unknown> }>;
} {
  // Create a DataTable showing the errors
  const _errorData = errors.map((error, index) => ({
    '#': index + 1,
    path: error.path,
    error: error.message,
    expected: error.expected || '-',
    received: error.received || '-',
  }));

  return {
    root: 'error-table',
    elements: {
      'error-table': {
        type: 'DataTable',
        props: {
          columns: ['#', 'path', 'error', 'expected', 'received'],
          height: 300,
          density: 'compact',
          virtualScrolling: false,
          showRowNumbers: false,
        },
      },
    },
  };
}

/**
 * Wrapper component that validates spec and shows fallback on error.
 */
export interface ValidatedSpecRendererProps {
  spec: unknown;
  originalPrompt?: string;
  onRetry?: () => void;
  children: (validSpec: Record<string, unknown>) => React.ReactNode;
}

export function ValidatedSpecRenderer({
  spec,
  originalPrompt,
  onRetry,
  children,
}: ValidatedSpecRendererProps): React.ReactElement {
  // Inline validation to avoid circular dependency
  const validateSpec = React.useMemo(() => {
    // Import dynamically to avoid circular deps
    const { validateGeneratedSpec } = require('./validation');
    return validateGeneratedSpec(spec);
  }, [spec]);

  if (!validateSpec.valid) {
    return (
      <SpecValidationError
        errors={validateSpec.errors}
        originalPrompt={originalPrompt}
        onRetry={onRetry}
      />
    );
  }

  return <>{children(validateSpec.spec as Record<string, unknown>)}</>;
}
