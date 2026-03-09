/**
 * Component Playground Registry
 *
 * Maps component schema names to React render functions
 * for live interactive preview in the playground.
 */

import * as React from 'react';

// Primitives
import { Button } from '../primitives/button';
import { Alert } from '../primitives/alert';
import { Badge } from '../primitives/badge';
import { Checkbox } from '../primitives/checkbox';
import { Input } from '../primitives/input';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '../primitives/select';
import { RadioGroup, RadioGroupItem } from '../primitives/radio-group';
import { Separator } from '../primitives/separator';
import { Slider } from '../primitives/slider';
import { Switch } from '../primitives/switch';
import { Progress } from '../primitives/progress';
import { CircularProgress } from '../primitives/circular-progress';
import { Typography } from '../primitives/typography';
import { Icon } from '../primitives/icon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../primitives/tabs';
import {
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
} from '../primitives/tooltip';
import { ListItem } from '../primitives/list-item';
import {
  Dialog, DialogContent, DialogHeader, DialogBody,
  DialogFooter, DialogTitle, DialogDescription, DialogTrigger,
} from '../primitives/dialog';
import { Label } from '../primitives/label';

// Molecules
import { IconButton } from '../molecules/icon-button';
import { FormField } from '../molecules/form-field';
import { FilterChip } from '../molecules/chip';
import { CodeSnippet } from '../molecules/code-snippet';
import { Snackbar } from '../molecules/snackbar';
import { ActionRibbon } from '../molecules/action-ribbon';
import { EmptyState } from '../molecules/empty-state';
import { TextLockup } from '../molecules/text-lockup';
import { IconLockup } from '../molecules/icon-lockup';
import { Menu } from '../molecules/menu';
import { Toolbar, ToolbarSeparator } from '../molecules/toolbar';
import { StatusDialog } from '../molecules/status-dialog';

// Organisms
import { SideSheet } from '../organisms/side-sheet';
import { FullScreenDialog } from '../organisms/full-screen-dialog';
import { FocusedPage } from '../organisms/focused-page';
import { TreeList } from '../organisms/tree-list';
import type { TreeNode } from '../organisms/tree-list';
import { OnboardingCards } from '../organisms/onboarding-cards';
import type { OnboardingCard } from '../organisms/onboarding-cards';
import { NotebookCell } from '../organisms/notebook-cell';
import { DataTable } from '../organisms/data-table';
import type { DataTableColumn } from '../organisms/data-table';

// Icons
import {
  Search, Download, Settings, Copy,
  ChevronRight, File, Folder, Trash2,
  Bold, Italic, Underline, AlignLeft, Database, User,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

type RenderFn = (props: Record<string, unknown>) => React.ReactNode;

export interface RegistryEntry {
  render: RenderFn;
  defaultProps: Record<string, unknown>;
}

// ── Sample Data ───────────────────────────────────────────────────────────

const SAMPLE_TREE: TreeNode[] = [
  { id: '1', label: 'src', icon: <Folder className="h-4 w-4" />, children: [
    { id: '1.1', label: 'components', icon: <Folder className="h-4 w-4" />, children: [
      { id: '1.1.1', label: 'Button.tsx', icon: <File className="h-4 w-4" /> },
      { id: '1.1.2', label: 'Alert.tsx', icon: <File className="h-4 w-4" /> },
    ]},
    { id: '1.2', label: 'index.ts', icon: <File className="h-4 w-4" /> },
  ]},
];

const SAMPLE_COLUMNS: DataTableColumn[] = [
  { id: 'id', header: 'ID', type: 'number', width: 60 },
  { id: 'name', header: 'Name', type: 'text' },
  { id: 'email', header: 'Email', type: 'text' },
  { id: 'role', header: 'Role', type: 'text' },
];

const SAMPLE_TABLE_DATA = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Engineer' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'Designer' },
  { id: 3, name: 'Carol Lee', email: 'carol@example.com', role: 'Manager' },
  { id: 4, name: 'David Park', email: 'david@example.com', role: 'Analyst' },
];

const SAMPLE_CARDS: OnboardingCard[] = [
  { id: '1', title: 'Create a connection', description: 'Connect to your database', state: 'complete' },
  { id: '2', title: 'Write a query', description: 'Use AI to generate SQL', state: 'incomplete' },
  { id: '3', title: 'Explore results', description: 'Charts, tables, and more', state: 'unavailable' },
];

const SAMPLE_SQL = `SELECT
  department,
  COUNT(*) as employee_count,
  AVG(salary) as avg_salary
FROM employees
GROUP BY department
ORDER BY avg_salary DESC;`;

// ── Stateful Preview Wrappers ─────────────────────────────────────────────

function DialogPreview(props: Record<string, unknown>) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{(props.title as string) || 'Dialog Title'}</DialogTitle>
          <DialogDescription>{(props.description as string) || 'This is a dialog description.'}</DialogDescription>
        </DialogHeader>
        <DialogBody><p className="text-sm text-on-surface-variant">Dialog content goes here.</p></DialogBody>
        <DialogFooter>
          <Button variant="text" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => setOpen(false)}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SnackbarPreview(props: Record<string, unknown>) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>Show Snackbar</Button>
      <Snackbar
        open={open}
        onDismiss={() => setOpen(false)}
        message={(props.message as string) || 'Operation completed'}
        variant={(props.variant as 'default' | 'positive' | 'negative') || 'default'}
        actionLabel={(props.actionLabel as string) || undefined}
        dismissible
      />
    </div>
  );
}

function StatusDialogPreview(props: Record<string, unknown>) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>Show Status</Button>
      <StatusDialog
        open={open}
        onOpenChange={setOpen}
        status={(props.status as 'loading' | 'success' | 'error') || 'success'}
        title={(props.title as string) || 'Operation Complete'}
        description={(props.description as string) || 'Your changes have been saved.'}
        action={<Button onClick={() => setOpen(false)}>Dismiss</Button>}
      />
    </div>
  );
}

function SideSheetPreview(props: Record<string, unknown>) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>Open Side Sheet</Button>
      <SideSheet
        open={open}
        onOpenChange={setOpen}
        side={(props.side as 'left' | 'right') || 'right'}
        title={(props.title as string) || 'Details'}
      >
        <p className="p-4 text-sm text-on-surface-variant">Side sheet content.</p>
      </SideSheet>
    </div>
  );
}

function FullScreenDialogPreview(props: Record<string, unknown>) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>Open Full Screen</Button>
      <FullScreenDialog
        open={open}
        onOpenChange={setOpen}
        title={(props.title as string) || 'Full Screen Dialog'}
      >
        <p className="text-sm text-on-surface-variant p-4">Full screen content here.</p>
      </FullScreenDialog>
    </div>
  );
}

function FocusedPagePreview(props: Record<string, unknown>) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>Open Focused Page</Button>
      {open && (
        <div className="fixed inset-0 z-50">
          <FocusedPage
            title={(props.title as string) || 'Focused Page'}
            onBack={() => setOpen(false)}
            breadcrumbs={[{ label: 'Home' }, { label: 'Settings' }]}
          >
            <p className="text-sm text-on-surface-variant p-4">Page content.</p>
          </FocusedPage>
        </div>
      )}
    </div>
  );
}

function TooltipPreview(props: Record<string, unknown>) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Hover me</Button>
        </TooltipTrigger>
        <TooltipContent side={(props.side as 'top' | 'bottom' | 'left' | 'right') || 'top'}>
          {(props.content as string) || 'Tooltip text'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Component Registry ────────────────────────────────────────────────────

export const COMPONENT_REGISTRY: Record<string, RegistryEntry> = {
  // ── Actions ─────────────────────────────────────────────────────────────
  Button: {
    defaultProps: { variant: 'default', size: 'default', density: 'compact', disabled: false, children: 'Click Me' },
    render: (p) => (
      <Button variant={p.variant as any} size={p.size as any} density={p.density as any} disabled={p.disabled as boolean}>
        {(p.children as string) || 'Click Me'}
      </Button>
    ),
  },
  IconButton: {
    defaultProps: { variant: 'standard', size: 'md', disabled: false },
    render: (p) => (
      <IconButton variant={p.variant as any} size={p.size as any} disabled={p.disabled as boolean} aria-label="Settings">
        <Settings className="h-5 w-5" />
      </IconButton>
    ),
  },
  ActionRibbon: {
    defaultProps: { state: 'active', label: 'Editing row 5' },
    render: (p) => (
      <div className="w-full border border-su-outline-variant rounded-lg overflow-hidden">
        <ActionRibbon state={p.state as any} label={p.label as string}
          actions={p.state === 'active' ? [
            <Button key="s" size="sm">Save</Button>,
            <Button key="c" variant="text" size="sm">Cancel</Button>,
          ] : undefined}
        />
      </div>
    ),
  },

  // ── Feedback ────────────────────────────────────────────────────────────
  Alert: {
    defaultProps: { variant: 'secondary', mode: 'inline', title: 'Heads up!' },
    render: (p) => (
      <Alert variant={p.variant as any} mode={p.mode as any} title={(p.title as string) || 'Alert'}
        description="This is an alert with important information." />
    ),
  },
  Dialog: {
    defaultProps: { title: 'Dialog Title', description: 'This is a dialog description.' },
    render: (p) => <DialogPreview {...p} />,
  },
  CircularProgress: {
    defaultProps: { value: 65, size: 'md', showLabel: true },
    render: (p) => <CircularProgress value={p.value as number} size={p.size as any} showLabel={p.showLabel as boolean} />,
  },
  Progress: {
    defaultProps: { value: 60 },
    render: (p) => <Progress value={p.value as number} className="w-64" />,
  },
  EmptyState: {
    defaultProps: { title: 'No results found', description: 'Try adjusting your search criteria.' },
    render: (p) => (
      <EmptyState title={p.title as string} description={p.description as string}
        icon={<Search className="h-12 w-12" />} />
    ),
  },
  Snackbar: {
    defaultProps: { message: 'File saved successfully', variant: 'default', actionLabel: 'Undo' },
    render: (p) => <SnackbarPreview {...p} />,
  },
  StatusDialog: {
    defaultProps: { status: 'success', title: 'Operation Complete', description: 'Changes saved.' },
    render: (p) => <StatusDialogPreview {...p} />,
  },
  FullScreenDialog: {
    defaultProps: { title: 'Full Screen Dialog' },
    render: (p) => <FullScreenDialogPreview {...p} />,
  },

  // ── Layout ──────────────────────────────────────────────────────────────
  Separator: {
    defaultProps: { orientation: 'horizontal' },
    render: (p) => (
      <div className={p.orientation === 'vertical' ? 'h-12' : 'w-64'}>
        <Separator orientation={p.orientation as any} />
      </div>
    ),
  },
  SideSheet: {
    defaultProps: { side: 'right', title: 'Details' },
    render: (p) => <SideSheetPreview {...p} />,
  },
  FocusedPage: {
    defaultProps: { title: 'Focused Page' },
    render: (p) => <FocusedPagePreview {...p} />,
  },
  OnboardingCards: {
    defaultProps: {},
    render: () => <OnboardingCards cards={SAMPLE_CARDS} />,
  },

  // ── Data Display ────────────────────────────────────────────────────────
  Badge: {
    defaultProps: { variant: 'default', children: 'Badge' },
    render: (p) => <Badge variant={p.variant as any}>{(p.children as string) || 'Badge'}</Badge>,
  },
  FilterChip: {
    defaultProps: { label: 'Active', selected: false },
    render: (p) => <FilterChip label={p.label as string} selected={p.selected as boolean} />,
  },
  ListItem: {
    defaultProps: { primary: 'List Item', secondary: 'Supporting text' },
    render: (p) => (
      <div className="w-80 border border-su-outline-variant rounded-lg overflow-hidden">
        <ListItem primary={p.primary as string} secondary={p.secondary as string}
          leading={<Icon size="md"><User className="h-5 w-5" /></Icon>} />
      </div>
    ),
  },
  TreeList: {
    defaultProps: {},
    render: () => (
      <div className="w-64 border border-su-outline-variant rounded-lg overflow-hidden">
        <TreeList nodes={SAMPLE_TREE} />
      </div>
    ),
  },
  DataTable: {
    defaultProps: { density: 'comfortable' },
    render: (p) => (
      <div className="w-full border border-su-outline-variant rounded-lg overflow-hidden">
        <DataTable columns={SAMPLE_COLUMNS} data={SAMPLE_TABLE_DATA}
          density={p.density as any} height={250} />
      </div>
    ),
  },
  NotebookCell: {
    defaultProps: { type: 'code', status: 'idle' },
    render: (p) => (
      <div className="w-full">
        <NotebookCell type={p.type as any} status={p.status as any}
          value={SAMPLE_SQL} />
      </div>
    ),
  },

  // ── Inputs ──────────────────────────────────────────────────────────────
  Input: {
    defaultProps: { placeholder: 'Enter text...', disabled: false, type: 'text', density: 'compact' },
    render: (p) => (
      <Input placeholder={p.placeholder as string} disabled={p.disabled as boolean}
        type={p.type as string} density={p.density as any} className="w-64" />
    ),
  },
  Textarea: {
    defaultProps: { placeholder: 'Type here...', disabled: false },
    render: (p) => (
      <textarea
        className="flex min-h-[80px] w-64 rounded-lg border border-su-outline-variant bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        placeholder={p.placeholder as string}
        disabled={p.disabled as boolean}
      />
    ),
  },
  Select: {
    defaultProps: { density: 'compact' },
    render: (p) => (
      <Select density={p.density as any}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="opt1">Option 1</SelectItem>
          <SelectItem value="opt2">Option 2</SelectItem>
          <SelectItem value="opt3">Option 3</SelectItem>
        </SelectContent>
      </Select>
    ),
  },
  Checkbox: {
    defaultProps: { disabled: false },
    render: (p) => (
      <div className="flex items-center gap-2">
        <Checkbox id="demo-cb" disabled={p.disabled as boolean} />
        <Label htmlFor="demo-cb">Accept terms</Label>
      </div>
    ),
  },
  RadioGroup: {
    defaultProps: { disabled: false },
    render: (p) => (
      <RadioGroup defaultValue="opt1" disabled={p.disabled as boolean}>
        <div className="flex items-center gap-2"><RadioGroupItem value="opt1" id="r1" /><Label htmlFor="r1">Option 1</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="opt2" id="r2" /><Label htmlFor="r2">Option 2</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="opt3" id="r3" /><Label htmlFor="r3">Option 3</Label></div>
      </RadioGroup>
    ),
  },
  FormField: {
    defaultProps: { label: 'Email Address', helperText: 'We will never share your email.', required: true },
    render: (p) => (
      <FormField label={p.label as string} helperText={p.helperText as string} required={p.required as boolean}>
        <Input placeholder="you@example.com" className="w-64" />
      </FormField>
    ),
  },
  Switch: {
    defaultProps: { disabled: false },
    render: (p) => (
      <div className="flex items-center gap-3">
        <Switch id="demo-sw" disabled={p.disabled as boolean} />
        <Label htmlFor="demo-sw">Dark mode</Label>
      </div>
    ),
  },
  Slider: {
    defaultProps: { min: 0, max: 100, step: 1, disabled: false },
    render: (p) => (
      <Slider defaultValue={50} min={p.min as number} max={p.max as number}
        step={p.step as number} disabled={p.disabled as boolean} className="w-64" />
    ),
  },

  // ── Navigation ──────────────────────────────────────────────────────────
  Tabs: {
    defaultProps: {},
    render: () => (
      <Tabs defaultValue="tab1" className="w-80">
        <TabsList>
          <TabsTrigger value="tab1">Overview</TabsTrigger>
          <TabsTrigger value="tab2">Details</TabsTrigger>
          <TabsTrigger value="tab3">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1"><p className="p-4 text-sm text-on-surface-variant">Overview content</p></TabsContent>
        <TabsContent value="tab2"><p className="p-4 text-sm text-on-surface-variant">Details content</p></TabsContent>
        <TabsContent value="tab3"><p className="p-4 text-sm text-on-surface-variant">Settings content</p></TabsContent>
      </Tabs>
    ),
  },
  Menu: {
    defaultProps: {},
    render: () => (
      <Menu
        trigger={<Button variant="outline">Actions <ChevronRight className="ml-1 h-4 w-4" /></Button>}
        items={[
          { label: 'Copy', icon: <Copy className="h-4 w-4" />, onClick: () => {} },
          { label: 'Download', icon: <Download className="h-4 w-4" />, onClick: () => {} },
          { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, onClick: () => {}, destructive: true },
        ]}
      />
    ),
  },
  Toolbar: {
    defaultProps: {},
    render: () => (
      <Toolbar>
        <IconButton variant="standard" size="sm" aria-label="Bold"><Bold className="h-4 w-4" /></IconButton>
        <IconButton variant="standard" size="sm" aria-label="Italic"><Italic className="h-4 w-4" /></IconButton>
        <IconButton variant="standard" size="sm" aria-label="Underline"><Underline className="h-4 w-4" /></IconButton>
        <ToolbarSeparator />
        <IconButton variant="standard" size="sm" aria-label="Align"><AlignLeft className="h-4 w-4" /></IconButton>
      </Toolbar>
    ),
  },

  // ── Content ─────────────────────────────────────────────────────────────
  Tooltip: {
    defaultProps: { content: 'Helpful tooltip text', side: 'top' },
    render: (p) => <TooltipPreview {...p} />,
  },
  Typography: {
    defaultProps: { variant: 'body-md', children: 'The quick brown fox jumps over the lazy dog.' },
    render: (p) => <Typography variant={p.variant as any}>{(p.children as string) || 'Sample text'}</Typography>,
  },
  Icon: {
    defaultProps: { size: 'md' },
    render: (p) => <Icon size={p.size as any}><Database className="h-5 w-5" /></Icon>,
  },
  IconLockup: {
    defaultProps: { label: 'Database', layout: 'horizontal' },
    render: (p) => (
      <IconLockup
        icon={<Icon size="md"><Database className="h-5 w-5" /></Icon>}
        label={p.label as string}
        layout={p.layout as any}
      />
    ),
  },
  TextLockup: {
    defaultProps: { title: 'Headline', subtitle: 'Supporting text', size: 'md' },
    render: (p) => (
      <TextLockup title={p.title as string} subtitle={p.subtitle as string} size={p.size as any} />
    ),
  },
  CodeSnippet: {
    defaultProps: { language: 'sql', filename: 'query.sql', copyable: true, maxHeight: '200px' },
    render: (p) => (
      <CodeSnippet code={SAMPLE_SQL} language={p.language as string}
        filename={p.filename as string} copyable={p.copyable as boolean}
        maxHeight={p.maxHeight as string} />
    ),
  },
};
