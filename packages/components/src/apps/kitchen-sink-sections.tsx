/**
 * SurfacesUI Kitchen Sink — Section Components
 *
 * Individual section renderers for the dark-mode kitchen sink.
 * Implements Figma node 25796:15712 (file Yl9Vh9sloq2VxueDt3Majm).
 */

import * as React from 'react';

// ── Flow imports ────────────────────────────────────────────────────────────
import { FlowNode } from '../primitives/flow-node';
import { NodePalette } from '../molecules/node-palette';
import type { PaletteCategory } from '../molecules/node-palette';
import { FlowEditor } from '../organisms/flow-editor';
import { AgentFlowView } from '../organisms/agent-flow-view';
import type { AgentStep } from '../organisms/agent-flow-view';
import { FlowCanvas } from '../organisms/flow-canvas';
import { useAutoLayout } from '../hooks/use-auto-layout';
import { Database, Brain, BarChart3, Zap, Upload, GitBranch } from 'lucide-react';

// ── SQL Visual Explain imports ──────────────────────────────────────────────
import { ExplainPlanNode } from './sql-visual-explain/ExplainPlanNode';
import { NodeDetailPanel } from './sql-visual-explain/NodeDetailPanel';
import { planToNodes, planToEdges } from './sql-visual-explain/plan-to-flow';
import type { ExplainNodeData } from './sql-visual-explain/plan-to-flow';
import type { ExplainNode } from './sql-visual-explain/types';
import type { CostLevel } from './sql-visual-explain/types';
import { SAMPLE_SQL, SAMPLE_PLAN } from './sql-visual-explain/sample-data';
import type { Node } from '@xyflow/react';

// ── Library imports ─────────────────────────────────────────────────────────
import { Alert } from '../primitives/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../primitives/tabs';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../primitives/tooltip';
import { Badge, NotificationBadge } from '../primitives/badge';
import { Button } from '../primitives/button';
import { Checkbox } from '../primitives/checkbox';
import { CircularProgress } from '../primitives/circular-progress';
import { Input } from '../primitives/input';
import { Progress } from '../primitives/progress';
import { RadioGroup, RadioGroupItem } from '../primitives/radio-group';
import { Separator } from '../primitives/separator';
import { Slider } from '../primitives/slider';
import { Switch } from '../primitives/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '../primitives/dialog';
import { ActionRibbon } from '../molecules/action-ribbon';
import { CodeSnippet } from '../molecules/code-snippet';
import { FilterChip, InputChip } from '../molecules/chip';
import { EmptyState } from '../molecules/empty-state';
import { FormField } from '../molecules/form-field';
import { IconButton } from '../molecules/icon-button';
import { Snackbar } from '../molecules/snackbar';
import { Typography } from '../primitives/typography';
import { Icon } from '../primitives/icon';
import { ListItem } from '../primitives/list-item';
import { TextLockup } from '../molecules/text-lockup';
import { IconLockup } from '../molecules/icon-lockup';
import { Menu } from '../molecules/menu';
import { Toolbar, ToolbarSeparator } from '../molecules/toolbar';
import { StatusDialog } from '../molecules/status-dialog';
import { SideSheet } from '../organisms/side-sheet';
import { FullScreenDialog } from '../organisms/full-screen-dialog';
import { FocusedPage } from '../organisms/focused-page';
import { TreeList } from '../organisms/tree-list';
import type { TreeNode } from '../organisms/tree-list';
import { OnboardingCards } from '../organisms/onboarding-cards';
import type { OnboardingCard } from '../organisms/onboarding-cards';
import { NotebookCell } from '../organisms/notebook-cell';
import { DataTable } from '../organisms/data-table';
import type { DataTableColumn, RowAction } from '../organisms/data-table';
import type { TableDensity } from '../primitives/table-core';

const { useState } = React;

// ── Helpers ──────────────────────────────────────────────────────────────

/** Wraps a section with heading + content card */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      <div className="bg-card border border-su-outline-variant rounded-xl p-6">
        {children}
      </div>
    </section>
  );
}

/** Row of demo items with an optional label */
function DemoRow({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-xs text-on-surface-variant uppercase tracking-wider">{label}</p>}
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────

export function ActionRibbonSection() {
  const [checked, setChecked] = useState(true);
  const [selCount, setSelCount] = useState(3);

  return (
    <Section id="action-ribbon" title="Action Ribbon">
      <div className="flex flex-col gap-3">
        <DemoRow label="Inactive">
          <div className="w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <ActionRibbon state="inactive" label="No changes" />
          </div>
        </DemoRow>

        <DemoRow label="Active">
          <div className="w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <ActionRibbon
              state="active"
              label="Editing row 5"
              actions={[
                <Button key="save" variant="default" size="sm">Save</Button>,
                <Button key="cancel" variant="text" size="sm">Cancel</Button>,
              ]}
            />
          </div>
        </DemoRow>

        <DemoRow label="Positive">
          <div className="w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <ActionRibbon state="positive" label="3 rows updated successfully" />
          </div>
        </DemoRow>

        <DemoRow label="Caution">
          <div className="w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <ActionRibbon state="caution" label="Unsaved changes will be lost" />
          </div>
        </DemoRow>

        <DemoRow label="Negative">
          <div className="w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <ActionRibbon state="negative" label="Failed to save — check connection" />
          </div>
        </DemoRow>

        <DemoRow label="Loading">
          <div className="w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <ActionRibbon state="loading" label="Saving changes..." />
          </div>
        </DemoRow>

        <DemoRow label="Pending">
          <div className="w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <ActionRibbon state="pending" label="Waiting for approval" />
          </div>
        </DemoRow>

        <DemoRow label="Checked (bulk selection)">
          <div className="w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <ActionRibbon
              state="checked"
              checked={checked}
              onCheckedChange={setChecked}
              selectionCount={selCount}
              onClearSelection={() => { setSelCount(0); setChecked(false); }}
              icons={[
                <IconButton key="del" aria-label="Delete selected" size="sm">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </IconButton>,
              ]}
              actions={[
                <Button key="export" variant="outline" size="sm">Export</Button>,
              ]}
            />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

export function AlertsSection() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const dismiss = (id: string) => setDismissed(prev => [...prev, id]);

  return (
    <Section id="alerts" title="Alerts">
      <div className="flex flex-col gap-4">
        {/* Full-page alerts */}
        <p className="text-sm font-medium text-on-surface-variant">Full-page</p>
        <div className="flex flex-col gap-3">
          {!dismissed.includes('fp-negative') && (
            <Alert variant="negative" title="Alert title" onDismiss={() => dismiss('fp-negative')} />
          )}
          <Alert variant="caution" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm" className="text-inherit">Label</Button>} onDismiss={() => dismiss('fp-caution')} />
          <Alert variant="positive" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm" className="text-inherit">Label</Button>} onDismiss={() => dismiss('fp-positive')} />
          <Alert variant="secondary" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm" className="text-inherit">Label</Button>} onDismiss={() => dismiss('fp-secondary')} />
          <Alert variant="loading" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm" className="text-inherit">Label</Button>} onDismiss={() => dismiss('fp-loading')} />
          <Alert variant="default" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm" className="text-inherit">Label</Button>} onDismiss={() => dismiss('fp-default')} />
        </div>

        {/* Inline alerts */}
        <p className="text-sm font-medium text-on-surface-variant mt-2">Inline</p>
        <div className="flex flex-col gap-3">
          <Alert mode="inline" variant="negative" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm">Label</Button>} onDismiss={() => dismiss('il-negative')} />
          <Alert mode="inline" variant="caution" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm">Label</Button>} onDismiss={() => dismiss('il-caution')} />
          <Alert mode="inline" variant="positive" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm">Label</Button>} onDismiss={() => dismiss('il-positive')} />
          <Alert mode="inline" variant="secondary" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm">Label</Button>} onDismiss={() => dismiss('il-secondary')} />
          <Alert mode="inline" variant="loading" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm">Label</Button>} onDismiss={() => dismiss('il-loading')} />
          <Alert mode="inline" variant="default" title="Alert title" description="Alert description" action={<Button variant="ghost" size="sm">Label</Button>} onDismiss={() => dismiss('il-default')} />
        </div>
      </div>
    </Section>
  );
}

export function BadgeSection() {
  return (
    <Section id="badge" title="Badge">
      <div className="flex flex-col gap-6">
        <DemoRow label="Small (dot)">
          <div className="relative">
            <svg className="w-6 h-6 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <div className="absolute -top-1 -right-1"><NotificationBadge variant="dot" /></div>
          </div>
          <div className="relative">
            <svg className="w-6 h-6 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div className="absolute -top-1 -right-1"><NotificationBadge variant="dot" /></div>
          </div>
        </DemoRow>
        <DemoRow label="Large (count)">
          <div className="relative">
            <svg className="w-6 h-6 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <div className="absolute -top-2 -right-2"><NotificationBadge content="3" /></div>
          </div>
          <div className="relative">
            <svg className="w-6 h-6 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div className="absolute -top-2 -right-2"><NotificationBadge content="12" /></div>
          </div>
          <div className="relative">
            <svg className="w-6 h-6 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
            <div className="absolute -top-2 -right-2"><NotificationBadge content="99+" /></div>
          </div>
        </DemoRow>
        <DemoRow label="Text badges">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </DemoRow>
      </div>
    </Section>
  );
}

export function ButtonsSection() {
  return (
    <Section id="buttons" title="Buttons">
      <div className="flex flex-col gap-6">
        <DemoRow label="Text">
          <Button variant="text" size="sm">Label</Button>
          <Button variant="text" size="sm" disabled>Disabled</Button>
        </DemoRow>

        <DemoRow label="Outlined">
          <Button variant="outline" size="sm">Label</Button>
          <Button variant="outline" size="sm" disabled>Disabled</Button>
        </DemoRow>

        <DemoRow label="Filled">
          <Button variant="default" size="sm">Label</Button>
          <Button variant="default" size="sm" disabled>Disabled</Button>
        </DemoRow>

        <DemoRow label="Tonal">
          <Button variant="tonal" size="sm">Label</Button>
          <Button variant="tonal" size="sm" disabled>Disabled</Button>
        </DemoRow>

        <DemoRow label="Destructive">
          <Button variant="destructive" size="sm">Delete</Button>
          <Button variant="destructive" size="sm" disabled>Disabled</Button>
        </DemoRow>

        <DemoRow label="With icon">
          <Button variant="default" size="sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create
          </Button>
          <Button variant="outline" size="sm">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Export
          </Button>
        </DemoRow>
      </div>
    </Section>
  );
}

export function CheckboxSection() {
  return (
    <Section id="checkbox" title="Checkbox">
      <div className="grid grid-cols-3 gap-6">
        {[
          { label: 'Checked', checked: true as const, indeterminate: false },
          { label: 'Indeterminate', checked: 'indeterminate' as const, indeterminate: true },
          { label: 'Unchecked', checked: false as const, indeterminate: false },
        ].map(({ label, checked }) => (
          <div key={label} className="flex flex-col gap-3">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">{label}</p>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={checked}
                aria-label={`${label} enabled`}
              />
              <span className="text-sm text-foreground">Enabled</span>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={checked}
                disabled
                aria-label={`${label} disabled`}
              />
              <span className="text-sm text-on-surface-variant">Disabled</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ChipSection() {
  const chips = ['All', 'Analytics', 'Reports', 'Settings', 'Users'];
  const [active, setActive] = useState<string[]>(['Analytics']);
  const [inputChips, setInputChips] = useState(['React', 'TypeScript', 'Tailwind']);

  const toggle = (chip: string) => {
    setActive(prev =>
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
    );
  };

  return (
    <Section id="chips" title="Chip &amp; Chip Set">
      <div className="flex flex-col gap-4">
        <DemoRow label="Filter chips">
          {chips.map(chip => (
            <FilterChip
              key={chip}
              label={chip}
              selected={active.includes(chip)}
              onSelectedChange={() => toggle(chip)}
            />
          ))}
        </DemoRow>
        <DemoRow label="Input chip (dismissible)">
          {inputChips.map(chip => (
            <InputChip
              key={chip}
              label={chip}
              onDismiss={() => setInputChips(prev => prev.filter(c => c !== chip))}
            />
          ))}
        </DemoRow>
      </div>
    </Section>
  );
}

export function CircularProgressSection() {
  return (
    <Section id="circular-progress" title="Circular Progress">
      <div className="flex items-end gap-8">
        {[25, 50, 75, 100].map(pct => (
          <CircularProgress key={pct} value={pct} size={56} />
        ))}
      </div>
    </Section>
  );
}

export function CodeSnippetSection() {
  return (
    <Section id="code-snippet" title="Code Snippet">
      <div className="flex flex-col gap-4">
        <CodeSnippet
          filename="query.sql"
          language="sql"
          code={`SELECT name, region, revenue\nFROM sales_data\nWHERE fiscal_year = 2025\nORDER BY revenue DESC\nLIMIT 10;`}
        />
        <CodeSnippet
          language="TypeScript"
          showLineNumbers
          code={`import { Snackbar } from '@surfacesui/components';\n\nfunction App() {\n  return <Snackbar message="Saved" />;\n}`}
        />
      </div>
    </Section>
  );
}

export function DialogSection() {
  return (
    <Section id="dialog" title="Dialog">
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open Dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this file?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription>
              This action cannot be undone.
            </DialogDescription>
          </DialogBody>
          <DialogFooter>
            <DialogTrigger asChild>
              <Button variant="text">Don&apos;t delete</Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button variant="text" className="text-error hover:bg-error/8">Delete</Button>
            </DialogTrigger>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

export function DividerSection() {
  return (
    <Section id="divider" title="Divider">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-foreground mb-3">Content above</p>
          <Separator />
          <p className="text-sm text-foreground mt-3">Content below</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant">Label</span>
          <Separator className="flex-1" />
          <span className="text-sm text-on-surface-variant">Label</span>
          <Separator className="flex-1" />
          <span className="text-sm text-on-surface-variant">Label</span>
        </div>
      </div>
    </Section>
  );
}

export function EmptyStateSection() {
  return (
    <Section id="empty-state" title="Empty State">
      <EmptyState
        icon={
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          </svg>
        }
        title="No data found"
        description="There are no items to display. Try adjusting your filters or create a new item."
        action={{ label: 'Create New', onClick: () => {} }}
      />
    </Section>
  );
}

export function FormFieldSection() {
  return (
    <Section id="form-field" title="Form Field">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl">
        <FormField label="Default" helperText="Helper text" htmlFor="ff-default">
          <Input
            id="ff-default"
            type="text"
            placeholder="Placeholder text"
            className="bg-surface-container"
          />
        </FormField>
        <FormField label="Filled" helperText="Helper text" htmlFor="ff-filled">
          <Input
            id="ff-filled"
            type="text"
            defaultValue="Input value"
            className="bg-surface-container"
          />
        </FormField>
        <FormField label="Error" error="This field is required." htmlFor="ff-error">
          <Input
            id="ff-error"
            type="text"
            defaultValue="Invalid value"
            className="bg-surface-container"
          />
        </FormField>
      </div>
    </Section>
  );
}

export function IconButtonSection() {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [hearted, setHearted] = useState(true);

  return (
    <Section id="icon-button" title="Icon Button">
      <div className="flex flex-col gap-6">
        <DemoRow label="Standard">
          <IconButton aria-label="Edit">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </IconButton>
          <IconButton aria-label="Bookmark">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </IconButton>
          <IconButton aria-label="Like" active={liked} onClick={() => setLiked(v => !v)}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </IconButton>
          <IconButton aria-label="Block" disabled>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </IconButton>
        </DemoRow>
        <DemoRow label="Filled">
          <IconButton aria-label="Add" variant="filled">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </IconButton>
          <IconButton aria-label="Delete" variant="tonal">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </IconButton>
          <IconButton aria-label="Share" variant="tonal" disabled>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </IconButton>
        </DemoRow>
        <DemoRow label="Toggle (pressed/unpressed)">
          <IconButton aria-label="Bookmark" pressed={bookmarked} onPressedChange={setBookmarked}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </IconButton>
          <IconButton aria-label="Favorite" pressed={hearted} onPressedChange={setHearted}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={hearted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </IconButton>
        </DemoRow>
      </div>
    </Section>
  );
}

export function ProgressBarSection() {
  return (
    <Section id="progress-bar" title="Progress Bar">
      <div className="flex flex-col gap-6 max-w-md">
        {[25, 50, 75, 100].map(pct => (
          <div key={pct} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">Progress</span>
              <span className="text-xs text-on-surface-variant">{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-on-surface-variant">Indeterminate</span>
          <Progress />
        </div>
      </div>
    </Section>
  );
}

export function RadioSection() {
  const [selected, setSelected] = useState('option1');
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];
  return (
    <Section id="radio" title="Radio">
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-on-surface-variant uppercase tracking-wider">Enabled</p>
          <RadioGroup
            value={selected}
            onValueChange={setSelected}
            aria-label="Enabled options"
          >
            {options.map(opt => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                <RadioGroupItem value={opt.value} aria-label={opt.label} />
                <span className="text-sm text-foreground">{opt.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-on-surface-variant uppercase tracking-wider">Disabled</p>
          <RadioGroup value="option1" aria-label="Disabled options">
            {options.map((opt, i) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-not-allowed">
                <RadioGroupItem value={opt.value} aria-label={opt.label} disabled={i !== 0} />
                <span className="text-sm text-on-surface-variant opacity-60">{opt.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>
    </Section>
  );
}

export function SwitchSection() {
  const [states, setStates] = useState({ s1: true, s2: false, s3: true });
  return (
    <Section id="switch" title="Switch">
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wider">Enabled</p>
          <label className="flex items-center justify-between gap-4 cursor-pointer max-w-[200px]">
            <span className="text-sm text-foreground">Wi-Fi</span>
            <Switch
              checked={states.s1}
              onCheckedChange={v => setStates(s => ({ ...s, s1: v }))}
              aria-label="Wi-Fi"
            />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer max-w-[200px]">
            <span className="text-sm text-foreground">Bluetooth</span>
            <Switch
              checked={states.s2}
              onCheckedChange={v => setStates(s => ({ ...s, s2: v }))}
              aria-label="Bluetooth"
            />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer max-w-[200px]">
            <span className="text-sm text-foreground">Notifications</span>
            <Switch
              checked={states.s3}
              onCheckedChange={v => setStates(s => ({ ...s, s3: v }))}
              aria-label="Notifications"
            />
          </label>
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wider">Disabled</p>
          <label className="flex items-center justify-between gap-4 cursor-not-allowed max-w-[200px]">
            <span className="text-sm text-on-surface-variant opacity-60">Wi-Fi</span>
            <Switch checked disabled aria-label="Wi-Fi disabled on" />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-not-allowed max-w-[200px]">
            <span className="text-sm text-on-surface-variant opacity-60">Bluetooth</span>
            <Switch checked={false} disabled aria-label="Bluetooth disabled off" />
          </label>
        </div>
      </div>
    </Section>
  );
}

export function SliderSection() {
  const [vol, setVol] = useState(50);
  const [brightness, setBrightness] = useState(75);

  return (
    <Section id="slider" title="Slider">
      <div className="flex flex-col gap-6 max-w-md">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">Volume</span>
            <span className="text-xs text-on-surface-variant">{vol}</span>
          </div>
          <Slider value={vol} onValueChange={setVol} aria-label="Volume" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">Brightness</span>
            <span className="text-xs text-on-surface-variant">{brightness}%</span>
          </div>
          <Slider value={brightness} onValueChange={setBrightness} aria-label="Brightness" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-on-surface-variant">Disabled</span>
          <Slider value={30} disabled aria-label="Disabled slider" />
        </div>
      </div>
    </Section>
  );
}

export function SnackbarSection() {
  const [showDefault, setShowDefault] = useState(false);
  const [showPositive, setShowPositive] = useState(false);
  const [showNegative, setShowNegative] = useState(false);

  return (
    <Section id="snackbar" title="Snackbar">
      <div className="flex flex-col gap-4">
        <DemoRow label="Trigger snackbars">
          <Button variant="outline" size="sm" onClick={() => setShowDefault(true)}>Default</Button>
          <Button variant="outline" size="sm" onClick={() => setShowPositive(true)}>Positive</Button>
          <Button variant="outline" size="sm" onClick={() => setShowNegative(true)}>Negative</Button>
        </DemoRow>

        <div className="flex flex-col gap-2">
          <Snackbar
            message="Item saved to your collection"
            open={showDefault}
            onDismiss={() => setShowDefault(false)}
            dismissible
            actionLabel="View"
            onAction={() => setShowDefault(false)}
          />
          <Snackbar
            message="Export completed successfully"
            variant="positive"
            open={showPositive}
            onDismiss={() => setShowPositive(false)}
            dismissible
          />
          <Snackbar
            message="Failed to delete — connection error"
            variant="negative"
            open={showNegative}
            onDismiss={() => setShowNegative(false)}
            dismissible
            actionLabel="Retry"
            onAction={() => setShowNegative(false)}
          />
        </div>

        <DemoRow label="Static examples">
          <div className="flex flex-col gap-2 w-full">
            <Snackbar message="Default snackbar with action" actionLabel="Undo" onAction={() => {}} duration={0} />
            <Snackbar message="Caution message" variant="caution" duration={0} />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

export function TypographySection() {
  return (
    <Section id="typography" title="Typography">
      <div className="flex flex-col gap-4">
        <Typography variant="headline-lg">Headline Large</Typography>
        <Typography variant="headline-md">Headline Medium</Typography>
        <Typography variant="headline-sm">Headline Small</Typography>
        <Separator />
        <Typography variant="title-lg">Title Large</Typography>
        <Typography variant="title-md">Title Medium</Typography>
        <Typography variant="title-sm">Title Small</Typography>
        <Separator />
        <Typography variant="body-lg">Body Large — Lorem ipsum dolor sit amet.</Typography>
        <Typography variant="body-md">Body Medium — Default text style for most content.</Typography>
        <Typography variant="body-sm">Body Small — Fine print and secondary details.</Typography>
        <Separator />
        <Typography variant="caption">Caption text</Typography>
        <Typography variant="overline">OVERLINE LABEL</Typography>
        <Typography variant="body-md" muted>Muted body text for secondary information.</Typography>
      </div>
    </Section>
  );
}

export function IconSection() {
  const star = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );

  return (
    <Section id="icon" title="Icon">
      <div className="flex flex-col gap-6">
        <DemoRow label="Sizes">
          <Icon size="xs" aria-label="Star xs">{star}</Icon>
          <Icon size="sm" aria-label="Star sm">{star}</Icon>
          <Icon size="md" aria-label="Star md">{star}</Icon>
          <Icon size="lg" aria-label="Star lg">{star}</Icon>
          <Icon size="xl" aria-label="Star xl">{star}</Icon>
        </DemoRow>
        <DemoRow label="Colors">
          <Icon color="default" aria-label="Default">{star}</Icon>
          <Icon color="primary" aria-label="Primary">{star}</Icon>
          <Icon color="muted" aria-label="Muted">{star}</Icon>
          <Icon color="success" aria-label="Success">{star}</Icon>
          <Icon color="warning" aria-label="Warning">{star}</Icon>
          <Icon color="error" aria-label="Error">{star}</Icon>
        </DemoRow>
      </div>
    </Section>
  );
}

export function ListItemSection() {
  const [selected, setSelected] = useState<string | null>('item2');

  const userIcon = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );

  return (
    <Section id="list-item" title="List Item">
      <div className="flex flex-col border border-su-outline-variant rounded-lg overflow-hidden divide-y divide-su-outline-variant max-w-md">
        <ListItem
          primary="Single-line item"
          leading={userIcon}
          onClick={() => setSelected('item1')}
          selected={selected === 'item1'}
        />
        <ListItem
          primary="Two-line item"
          secondary="Supporting text below"
          leading={userIcon}
          onClick={() => setSelected('item2')}
          selected={selected === 'item2'}
        />
        <ListItem
          primary="Three-line item"
          secondary="Second line of text"
          tertiary="Third line for extra detail"
          leading={userIcon}
          onClick={() => setSelected('item3')}
          selected={selected === 'item3'}
        />
        <ListItem
          primary="Disabled item"
          secondary="Cannot interact"
          leading={userIcon}
          disabled
        />
        <ListItem
          primary="Item with trailing"
          secondary="Has a trailing element"
          leading={userIcon}
          trailing={<span className="text-xs">Meta</span>}
        />
      </div>
    </Section>
  );
}

export function TextLockupSection() {
  return (
    <Section id="text-lockup" title="Text Lockup">
      <div className="flex flex-col gap-6">
        <DemoRow label="Small">
          <TextLockup size="sm" title="Card Title" subtitle="Supporting info" />
        </DemoRow>
        <DemoRow label="Medium (default)">
          <TextLockup title="Section Heading" subtitle="Description of this section" />
        </DemoRow>
        <DemoRow label="Large">
          <TextLockup size="lg" title="Page Title" subtitle="Detailed explanation below the heading" />
        </DemoRow>
        <DemoRow label="Centered">
          <div className="w-full">
            <TextLockup align="center" title="Centered Title" subtitle="Centered subtitle text" />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

export function IconLockupSection() {
  const settingsIcon = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
  const dbIcon = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
  const chartIcon = (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );

  return (
    <Section id="icon-lockup" title="Icon Lockup">
      <div className="flex flex-col gap-6">
        <DemoRow label="Horizontal">
          <IconLockup icon={settingsIcon} label="Settings" description="Manage preferences" />
          <IconLockup icon={dbIcon} label="Database" description="View connections" />
          <IconLockup icon={chartIcon} label="Analytics" description="View reports" />
        </DemoRow>
        <DemoRow label="Vertical">
          <div className="flex gap-8">
            <IconLockup icon={settingsIcon} label="Settings" layout="vertical" />
            <IconLockup icon={dbIcon} label="Database" layout="vertical" />
            <IconLockup icon={chartIcon} label="Analytics" layout="vertical" />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

export function MenuSection() {
  const editIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  );
  const copyIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
  const trashIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );

  return (
    <Section id="menu" title="Menu">
      <div className="flex gap-6">
        <Menu
          trigger={<Button variant="outline" size="sm">Actions</Button>}
          items={[
            { label: 'Edit', icon: editIcon },
            { label: 'Duplicate', icon: copyIcon },
            { label: 'Delete', icon: trashIcon, destructive: true },
          ]}
        />
        <Menu
          trigger={<Button variant="outline" size="sm">With disabled</Button>}
          items={[
            { label: 'Option A' },
            { label: 'Option B' },
            { label: 'Option C (disabled)', disabled: true },
          ]}
          align="end"
        />
      </div>
    </Section>
  );
}

export function ToolbarSection() {
  return (
    <Section id="toolbar" title="Toolbar">
      <div className="flex flex-col gap-4">
        <DemoRow label="Horizontal">
          <Toolbar aria-label="Text formatting" className="border border-su-outline-variant rounded-lg">
            <IconButton aria-label="Bold" size="sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
              </svg>
            </IconButton>
            <IconButton aria-label="Italic" size="sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" />
              </svg>
            </IconButton>
            <IconButton aria-label="Underline" size="sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" /><line x1="4" y1="21" x2="20" y2="21" />
              </svg>
            </IconButton>
            <ToolbarSeparator />
            <IconButton aria-label="Align left" size="sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
              </svg>
            </IconButton>
            <IconButton aria-label="Align center" size="sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="18" y1="18" x2="6" y2="18" />
              </svg>
            </IconButton>
          </Toolbar>
        </DemoRow>
        <DemoRow label="Vertical">
          <Toolbar orientation="vertical" aria-label="Drawing tools" className="border border-su-outline-variant rounded-lg">
            <IconButton aria-label="Select" size="sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              </svg>
            </IconButton>
            <IconButton aria-label="Move" size="sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
              </svg>
            </IconButton>
            <ToolbarSeparator className="!w-full !min-h-0 !h-px !mx-0 !my-1" />
            <IconButton aria-label="Zoom in" size="sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </IconButton>
          </Toolbar>
        </DemoRow>
      </div>
    </Section>
  );
}

export function StatusDialogSection() {
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);

  // Auto-close loading after 2 seconds
  React.useEffect(() => {
    if (loadingOpen) {
      const t = setTimeout(() => setLoadingOpen(false), 2000);
      return () => clearTimeout(t);
    }
  }, [loadingOpen]);

  return (
    <Section id="status-dialog" title="Status Dialog">
      <div className="flex flex-col gap-4">
        <DemoRow label="Trigger status dialogs">
          <Button variant="outline" size="sm" onClick={() => setLoadingOpen(true)}>Loading</Button>
          <Button variant="outline" size="sm" onClick={() => setSuccessOpen(true)}>Success</Button>
          <Button variant="outline" size="sm" onClick={() => setErrorOpen(true)}>Error</Button>
        </DemoRow>

        <StatusDialog
          open={loadingOpen}
          status="loading"
          title="Saving changes..."
          description="Please wait while we save your data."
        />
        <StatusDialog
          open={successOpen}
          onOpenChange={setSuccessOpen}
          status="success"
          title="Changes Saved"
          description="Your data has been saved successfully."
        />
        <StatusDialog
          open={errorOpen}
          onOpenChange={setErrorOpen}
          status="error"
          title="Save Failed"
          description="Unable to save your changes. Please try again."
          action={<Button variant="text" size="sm" onClick={() => setErrorOpen(false)}>Retry</Button>}
        />
      </div>
    </Section>
  );
}

export function SideSheetSection() {
  const [rightOpen, setRightOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);

  return (
    <Section id="side-sheet" title="Side Sheet">
      <div className="flex gap-4">
        <Button variant="outline" size="sm" onClick={() => setRightOpen(true)}>
          Open Right Sheet
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLeftOpen(true)}>
          Open Left Sheet
        </Button>

        <SideSheet
          open={rightOpen}
          onOpenChange={setRightOpen}
          title="Item Details"
          description="View and edit item properties"
          footer={
            <>
              <Button variant="text" size="sm" onClick={() => setRightOpen(false)}>Cancel</Button>
              <Button variant="default" size="sm" onClick={() => setRightOpen(false)}>Save</Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-foreground">
              This is a right-side sheet with a header, scrollable content, and footer actions.
            </p>
            <Separator />
            <FormField label="Name" htmlFor="ss-name">
              <Input id="ss-name" placeholder="Enter name" className="bg-surface-container" />
            </FormField>
            <FormField label="Description" htmlFor="ss-desc">
              <Input id="ss-desc" placeholder="Enter description" className="bg-surface-container" />
            </FormField>
          </div>
        </SideSheet>

        <SideSheet
          open={leftOpen}
          onOpenChange={setLeftOpen}
          side="left"
          title="Navigation"
          width={300}
        >
          <div className="flex flex-col gap-2">
            <ListItem primary="Dashboard" onClick={() => {}} />
            <ListItem primary="Settings" onClick={() => {}} />
            <ListItem primary="Profile" onClick={() => {}} />
            <ListItem primary="Help" onClick={() => {}} />
          </div>
        </SideSheet>
      </div>
    </Section>
  );
}

export function FullScreenDialogSection() {
  const [open, setOpen] = useState(false);

  return (
    <Section id="full-screen-dialog" title="Full Screen Dialog">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Open Full Screen Dialog
      </Button>

      <FullScreenDialog
        open={open}
        onOpenChange={setOpen}
        title="Application Settings"
        action={<Button variant="default" size="sm" onClick={() => setOpen(false)}>Save</Button>}
      >
        <div className="flex flex-col gap-6">
          <div>
            <Typography variant="title-md">General</Typography>
            <Typography variant="body-sm" muted>Configure general application settings.</Typography>
          </div>
          <Separator />
          <FormField label="Application Name" htmlFor="fsd-name">
            <Input id="fsd-name" defaultValue="My Application" className="bg-surface-container" />
          </FormField>
          <FormField label="Default Language" htmlFor="fsd-lang">
            <Input id="fsd-lang" defaultValue="English" className="bg-surface-container" />
          </FormField>
          <Separator />
          <div>
            <Typography variant="title-md">Notifications</Typography>
            <Typography variant="body-sm" muted>Manage notification preferences.</Typography>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Email notifications</span>
            <Switch defaultChecked aria-label="Email notifications" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Push notifications</span>
            <Switch aria-label="Push notifications" />
          </div>
        </div>
      </FullScreenDialog>
    </Section>
  );
}

export function FocusedPageSection() {
  return (
    <Section id="focused-page" title="Focused Page">
      <div className="border border-su-outline-variant rounded-lg overflow-hidden h-[300px]">
        <FocusedPage
          title="Account Settings"
          subtitle="Manage your account preferences"
          onBack={() => {}}
          breadcrumbs={[
            { label: 'Home', onClick: () => {} },
            { label: 'Account' },
            { label: 'Settings' },
          ]}
          headerActions={<Button variant="default" size="sm">Save</Button>}
          maxWidth={600}
        >
          <div className="flex flex-col gap-4">
            <FormField label="Display Name" htmlFor="fp-name">
              <Input id="fp-name" defaultValue="John Doe" className="bg-surface-container" />
            </FormField>
            <FormField label="Email" htmlFor="fp-email">
              <Input id="fp-email" defaultValue="john@example.com" className="bg-surface-container" />
            </FormField>
          </div>
        </FocusedPage>
      </div>
    </Section>
  );
}

export function TreeListSection() {
  const [selected, setSelected] = useState<string | undefined>('readme');

  const fileIcon = (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
  const folderIcon = (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );

  const treeData: TreeNode[] = [
    {
      id: 'src',
      label: 'src',
      icon: folderIcon,
      children: [
        {
          id: 'components',
          label: 'components',
          icon: folderIcon,
          children: [
            { id: 'button', label: 'Button.tsx', icon: fileIcon },
            { id: 'input', label: 'Input.tsx', icon: fileIcon },
            { id: 'dialog', label: 'Dialog.tsx', icon: fileIcon },
          ],
        },
        { id: 'index', label: 'index.ts', icon: fileIcon },
        { id: 'utils', label: 'utils.ts', icon: fileIcon },
      ],
    },
    { id: 'package', label: 'package.json', icon: fileIcon },
    { id: 'readme', label: 'README.md', icon: fileIcon },
  ];

  return (
    <Section id="tree-list" title="Tree List">
      <div className="border border-su-outline-variant rounded-lg p-2 max-w-sm">
        <TreeList
          nodes={treeData}
          selectedId={selected}
          onSelect={setSelected}
        />
      </div>
    </Section>
  );
}

// ── Onboarding Cards ──────────────────────────────────────────────────────

export function OnboardingCardsSection() {
  const [collapsed, setCollapsed] = useState(false);

  const taskIcon = (
    <svg className="w-8 h-8 text-tertiary" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M8 4l8 6-8 6V4z" />
      <circle cx="22" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="22" width="20" height="4" rx="2" />
    </svg>
  );

  const incompleteCards: OnboardingCard[] = [
    { id: 'profile', title: 'Setup Profile', description: 'Configure your display name, avatar, and preferences.', ctaLabel: 'Configure', icon: taskIcon },
    { id: 'connect', title: 'Connect Data', description: 'Link your databases and APIs to start querying.', ctaLabel: 'Connect', icon: taskIcon },
    { id: 'dashboard', title: 'Create Dashboard', description: 'Build your first interactive dashboard from templates.', ctaLabel: 'Create', icon: taskIcon },
    { id: 'invite', title: 'Invite Team', description: 'Add collaborators to share insights.', ctaLabel: 'Invite', icon: taskIcon },
    { id: 'explore', title: 'Explore Features', description: 'Take a guided tour of SQL editor, charts, and more.', ctaLabel: 'Tour', icon: taskIcon },
    { id: 'learn', title: 'Learning Resources', description: 'Browse docs, tutorials, and example notebooks.', ctaLabel: 'Browse', icon: taskIcon },
  ];

  const completedCards: OnboardingCard[] = incompleteCards.map((c) => ({
    ...c,
    state: 'complete' as const,
  }));

  return (
    <Section id="onboarding-cards" title="Onboarding Cards">
      <div className="flex flex-col gap-6">
        <DemoRow label="Incomplete (with scroll)">
          <div className="w-full">
            <OnboardingCards
              cards={incompleteCards}
              heading="Get started with SurfacesUI"
              onSkipAll={() => alert('Skip all')}
              collapsed={collapsed}
              onToggleCollapse={() => setCollapsed(!collapsed)}
            />
          </div>
        </DemoRow>

        <DemoRow label="All completed">
          <div className="w-full">
            <OnboardingCards
              cards={completedCards}
              completed
              onDismiss={() => alert('Dismissed')}
              completionDescription="We provide all of our resources under Learn to help you succeed every step of the way."
            />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

// ── Notebook Cell ─────────────────────────────────────────────────────────

export function NotebookCellSection() {
  const [codeValue, setCodeValue] = useState('SELECT *\nFROM customers\nWHERE active = true\nLIMIT 10;');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <Section id="notebook-cell" title="Notebook Cell">
      <div className="flex flex-col gap-2 max-w-3xl">
        <DemoRow label="Default (code, editable)">
          <div className="w-full">
            <NotebookCell
              type="code"
              value={codeValue}
              onValueChange={setCodeValue}
              executionCount={1}
              selected={selectedId === 'edit'}
              onSelect={() => setSelectedId('edit')}
              onRun={() => alert('Run!')}
            />
          </div>
        </DemoRow>

        <DemoRow label="Running">
          <div className="w-full">
            <NotebookCell
              type="code"
              value="import pandas as pd\ndf = pd.read_csv('data.csv')\ndf.describe()"
              status="running"
            />
          </div>
        </DemoRow>

        <DemoRow label="Selected with count">
          <div className="w-full">
            <NotebookCell
              type="code"
              value="print('Hello, world!')"
              status="success"
              executionCount={3}
              selected
            />
          </div>
        </DemoRow>

        <DemoRow label="Error alert">
          <div className="w-full">
            <NotebookCell
              type="code"
              value="SELECT * FROM missing_table;"
              status="error"
              executionCount={4}
              error={{
                title: 'Query failed',
                description: 'Table "missing_table" does not exist.',
                actions: <button type="button" className="text-sm font-medium px-3 py-1">Retry</button>,
              }}
            />
          </div>
        </DemoRow>

        <DemoRow label="Rendered markdown">
          <div className="w-full">
            <NotebookCell
              type="markdown"
              value="# Welcome to your new notebook"
              renderedOutput={
                <div>
                  <h2 className="text-2xl font-normal leading-9 text-foreground mb-3">
                    Welcome to your new notebook
                  </h2>
                  <p className="text-base leading-6 text-foreground">
                    Type here in the cell editor to add code!
                  </p>
                </div>
              }
            />
          </div>
        </DemoRow>

        <DemoRow label="Custom editor slot">
          <div className="w-full">
            <NotebookCell
              type="code"
              value=""
              editor={
                <div className="text-sm font-mono text-on-surface-variant italic p-2 border border-dashed border-su-outline-variant rounded">
                  Custom editor slot (e.g. Monaco, CodeMirror)
                </div>
              }
            />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

// ── Data Table Section ────────────────────────────────────────────────────

interface TeamMember {
  id: number;
  name: string;
  role: string;
  department: string;
  sessions: number;
  [key: string]: unknown;
}

const TEAM_DATA: TeamMember[] = [
  { id: 1, name: 'Alice Chen', role: 'Admin', department: 'Engineering', sessions: 142 },
  { id: 2, name: 'Bob Martinez', role: 'Editor', department: 'Product', sessions: 87 },
  { id: 3, name: 'Carol Davis', role: 'Viewer', department: 'Marketing', sessions: 23 },
  { id: 4, name: 'David Kim', role: 'Admin', department: 'Engineering', sessions: 256 },
  { id: 5, name: 'Eva Patel', role: 'Editor', department: 'Design', sessions: 64 },
  { id: 6, name: 'Frank Wilson', role: 'Viewer', department: 'Sales', sessions: 11 },
];

const DENSITY_OPTIONS: TableDensity[] = ['default', 'comfortable', 'compact', 'dense'];

export function DataTableSection() {
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(new Set([1, 3]));
  const [sort, setSort] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(null);
  const [density, setDensity] = useState<TableDensity>('default');

  const columns: DataTableColumn<TeamMember>[] = [
    { id: '_select', type: 'checkbox' },
    { id: 'name', header: 'Name', type: 'text', sortable: true },
    { id: 'role', header: 'Role', type: 'text', sortable: true },
    { id: 'department', header: 'Department', type: 'text' },
    { id: 'sessions', header: 'Sessions', type: 'number', sortable: true },
    { id: '_actions', type: 'actions' },
  ];

  const rowActions: RowAction<TeamMember>[] = [
    { label: 'Edit', onClick: () => {} },
    { label: 'Duplicate', onClick: () => {} },
    { label: 'Delete', destructive: true, onClick: () => {} },
  ];

  return (
    <Section id="data-table" title="Data Table">
      <div className="flex flex-col gap-4">
        <DemoRow label="Density">
          <div className="flex gap-2">
            {DENSITY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDensity(d)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  density === d
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-on-surface-variant border-su-outline-variant hover:border-on-surface-variant'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </DemoRow>

        <DemoRow label="Full-featured (selection, sorting, actions)">
          <div className="w-full">
            <DataTable
              data={TEAM_DATA}
              columns={columns}
              density={density}
              height={350}
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              getRowKey={(row: TeamMember) => row.id}
              sort={sort}
              onSortChange={setSort}
              rowActions={rowActions}
              aria-label="Team members"
            />
          </div>
        </DemoRow>

        <DemoRow label="Empty state">
          <div className="w-full">
            <DataTable
              data={[]}
              columns={columns}
              height={200}
              aria-label="Empty table"
            />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

/* ── Tabs Section ─────────────────────────────────────────────────────── */

export function TabsSection() {
  return (
    <Section id="tabs" title="Tabs">
      <div className="flex flex-col gap-6">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="p-4 text-sm text-on-surface-variant">
              Overview content — displays general information and key metrics.
            </div>
          </TabsContent>
          <TabsContent value="analytics">
            <div className="p-4 text-sm text-on-surface-variant">
              Analytics content — charts and performance data.
            </div>
          </TabsContent>
          <TabsContent value="settings">
            <div className="p-4 text-sm text-on-surface-variant">
              Settings content — configuration options.
            </div>
          </TabsContent>
        </Tabs>

        <DemoRow label="Disabled tab">
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="disabled" disabled>Disabled</TabsTrigger>
              <TabsTrigger value="another">Another</TabsTrigger>
            </TabsList>
          </Tabs>
        </DemoRow>
      </div>
    </Section>
  );
}

/* ── Tooltip Section ──────────────────────────────────────────────────── */

export function TooltipSection() {
  return (
    <Section id="tooltip" title="Tooltip">
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-col gap-6">
          <DemoRow label="Basic">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>Single-line tooltip</TooltipContent>
            </Tooltip>
          </DemoRow>

          <DemoRow label="Placement">
            <div className="flex gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm">Top</Button>
                </TooltipTrigger>
                <TooltipContent side="top">Tooltip on top</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm">Bottom</Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Tooltip on bottom</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm">Left</Button>
                </TooltipTrigger>
                <TooltipContent side="left">Tooltip on left</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm">Right</Button>
                </TooltipTrigger>
                <TooltipContent side="right">Tooltip on right</TooltipContent>
              </Tooltip>
            </div>
          </DemoRow>

          <DemoRow label="Multi-line">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm">Multi-line</Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                This is a longer tooltip that wraps to multiple lines for detailed information.
              </TooltipContent>
            </Tooltip>
          </DemoRow>
        </div>
      </TooltipProvider>
    </Section>
  );
}

// ── Flow Components ───────────────────────────────────────────────────────

export function FlowNodeSection() {
  return (
    <Section id="flow-node" title="Flow Node">
      <div className="flex flex-col gap-6">
        <DemoRow label="Variants">
          <div className="grid grid-cols-3 gap-4">
            <FlowNode label="Default" description="A default node" variant="default" sourceHandle={false} targetHandle={false} />
            <FlowNode label="Info" description="Primary info node" variant="info" sourceHandle={false} targetHandle={false} />
            <FlowNode label="Positive" description="Success state" variant="positive" sourceHandle={false} targetHandle={false} />
            <FlowNode label="Warning" description="Attention needed" variant="warning" sourceHandle={false} targetHandle={false} />
            <FlowNode label="Error" description="Error state" variant="error" sourceHandle={false} targetHandle={false} />
            <FlowNode label="Purple" description="Tertiary accent" variant="purple" sourceHandle={false} targetHandle={false} />
          </div>
        </DemoRow>

        <DemoRow label="With Icon & Status">
          <div className="grid grid-cols-2 gap-4">
            <FlowNode
              icon={<Database className="h-4 w-4 text-primary" />}
              label="Database Source"
              description="Connect to Teradata"
              variant="info"
              status={<Badge variant="secondary" className="text-xs">Connected</Badge>}
              sourceHandle={false}
              targetHandle={false}
            />
            <FlowNode
              icon={<Brain className="h-4 w-4 text-tertiary" />}
              label="ML Model"
              description="Classification model"
              variant="purple"
              status={<Badge variant="secondary" className="text-xs">Ready</Badge>}
              sourceHandle={false}
              targetHandle={false}
            />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

// ── Sample data for palette/editor demos ─────────────────────────────────

const SAMPLE_CATEGORIES: PaletteCategory[] = [
  {
    id: 'input',
    label: 'Input',
    items: [
      { id: 'csv', label: 'CSV Data', description: 'Upload data files', icon: <Upload className="h-4 w-4 text-primary" />, variant: 'info' as const },
      { id: 'database', label: 'Database', description: 'Connect to database', icon: <Database className="h-4 w-4 text-primary" />, variant: 'info' as const },
    ],
    defaultExpanded: true,
  },
  {
    id: 'processing',
    label: 'Processing',
    items: [
      { id: 'transform', label: 'Transform', description: 'Data transformation', icon: <GitBranch className="h-4 w-4 text-positive" />, variant: 'positive' as const },
      { id: 'model', label: 'ML Model', description: 'Train or score', icon: <Brain className="h-4 w-4 text-tertiary" />, variant: 'purple' as const },
    ],
    defaultExpanded: true,
  },
  {
    id: 'output',
    label: 'Output',
    items: [
      { id: 'chart', label: 'Visualization', description: 'Chart output', icon: <BarChart3 className="h-4 w-4 text-warning" />, variant: 'warning' as const },
      { id: 'api', label: 'API Endpoint', description: 'Deploy output', icon: <Zap className="h-4 w-4 text-warning" />, variant: 'warning' as const },
    ],
  },
];

export function NodePaletteSection() {
  return (
    <Section id="node-palette" title="Node Palette">
      <div className="flex flex-col gap-6">
        <DemoRow label="Interactive palette">
          <div className="h-[400px] w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <NodePalette
              title="Components"
              description="Click to add nodes"
              categories={SAMPLE_CATEGORIES}
              onItemClick={(item) => console.log('Palette item clicked:', item.id)}
              footer={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">Clear</Button>
                  <Button size="sm" className="flex-1">Run</Button>
                </div>
              }
            />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

export function FlowEditorSection() {
  return (
    <Section id="flow-editor" title="Flow Editor">
      <div className="flex flex-col gap-6">
        <DemoRow label="Interactive workflow editor">
          <div className="h-[500px] w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <FlowEditor
              paletteTitle="Workflow"
              paletteDescription="Click items to add nodes"
              categories={SAMPLE_CATEGORIES}
            />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

const SAMPLE_AGENT_STEPS: AgentStep[] = [
  { id: 'step-1', name: 'Data Discovery', agentId: 'db-discovery', status: 'completed', stepNumber: 1 },
  { id: 'step-2', name: 'SQL Generation', agentId: 'sql-generator', status: 'completed', stepNumber: 2, dependsOn: ['step-1'] },
  { id: 'step-3', name: 'Error Recovery', agentId: 'error-recovery', status: 'running', stepNumber: 3, dependsOn: ['step-2'] },
  { id: 'step-4', name: 'UI Generation', agentId: 'ui-generator', status: 'pending', stepNumber: 4, dependsOn: ['step-2'] },
  { id: 'step-5', name: 'Report Builder', agentId: 'report-builder', status: 'pending', stepNumber: 5, dependsOn: ['step-3', 'step-4'] },
];

export function AgentFlowViewSection() {
  return (
    <Section id="agent-flow-view" title="Agent Flow View">
      <div className="flex flex-col gap-6">
        <DemoRow label="Agent orchestration DAG">
          <div className="h-[400px] w-full border border-su-outline-variant rounded-lg overflow-hidden">
            <AgentFlowView
              steps={SAMPLE_AGENT_STEPS}
              onAgentClick={(id) => console.log('Agent clicked:', id)}
            />
          </div>
        </DemoRow>

        <DemoRow label="Empty state">
          <div className="h-[200px] w-full">
            <AgentFlowView steps={[]} />
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

// ── SQL Visual Explain ────────────────────────────────────────────────────

const explainNodeTypes = { explainPlanNode: ExplainPlanNode };

export function SqlVisualExplainSection() {
  const [selectedNode, setSelectedNode] = React.useState<ExplainNode | null>(null);
  const [selectedCostLevel, setSelectedCostLevel] = React.useState<CostLevel>('low');

  const rawNodes = React.useMemo(() => planToNodes(SAMPLE_PLAN), []);
  const rawEdges = React.useMemo(() => planToEdges(SAMPLE_PLAN), []);

  const { nodes, edges } = useAutoLayout(rawNodes, rawEdges, {
    direction: 'TB',
    nodeWidth: 280,
    nodeHeight: 140,
    nodeSpacing: 60,
    rankSpacing: 100,
  });

  const handleNodeClick = React.useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const data = node.data as ExplainNodeData;
      setSelectedNode(data.explainNode);
      setSelectedCostLevel(data.costLevel);
    },
    [],
  );

  return (
    <Section id="sql-visual-explain" title="SQL Visual Explain">
      <div className="flex flex-col gap-4">
        {/* Query */}
        <pre className="text-xs font-mono text-foreground bg-muted/30 rounded-lg p-3 overflow-x-auto max-h-24 leading-relaxed border border-su-outline-variant">
          {SAMPLE_SQL}
        </pre>

        {/* Canvas + Detail Panel */}
        <div className="flex border border-su-outline-variant rounded-lg overflow-hidden" style={{ height: 500 }}>
          <div className="flex-1 min-w-0">
            <FlowCanvas
              nodes={nodes}
              edges={edges}
              nodeTypes={explainNodeTypes}
              onNodeClick={handleNodeClick}
              interactive={false}
              fitView
              showControls
              showBackground
              defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
            />
          </div>
          {selectedNode && (
            <NodeDetailPanel
              node={selectedNode}
              costLevel={selectedCostLevel}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Click any node to view detailed EXPLAIN ANALYZE statistics in the side panel.
        </p>
      </div>
    </Section>
  );
}
