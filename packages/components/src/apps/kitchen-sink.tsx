/**
 * SurfacesUI Kitchen Sink
 *
 * Dark-mode showcase of all core SurfacesUI components.
 * Implements Figma node 25796:15712 (file Yl9Vh9sloq2VxueDt3Majm).
 *
 * DEV-ONLY: Access at http://localhost:5180/src/apps/kitchen-sink.html
 * NOT packaged as MCP app.
 */

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ThemeToggle } from './ThemeToggle';
import '../theme/tokens.css';

import {
  Section,
  ActionRibbonSection,
  AlertsSection,
  BadgeSection,
  ButtonsSection,
  CheckboxSection,
  ChipSection,
  CircularProgressSection,
  CodeSnippetSection,
  DialogSection,
  DividerSection,
  EmptyStateSection,
  FormFieldSection,
  IconButtonSection,
  ProgressBarSection,
  RadioSection,
  SwitchSection,
} from './kitchen-sink-sections';

// ── Nav config ───────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'action-ribbon', label: 'Action Ribbon' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'badge', label: 'Badge' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'checkbox', label: 'Checkbox' },
  { id: 'chips', label: 'Chips' },
  { id: 'circular-progress', label: 'Circular Progress' },
  { id: 'code-snippet', label: 'Code Snippet' },
  { id: 'dialog', label: 'Dialog' },
  { id: 'divider', label: 'Divider' },
  { id: 'empty-state', label: 'Empty State' },
  { id: 'form-field', label: 'Form Field' },
  { id: 'icon-button', label: 'Icon Button' },
  { id: 'progress-bar', label: 'Progress Bar' },
  { id: 'radio', label: 'Radio' },
  { id: 'switch', label: 'Switch' },
];

// ── App shell ────────────────────────────────────────────────────────────

function KitchenSink() {
  const [active, setActive] = React.useState('action-ribbon');

  const handleNavClick = (id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Update active nav on scroll
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );
    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-background text-foreground flex min-h-screen">
      {/* ── Sticky nav rail ── */}
      <aside className="bg-surface-container-lowest border-su-outline-variant sticky top-0 hidden h-screen w-52 shrink-0 flex-col overflow-y-auto border-r lg:flex">
        <div className="border-su-outline-variant border-b px-4 py-5">
          <p className="text-on-surface-variant text-xs font-semibold tracking-widest uppercase">
            SurfacesUI
          </p>
          <h1 className="text-foreground mt-0.5 text-base font-bold">Kitchen Sink</h1>
        </div>
        <nav className="flex-1 px-2 py-3">
          {NAV_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`mb-0.5 w-full rounded-full px-3 py-2 text-left text-sm transition-colors ${
                active === id
                  ? 'bg-secondary-container text-secondary-container-foreground font-medium'
                  : 'text-on-surface-variant hover:bg-secondary-container/10'
              } `}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="border-su-outline-variant space-y-2 border-t px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant text-xs">Theme</span>
            <ThemeToggle />
          </div>
          <p className="text-on-surface-variant text-[10px]">SurfacesUI v1.0</p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        {/* Mobile header */}
        <header className="border-su-outline-variant bg-card/80 sticky top-0 z-10 border-b px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <h1 className="text-foreground text-base font-bold">Kitchen Sink</h1>
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 lg:px-8">
          {/* Page title */}
          <div className="border-su-outline-variant border-b pb-4">
            <h1 className="text-foreground text-2xl font-bold">Component Library</h1>
            <p className="text-on-surface-variant mt-1 text-sm">
              SurfacesUI component library — dark mode
            </p>
          </div>

          <ActionRibbonSection />
          <AlertsSection />
          <BadgeSection />
          <ButtonsSection />
          <CheckboxSection />
          <ChipSection />
          <CircularProgressSection />
          <CodeSnippetSection />
          <DialogSection />
          <DividerSection />
          <EmptyStateSection />
          <FormFieldSection />
          <IconButtonSection />
          <ProgressBarSection />
          <RadioSection />
          <SwitchSection />

          <div className="flex gap-4">
            <div className="bg-card flex-1 border p-4">Gap test 1</div>
            <div className="bg-card flex-1 border p-4">Gap test 2</div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Mount ────────────────────────────────────────────────────────────────

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <ThemeProvider persistTheme theme="dark">
      <KitchenSink />
    </ThemeProvider>,
  );
}
