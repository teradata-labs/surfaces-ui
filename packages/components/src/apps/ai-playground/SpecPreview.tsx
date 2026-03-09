/**
 * SpecPreview — Live preview + JSON editor split view
 *
 * Renders the generated json-render spec using SurfacesRenderer with
 * the extended UI registry. Shows a JSON editor alongside for inspection
 * and manual editing.
 */
import * as React from 'react';
import {
  Renderer,
  StateProvider,
  ActionProvider,
  VisibilityProvider,
  type Spec,
} from '@json-render/react';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { uiRegistry } from '../../catalog/ui-registry';
import { Button } from '../../primitives/button';
import { cn } from '@/lib/utils';
import { Eye, Code, Copy, Check, Download, AlertTriangle } from 'lucide-react';

// Error boundary to catch Renderer crashes gracefully
class RendererErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-warning" />
          <div>
            <p className="text-sm font-medium text-foreground">Renderer Error</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-xs text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface SpecPreviewProps {
  spec: Record<string, unknown> | null;
  onSpecChange?: (spec: Record<string, unknown>) => void;
  /** Show raw JSON alongside the preview */
  showJson?: boolean;
}

type ViewMode = 'preview' | 'json' | 'split';

export function SpecPreview({ spec, onSpecChange, showJson = true }: SpecPreviewProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>('split');
  const [jsonText, setJsonText] = React.useState('');
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Sync JSON text when spec changes from outside (generation)
  React.useEffect(() => {
    if (spec) {
      setJsonText(JSON.stringify(spec, null, 2));
      setJsonError(null);
    }
  }, [spec]);

  // Handle manual JSON edits
  const handleJsonChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);

    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      onSpecChange?.(parsed);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [onSpecChange]);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = jsonText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [jsonText]);

  const handleDownload = React.useCallback(() => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ui-spec.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [jsonText]);

  if (!spec) {
    return (
      <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg bg-muted/20">
        <p className="text-sm text-muted-foreground">
          Generate a spec to see the preview here
        </p>
      </div>
    );
  }

  // Sanitize spec: strip children refs that point to non-existent elements
  const sanitizedSpec = React.useMemo(() => {
    if (!spec) return null;
    try {
      const elements = spec.elements as Record<string, Record<string, unknown>> | undefined;
      if (!elements || !spec.root) return spec;

      // Remove dangling children references
      const cleaned = { ...spec, elements: { ...elements } };
      for (const [id, element] of Object.entries(cleaned.elements as Record<string, Record<string, unknown>>)) {
        if (element.children && Array.isArray(element.children)) {
          const validChildren = (element.children as string[]).filter(
            childId => (cleaned.elements as Record<string, unknown>)[childId] !== undefined
          );
          if (validChildren.length !== (element.children as string[]).length) {
            (cleaned.elements as Record<string, Record<string, unknown>>)[id] = {
              ...element,
              children: validChildren,
            };
          }
        }
      }
      return cleaned;
    } catch {
      return spec;
    }
  }, [spec]);

  const renderPreview = () => (
    <div className="bg-background rounded-lg border border-border overflow-auto">
      <ThemeProvider persistTheme>
        <StateProvider initialState={((sanitizedSpec as Record<string, unknown>)?.state ?? {}) as Record<string, unknown>}>
          <ActionProvider handlers={{}}>
            <VisibilityProvider>
              <div className="p-6">
                <RendererErrorBoundary>
                  <Renderer
                    spec={sanitizedSpec as unknown as Spec}
                    registry={uiRegistry}
                    loading={false}
                  />
                </RendererErrorBoundary>
              </div>
            </VisibilityProvider>
          </ActionProvider>
        </StateProvider>
      </ThemeProvider>
    </div>
  );

  const renderJsonEditor = () => (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">JSON Specification</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <textarea
        value={jsonText}
        onChange={handleJsonChange}
        spellCheck={false}
        className={cn(
          'flex-1 p-3 text-xs font-mono bg-background text-foreground resize-none',
          'focus:outline-none',
          jsonError && 'border-t-2 border-destructive',
        )}
      />
      {jsonError && (
        <div className="px-3 py-1.5 bg-destructive/10 border-t border-destructive/20">
          <p className="text-xs text-destructive">{jsonError}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* View Mode Tabs */}
      {showJson && (
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => setViewMode('preview')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'preview'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'split'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Split
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'json'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Code className="h-3.5 w-3.5" /> JSON
          </button>
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'flex-1 min-h-0',
        viewMode === 'split' && 'grid grid-cols-[7fr_3fr] gap-4',
      )}>
        {(viewMode === 'preview' || viewMode === 'split') && renderPreview()}
        {(viewMode === 'json' || viewMode === 'split') && renderJsonEditor()}
      </div>
    </div>
  );
}
