/**
 * AI Playground — Generate dynamic pages with any LLM
 *
 * Connect your preferred LLM provider, choose a page type,
 * describe what you want, and get a live-rendered UI spec.
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import '../theme/tokens.css';

import { ThemeWrapper } from './ThemeWrapper';
import { ProviderConfig } from './ai-playground/ProviderConfig';
import { PageTemplates } from './ai-playground/PageTemplates';
import { PromptComposer } from './ai-playground/PromptComposer';
import { SpecPreview } from './ai-playground/SpecPreview';
import { ComponentCatalog } from './ai-playground/ComponentCatalog';
import { useLLMGenerate } from './ai-playground/use-llm-generate';
import { resetLoomSession } from './ai-playground/llm-client';
import { PAGE_TEMPLATES } from './ai-playground/templates';
import { getFullSystemPrompt } from '../catalog/prompts';
import type { LLMProviderConfig, PageType } from './ai-playground/types';
import type { ComponentSchema } from '../catalog/component-schemas';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

function AIPlayground() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [providerConfig, setProviderConfig] = React.useState<LLMProviderConfig | null>(null);
  const [selectedTemplate, setSelectedTemplate] = React.useState<PageType | null>(null);
  const [prompt, setPrompt] = React.useState('');
  const [hasGenerated, setHasGenerated] = React.useState(false);

  const { state: genState, generate, abort, reset, setSpec } = useLLMGenerate();

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleTemplateSelect = React.useCallback((id: PageType) => {
    setSelectedTemplate(id);
    // Pre-fill with the first example prompt
    const template = PAGE_TEMPLATES.find(t => t.id === id);
    if (template) {
      setPrompt(template.examplePrompts[0] || '');
    }
  }, []);

  const handleGenerate = React.useCallback(() => {
    if (!providerConfig || !prompt.trim()) return;

    // Build system prompt
    const template = selectedTemplate
      ? PAGE_TEMPLATES.find(t => t.id === selectedTemplate)
      : null;

    let systemPrompt = getFullSystemPrompt({ includeExamples: true });
    systemPrompt += '\n\n---\n\n';

    // Add extended UI component descriptions
    systemPrompt += `## Extended Layout & Form Components (json-render)\n\n`;
    systemPrompt += `In addition to data visualization components, the following layout and form components are available:\n\n`;
    systemPrompt += `### Box\nFlexbox/grid layout container. Props: direction (row|column), gap (px), columns (grid count), padding (px), align, justify, wrap.\nIMPORTANT: Box supports children via the "children" array in the spec.\n\n`;
    systemPrompt += `### Card\nContent card with optional title and description. Props: title, description, variant (default|outline|filled), padding (none|sm|md|lg).\nSupports children.\n\n`;
    systemPrompt += `### Heading\nText heading. Props: text, level (1-4), align.\n\n`;
    systemPrompt += `### Text\nBody text. Props: content (supports **bold** and *italic*), size (sm|base|lg), muted, align.\n\n`;
    systemPrompt += `### StatCard\nKPI metric card. Props: label, value, change (e.g. "+12%"), trend (up|down|neutral).\n\n`;
    systemPrompt += `### Divider\nSeparator line. Props: orientation (horizontal|vertical), label.\n\n`;
    systemPrompt += `### FormInput\nLabeled input field. Props: label, name, placeholder, type (text|email|number|password|url|tel|date), required, helperText.\n\n`;
    systemPrompt += `### FormSelect\nLabeled dropdown. Props: label, name, placeholder, options [{label, value}], required.\n\n`;

    // Add spec format instructions
    systemPrompt += `## Spec Format\n\n`;
    systemPrompt += `Generate a valid json-render spec with this structure:\n`;
    systemPrompt += `{\n  "root": "element-id",\n  "elements": {\n    "element-id": {\n      "type": "ComponentType",\n      "props": { ... },\n      "children": ["child-id-1", "child-id-2"]  // only for Box and Card\n    }\n  },\n  "state": {\n    "data": [...]  // sample data for charts and tables\n  }\n}\n\n`;
    systemPrompt += `CRITICAL RULES:\n`;
    systemPrompt += `- Respond ONLY with the JSON spec object. No markdown, no explanation, no code blocks.\n`;
    systemPrompt += `- Every element must have a unique string ID in the elements map.\n`;
    systemPrompt += `- The "root" must reference an existing element ID.\n`;
    systemPrompt += `- Only Box and Card support "children" arrays.\n`;
    systemPrompt += `- Include sample data in "state.data" for Chart, DataTable, and TableWithFilters components.\n`;
    systemPrompt += `- Use realistic, coherent sample data that matches the user's request.\n`;

    if (template) {
      systemPrompt += `\n${template.systemPromptAddition}\n`;
    }

    setHasGenerated(true);
    generate(providerConfig, systemPrompt, prompt);
  }, [providerConfig, prompt, selectedTemplate, generate]);

  const handleReset = React.useCallback(() => {
    reset();
    resetLoomSession();
    setHasGenerated(false);
  }, [reset]);

  const handleUseComponent = React.useCallback((component: ComponentSchema) => {
    setPrompt(prev => {
      const addition = `\nInclude a ${component.name} component (${component.description})`;
      return prev + addition;
    });
  }, []);

  // Use sample spec from template for preview
  const handlePreviewSample = React.useCallback(() => {
    if (!selectedTemplate) return;
    const template = PAGE_TEMPLATES.find(t => t.id === selectedTemplate);
    if (template?.sampleSpec) {
      setSpec(template.sampleSpec as Record<string, unknown>);
      setHasGenerated(true);
    }
  }, [selectedTemplate, setSpec]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // State 1: No provider configured
  if (!providerConfig) {
    return (
      <ThemeWrapper
        title="AI Playground"
        description="Generate dynamic pages with any LLM"
        showDemoNav
        currentDemo="ai-playground"
      >
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
          <div className="flex items-center gap-3 text-primary">
            <Sparkles className="h-10 w-10" />
            <div>
              <h2 className="text-2xl font-bold text-foreground">AI Playground</h2>
              <p className="text-muted-foreground">
                Connect your LLM to generate dashboards, forms, and more
              </p>
            </div>
          </div>
          <ProviderConfig config={null} onConfigured={setProviderConfig} />
        </div>
      </ThemeWrapper>
    );
  }

  // State 2: Provider configured, no generation yet
  if (!hasGenerated) {
    return (
      <ThemeWrapper
        title="AI Playground"
        description="Generate dynamic pages with any LLM"
        showDemoNav
        currentDemo="ai-playground"
      >
        <div className="flex flex-col gap-6">
          {/* Provider Settings Bar */}
          <div className="flex items-center justify-between">
            <ProviderConfig config={providerConfig} onConfigured={setProviderConfig} compact />
            {selectedTemplate && (
              <button
                onClick={handlePreviewSample}
                className="text-xs text-primary hover:underline"
              >
                Preview sample spec
              </button>
            )}
          </div>

          {/* Page Type Selection */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-foreground">Choose a page type</h3>
            <PageTemplates
              selected={selectedTemplate}
              onSelect={handleTemplateSelect}
            />
          </div>

          {/* Main Content: Prompt + Catalog */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
            <PromptComposer
              prompt={prompt}
              onPromptChange={setPrompt}
              onGenerate={handleGenerate}
              onAbort={abort}
              onReset={handleReset}
              selectedTemplate={selectedTemplate}
              generationState={genState}
            />
            <div className="hidden lg:block">
              <ComponentCatalog
                onUseComponent={handleUseComponent}
                maxHeight="400px"
              />
            </div>
          </div>
        </div>
      </ThemeWrapper>
    );
  }

  // State 3: Generated (or generating)
  const isGenerating = genState.status === 'generating' || genState.status === 'validating';

  return (
    <ThemeWrapper
      title="AI Playground"
      description="Generate dynamic pages with any LLM"
      showDemoNav
      currentDemo="ai-playground"
    >
      <div className="flex flex-col gap-4 h-[calc(100vh-120px)]">
        {/* Top Toolbar */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <PromptComposer
              prompt={prompt}
              onPromptChange={setPrompt}
              onGenerate={handleGenerate}
              onAbort={abort}
              onReset={handleReset}
              selectedTemplate={selectedTemplate}
              generationState={genState}
              compact
            />
          </div>
          <ProviderConfig config={providerConfig} onConfigured={setProviderConfig} compact />
        </div>

        {/* Generation Progress */}
        {isGenerating && (
          <div className="flex flex-col gap-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${genState.progress * 100}%` }}
                role="progressbar"
                aria-valuenow={Math.round(genState.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="text-xs text-muted-foreground animate-pulse">
              {genState.status === 'validating' ? 'Validating specification...' : 'Generating UI specification...'}
            </p>
            {genState.rawText && (
              <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-x-auto max-h-16 text-muted-foreground">
                {genState.rawText.slice(-300)}
              </pre>
            )}
          </div>
        )}

        {/* Error */}
        {genState.status === 'error' && genState.error && !isGenerating && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">Generation failed</p>
            <p className="text-xs text-destructive/80 mt-1">{genState.error}</p>
          </div>
        )}

        {/* Preview */}
        {(genState.spec || genState.status === 'error') && !isGenerating && (
          <div className="flex-1 min-h-0">
            <SpecPreview
              spec={genState.spec}
              onSpecChange={setSpec}
            />
          </div>
        )}

        {/* Template Quick Switch */}
        {!isGenerating && genState.spec && (
          <div className={cn(
            'flex items-center gap-3 py-2 border-t border-border',
          )}>
            <span className="text-xs text-muted-foreground shrink-0">Switch template:</span>
            <div className="flex gap-2 overflow-x-auto">
              {PAGE_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateSelect(t.id)}
                  className={cn(
                    'px-3 py-1 text-xs rounded-full border transition-colors whitespace-nowrap',
                    selectedTemplate === t.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ThemeWrapper>
  );
}

// ── Mount ────────────────────────────────────────────────────────────────────

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<AIPlayground />);
}
