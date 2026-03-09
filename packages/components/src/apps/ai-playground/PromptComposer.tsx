/**
 * PromptComposer — Prompt input with template context and example prompts
 *
 * Provides a textarea for natural language input, pre-filled from selected
 * page template. Shows example prompts that users can click to auto-fill.
 */
import * as React from 'react';
import { Button } from '../../primitives/button';
import { PAGE_TEMPLATES } from './templates';
import type { PageType, GenerationState } from './types';
import { cn } from '@/lib/utils';
import { Sparkles, Square, RotateCcw } from 'lucide-react';

interface PromptComposerProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  onAbort: () => void;
  onReset: () => void;
  selectedTemplate: PageType | null;
  generationState: GenerationState;
  /** Compact layout for post-generation toolbar */
  compact?: boolean;
}

export function PromptComposer({
  prompt,
  onPromptChange,
  onGenerate,
  onAbort,
  onReset,
  selectedTemplate,
  generationState,
  compact = false,
}: PromptComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const template = selectedTemplate
    ? PAGE_TEMPLATES.find(t => t.id === selectedTemplate)
    : null;

  const isGenerating = generationState.status === 'generating' || generationState.status === 'validating';
  const hasResult = generationState.status === 'complete' || generationState.status === 'error';

  const handleSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onGenerate();
    }
  }, [prompt, isGenerating, onGenerate]);

  const handleExampleClick = React.useCallback((examplePrompt: string) => {
    onPromptChange(examplePrompt);
    textareaRef.current?.focus();
  }, [onPromptChange]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (prompt.trim() && !isGenerating) {
        onGenerate();
      }
    }
  }, [prompt, isGenerating, onGenerate]);

  // Compact mode: single-line prompt bar
  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Describe what to generate..."
          disabled={isGenerating}
          className="flex-1 h-9 px-3 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          onKeyDown={handleKeyDown}
        />
        {isGenerating ? (
          <Button type="button" variant="outline" size="sm" onClick={onAbort} className="gap-1.5">
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        ) : (
          <>
            <Button type="submit" size="sm" disabled={!prompt.trim()} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Regenerate
            </Button>
            {hasResult && (
              <Button type="button" variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </form>
    );
  }

  // Full mode: large textarea with examples
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="ai-prompt" className="text-sm font-medium text-foreground">
          Describe the UI you want to generate
        </label>
        <textarea
          ref={textareaRef}
          id="ai-prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={template
            ? `e.g. "${template.examplePrompts[0]}"`
            : 'Select a page type above, then describe what you want...'
          }
          rows={4}
          disabled={isGenerating}
          className={cn(
            'w-full px-4 py-3 text-sm bg-background border border-input rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
            'disabled:opacity-50 resize-none leading-relaxed',
            'placeholder:text-muted-foreground',
          )}
        />
        <div className="flex items-center gap-3">
          {isGenerating ? (
            <Button type="button" variant="outline" onClick={onAbort} className="gap-1.5">
              <Square className="h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!prompt.trim()} className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Generate
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to submit
          </span>
        </div>
      </form>

      {/* Progress */}
      {isGenerating && (
        <div className="flex flex-col gap-2">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${generationState.progress * 100}%` }}
              role="progressbar"
              aria-label="Generation progress"
              aria-valuenow={Math.round(generationState.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-xs text-muted-foreground animate-pulse">
            {generationState.status === 'validating' ? 'Validating spec...' : 'Generating UI specification...'}
          </p>
        </div>
      )}

      {/* Example Prompts */}
      {template && !isGenerating && !hasResult && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Try an example:</span>
          <div className="flex flex-col gap-1.5">
            {template.examplePrompts.map((example, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleExampleClick(example)}
                className="text-left text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                &ldquo;{example}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {generationState.status === 'error' && generationState.error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive font-medium">Generation failed</p>
          <p className="text-xs text-destructive/80 mt-1">{generationState.error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            className="mt-2 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
