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
import { ThemeWrapper } from './ThemeWrapper';
import '../theme/tokens.css';

import {
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

// ── App Wrapper with submenu ─────────────────────────────────────────────

function KitchenSinkApp() {
  const [active, setActive] = React.useState('action-ribbon');

  const handleNavClick = (id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Generate submenu items
  const subMenuItems = NAV_ITEMS.map(({ id, label }) => ({
    id,
    label,
    onClick: () => handleNavClick(id),
  }));

  return (
    <ThemeWrapper
      title="Kitchen Sink"
      description="Component library — dark mode showcase"
      showDemoNav={true}
      currentDemo="kitchen-sink"
      subMenuItems={subMenuItems}
      activeSubItem={active}
    >
      <KitchenSinkContent activeSection={active} setActiveSection={setActive} />
    </ThemeWrapper>
  );
}

// ── Content Component ────────────────────────────────────────────────────

function KitchenSinkContent({
  activeSection,
  setActiveSection
}: {
  activeSection: string;
  setActiveSection: (id: string) => void;
}) {
  // Update active nav on scroll
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
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
  }, [setActiveSection]);

  return (
    <div className="space-y-8">
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
  );
}

// ── Mount ────────────────────────────────────────────────────────────────

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<KitchenSinkApp />);
}
