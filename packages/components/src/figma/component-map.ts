/**
 * Figma Component Map
 *
 * Canonical mapping between Figma Covalent design system components (cv-*)
 * and SurfacesUI React components. This is the single source of truth for
 * the Figma-to-code relationship.
 *
 * Used by:
 * - Figma Code Connect (designers see React snippets in dev mode)
 * - AI component schemas (LLMs discover correct components)
 * - Token sync pipeline (design variable -> CSS custom property mapping)
 *
 * Naming principles:
 * - Clean PascalCase names, no cv- prefix (React namespace handles isolation)
 * - Full English words, no abbreviations (AI agents need unambiguous names)
 * - Props use semantic intent (variant, severity) not implementation (styleMode, type)
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type AtomicLevel = 'atom' | 'molecule' | 'organism';

export type ComponentStatus =
  | 'implemented'    // React component exists and is exported
  | 'planned'        // Figma component exists, React implementation pending
  | 'extend-existing'; // Can be added as variant/mode of existing component

export type ComponentCategory =
  | 'actions'        // Buttons, ribbons, toggles
  | 'feedback'       // Alerts, dialogs, snackbars, progress
  | 'layout'         // Dividers, cards, sheets, pages
  | 'data-display'   // Tables, lists, trees, badges, chips
  | 'inputs'         // Text fields, selects, checkboxes, radios, sliders
  | 'navigation'     // Tabs, menus, toolbars
  | 'content';       // Typography, icons, code snippets

export interface ComponentMapEntry {
  /** Figma component name (e.g., 'cv-button') */
  figmaName: string;

  /** React component name (e.g., 'Button') */
  react: string;

  /** Import path relative to src/ (e.g., 'primitives/button') */
  path: string;

  /** Atomic design level */
  level: AtomicLevel;

  /** Implementation status */
  status: ComponentStatus;

  /** Semantic category for AI discovery */
  category: ComponentCategory;

  /** Brief description for AI consumption */
  description: string;

  /** Sub-components exported alongside the main component */
  subComponents?: string[];

  /** Notes for planned/extend-existing components */
  notes?: string;
}

// ── Component Map ────────────────────────────────────────────────────────────

export const COMPONENT_MAP: Record<string, ComponentMapEntry> = {
  // ── Actions ──────────────────────────────────────────────────────────────

  'cv-button': {
    figmaName: 'cv-button',
    react: 'Button',
    path: 'primitives/button',
    level: 'atom',
    status: 'implemented',
    category: 'actions',
    description: 'Interactive button for user actions. Supports text, outlined, and raised variants with optional icons.',
  },

  'cv-icon-button': {
    figmaName: 'cv-icon-button',
    react: 'IconButton',
    path: 'molecules/icon-button',
    level: 'molecule',
    status: 'implemented',
    category: 'actions',
    description: 'Compact button displaying only an icon. Use for toolbar actions, close buttons, and secondary controls.',
    subComponents: ['iconButtonVariants'],
  },

  'cv-icon-button-toggle': {
    figmaName: 'cv-icon-button-toggle',
    react: 'IconButtonToggle',
    path: 'molecules/icon-button',
    level: 'atom',
    status: 'extend-existing',
    category: 'actions',
    description: 'Icon button with toggle state (pressed/unpressed). Use for favorite, bookmark, and mode switches.',
    notes: 'Add toggle mode to existing IconButton component with pressed/onPressedChange props.',
  },

  'cv-action-ribbon': {
    figmaName: 'cv-action-ribbon',
    react: 'ActionRibbon',
    path: 'molecules/action-ribbon',
    level: 'molecule',
    status: 'planned',
    category: 'actions',
    description: 'Horizontal bar of contextual actions. Use for bulk operations on selected items or page-level actions.',
  },

  // ── Feedback ─────────────────────────────────────────────────────────────

  'cv-alert': {
    figmaName: 'cv-alert',
    react: 'Alert',
    path: 'primitives/alert',
    level: 'atom',
    status: 'implemented',
    category: 'feedback',
    description: 'Inline message for important information. Supports info, success, warning, and error severity levels.',
    subComponents: ['AlertTitle', 'AlertDescription'],
  },

  'cv-dialog': {
    figmaName: 'cv-dialog',
    react: 'Dialog',
    path: 'primitives/dialog',
    level: 'molecule',
    status: 'implemented',
    category: 'feedback',
    description: 'Modal dialog for focused interactions. Use for confirmations, forms, and content that requires attention.',
    subComponents: ['DialogContent', 'DialogDescription', 'DialogFooter', 'DialogHeader', 'DialogTitle', 'DialogTrigger'],
  },

  'cv-full-screen-dialog': {
    figmaName: 'cv-full-screen-dialog',
    react: 'FullScreenDialog',
    path: 'primitives/full-screen-dialog',
    level: 'organism',
    status: 'planned',
    category: 'feedback',
    description: 'Full-screen modal for complex workflows. Use for multi-step forms, editors, or content that needs maximum space.',
  },

  'cv-status-dialog': {
    figmaName: 'cv-status-dialog',
    react: 'StatusDialog',
    path: 'molecules/status-dialog',
    level: 'molecule',
    status: 'planned',
    category: 'feedback',
    description: 'Dialog showing operation status (loading, success, error). Use for async operation feedback.',
  },

  'cv-snackbar': {
    figmaName: 'cv-snackbar',
    react: 'Snackbar',
    path: 'molecules/snackbar',
    level: 'molecule',
    status: 'planned',
    category: 'feedback',
    description: 'Brief notification toast at screen edge. Use for non-blocking success/error messages that auto-dismiss.',
  },

  'cv-circular-progress': {
    figmaName: 'cv-circular-progress',
    react: 'CircularProgress',
    path: 'primitives/circular-progress',
    level: 'atom',
    status: 'implemented',
    category: 'feedback',
    description: 'Circular loading indicator. Use for inline loading states and determinate progress.',
  },

  'cv-linear-progress': {
    figmaName: 'cv-linear-progress',
    react: 'Progress',
    path: 'primitives/progress',
    level: 'atom',
    status: 'implemented',
    category: 'feedback',
    description: 'Horizontal progress bar. Use for file uploads, long operations, and step progress.',
  },

  'cv-empty-state': {
    figmaName: 'cv-empty-state',
    react: 'EmptyState',
    path: 'molecules/empty-state',
    level: 'molecule',
    status: 'implemented',
    category: 'feedback',
    description: 'Placeholder for empty views with icon, title, description, and action. Use when no data exists yet.',
  },

  // ── Layout ───────────────────────────────────────────────────────────────

  'cv-divider': {
    figmaName: 'cv-divider',
    react: 'Separator',
    path: 'primitives/separator',
    level: 'atom',
    status: 'implemented',
    category: 'layout',
    description: 'Visual divider line between content sections. Supports horizontal and vertical orientation.',
  },

  'cv-focused-page': {
    figmaName: 'cv-focused-page',
    react: 'FocusedPage',
    path: 'organisms/focused-page',
    level: 'organism',
    status: 'planned',
    category: 'layout',
    description: 'Full-page layout with centered content and navigation. Use for onboarding, settings, and focused workflows.',
  },

  'cv-side-sheet': {
    figmaName: 'cv-side-sheet',
    react: 'SideSheet',
    path: 'organisms/side-sheet',
    level: 'organism',
    status: 'planned',
    category: 'layout',
    description: 'Slide-out panel from screen edge. Use for detail views, filters, and supplementary content.',
  },

  'cv-onboarding-cards': {
    figmaName: 'cv-onboarding-cards',
    react: 'OnboardingCards',
    path: 'organisms/onboarding-cards',
    level: 'organism',
    status: 'planned',
    category: 'layout',
    description: 'Step-by-step card carousel for onboarding flows. Use for first-time user guidance.',
  },

  // ── Data Display ─────────────────────────────────────────────────────────

  'cv-badge': {
    figmaName: 'cv-badge',
    react: 'Badge',
    path: 'primitives/badge',
    level: 'atom',
    status: 'implemented',
    category: 'data-display',
    description: 'Small label for status, counts, or categories. Supports dot, count, and text variants.',
    subComponents: ['NotificationBadge', 'badgeVariants'],
  },

  'cv-chip': {
    figmaName: 'cv-chip',
    react: 'FilterChip',
    path: 'molecules/chip',
    level: 'molecule',
    status: 'implemented',
    category: 'data-display',
    description: 'Compact element for filters, selections, or tags. Supports selected state and removal.',
    subComponents: ['InputChip'],
  },

  'cv-chip-set': {
    figmaName: 'cv-chip-set',
    react: 'FilterChip',
    path: 'molecules/chip',
    level: 'molecule',
    status: 'implemented',
    category: 'data-display',
    description: 'Group of chips for multi-select filtering. Compose multiple FilterChip components.',
    notes: 'Handled by composing multiple FilterChip/InputChip instances. No separate ChipSet component needed.',
  },

  'cv-list-item': {
    figmaName: 'cv-list-item',
    react: 'ListItem',
    path: 'primitives/list-item',
    level: 'atom',
    status: 'planned',
    category: 'data-display',
    description: 'Single row in a list with text, icons, and actions. Supports 1-line, 2-line, and 3-line layouts.',
  },

  'cv-tree-list': {
    figmaName: 'cv-tree-list',
    react: 'TreeList',
    path: 'organisms/tree-list',
    level: 'organism',
    status: 'planned',
    category: 'data-display',
    description: 'Hierarchical tree view for nested data. Use for file browsers, org charts, and nested categories.',
    subComponents: ['TreeListItem'],
  },

  'cv-tree-list-item': {
    figmaName: 'cv-tree-list-item',
    react: 'TreeListItem',
    path: 'organisms/tree-list',
    level: 'atom',
    status: 'planned',
    category: 'data-display',
    description: 'Single node in a tree list with expand/collapse and optional icon.',
    notes: 'Co-located with TreeList component.',
  },

  'cv-notebook-cell': {
    figmaName: 'cv-notebook-cell',
    react: 'NotebookCell',
    path: 'organisms/notebook-cell',
    level: 'organism',
    status: 'planned',
    category: 'data-display',
    description: 'Executable code/markdown cell for notebook interfaces. Use for interactive data analysis UIs.',
  },

  // ── Inputs ───────────────────────────────────────────────────────────────

  'cv-text-field': {
    figmaName: 'cv-text-field',
    react: 'Input',
    path: 'primitives/input',
    level: 'atom',
    status: 'implemented',
    category: 'inputs',
    description: 'Single-line text input. Use for names, emails, search, and short-form data entry.',
  },

  'cv-text-area': {
    figmaName: 'cv-text-area',
    react: 'Textarea',
    path: 'primitives/textarea',
    level: 'atom',
    status: 'implemented',
    category: 'inputs',
    description: 'Multi-line text input. Use for comments, descriptions, SQL queries, and long-form content.',
  },

  'cv-select': {
    figmaName: 'cv-select',
    react: 'Select',
    path: 'primitives/select',
    level: 'atom',
    status: 'implemented',
    category: 'inputs',
    description: 'Dropdown selection from predefined options. Use for single-value selection from a list.',
    subComponents: ['SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue', 'SelectGroup', 'SelectLabel', 'SelectSeparator'],
  },

  'cv-checkbox': {
    figmaName: 'cv-checkbox',
    react: 'Checkbox',
    path: 'primitives/checkbox',
    level: 'atom',
    status: 'implemented',
    category: 'inputs',
    description: 'Binary toggle for yes/no choices. Supports checked, unchecked, and indeterminate states.',
  },

  'cv-checkbox-icon': {
    figmaName: 'cv-checkbox-icon',
    react: 'Checkbox',
    path: 'primitives/checkbox',
    level: 'atom',
    status: 'extend-existing',
    category: 'inputs',
    description: 'Visual checkbox with icon content instead of checkmark. Extend existing Checkbox component.',
    notes: 'Add icon slot prop to existing Checkbox component.',
  },

  'cv-radio': {
    figmaName: 'cv-radio',
    react: 'RadioGroup',
    path: 'primitives/radio-group',
    level: 'atom',
    status: 'implemented',
    category: 'inputs',
    description: 'Single selection from multiple options. Use when user must choose exactly one option.',
    subComponents: ['RadioGroupItem'],
  },

  'cv-radio-icon': {
    figmaName: 'cv-radio-icon',
    react: 'RadioGroup',
    path: 'primitives/radio-group',
    level: 'atom',
    status: 'extend-existing',
    category: 'inputs',
    description: 'Radio button with icon content. Extend existing RadioGroup/RadioGroupItem.',
    notes: 'Add icon slot prop to existing RadioGroupItem component.',
  },

  'cv-form-field': {
    figmaName: 'cv-form-field',
    react: 'FormField',
    path: 'molecules/form-field',
    level: 'molecule',
    status: 'implemented',
    category: 'inputs',
    description: 'Wrapper providing label, helper text, and error state for any input. Use around Input, Select, Textarea.',
  },

  'cv-slider': {
    figmaName: 'cv-slider',
    react: 'Slider',
    path: 'primitives/slider',
    level: 'atom',
    status: 'planned',
    category: 'inputs',
    description: 'Range input for numeric values. Use for volume, brightness, price ranges, and numeric filters.',
  },

  // ── Navigation ───────────────────────────────────────────────────────────

  'cv-tab': {
    figmaName: 'cv-tab',
    react: 'Tabs',
    path: 'primitives/tabs',
    level: 'atom',
    status: 'implemented',
    category: 'navigation',
    description: 'Single tab within a tab bar. Use TabsTrigger inside TabsList.',
    subComponents: ['TabsContent', 'TabsList', 'TabsTrigger'],
    notes: 'cv-tab and cv-tab-bar are both handled by the Tabs compound component.',
  },

  'cv-tab-bar': {
    figmaName: 'cv-tab-bar',
    react: 'Tabs',
    path: 'primitives/tabs',
    level: 'molecule',
    status: 'implemented',
    category: 'navigation',
    description: 'Container for tab navigation. Holds TabsTrigger elements for switching between views.',
    notes: 'Covered by Tabs + TabsList. No separate TabBar component needed.',
  },

  'cv-menu': {
    figmaName: 'cv-menu',
    react: 'Menu',
    path: 'molecules/menu',
    level: 'molecule',
    status: 'planned',
    category: 'navigation',
    description: 'Dropdown menu of actions or navigation links. Use for context menus, overflow menus, and nav dropdowns.',
  },

  'cv-toolbar': {
    figmaName: 'cv-toolbar',
    react: 'Toolbar',
    path: 'molecules/toolbar',
    level: 'molecule',
    status: 'planned',
    category: 'navigation',
    description: 'Horizontal bar of tools and actions. Use for editor toolbars, page-level controls.',
  },

  // ── Content ──────────────────────────────────────────────────────────────

  'cv-tooltip': {
    figmaName: 'cv-tooltip',
    react: 'Tooltip',
    path: 'primitives/tooltip',
    level: 'atom',
    status: 'implemented',
    category: 'content',
    description: 'Hover/focus popup with brief helpful text. Use for icon-only buttons and truncated content.',
  },

  'cv-typography': {
    figmaName: 'cv-typography',
    react: 'Typography',
    path: 'primitives/typography',
    level: 'atom',
    status: 'planned',
    category: 'content',
    description: 'Text element with design system typography presets (headline, body, caption, overline).',
  },

  'cv-icon': {
    figmaName: 'cv-icon',
    react: 'Icon',
    path: 'primitives/icon',
    level: 'atom',
    status: 'planned',
    category: 'content',
    description: 'Themed icon container. Wraps icon SVGs with consistent sizing and color from design tokens.',
  },

  'cv-icon-lockup': {
    figmaName: 'cv-icon-lockup',
    react: 'IconLockup',
    path: 'molecules/icon-lockup',
    level: 'molecule',
    status: 'planned',
    category: 'content',
    description: 'Icon paired with text label. Use for feature lists, menu items, and labeled icons.',
  },

  'cv-text-lockup': {
    figmaName: 'cv-text-lockup',
    react: 'TextLockup',
    path: 'molecules/text-lockup',
    level: 'molecule',
    status: 'planned',
    category: 'content',
    description: 'Title/subtitle text pairing. Use for card headers, section titles, and metadata display.',
  },

  'cv-code-snippet': {
    figmaName: 'cv-code-snippet',
    react: 'CodeSnippet',
    path: 'molecules/code-snippet',
    level: 'molecule',
    status: 'planned',
    category: 'content',
    description: 'Syntax-highlighted code block with copy button. Use for displaying SQL, JSON, or code examples.',
  },
} as const;

// ── Utility Types ────────────────────────────────────────────────────────────

/** All Figma component names */
export type FigmaComponentName = keyof typeof COMPONENT_MAP;

/** All React component names (from implemented components) */
export type ReactComponentName = (typeof COMPONENT_MAP)[FigmaComponentName]['react'];

// ── Query Helpers ────────────────────────────────────────────────────────────

/**
 * Get all components by status
 */
export function getComponentsByStatus(status: ComponentStatus): ComponentMapEntry[] {
  return Object.values(COMPONENT_MAP).filter(c => c.status === status);
}

/**
 * Get all components by category
 */
export function getComponentsByCategory(category: ComponentCategory): ComponentMapEntry[] {
  return Object.values(COMPONENT_MAP).filter(c => c.category === category);
}

/**
 * Get all components by atomic level
 */
export function getComponentsByLevel(level: AtomicLevel): ComponentMapEntry[] {
  return Object.values(COMPONENT_MAP).filter(c => c.level === level);
}

/**
 * Look up React component name from Figma name
 */
export function figmaToReact(figmaName: string): string | undefined {
  const entry = COMPONENT_MAP[figmaName];
  return entry?.react;
}

/**
 * Look up Figma name from React component name
 */
export function reactToFigma(reactName: string): string | undefined {
  const entry = Object.entries(COMPONENT_MAP).find(([_, v]) => v.react === reactName);
  return entry?.[0];
}

/**
 * Get component map entries suitable for AI discovery prompts
 */
export function getComponentCatalog(): Array<{
  name: string;
  description: string;
  category: ComponentCategory;
  level: AtomicLevel;
  available: boolean;
}> {
  // Deduplicate by react name (cv-tab and cv-tab-bar both map to Tabs)
  const seen = new Set<string>();
  return Object.values(COMPONENT_MAP)
    .filter(entry => {
      if (seen.has(entry.react)) return false;
      seen.add(entry.react);
      return true;
    })
    .map(entry => ({
      name: entry.react,
      description: entry.description,
      category: entry.category,
      level: entry.level,
      available: entry.status === 'implemented',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
