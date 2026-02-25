/**
 * SurfacesUI Kitchen Sink — Section Components
 *
 * Individual section renderers for the dark-mode kitchen sink.
 * Implements Figma node 25796:15712 (file Yl9Vh9sloq2VxueDt3Majm).
 */

import * as React from 'react';

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

/** State label pill */
function StateLabel({ label }: { label: string }) {
  return (
    <span className="text-[10px] text-on-surface-variant uppercase tracking-wider w-16 shrink-0 text-right">
      {label}
    </span>
  );
}

// ── Primitive Components ──────────────────────────────────────────────────

/** CvSwitch */
function CvSwitch({ checked = true, disabled = false }: { checked?: boolean; disabled?: boolean }) {
  const trackBg = checked
    ? disabled ? 'bg-[var(--primary-20-raw)]' : 'bg-primary'
    : disabled ? 'bg-[var(--on-surface-12-raw)]' : 'bg-on-surface-variant';
  const knobBg = checked
    ? disabled ? 'bg-[var(--on-surface-38-raw)]' : 'bg-primary-foreground'
    : disabled ? 'bg-[var(--on-surface-38-raw)]' : 'bg-on-surface-variant';
  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      className={`relative w-[52px] h-[32px] rounded-full flex items-center px-1 transition-colors ${trackBg} ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div
        className={`w-[24px] h-[24px] rounded-full shadow transition-all ${knobBg} ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </div>
  );
}

/** CvRadio */
function CvRadio({ checked = true, disabled = false }: { checked?: boolean; disabled?: boolean }) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
        ${checked ? 'border-primary' : 'border-on-surface-variant'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {checked && (
        <div className={`w-3 h-3 rounded-full ${disabled ? 'bg-on-surface-variant' : 'bg-primary'}`} />
      )}
    </div>
  );
}

/** CvCheckbox */
function CvCheckbox({
  checked = true,
  indeterminate = false,
  disabled = false,
}: {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
}) {
  const isActive = checked || indeterminate;
  return (
    <div
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-disabled={disabled}
      className={`w-[18px] h-[18px] rounded flex items-center justify-center border-2 transition-colors
        ${isActive ? 'bg-primary border-primary' : 'border-on-surface-variant bg-transparent'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {isActive && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          {indeterminate ? (
            <line x1="2" y1="6" x2="10" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          )}
        </svg>
      )}
    </div>
  );
}

/** CvBadge */
function CvBadge({ content = '3', size = 'Large' }: { content?: string; size?: 'Small' | 'Large' }) {
  if (size === 'Small') {
    return <div className="w-2 h-2 rounded-full bg-destructive" />;
  }
  return (
    <div className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive flex items-center justify-center">
      <span className="text-[11px] font-medium text-white leading-none">{content}</span>
    </div>
  );
}

/** Circular progress ring */
function CircularProgress({ percent = 75, size = 48 }: { percent: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--outline))" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[10px] text-on-surface-variant">{percent}%</span>
    </div>
  );
}

// ── Sections ─────────────────────────────────────────────────────────────

export function ActionRibbonSection() {
  return (
    <Section id="action-ribbon" title="Action Ribbon">
      <div className="flex items-center justify-between h-14 px-4 border-b border-su-outline-variant bg-surface rounded-lg">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-sm font-medium text-foreground">Application Name</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--on-surface-8-raw)] text-on-surface-variant transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>
          <button className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--on-surface-8-raw)] text-on-surface-variant transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">JD</div>
        </div>
      </div>
    </Section>
  );
}

export function AlertsSection() {
  return (
    <Section id="alerts" title="Alerts">
      <div className="flex flex-col gap-3">
        {/* Negative */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-negative-container border border-destructive">
          <svg className="w-5 h-5 shrink-0 mt-0.5 text-on-negative-container" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-on-negative-container">Error title</p>
            <p className="text-sm text-on-negative-container opacity-80 mt-0.5">Something went wrong. Please try again.</p>
          </div>
          <button className="text-on-negative-container opacity-70 hover:opacity-100 shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {/* Caution */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-caution-container border border-warning">
          <svg className="w-5 h-5 shrink-0 mt-0.5 text-on-caution-container" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m10.29 3.86-8.74 15.1A1 1 0 0 0 2.41 21H21.6a1 1 0 0 0 .86-1.5L13.72 3.86a1 1 0 0 0-1.72 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-on-caution-container">Warning title</p>
            <p className="text-sm text-on-caution-container opacity-80 mt-0.5">Please review before continuing.</p>
          </div>
          <button className="text-on-caution-container opacity-70 hover:opacity-100 shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {/* Positive */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-positive-container border border-success">
          <svg className="w-5 h-5 shrink-0 mt-0.5 text-on-positive-container" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-on-positive-container">Success title</p>
            <p className="text-sm text-on-positive-container opacity-80 mt-0.5">Operation completed successfully.</p>
          </div>
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
            <div className="absolute -top-1 -right-1"><CvBadge size="Small" /></div>
          </div>
          <div className="relative">
            <svg className="w-6 h-6 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div className="absolute -top-1 -right-1"><CvBadge size="Small" /></div>
          </div>
        </DemoRow>
        <DemoRow label="Large (count)">
          <div className="relative">
            <svg className="w-6 h-6 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <div className="absolute -top-2 -right-2"><CvBadge content="3" size="Large" /></div>
          </div>
          <div className="relative">
            <svg className="w-6 h-6 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <div className="absolute -top-2 -right-2"><CvBadge content="12" size="Large" /></div>
          </div>
          <div className="relative">
            <svg className="w-6 h-6 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
            <div className="absolute -top-2 -right-2"><CvBadge content="99+" size="Large" /></div>
          </div>
        </DemoRow>
      </div>
    </Section>
  );
}

export function ButtonsSection() {
  return (
    <Section id="buttons" title="Buttons">
      <div className="flex flex-col gap-6">
        {/* Text buttons */}
        <DemoRow label="Text">
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary hover:bg-[var(--primary-8-raw)] transition-colors">Label</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary bg-[var(--primary-8-raw)] transition-colors">Hovered</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary bg-[var(--primary-12-raw)] transition-colors">Focused</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-on-surface-variant cursor-not-allowed opacity-60" disabled>Disabled</button>
        </DemoRow>

        {/* Outlined buttons */}
        <DemoRow label="Outlined">
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary border border-su-outline hover:bg-[var(--primary-8-raw)] transition-colors">Label</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary border border-su-outline bg-[var(--primary-8-raw)] transition-colors">Hovered</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary border border-primary bg-[var(--primary-12-raw)] transition-colors">Focused</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-[var(--on-surface-38-raw)] border border-[var(--on-surface-12-raw)] cursor-not-allowed" disabled>Disabled</button>
        </DemoRow>

        {/* Filled/raised buttons */}
        <DemoRow label="Filled">
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)] transition-opacity">Label</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary-foreground bg-primary opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]">Hovered</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary-foreground bg-primary opacity-80 shadow-none">Pressed</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium bg-[var(--on-surface-12-raw)] text-[var(--on-surface-38-raw)] cursor-not-allowed" disabled>Disabled</button>
        </DemoRow>

        {/* Tonal buttons */}
        <DemoRow label="Tonal">
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary bg-[var(--primary-12-raw)] hover:bg-[var(--primary-20-raw)] transition-colors">Label</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary bg-[var(--primary-20-raw)]">Hovered</button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium bg-[var(--on-surface-12-raw)] text-[var(--on-surface-38-raw)] cursor-not-allowed" disabled>Disabled</button>
        </DemoRow>

        {/* Icon + label buttons */}
        <DemoRow label="With icon">
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 flex items-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-opacity">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Create
          </button>
          <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary border border-su-outline hover:bg-[var(--primary-8-raw)] flex items-center gap-2 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            Export
          </button>
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
          { label: 'Checked', checked: true, indeterminate: false },
          { label: 'Indeterminate', checked: false, indeterminate: true },
          { label: 'Unchecked', checked: false, indeterminate: false },
        ].map(({ label, checked, indeterminate }) => (
          <div key={label} className="flex flex-col gap-3">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">{label}</p>
            <div className="flex items-center gap-3">
              <CvCheckbox checked={checked} indeterminate={indeterminate} />
              <span className="text-sm text-foreground">Enabled</span>
            </div>
            <div className="flex items-center gap-3">
              <CvCheckbox checked={checked} indeterminate={indeterminate} disabled />
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

  const toggle = (chip: string) => {
    setActive(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]);
  };

  return (
    <Section id="chips" title="Chip &amp; Chip Set">
      <div className="flex flex-col gap-4">
        <DemoRow label="Filter chips">
          {chips.map(chip => {
            const sel = active.includes(chip);
            return (
              <button
                key={chip}
                onClick={() => toggle(chip)}
                className={`h-8 px-3 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5
                  ${sel ? 'bg-secondary-container text-secondary-container-foreground' : 'border border-su-outline text-on-surface-variant hover:bg-secondary-container/10'}
                `}
              >
                {sel && (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {chip}
              </button>
            );
          })}
        </DemoRow>
        <DemoRow label="Input chip (dismissible)">
          {['React', 'TypeScript', 'Tailwind'].map(chip => (
            <div key={chip} className="flex items-center gap-1 h-8 pl-3 pr-2 rounded-full border border-su-outline text-sm text-foreground bg-surface-container">
              <span>{chip}</span>
              <button className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-[var(--on-surface-12-raw)] text-on-surface-variant transition-colors">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
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
          <CircularProgress key={pct} percent={pct} size={56} />
        ))}
        <div className="flex flex-col items-center gap-1">
          <div className="w-14 h-14 relative">
            <svg width="56" height="56" className="-rotate-90">
              <circle cx="28" cy="28" r="22" fill="none" stroke="hsl(var(--outline))" strokeWidth="4" />
              <circle cx="28" cy="28" r="22" fill="none" stroke="hsl(var(--primary))" strokeWidth="4"
                strokeDasharray={2 * Math.PI * 22} strokeDashoffset={2 * Math.PI * 22 * 0.35}
                strokeLinecap="round" className="animate-[spin_2s_linear_infinite]"
                style={{ transformOrigin: 'center', animation: 'none' }}
              />
            </svg>
          </div>
          <span className="text-[10px] text-on-surface-variant">Custom</span>
        </div>
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
  const [open, setOpen] = useState(false);
  return (
    <Section id="dialog" title="Dialog">
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-4 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-opacity"
      >
        Open Dialog
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative bg-card rounded-2xl border border-su-outline-variant shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">Confirm Action</h3>
            <p className="text-sm text-on-surface-variant mb-6">
              Are you sure you want to delete this item? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="h-9 px-4 rounded-lg text-sm font-medium text-primary hover:bg-[var(--primary-8-raw)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-9 px-4 rounded-lg text-sm font-medium text-primary-foreground bg-destructive hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

export function DividerSection() {
  return (
    <Section id="divider" title="Divider">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-foreground mb-3">Content above</p>
          <hr className="border-su-outline-variant" />
          <p className="text-sm text-foreground mt-3">Content below</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-on-surface-variant">Label</span>
          <div className="h-px flex-1 bg-su-outline-variant" />
          <span className="text-sm text-on-surface-variant">Label</span>
          <div className="h-px flex-1 bg-su-outline-variant" />
          <span className="text-sm text-on-surface-variant">Label</span>
        </div>
      </div>
    </Section>
  );
}

export function EmptyStateSection() {
  return (
    <Section id="empty-state" title="Empty State">
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
          <svg className="w-8 h-8 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">No data found</p>
          <p className="text-sm text-on-surface-variant mt-1 max-w-xs">
            There are no items to display. Try adjusting your filters or create a new item.
          </p>
        </div>
        <button className="h-9 px-4 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-opacity">
          Create New
        </button>
      </div>
    </Section>
  );
}

export function FormFieldSection() {
  return (
    <Section id="form-field" title="Form Field">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl">
        {/* Default */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-on-surface-variant">Default</label>
          <input
            type="text"
            placeholder="Placeholder text"
            className="h-10 px-3 rounded-lg border border-su-outline bg-surface-container text-sm text-foreground placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
          <p className="text-xs text-on-surface-variant">Helper text</p>
        </div>
        {/* Filled */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-on-surface-variant">Filled</label>
          <input
            type="text"
            defaultValue="Input value"
            className="h-10 px-3 rounded-lg border border-primary bg-surface-container text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          <p className="text-xs text-on-surface-variant">Helper text</p>
        </div>
        {/* Error */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-on-surface-variant">Error</label>
          <input
            type="text"
            defaultValue="Invalid value"
            className="h-10 px-3 rounded-lg border border-destructive bg-surface-container text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-destructive transition-colors"
          />
          <p className="text-xs text-destructive">This field is required.</p>
        </div>
      </div>
    </Section>
  );
}

export function IconButtonSection() {
  return (
    <Section id="icon-button" title="Icon Button">
      <div className="flex flex-col gap-6">
        <DemoRow label="Standard">
          {[false, false, true].map((active, i) => (
            <button
              key={i}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors
                ${active
                  ? 'bg-secondary-container text-secondary-container-foreground'
                  : 'text-on-surface-variant hover:bg-[var(--on-surface-8-raw)]'}
              `}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {i === 0 && <><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>}
                {i === 1 && <><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></>}
                {i === 2 && <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>}
              </svg>
            </button>
          ))}
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant opacity-40 cursor-not-allowed" disabled>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </button>
        </DemoRow>
        <DemoRow label="Filled">
          <button className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container text-on-surface-variant hover:bg-[var(--on-surface-8-raw)] transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
          <button className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container text-on-surface-variant opacity-40 cursor-not-allowed" disabled>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
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
            <div className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
        {/* Indeterminate */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-on-surface-variant">Indeterminate</span>
          <div className="h-2 w-full rounded-full bg-surface-container-highest overflow-hidden relative">
            <div className="h-full w-1/3 rounded-full bg-primary absolute animate-[indeterminate_1.5s_ease-in-out_infinite]" />
          </div>
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
          {options.map(opt => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <CvRadio checked={selected === opt.value} />
              <span className="text-sm text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xs text-on-surface-variant uppercase tracking-wider">Disabled</p>
          {options.map((opt, i) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-not-allowed">
              <CvRadio checked={i === 0} disabled />
              <span className="text-sm text-on-surface-variant opacity-60">{opt.label}</span>
            </label>
          ))}
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
            <CvSwitch checked={states.s1} />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer max-w-[200px]">
            <span className="text-sm text-foreground">Bluetooth</span>
            <CvSwitch checked={states.s2} />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer max-w-[200px]">
            <span className="text-sm text-foreground">Notifications</span>
            <CvSwitch checked={states.s3} />
          </label>
        </div>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-on-surface-variant uppercase tracking-wider">Disabled</p>
          <label className="flex items-center justify-between gap-4 cursor-not-allowed max-w-[200px]">
            <span className="text-sm text-on-surface-variant opacity-60">Wi-Fi</span>
            <CvSwitch checked disabled />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-not-allowed max-w-[200px]">
            <span className="text-sm text-on-surface-variant opacity-60">Bluetooth</span>
            <CvSwitch checked={false} disabled />
          </label>
        </div>
      </div>
    </Section>
  );
}
