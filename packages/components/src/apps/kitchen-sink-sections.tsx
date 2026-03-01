/**
 * SurfacesUI Kitchen Sink — Section Components
 *
 * Individual section renderers for the dark-mode kitchen sink.
 * Implements Figma node 25796:15712 (file Yl9Vh9sloq2VxueDt3Majm).
 */

import * as React from 'react';

// ── Library imports ─────────────────────────────────────────────────────────
import { Alert, AlertTitle, AlertDescription } from '../primitives/alert';
import { Badge, NotificationBadge } from '../primitives/badge';
import { Button } from '../primitives/button';
import { Checkbox } from '../primitives/checkbox';
import { CircularProgress } from '../primitives/circular-progress';
import { Input } from '../primitives/input';
import { Progress } from '../primitives/progress';
import { RadioGroup, RadioGroupItem } from '../primitives/radio-group';
import { Separator } from '../primitives/separator';
import { Switch } from '../primitives/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '../primitives/dialog';
import { FilterChip, InputChip } from '../molecules/chip';
import { EmptyState } from '../molecules/empty-state';
import { FormField } from '../molecules/form-field';
import { IconButton } from '../molecules/icon-button';

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
  return (
    <Section id="action-ribbon" title="Action Ribbon">
      <div className="flex items-center justify-between h-14 px-4 border-b border-su-outline-variant bg-surface rounded-lg">
        <div className="flex items-center gap-3">
          <IconButton aria-label="Open menu" variant="standard" size="sm">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </IconButton>
          <span className="text-sm font-medium text-foreground">Application Name</span>
        </div>
        <div className="flex items-center gap-2">
          <IconButton aria-label="Search">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </IconButton>
          <IconButton aria-label="Notifications">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </IconButton>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">JD</div>
        </div>
      </div>
    </Section>
  );
}

export function AlertsSection() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const dismiss = (id: string) => setDismissed(prev => [...prev, id]);

  return (
    <Section id="alerts" title="Alerts">
      <div className="flex flex-col gap-3">
        {!dismissed.includes('negative') && (
          <Alert variant="negative" onDismiss={() => dismiss('negative')}>
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <AlertTitle>Error title</AlertTitle>
              <AlertDescription>Something went wrong. Please try again.</AlertDescription>
            </div>
          </Alert>
        )}
        {!dismissed.includes('caution') && (
          <Alert variant="caution" onDismiss={() => dismiss('caution')}>
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m10.29 3.86-8.74 15.1A1 1 0 0 0 2.41 21H21.6a1 1 0 0 0 .86-1.5L13.72 3.86a1 1 0 0 0-1.72 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <AlertTitle>Warning title</AlertTitle>
              <AlertDescription>Please review before continuing.</AlertDescription>
            </div>
          </Alert>
        )}
        {!dismissed.includes('positive') && (
          <Alert variant="positive">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>
              <AlertTitle>Success title</AlertTitle>
              <AlertDescription>Operation completed successfully.</AlertDescription>
            </div>
          </Alert>
        )}
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
      <div className="rounded-lg bg-surface-container-highest border border-su-outline-variant overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-su-outline-variant">
          <span className="text-xs text-on-surface-variant font-mono">query.sql</span>
          <button className="text-xs text-primary hover:text-primary/80 transition-colors">Copy</button>
        </div>
        <pre className="p-4 text-sm font-mono text-foreground overflow-x-auto leading-relaxed">
          <code>
            <span className="text-primary">SELECT</span>{' '}
            <span className="text-foreground">name, region, revenue</span>{'\n'}
            <span className="text-primary">FROM</span>{' '}
            <span className="text-on-positive-container">sales_data</span>{'\n'}
            <span className="text-primary">WHERE</span>{' '}
            <span className="text-foreground">fiscal_year =</span>{' '}
            <span className="text-on-caution-container">2025</span>{'\n'}
            <span className="text-primary">ORDER BY</span>{' '}
            <span className="text-foreground">revenue</span>{' '}
            <span className="text-primary">DESC</span>{'\n'}
            <span className="text-primary">LIMIT</span>{' '}
            <span className="text-on-caution-container">10</span><span className="text-on-surface-variant">;</span>
          </code>
        </pre>
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
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogTrigger asChild>
              <Button variant="text">Cancel</Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete</Button>
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
