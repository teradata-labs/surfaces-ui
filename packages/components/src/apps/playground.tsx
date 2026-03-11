/**
 * SurfacesUI Component Playground
 *
 * Interactive playground for exploring component props, variations, and metadata.
 * Auto-generates controls from ComponentSchema definitions.
 *
 * DEV-ONLY: Access at http://localhost:5180/src/apps/playground.html
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeWrapper } from './ThemeWrapper';
import { COMPONENT_SCHEMAS, getSchemasByCategory } from '../catalog/component-schemas';
import type { ComponentSchema } from '../catalog/component-schemas';
import { COMPONENT_REGISTRY } from './playground-registry';
import { PlaygroundControls, CodeView } from './playground-controls';
import { MetadataPanel, PropsTable } from './playground-metadata';
import { Badge } from '../primitives/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../primitives/tabs';
import '../theme/tokens.css';

const { useState, useMemo, useCallback } = React;

// ── Category order ────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['actions', 'feedback', 'layout', 'data-display', 'inputs', 'navigation', 'content'];

const CATEGORY_LABELS: Record<string, string> = {
  'actions': 'Actions',
  'feedback': 'Feedback',
  'layout': 'Layout',
  'data-display': 'Data Display',
  'inputs': 'Inputs',
  'navigation': 'Navigation',
  'content': 'Content',
};

const LEVEL_COLORS: Record<string, string> = {
  atom: 'default',
  molecule: 'secondary',
  organism: 'outline',
};

// ── Main App ──────────────────────────────────────────────────────────────

function PlaygroundApp() {
  const [selectedName, setSelectedName] = useState('Button');

  // Build categorized nav
  const categories = useMemo(() =>
    CATEGORY_ORDER.map(cat => ({
      name: cat,
      label: CATEGORY_LABELS[cat] || cat,
      schemas: getSchemasByCategory(cat),
    })).filter(c => c.schemas.length > 0),
  []);

  // Nav submenu items (flat list of all components with category headers)
  const subMenuItems = useMemo(() => {
    const items: { id: string; label: string; onClick: () => void }[] = [];
    for (const cat of categories) {
      // Category header (non-clickable separator)
      items.push({
        id: `cat-${cat.name}`,
        label: `── ${cat.label} ──`,
        onClick: () => {},
      });
      for (const schema of cat.schemas) {
        items.push({
          id: schema.name,
          label: schema.name,
          onClick: () => setSelectedName(schema.name),
        });
      }
    }
    return items;
  }, [categories]);

  return (
    <ThemeWrapper
      title="Component Playground"
      description="Interactive props, variations & documentation"
      showDemoNav={true}
      currentDemo="playground"
      subMenuItems={subMenuItems}
      activeSubItem={selectedName}
    >
      <ComponentPlayground key={selectedName} name={selectedName} />
    </ThemeWrapper>
  );
}

// ── Component Playground ──────────────────────────────────────────────────

function ComponentPlayground({ name }: { name: string }) {
  const schema = useMemo(
    () => COMPONENT_SCHEMAS.find(s => s.name === name),
    [name],
  );

  const registry = COMPONENT_REGISTRY[name];

  // Initialize prop values from defaults
  const [propValues, setPropValues] = useState<Record<string, unknown>>(() =>
    registry?.defaultProps ?? {},
  );

  // Reset props when component changes
  React.useEffect(() => {
    setPropValues(registry?.defaultProps ?? {});
  }, [name, registry]);

  const handlePropChange = useCallback((propName: string, value: unknown) => {
    setPropValues(prev => ({ ...prev, [propName]: value }));
  }, []);

  const handleValuesChange = useCallback((newValues: Record<string, unknown>) => {
    setPropValues(newValues);
  }, []);

  if (!schema) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg">Component "{name}" not found in schemas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <ComponentHeader schema={schema} />

      {/* Preview + Controls */}
      <div className="grid grid-cols-1 md:grid-cols-[7fr_3fr] gap-6 items-stretch">
        {/* Live Preview */}
        <div className="flex">
          <div className="border border-su-outline-variant rounded-xl overflow-hidden flex flex-col w-full">
            <div className="bg-surface-container-lowest px-4 py-2 border-b border-su-outline-variant">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</span>
            </div>
            <div className="p-6 flex-1 flex items-center justify-center bg-background">
              {registry ? (
                <div className="w-full flex items-center justify-center">
                  {registry.render(propValues)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Live preview not available for this component.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="flex">
          <div className="border border-su-outline-variant rounded-xl overflow-hidden flex flex-col w-full">
            <div className="bg-surface-container-lowest px-4 py-2 border-b border-su-outline-variant">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Controls</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <PlaygroundControls
                props={schema.props}
                values={propValues}
                onChange={handlePropChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Tabs: Code, Props Table, Metadata */}
      <div className="border border-su-outline-variant rounded-xl overflow-hidden">
        <Tabs defaultValue="metadata" className="w-full">
          <div className="bg-surface-container-lowest px-4 py-2 border-b border-su-outline-variant">
            <TabsList>
              <TabsTrigger value="metadata">Usage & Docs</TabsTrigger>
              <TabsTrigger value="props">Props Table</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            <TabsContent value="metadata">
              <MetadataPanel schema={schema} />
            </TabsContent>

            <TabsContent value="props">
              <PropsTable schema={schema} />
            </TabsContent>

            <TabsContent value="code">
              <CodeView
                componentName={name}
                values={propValues}
                defaultProps={registry?.defaultProps ?? {}}
                onValuesChange={handleValuesChange}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// ── Component Header ──────────────────────────────────────────────────────

function ComponentHeader({ schema }: { schema: ComponentSchema }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-foreground">{schema.name}</h2>
        <Badge variant={LEVEL_COLORS[schema.level] as unknown as never} className="text-[10px] uppercase">
          {schema.level}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {schema.category}
        </Badge>
      </div>
      <p className="text-sm text-on-surface-variant">{schema.description}</p>
      <p className="text-xs text-muted-foreground font-mono">
        Figma: {schema.figmaName}
      </p>
    </div>
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────

const container = document.getElementById('root');
if (container) {
  // Reuse existing root on HMR to avoid "createRoot on same container" warnings
  interface ContainerWithRoot extends HTMLElement {
    __reactRoot?: ReturnType<typeof createRoot>;
  }
  const containerWithRoot = container as ContainerWithRoot;
  const existingRoot = containerWithRoot.__reactRoot;
  if (existingRoot) {
    existingRoot.render(<PlaygroundApp />);
  } else {
    const reactRoot = createRoot(container);
    containerWithRoot.__reactRoot = reactRoot;
    reactRoot.render(<PlaygroundApp />);
  }
}
