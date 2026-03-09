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
  SliderSection,
  SnackbarSection,
  SwitchSection,
  TypographySection,
  IconSection,
  ListItemSection,
  TextLockupSection,
  IconLockupSection,
  MenuSection,
  ToolbarSection,
  StatusDialogSection,
  SideSheetSection,
  FullScreenDialogSection,
  FocusedPageSection,
  TreeListSection,
  OnboardingCardsSection,
  NotebookCellSection,
  DataTableSection,
  TabsSection,
  TooltipSection,
  FlowNodeSection,
  NodePaletteSection,
  FlowEditorSection,
  AgentFlowViewSection,
  SqlVisualExplainSection,
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
  { id: 'slider', label: 'Slider' },
  { id: 'snackbar', label: 'Snackbar' },
  { id: 'switch', label: 'Switch' },
  { id: 'typography', label: 'Typography' },
  { id: 'icon', label: 'Icon' },
  { id: 'list-item', label: 'List Item' },
  { id: 'text-lockup', label: 'Text Lockup' },
  { id: 'icon-lockup', label: 'Icon Lockup' },
  { id: 'menu', label: 'Menu' },
  { id: 'toolbar', label: 'Toolbar' },
  { id: 'status-dialog', label: 'Status Dialog' },
  { id: 'side-sheet', label: 'Side Sheet' },
  { id: 'full-screen-dialog', label: 'Full Screen Dialog' },
  { id: 'focused-page', label: 'Focused Page' },
  { id: 'tree-list', label: 'Tree List' },
  { id: 'onboarding-cards', label: 'Onboarding Cards' },
  { id: 'notebook-cell', label: 'Notebook Cell' },
  { id: 'data-table', label: 'Data Table' },
  { id: 'tabs', label: 'Tabs' },
  { id: 'tooltip', label: 'Tooltip' },
  { id: 'flow-node', label: 'Flow Node' },
  { id: 'node-palette', label: 'Node Palette' },
  { id: 'flow-editor', label: 'Flow Editor' },
  { id: 'agent-flow-view', label: 'Agent Flow View' },
  { id: 'sql-visual-explain', label: 'SQL Visual Explain' },
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
      <SliderSection />
      <SnackbarSection />
      <SwitchSection />
      <TypographySection />
      <IconSection />
      <ListItemSection />
      <TextLockupSection />
      <IconLockupSection />
      <MenuSection />
      <ToolbarSection />
      <StatusDialogSection />
      <SideSheetSection />
      <FullScreenDialogSection />
      <FocusedPageSection />
      <TreeListSection />
      <OnboardingCardsSection />
      <NotebookCellSection />
      <DataTableSection />
      <TabsSection />
      <TooltipSection />
      <FlowNodeSection />
      <NodePaletteSection />
      <FlowEditorSection />
      <AgentFlowViewSection />
      <SqlVisualExplainSection />
    </div>
  );
}

// ── Mount ────────────────────────────────────────────────────────────────

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<KitchenSinkApp />);
}
