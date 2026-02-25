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
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    NAV_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* ── Sticky nav rail ── */}
      <aside className="w-52 shrink-0 sticky top-0 h-screen overflow-y-auto bg-surface-container-lowest border-r border-su-outline-variant hidden lg:flex flex-col">
        <div className="px-4 py-5 border-b border-su-outline-variant">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest">SurfacesUI</p>
          <h1 className="text-base font-bold text-foreground mt-0.5">Kitchen Sink</h1>
        </div>
        <nav className="flex-1 px-2 py-3">
          {NAV_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleNavClick(id)}
              className={`w-full text-left px-3 py-2 text-sm rounded-full transition-colors mb-0.5
                ${active === id
                  ? 'bg-secondary-container text-secondary-container-foreground font-medium'
                  : 'text-on-surface-variant hover:bg-secondary-container/10'}
              `}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-su-outline-variant space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">Theme</span>
            <ThemeToggle />
          </div>
          <p className="text-[10px] text-on-surface-variant">
            SurfacesUI v1.0
          </p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-10 border-b border-su-outline-variant bg-card/80 backdrop-blur px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-foreground">Kitchen Sink</h1>
            <ThemeToggle />
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 lg:px-8 py-8 space-y-8">
          {/* Page title */}
          <div className="pb-4 border-b border-su-outline-variant">
            <h1 className="text-2xl font-bold text-foreground">Component Library</h1>
            <p className="text-sm text-on-surface-variant mt-1">
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
    </ThemeProvider>
  );
}
