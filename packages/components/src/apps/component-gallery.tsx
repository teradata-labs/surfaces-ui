/**
 * Component Gallery - MCP-optimized showcase
 *
 * Simplified version of kitchen-sink designed specifically for MCP rendering.
 * Shows core components with error boundaries and conservative rendering.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { ThemeWrapper } from './ThemeWrapper';
import '../theme/tokens.css';

// Create the MCP Apps bridge instance
const bridge = new McpAppsBridge();
bridge.connect();

// Import core components only
import { Button } from '../primitives/button';
import { Badge } from '../primitives/badge';
import { Input } from '../primitives/input';
import { Checkbox } from '../primitives/checkbox';
import { Switch } from '../primitives/switch';
import { Progress } from '../primitives/progress';
import { Alert } from '../primitives/alert';
import { Typography } from '../primitives/typography';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../primitives/tabs';
import { DataTable } from '../organisms/data-table';
import type { DataTableColumn } from '../organisms/data-table';

const { useState } = React;

// Error boundary for graceful failure
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-error">
          <p>Component failed to load</p>
          <p className="text-xs mt-2">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Section wrapper
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 mb-8">
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      <div className="bg-card border border-su-outline-variant rounded-xl p-6">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </section>
  );
}

// Component sections
function ButtonsSection() {
  return (
    <Section id="buttons" title="Buttons">
      <div className="flex flex-wrap gap-3">
        <Button>Default</Button>
        <Button disabled>Disabled</Button>
      </div>
    </Section>
  );
}

function BadgesSection() {
  return (
    <Section id="badges" title="Badges">
      <div className="flex flex-wrap gap-3">
        <Badge>Default</Badge>
        <Badge>Badge</Badge>
      </div>
    </Section>
  );
}

function InputsSection() {
  return (
    <Section id="inputs" title="Inputs">
      <div className="flex flex-col gap-4 max-w-md">
        <Input placeholder="Enter text..." className="bg-surface-container" />
        <Input defaultValue="Filled input" className="bg-surface-container" />
        <Input disabled placeholder="Disabled" className="bg-surface-container" />
      </div>
    </Section>
  );
}

function CheckboxSection() {
  const [checked, setChecked] = useState<boolean>(true);
  return (
    <Section id="checkboxes" title="Checkboxes">
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox
            defaultChecked={checked}
            onCheckedChange={(val) => setChecked(val === true)}
            aria-label="Checkbox example"
          />
          <span className="text-sm">Checked</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <Checkbox aria-label="Unchecked example" />
          <span className="text-sm">Unchecked</span>
        </label>
        <label className="flex items-center gap-3 cursor-not-allowed">
          <Checkbox disabled aria-label="Disabled example" />
          <span className="text-sm text-on-surface-variant">Disabled</span>
        </label>
      </div>
    </Section>
  );
}

function SwitchSection() {
  const [enabled, setEnabled] = useState(true);
  return (
    <Section id="switches" title="Switches">
      <div className="flex flex-col gap-4 max-w-xs">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">Wi-Fi</span>
          <Switch defaultChecked={enabled} onCheckedChange={setEnabled} aria-label="Wi-Fi" />
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">Bluetooth</span>
          <Switch aria-label="Bluetooth" />
        </label>
        <label className="flex items-center justify-between cursor-not-allowed">
          <span className="text-sm text-on-surface-variant">Airplane Mode</span>
          <Switch disabled aria-label="Airplane Mode" />
        </label>
      </div>
    </Section>
  );
}

function ProgressSection() {
  return (
    <Section id="progress" title="Progress">
      <div className="flex flex-col gap-6 max-w-md">
        {[25, 50, 75, 100].map((value) => (
          <div key={value} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">Progress</span>
              <span className="text-xs text-on-surface-variant">{value}%</span>
            </div>
            <Progress value={value} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function AlertsSection() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const dismiss = (id: string) => setDismissed((prev) => [...prev, id]);

  return (
    <Section id="alerts" title="Alerts">
      <div className="flex flex-col gap-3">
        {!dismissed.includes('info') && (
          <Alert title="Information" onDismiss={() => dismiss('info')} />
        )}
        {!dismissed.includes('desc') && (
          <Alert
            title="Alert with description"
            description="This is additional information about the alert."
            onDismiss={() => dismiss('desc')}
          />
        )}
      </div>
    </Section>
  );
}

function TypographySection() {
  return (
    <Section id="typography" title="Typography">
      <div className="flex flex-col gap-4">
        <Typography variant="headline-lg">Headline Large</Typography>
        <Typography variant="headline-md">Headline Medium</Typography>
        <Typography variant="title-lg">Title Large</Typography>
        <Typography variant="body-lg">Body Large</Typography>
        <Typography variant="body-md">Body Medium - Default text</Typography>
        <Typography variant="caption">Caption text</Typography>
      </div>
    </Section>
  );
}

function TabsSection() {
  return (
    <Section id="tabs" title="Tabs">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="p-4 text-sm text-on-surface-variant">
            Overview content with key information and metrics.
          </div>
        </TabsContent>
        <TabsContent value="details">
          <div className="p-4 text-sm text-on-surface-variant">
            Detailed information and data.
          </div>
        </TabsContent>
        <TabsContent value="settings">
          <div className="p-4 text-sm text-on-surface-variant">
            Configuration and preferences.
          </div>
        </TabsContent>
      </Tabs>
    </Section>
  );
}

interface User extends Record<string, unknown> {
  id: number;
  name: string;
  role: string;
  status: string;
}

const SAMPLE_DATA: User[] = [
  { id: 1, name: 'Alice Chen', role: 'Admin', status: 'Active' },
  { id: 2, name: 'Bob Martinez', role: 'Editor', status: 'Active' },
  { id: 3, name: 'Carol Davis', role: 'Viewer', status: 'Inactive' },
  { id: 4, name: 'David Kim', role: 'Admin', status: 'Active' },
];

function DataTableSection() {
  const columns: DataTableColumn<Record<string, unknown>>[] = [
    { id: 'name', header: 'Name', type: 'text' },
    { id: 'role', header: 'Role', type: 'text' },
    { id: 'status', header: 'Status', type: 'text' },
  ];

  return (
    <Section id="datatable" title="Data Table">
      <DataTable
        data={SAMPLE_DATA}
        columns={columns}
        height={250}
        getRowKey={(row) => (row as User).id}
        aria-label="Users table"
      />
    </Section>
  );
}

// Navigation items
const NAV_ITEMS = [
  { id: 'buttons', label: 'Buttons' },
  { id: 'badges', label: 'Badges' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'checkboxes', label: 'Checkboxes' },
  { id: 'switches', label: 'Switches' },
  { id: 'progress', label: 'Progress' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'typography', label: 'Typography' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'datatable', label: 'Data Table' },
];

// Main app
function ComponentGallery() {
  const [active, setActive] = useState('buttons');

  const handleNavClick = (id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const subMenuItems = NAV_ITEMS.map(({ id, label }) => ({
    id,
    label,
    onClick: () => handleNavClick(id),
  }));

  return (
    <ThemeWrapper
      title="Component Gallery"
      description="Core SurfacesUI components"
      showDemoNav={true}
      currentDemo="component-gallery"
      subMenuItems={subMenuItems}
      activeSubItem={active}
    >
      <div className="space-y-8">
        <ButtonsSection />
        <BadgesSection />
        <InputsSection />
        <CheckboxSection />
        <SwitchSection />
        <ProgressSection />
        <AlertsSection />
        <TypographySection />
        <TabsSection />
        <DataTableSection />
      </div>
    </ThemeWrapper>
  );
}

// Mount
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <McpBridgeProvider bridge={bridge}>
      <ErrorBoundary fallback={
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Failed to load Component Gallery</h1>
            <p className="text-sm text-on-surface-variant">Please check console for errors</p>
          </div>
        </div>
      }>
        <ComponentGallery />
      </ErrorBoundary>
    </McpBridgeProvider>
  );
} else {
  console.error('Root element not found');
}
