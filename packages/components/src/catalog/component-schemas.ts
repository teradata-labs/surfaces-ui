/**
 * AI-Consumable Component Schemas
 *
 * Rich metadata for every SurfacesUI component, designed to be consumed
 * by AI agents (LLMs) that scaffold UIs from natural language.
 *
 * Each schema includes:
 * - Props definition with types, defaults, and descriptions
 * - Usage guidance: when to use, when not to, alternatives
 * - Composition rules: what goes inside what
 * - Design token references
 * - Domain context for data/analytics/AI-ML use cases
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
  values?: string[];
}

export interface UsagePattern {
  name: string;
  description: string;
  components: string[];
}

export interface UsageGuidance {
  when: string[];
  whenNot: string[];
  alternatives: string[];
  dos: string[];
  donts: string[];
  patterns: UsagePattern[];
  domainContext?: string;
}

export interface ComponentSchema {
  name: string;
  figmaName: string;
  description: string;
  category: string;
  level: 'atom' | 'molecule' | 'organism';
  props: PropDefinition[];
  usage: UsageGuidance;
  designTokens: string[];
  composedOf?: string[];
  composableWith?: string[];
  subComponents?: string[];
}

// ── Component Schemas ────────────────────────────────────────────────────────

export const COMPONENT_SCHEMAS: ComponentSchema[] = [
  // ── Actions ──────────────────────────────────────────────────────────────

  {
    name: 'Button',
    figmaName: 'cv-button',
    description: 'Interactive button for triggering actions. Supports multiple visual variants and optional icons.',
    category: 'actions',
    level: 'atom',
    props: [
      { name: 'variant', type: 'enum', required: false, default: 'default', description: 'Visual style of the button', values: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'tonal'] },
      { name: 'size', type: 'enum', required: false, default: 'default', description: 'Button size', values: ['default', 'sm', 'lg', 'icon'] },
      { name: 'density', type: 'enum', required: false, default: 'compact', description: 'Height density level (only affects size="default")', values: ['compact', 'comfortable', 'spacious'] },
      { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Disables interaction' },
      { name: 'asChild', type: 'boolean', required: false, default: 'false', description: 'Render as child element (for composition with Link)' },
      { name: 'children', type: 'ReactNode', required: true, description: 'Button label text or content' },
    ],
    usage: {
      when: [
        'Primary user actions (submit, save, create)',
        'Form submissions',
        'Destructive actions (delete, remove) with variant="destructive"',
        'Secondary actions with variant="outline" or variant="secondary"',
      ],
      whenNot: [
        'Navigation between pages - use Link instead',
        'Toggling boolean state - use Switch or Checkbox',
        'Icon-only actions in toolbars - use IconButton',
        'Multi-step selections - use RadioGroup or Select',
      ],
      alternatives: ['IconButton', 'Link (for navigation)', 'Switch (for toggles)'],
      dos: [
        'Always provide descriptive label text for accessibility',
        'Use variant="destructive" for delete/remove actions',
        'Use variant="outline" for secondary actions alongside a primary button',
        'Place primary action button on the right in button groups',
      ],
      donts: [
        'Do not nest interactive elements inside Button',
        'Do not use for navigation - use HTML anchor or router Link',
        'Do not use more than one primary (default) button per section',
      ],
      patterns: [
        { name: 'Form actions', description: 'Primary submit + secondary cancel', components: ['Button', 'Button'] },
        { name: 'Destructive confirm', description: 'Delete button inside a confirmation Dialog', components: ['Dialog', 'Button'] },
      ],
      domainContext: 'In analytics dashboards, use for query execution, data export, and filter application. In AI/ML UIs, use for model training triggers and pipeline execution.',
    },
    designTokens: ['--primary', '--primary-foreground', '--destructive', '--su-button-height', '--su-button-padding-x'],
    composableWith: ['Dialog', 'FormField', 'Toolbar', 'ActionRibbon'],
  },

  {
    name: 'IconButton',
    figmaName: 'cv-icon-button',
    description: 'Compact button displaying only an icon. For toolbar actions, close buttons, and secondary controls.',
    category: 'actions',
    level: 'molecule',
    props: [
      { name: 'variant', type: 'enum', required: false, default: 'standard', description: 'Visual style', values: ['standard', 'filled', 'tonal', 'outlined'] },
      { name: 'size', type: 'enum', required: false, default: 'md', description: 'Button size', values: ['sm', 'md', 'lg'] },
      { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Disables interaction' },
      { name: 'aria-label', type: 'string', required: true, description: 'Accessible label (required since no visible text)' },
      { name: 'children', type: 'ReactNode', required: true, description: 'Icon element' },
    ],
    usage: {
      when: [
        'Toolbar actions (bold, italic, align)',
        'Close/dismiss buttons on dialogs and alerts',
        'Compact secondary actions (edit, delete, more)',
        'Toggle actions (favorite, bookmark)',
      ],
      whenNot: [
        'Primary page actions - use Button with text label',
        'When the action meaning is not obvious from the icon alone',
        'When space is not constrained - prefer Button with label',
      ],
      alternatives: ['Button (with text label)', 'Tooltip + IconButton (for less obvious icons)'],
      dos: [
        'Always provide aria-label for screen readers',
        'Wrap with Tooltip for icons that are not universally understood',
        'Use consistent icon sizing within a toolbar',
      ],
      donts: [
        'Do not omit aria-label - icon-only buttons are inaccessible without it',
        'Do not use for primary actions unless space is extremely constrained',
      ],
      patterns: [
        { name: 'Toolbar row', description: 'Row of icon buttons with tooltips', components: ['Toolbar', 'Tooltip', 'IconButton'] },
      ],
      domainContext: 'In SQL editors, use for run query, format, and copy actions. In data tables, use for row-level actions like edit and delete.',
    },
    designTokens: ['--primary', '--muted-foreground', '--su-icon-button-size'],
    composableWith: ['Tooltip', 'Toolbar'],
  },

  // ── Feedback ─────────────────────────────────────────────────────────────

  {
    name: 'Alert',
    figmaName: 'cv-alert',
    description: 'Inline message for important information. Supports info, success, warning, and error severity levels.',
    category: 'feedback',
    level: 'atom',
    props: [
      { name: 'variant', type: 'enum', required: false, default: 'default', description: 'Visual severity', values: ['default', 'destructive', 'success', 'warning'] },
      { name: 'children', type: 'ReactNode', required: true, description: 'Alert content (use AlertTitle + AlertDescription)' },
    ],
    usage: {
      when: [
        'Displaying validation errors on forms',
        'Success messages after operations complete',
        'Warning about data quality or missing permissions',
        'Informational messages about system status',
      ],
      whenNot: [
        'Brief, auto-dismissing notifications - use Snackbar',
        'Blocking user interaction - use Dialog',
        'Status of async operations - use StatusDialog or Progress',
      ],
      alternatives: ['Snackbar (transient)', 'Dialog (blocking)', 'StatusDialog (operation status)'],
      dos: [
        'Use AlertTitle for the heading and AlertDescription for details',
        'Match variant to message severity (destructive for errors)',
        'Place inline near the related content',
      ],
      donts: [
        'Do not use for transient success messages - use Snackbar',
        'Do not stack more than 3 alerts on a single view',
      ],
      patterns: [
        { name: 'Form validation', description: 'Error alert above form fields', components: ['Alert', 'FormField'] },
        { name: 'Query result status', description: 'Success/error alert with query details', components: ['Alert', 'AlertTitle', 'AlertDescription'] },
      ],
      domainContext: 'In data pipelines, use for job failure notifications. In analytics, use for data quality warnings.',
    },
    designTokens: ['--destructive', '--success', '--warning', '--background', '--foreground'],
    subComponents: ['AlertTitle', 'AlertDescription'],
    composableWith: ['FormField', 'Dialog'],
  },

  {
    name: 'Dialog',
    figmaName: 'cv-dialog',
    description: 'Modal dialog for focused interactions requiring user attention.',
    category: 'feedback',
    level: 'molecule',
    props: [
      { name: 'open', type: 'boolean', required: false, description: 'Controlled open state' },
      { name: 'onOpenChange', type: 'function', required: false, description: 'Called when open state changes' },
      { name: 'children', type: 'ReactNode', required: true, description: 'Dialog trigger and content' },
    ],
    usage: {
      when: [
        'Confirmation before destructive actions (delete, overwrite)',
        'Forms that need focused attention (create, edit)',
        'Detail views that overlay the main content',
        'Settings or configuration panels',
      ],
      whenNot: [
        'Simple yes/no questions - consider inline confirmation',
        'Non-blocking information - use Alert or Snackbar',
        'Full workflows with many steps - use FullScreenDialog or SideSheet',
      ],
      alternatives: ['SideSheet (for detail/supplementary content)', 'FullScreenDialog (for complex workflows)', 'Alert (for inline messages)'],
      dos: [
        'Include clear title and description using DialogHeader',
        'Provide cancel and confirm actions in DialogFooter',
        'Trap focus within the dialog for accessibility',
      ],
      donts: [
        'Do not nest dialogs inside dialogs',
        'Do not use for content the user needs to reference while working',
      ],
      patterns: [
        { name: 'Delete confirmation', description: 'Dialog with destructive action button', components: ['Dialog', 'DialogContent', 'DialogHeader', 'DialogFooter', 'Button'] },
      ],
      domainContext: 'In data tools, use for SQL query save, connection configuration, and export settings.',
    },
    designTokens: ['--background', '--foreground', '--border'],
    subComponents: ['DialogContent', 'DialogDescription', 'DialogFooter', 'DialogHeader', 'DialogTitle', 'DialogTrigger'],
    composableWith: ['Button', 'FormField', 'Input'],
  },

  {
    name: 'CircularProgress',
    figmaName: 'cv-circular-progress',
    description: 'Circular loading indicator for inline loading states and progress.',
    category: 'feedback',
    level: 'atom',
    props: [
      { name: 'value', type: 'number', required: false, description: 'Progress value 0-100 (omit for indeterminate)' },
      { name: 'size', type: 'enum', required: false, default: 'md', description: 'Indicator size', values: ['sm', 'md', 'lg'] },
      { name: 'label', type: 'string', required: false, description: 'Accessible label' },
    ],
    usage: {
      when: [
        'Inline loading states (button loading, cell loading)',
        'Determinate progress for file uploads or processing',
        'Compact spaces where a full progress bar does not fit',
      ],
      whenNot: [
        'Full-width progress indication - use Progress (linear)',
        'Page-level loading - use skeleton or full-page loader',
      ],
      alternatives: ['Progress (linear bar)', 'Skeleton loading'],
      dos: ['Provide aria-label for screen readers'],
      donts: ['Do not use multiple spinners simultaneously in the same area'],
      patterns: [
        { name: 'Button loading', description: 'Spinner inside a disabled button', components: ['Button', 'CircularProgress'] },
      ],
      domainContext: 'In analytics, use for query execution progress. In ML UIs, use for model training progress.',
    },
    designTokens: ['--primary'],
    composableWith: ['Button', 'EmptyState'],
  },

  {
    name: 'Progress',
    figmaName: 'cv-linear-progress',
    description: 'Horizontal progress bar for operations and step indicators.',
    category: 'feedback',
    level: 'atom',
    props: [
      { name: 'value', type: 'number', required: false, description: 'Progress value 0-100' },
      { name: 'max', type: 'number', required: false, default: '100', description: 'Maximum value' },
    ],
    usage: {
      when: [
        'File upload progress',
        'Multi-step process completion',
        'Data loading progress bars',
      ],
      whenNot: [
        'Inline/compact loading - use CircularProgress',
        'Indeterminate loading in small spaces - use CircularProgress',
      ],
      alternatives: ['CircularProgress (compact)'],
      dos: ['Set aria-label describing what is progressing'],
      donts: ['Do not use indeterminate progress for operations that can be measured'],
      patterns: [],
      domainContext: 'In data pipelines, use for ETL job progress. In notebooks, use for cell execution progress.',
    },
    designTokens: ['--primary', '--muted'],
    composableWith: ['Card'],
  },

  {
    name: 'EmptyState',
    figmaName: 'cv-empty-state',
    description: 'Placeholder for views with no data. Includes icon, title, description, and optional action.',
    category: 'feedback',
    level: 'molecule',
    props: [
      { name: 'icon', type: 'ReactNode', required: false, description: 'Illustrative icon' },
      { name: 'title', type: 'string', required: true, description: 'Main heading text' },
      { name: 'description', type: 'string', required: false, description: 'Explanatory text' },
      { name: 'action', type: 'ReactNode', required: false, description: 'Call-to-action button' },
    ],
    usage: {
      when: [
        'No results from a search or query',
        'First-time empty state before user adds data',
        'Error states with recovery action',
      ],
      whenNot: [
        'Loading states - use CircularProgress or skeleton',
        'Temporary empty states during data refresh',
      ],
      alternatives: ['Alert (for error messages with details)'],
      dos: [
        'Include an actionable next step (button or link)',
        'Use friendly, helpful language',
      ],
      donts: [
        'Do not show empty state while data is still loading',
      ],
      patterns: [
        { name: 'No query results', description: 'Empty state with "Run a query" action', components: ['EmptyState', 'Button'] },
      ],
      domainContext: 'In data browsers, use for "No tables found" or "Run your first query". In ML tools, use for "No models trained yet".',
    },
    designTokens: ['--muted-foreground', '--muted'],
    composableWith: ['Button', 'Card'],
  },

  // ── Data Display ─────────────────────────────────────────────────────────

  {
    name: 'Badge',
    figmaName: 'cv-badge',
    description: 'Small label for status, counts, or categories. Supports dot, count, and text variants.',
    category: 'data-display',
    level: 'atom',
    props: [
      { name: 'variant', type: 'enum', required: false, default: 'default', description: 'Visual variant', values: ['default', 'secondary', 'destructive', 'outline', 'success', 'warning'] },
      { name: 'children', type: 'ReactNode', required: true, description: 'Badge label content' },
    ],
    usage: {
      when: [
        'Status indicators (active, pending, failed)',
        'Category labels on cards or list items',
        'Count indicators (unread messages, notifications)',
      ],
      whenNot: [
        'Interactive tags that can be removed - use FilterChip',
        'Long text labels - use plain text with styling',
      ],
      alternatives: ['FilterChip (interactive/removable)', 'Alert (for messages)'],
      dos: [
        'Use semantic variants (success for active, destructive for failed)',
        'Keep text short (1-2 words or a number)',
      ],
      donts: [
        'Do not use for interactive elements - badges are display-only',
      ],
      patterns: [
        { name: 'Status indicator', description: 'Badge showing job status on a table row', components: ['Badge'] },
      ],
      domainContext: 'In data pipelines, use for job status (running, failed, complete). In ML, use for model accuracy labels.',
    },
    designTokens: ['--primary', '--destructive', '--success', '--warning'],
    composableWith: ['Card', 'ListItem'],
  },

  {
    name: 'FilterChip',
    figmaName: 'cv-chip',
    description: 'Compact interactive element for filters, selections, or tags. Supports selected state and removal.',
    category: 'data-display',
    level: 'molecule',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Chip display text' },
      { name: 'selected', type: 'boolean', required: false, default: 'false', description: 'Whether the chip is selected' },
      { name: 'onSelect', type: 'function', required: false, description: 'Called when selection changes' },
      { name: 'removable', type: 'boolean', required: false, default: 'false', description: 'Show remove button' },
      { name: 'onRemove', type: 'function', required: false, description: 'Called when remove button is clicked' },
      { name: 'icon', type: 'ReactNode', required: false, description: 'Leading icon' },
    ],
    usage: {
      when: [
        'Multi-select filter controls',
        'Applied filter indicators (with removable=true)',
        'Tag/label selection',
      ],
      whenNot: [
        'Single selection from many options - use Select or RadioGroup',
        'Status display without interaction - use Badge',
        'Full text labels - use Badge',
      ],
      alternatives: ['Badge (display-only)', 'Select (single selection from dropdown)', 'Checkbox (binary choices in forms)'],
      dos: [
        'Group related chips together in a row',
        'Use removable chips for applied filters',
      ],
      donts: [
        'Do not use as navigation elements',
        'Do not make chips too long - keep labels concise',
      ],
      patterns: [
        { name: 'Filter bar', description: 'Row of selectable filter chips', components: ['FilterChip', 'FilterChip', 'FilterChip'] },
      ],
      domainContext: 'In data browsers, use for column type filters, table tag filters. In analytics, use for dimension/measure selection.',
    },
    designTokens: ['--primary', '--outline', '--su-chip-height'],
    subComponents: ['InputChip'],
    composableWith: ['Toolbar', 'Card'],
  },

  // ── Inputs ───────────────────────────────────────────────────────────────

  {
    name: 'Input',
    figmaName: 'cv-text-field',
    description: 'Single-line text input for names, emails, search, and short data entry.',
    category: 'inputs',
    level: 'atom',
    props: [
      { name: 'type', type: 'string', required: false, default: 'text', description: 'HTML input type' },
      { name: 'placeholder', type: 'string', required: false, description: 'Placeholder text' },
      { name: 'density', type: 'enum', required: false, default: 'compact', description: 'Height density level', values: ['compact', 'comfortable', 'spacious'] },
      { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Disables input' },
      { name: 'value', type: 'string', required: false, description: 'Controlled value' },
      { name: 'onChange', type: 'function', required: false, description: 'Called when value changes' },
    ],
    usage: {
      when: [
        'Short text entry (names, emails, URLs)',
        'Search fields',
        'Number inputs',
      ],
      whenNot: [
        'Multi-line text - use Textarea',
        'Selection from options - use Select',
        'SQL or code input - use SQLEditor',
      ],
      alternatives: ['Textarea (multi-line)', 'Select (predefined options)', 'Slider (numeric ranges)'],
      dos: [
        'Always wrap with FormField for label and error messaging',
        'Set appropriate HTML type (email, number, url)',
      ],
      donts: [
        'Do not use without a label (FormField or aria-label)',
      ],
      patterns: [
        { name: 'Form field', description: 'Input wrapped in FormField with label and validation', components: ['FormField', 'Input'] },
      ],
      domainContext: 'In SQL tools, use for connection name, database name inputs. In analytics, use for metric naming.',
    },
    designTokens: ['--input', '--border', '--ring', '--su-text-field-height'],
    composableWith: ['FormField', 'Label'],
  },

  {
    name: 'Textarea',
    figmaName: 'cv-text-area',
    description: 'Multi-line text input for comments, descriptions, and long content.',
    category: 'inputs',
    level: 'atom',
    props: [
      { name: 'placeholder', type: 'string', required: false, description: 'Placeholder text' },
      { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Disables input' },
      { name: 'rows', type: 'number', required: false, default: '3', description: 'Visible rows' },
      { name: 'value', type: 'string', required: false, description: 'Controlled value' },
    ],
    usage: {
      when: ['Multi-line text (descriptions, notes, comments)', 'SQL query input (simple cases)'],
      whenNot: ['Single-line input - use Input', 'Syntax-highlighted code - use CodeSnippet or SQLEditor'],
      alternatives: ['Input (single-line)', 'SQLEditor (code with syntax highlighting)'],
      dos: ['Wrap with FormField for label and validation'],
      donts: ['Do not use for single-line input'],
      patterns: [],
      domainContext: 'In data tools, use for query descriptions and column comments.',
    },
    designTokens: ['--input', '--border', '--ring'],
    composableWith: ['FormField'],
  },

  {
    name: 'Select',
    figmaName: 'cv-select',
    description: 'Dropdown selection from predefined options.',
    category: 'inputs',
    level: 'atom',
    props: [
      { name: 'value', type: 'string', required: false, description: 'Selected value' },
      { name: 'onValueChange', type: 'function', required: false, description: 'Called when selection changes' },
      { name: 'placeholder', type: 'string', required: false, description: 'Placeholder text when no value selected' },
      { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Disables selection' },
      { name: 'density', type: 'enum', required: false, default: 'compact', description: 'Height density level', values: ['compact', 'comfortable', 'spacious'] },
    ],
    usage: {
      when: ['Single selection from 4+ predefined options', 'Form fields where space is limited'],
      whenNot: ['2-3 options - use RadioGroup for visibility', 'Multi-select - use FilterChip group', 'Free text entry - use Input'],
      alternatives: ['RadioGroup (few visible options)', 'FilterChip (multi-select)', 'Input (free text)'],
      dos: ['Provide meaningful placeholder text', 'Group related options with SelectGroup'],
      donts: ['Do not use for 2-3 items where RadioGroup would be clearer'],
      patterns: [
        { name: 'Form select', description: 'Select wrapped in FormField', components: ['FormField', 'Select', 'SelectTrigger', 'SelectContent', 'SelectItem'] },
      ],
      domainContext: 'In data tools, use for database/schema/table selection. In analytics, use for aggregation type, chart type selection.',
    },
    designTokens: ['--border', '--background', '--su-select-height'],
    subComponents: ['SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue', 'SelectGroup', 'SelectLabel', 'SelectSeparator'],
    composableWith: ['FormField'],
  },

  {
    name: 'Checkbox',
    figmaName: 'cv-checkbox',
    description: 'Binary toggle for yes/no choices. Supports checked, unchecked, and indeterminate states.',
    category: 'inputs',
    level: 'atom',
    props: [
      { name: 'checked', type: 'boolean', required: false, description: 'Checked state' },
      { name: 'onCheckedChange', type: 'function', required: false, description: 'Called when state changes' },
      { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Disables interaction' },
      { name: 'indeterminate', type: 'boolean', required: false, default: 'false', description: 'Show indeterminate state (partial selection)' },
    ],
    usage: {
      when: ['Boolean yes/no options in forms', 'Multi-select in lists (select all/some)', 'Terms acceptance'],
      whenNot: ['Mutually exclusive options - use RadioGroup', 'On/off toggle with immediate effect - use Switch'],
      alternatives: ['Switch (immediate toggle)', 'RadioGroup (mutually exclusive)'],
      dos: ['Always pair with a Label', 'Use indeterminate for "select all" when partial'],
      donts: ['Do not use without a visible label'],
      patterns: [
        { name: 'Table row selection', description: 'Checkbox for selecting rows in a data table', components: ['Checkbox'] },
      ],
      domainContext: 'In data tables, use for row selection and bulk operations. In forms, use for feature toggles.',
    },
    designTokens: ['--primary', '--border'],
    composableWith: ['FormField', 'Label'],
  },

  {
    name: 'RadioGroup',
    figmaName: 'cv-radio',
    description: 'Single selection from multiple mutually exclusive options.',
    category: 'inputs',
    level: 'atom',
    props: [
      { name: 'value', type: 'string', required: false, description: 'Selected value' },
      { name: 'onValueChange', type: 'function', required: false, description: 'Called when selection changes' },
      { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Disables all options' },
    ],
    usage: {
      when: ['2-5 mutually exclusive options', 'When all options should be visible'],
      whenNot: ['Many options (6+) - use Select', 'Multi-select - use Checkbox group', 'Binary toggle - use Switch'],
      alternatives: ['Select (many options)', 'Checkbox (multi-select)', 'Switch (binary)'],
      dos: ['Show all options at once', 'Use RadioGroupItem with Label for each option'],
      donts: ['Do not use for more than 5-6 options'],
      patterns: [],
      domainContext: 'In analytics, use for chart type selection. In export dialogs, use for format selection (CSV/JSON/Excel).',
    },
    designTokens: ['--primary', '--border'],
    subComponents: ['RadioGroupItem'],
    composableWith: ['FormField'],
  },

  {
    name: 'FormField',
    figmaName: 'cv-form-field',
    description: 'Wrapper providing label, helper text, and error state for any input element.',
    category: 'inputs',
    level: 'molecule',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Field label text' },
      { name: 'helperText', type: 'string', required: false, description: 'Helper text below input' },
      { name: 'error', type: 'string', required: false, description: 'Error message (shows error state when set)' },
      { name: 'required', type: 'boolean', required: false, default: 'false', description: 'Show required indicator' },
      { name: 'children', type: 'ReactNode', required: true, description: 'Input element (Input, Select, Textarea, etc.)' },
    ],
    usage: {
      when: ['Wrapping any input element to provide label and validation', 'Forms with multiple fields'],
      whenNot: ['Standalone search inputs (use placeholder instead)', 'When label is provided separately'],
      alternatives: ['Label + Input (manual composition)'],
      dos: [
        'Always use for form inputs to ensure accessibility',
        'Set error prop for validation errors',
        'Use helperText for input format guidance',
      ],
      donts: ['Do not nest FormField inside FormField'],
      patterns: [
        { name: 'Login form', description: 'FormField wrapping email and password inputs', components: ['FormField', 'Input'] },
      ],
      domainContext: 'In connection dialogs, use for host, port, username fields. In query builders, use for parameter inputs.',
    },
    designTokens: ['--foreground', '--muted-foreground', '--destructive'],
    composableWith: ['Input', 'Textarea', 'Select', 'Checkbox', 'RadioGroup'],
  },

  // ── Navigation ───────────────────────────────────────────────────────────

  {
    name: 'Tabs',
    figmaName: 'cv-tab',
    description: 'Tabbed navigation for switching between views within the same context.',
    category: 'navigation',
    level: 'atom',
    props: [
      { name: 'value', type: 'string', required: false, description: 'Active tab value' },
      { name: 'onValueChange', type: 'function', required: false, description: 'Called when active tab changes' },
      { name: 'defaultValue', type: 'string', required: false, description: 'Default active tab' },
      { name: 'children', type: 'ReactNode', required: true, description: 'TabsList + TabsContent elements' },
    ],
    usage: {
      when: ['Multiple views of the same data (table/chart)', 'Section-level navigation within a page', 'Settings categories'],
      whenNot: ['Page-level navigation - use router/sidebar', 'Two states - use Switch or ViewModeToggle'],
      alternatives: ['ViewModeToggle (for table/chart switching)', 'Select (compact tab-like selection)'],
      dos: ['Use TabsList to group TabsTrigger elements', 'Match TabsContent value to TabsTrigger value'],
      donts: ['Do not use more than 6-7 tabs - consider a Select or sidebar instead'],
      patterns: [
        { name: 'Results view switcher', description: 'Tabs for table, chart, and raw JSON views', components: ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'] },
      ],
      domainContext: 'In SQL results, use for table/chart/raw view switching. In data browsers, use for tables/views/procedures tabs.',
    },
    designTokens: ['--primary', '--muted', '--muted-foreground', '--su-tab-height'],
    subComponents: ['TabsContent', 'TabsList', 'TabsTrigger'],
    composableWith: ['Card'],
  },

  // ── Layout ───────────────────────────────────────────────────────────────

  {
    name: 'Separator',
    figmaName: 'cv-divider',
    description: 'Visual divider line between content sections.',
    category: 'layout',
    level: 'atom',
    props: [
      { name: 'orientation', type: 'enum', required: false, default: 'horizontal', description: 'Divider orientation', values: ['horizontal', 'vertical'] },
      { name: 'decorative', type: 'boolean', required: false, default: 'true', description: 'Whether decorative (skip for screen readers)' },
    ],
    usage: {
      when: ['Separating content sections', 'Dividing list groups', 'Visual break in toolbars'],
      whenNot: ['Spacing between elements - use CSS margin/gap instead'],
      alternatives: ['CSS border or margin (for simple spacing)'],
      dos: ['Set decorative=true for visual-only dividers'],
      donts: ['Do not overuse - whitespace is often sufficient'],
      patterns: [],
    },
    designTokens: ['--border', '--su-divider-margin-y'],
  },

  // ── Content ──────────────────────────────────────────────────────────────

  {
    name: 'Tooltip',
    figmaName: 'cv-tooltip',
    description: 'Hover/focus popup with brief text. For icon-only buttons and truncated content.',
    category: 'content',
    level: 'atom',
    props: [
      { name: 'content', type: 'string', required: true, description: 'Tooltip text' },
      { name: 'side', type: 'enum', required: false, default: 'top', description: 'Tooltip position', values: ['top', 'right', 'bottom', 'left'] },
      { name: 'children', type: 'ReactNode', required: true, description: 'Trigger element' },
    ],
    usage: {
      when: ['Labeling icon-only buttons', 'Showing full text for truncated content', 'Providing additional context on hover'],
      whenNot: ['Rich content or interactions - use Popover or Dialog', 'Permanently visible information - use text directly'],
      alternatives: ['Dialog (for rich content)', 'Label (for permanently visible text)'],
      dos: ['Keep tooltip text short (under 80 characters)', 'Always add to IconButton elements'],
      donts: ['Do not put interactive content inside tooltips', 'Do not rely on tooltips for critical information (not accessible on touch)'],
      patterns: [
        { name: 'Icon button with tooltip', description: 'Tooltip wrapping an IconButton', components: ['Tooltip', 'IconButton'] },
      ],
    },
    designTokens: ['--foreground', '--background'],
    composableWith: ['IconButton', 'Badge'],
  },

  {
    name: 'Switch',
    figmaName: 'cv-switch',
    description: 'Toggle switch for immediate on/off state changes.',
    category: 'inputs',
    level: 'atom',
    props: [
      { name: 'checked', type: 'boolean', required: false, description: 'Current state' },
      { name: 'onCheckedChange', type: 'function', required: false, description: 'Called when toggled' },
      { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Disables toggle' },
    ],
    usage: {
      when: ['Settings toggles with immediate effect', 'Feature flags', 'Dark mode toggle'],
      whenNot: ['Form submissions that need explicit save - use Checkbox', 'Multiple selections - use Checkbox group'],
      alternatives: ['Checkbox (for form submissions)', 'RadioGroup (for multiple options)'],
      dos: ['Always pair with a Label', 'Use for settings that take effect immediately'],
      donts: ['Do not use for form fields that require a save action'],
      patterns: [],
      domainContext: 'In settings, use for auto-refresh, dark mode, notifications toggles.',
    },
    designTokens: ['--primary'],
    composableWith: ['FormField', 'Label'],
  },

  {
    name: 'ActionRibbon',
    figmaName: 'cv-action-ribbon',
    description: 'Contextual status bar for tables and lists. Shows state feedback (saved, error, loading) and bulk selection actions.',
    category: 'actions',
    level: 'molecule',
    props: [
      { name: 'state', type: "'inactive' | 'active' | 'positive' | 'caution' | 'negative' | 'loading' | 'pending' | 'checked'", required: false, default: "'inactive'", description: 'Visual state controlling background, icon, and label color' },
      { name: 'label', type: 'string', required: false, default: "'No changes'", description: 'Status label text' },
      { name: 'selectionCount', type: 'number', required: false, description: 'Number of selected items (checked state)' },
      { name: 'onClearSelection', type: '() => void', required: false, description: 'Callback when "Clear selection" is clicked' },
      { name: 'icons', type: 'React.ReactNode[]', required: false, description: 'Icon button elements (up to 3)' },
      { name: 'actions', type: 'React.ReactNode[]', required: false, description: 'Action button elements (up to 3)' },
      { name: 'checked', type: 'boolean', required: false, default: 'false', description: 'Checkbox checked state (checked variant)' },
      { name: 'onCheckedChange', type: '(checked: boolean) => void', required: false, description: 'Checkbox change handler' },
      { name: 'className', type: 'string', required: false, description: 'Additional CSS classes' },
    ],
    usage: {
      when: ['Table/list with bulk operations', 'Status feedback after save/error/load', 'Toolbar with contextual actions'],
      whenNot: ['Global app navigation - use AppBar', 'Standalone buttons - use Button directly'],
      alternatives: ['Alert (for standalone status messages)', 'Toolbar (for static action bars)'],
      dos: ['Use semantic states to communicate status', 'Provide clear selection counts in checked state', 'Limit to 3 icon buttons and 3 action buttons'],
      donts: ['Do not nest ActionRibbons', 'Do not use without a parent data container (table, list)'],
      patterns: [
        { name: 'Table bulk actions', description: 'Checked state with selection count and action buttons', components: ['ActionRibbon', 'IconButton', 'Button'] },
        { name: 'Save status feedback', description: 'Cycles through loading → positive/negative based on result', components: ['ActionRibbon'] },
      ],
      domainContext: 'In data tables, use for bulk delete, export, and status feedback after queries. In forms, use for save/discard status.',
    },
    designTokens: ['--primary', '--success', '--warning', '--destructive', '--muted-foreground'],
    composableWith: ['Button', 'IconButton', 'Checkbox', 'DataTable'],
  },

  // ── Feedback (continued) ────────────────────────────────────────────────

  {
    name: 'Snackbar',
    figmaName: 'cv-snackbar',
    description: 'Brief notification toast at screen edge. Auto-dismisses after a configurable duration. Supports action buttons for undo/retry.',
    category: 'feedback',
    level: 'molecule',
    props: [
      { name: 'message', type: 'string', required: true, description: 'Notification message text' },
      { name: 'variant', type: 'enum', required: false, default: 'default', description: 'Visual severity', values: ['default', 'positive', 'caution', 'negative'] },
      { name: 'actionLabel', type: 'string', required: false, description: 'Optional action button label (e.g. "Undo")' },
      { name: 'onAction', type: 'function', required: false, description: 'Callback when action button is clicked' },
      { name: 'dismissible', type: 'boolean', required: false, default: 'true', description: 'Show dismiss (X) button' },
      { name: 'duration', type: 'number', required: false, default: '4000', description: 'Auto-dismiss duration in ms (0 = no auto-dismiss)' },
      { name: 'open', type: 'boolean', required: false, description: 'Controlled visibility state' },
    ],
    usage: {
      when: [
        'Brief success confirmations (item saved, query executed)',
        'Non-blocking error notifications with retry action',
        'Undo opportunities after destructive actions',
      ],
      whenNot: [
        'Persistent messages the user must acknowledge - use Alert',
        'Blocking confirmations - use Dialog',
        'Operation progress or status - use StatusDialog',
      ],
      alternatives: ['Alert (persistent inline)', 'StatusDialog (operation status)', 'Dialog (blocking)'],
      dos: [
        'Keep messages under 2 lines',
        'Provide an undo action for destructive operations',
        'Use semantic variants (positive for success, negative for errors)',
      ],
      donts: [
        'Do not stack more than one snackbar at a time',
        'Do not use for critical errors that require user action',
      ],
      patterns: [
        { name: 'Save confirmation', description: 'Brief "Changes saved" snackbar after form submit', components: ['Snackbar'] },
        { name: 'Delete undo', description: 'Snackbar with undo action after item deletion', components: ['Snackbar'] },
      ],
      domainContext: 'In data tools, use for "Query executed", "Export complete", and "Row deleted — Undo" notifications.',
    },
    designTokens: ['--positive', '--caution', '--negative', '--inverse-surface', '--inverse-on-surface'],
    composableWith: ['Button'],
  },

  {
    name: 'StatusDialog',
    figmaName: 'cv-status-dialog',
    description: 'Card modal with left status-color strip showing operation progress. Displays loading, success, or error states with optional details.',
    category: 'feedback',
    level: 'molecule',
    props: [
      { name: 'open', type: 'boolean', required: true, description: 'Whether the dialog is open' },
      { name: 'onOpenChange', type: 'function', required: false, description: 'Called when open state changes (disabled during loading)' },
      { name: 'status', type: 'enum', required: true, description: 'Current operation status', values: ['loading', 'success', 'error'] },
      { name: 'title', type: 'string', required: true, description: 'Dialog title' },
      { name: 'description', type: 'string', required: false, description: 'Description or status detail text' },
      { name: 'action', type: 'ReactNode', required: false, description: 'Optional action button (e.g. retry for error)' },
      { name: 'details', type: 'ReactNode', required: false, description: 'Expandable details (e.g. error code block)' },
    ],
    usage: {
      when: [
        'Async operation feedback (query execution, data import)',
        'Multi-step processes with intermediate states',
        'Error reporting with expandable details and retry action',
      ],
      whenNot: [
        'Simple loading indicators - use CircularProgress',
        'Inline status messages - use Alert or Snackbar',
        'User confirmations - use Dialog',
      ],
      alternatives: ['Dialog (for user confirmations)', 'CircularProgress (inline loading)', 'Snackbar (brief notification)'],
      dos: [
        'Prevent close during loading state',
        'Provide retry action on error states',
        'Include error details for debugging',
      ],
      donts: [
        'Do not use for operations that complete in under 500ms',
        'Do not allow dismissal during loading (confuses operation state)',
      ],
      patterns: [
        { name: 'Query execution', description: 'Loading → success/error flow for SQL execution', components: ['StatusDialog', 'Button'] },
      ],
      domainContext: 'In SQL tools, use for query execution status. In data pipelines, use for import/export progress.',
    },
    designTokens: ['--primary', '--positive', '--negative', '--surface'],
    composableWith: ['Button', 'CodeSnippet'],
  },

  {
    name: 'FullScreenDialog',
    figmaName: 'cv-full-screen-dialog',
    description: 'Full-screen modal for complex workflows. Includes a top bar with title, close button, and optional action.',
    category: 'feedback',
    level: 'organism',
    props: [
      { name: 'open', type: 'boolean', required: true, description: 'Whether the dialog is open' },
      { name: 'onOpenChange', type: 'function', required: false, description: 'Called when open state changes' },
      { name: 'title', type: 'string', required: true, description: 'Title shown in the top bar' },
      { name: 'action', type: 'ReactNode', required: false, description: 'Optional action button in top-right (e.g. Save)' },
      { name: 'children', type: 'ReactNode', required: false, description: 'Scrollable body content' },
    ],
    usage: {
      when: [
        'Multi-step forms or wizards that need full screen space',
        'Document editors, code editors, or content creation flows',
        'Settings panels with many sections',
      ],
      whenNot: [
        'Simple confirmations - use Dialog',
        'Supplementary content alongside main view - use SideSheet',
        'Quick forms with few fields - use Dialog',
      ],
      alternatives: ['Dialog (for simple modals)', 'SideSheet (for supplementary content)', 'FocusedPage (for non-modal full-page)'],
      dos: [
        'Include clear close/cancel and save/submit actions in the top bar',
        'Use scrollable body content for long forms',
      ],
      donts: [
        'Do not use for simple confirmations or alerts',
        'Do not nest dialogs inside a full-screen dialog',
      ],
      patterns: [
        { name: 'Editor workflow', description: 'Full-screen code or document editor with save action', components: ['FullScreenDialog', 'Button'] },
      ],
      domainContext: 'In SQL editors, use for full-screen query editing. In ML tools, use for model configuration wizards.',
    },
    designTokens: ['--surface', '--on-surface', '--primary'],
    composableWith: ['Button', 'FormField', 'Tabs'],
  },

  // ── Layout (continued) ──────────────────────────────────────────────────

  {
    name: 'SideSheet',
    figmaName: 'cv-side-sheet',
    description: 'Slide-out panel from screen edge for detail views, filters, and supplementary content. Includes header with title and optional footer.',
    category: 'layout',
    level: 'organism',
    props: [
      { name: 'open', type: 'boolean', required: true, description: 'Whether the sheet is open' },
      { name: 'onOpenChange', type: 'function', required: false, description: 'Called when open state changes' },
      { name: 'side', type: 'enum', required: false, default: 'right', description: 'Which edge the sheet slides from', values: ['left', 'right'] },
      { name: 'title', type: 'string', required: true, description: 'Sheet title (required for accessibility)' },
      { name: 'description', type: 'string', required: false, description: 'Optional subtitle below the title' },
      { name: 'width', type: 'string', required: false, default: '380px', description: 'Custom width' },
      { name: 'children', type: 'ReactNode', required: false, description: 'Sheet body content' },
      { name: 'footer', type: 'ReactNode', required: false, description: 'Footer content (e.g. action buttons)' },
    ],
    usage: {
      when: [
        'Detail views for selected items (row details, node properties)',
        'Filter panels alongside main content',
        'Configuration or settings panels',
      ],
      whenNot: [
        'Content that blocks the main view - use Dialog',
        'Full workflows requiring maximum space - use FullScreenDialog',
        'Navigation menus - use sidebar navigation',
      ],
      alternatives: ['Dialog (for blocking modals)', 'FullScreenDialog (for large workflows)', 'Tabs (for view switching)'],
      dos: [
        'Always provide a title for accessibility',
        'Use footer for action buttons (save, apply)',
        'Allow the user to interact with the main content while sheet is open',
      ],
      donts: [
        'Do not use for primary navigation',
        'Do not exceed 50% of viewport width',
      ],
      patterns: [
        { name: 'Row detail panel', description: 'Side sheet showing details of a selected table row', components: ['SideSheet', 'FormField'] },
        { name: 'Filter panel', description: 'Side sheet with filter controls for a data table', components: ['SideSheet', 'FilterChip', 'Button'] },
      ],
      domainContext: 'In data browsers, use for table/column properties. In analytics, use for chart configuration panels.',
    },
    designTokens: ['--surface', '--on-surface', '--border'],
    composableWith: ['Button', 'FormField', 'Tabs', 'ListItem'],
  },

  {
    name: 'FocusedPage',
    figmaName: 'cv-focused-page',
    description: 'Full-page layout with centered content area, breadcrumb navigation, and optional back button. Use for onboarding, settings, and focused workflows.',
    category: 'layout',
    level: 'organism',
    props: [
      { name: 'title', type: 'string', required: true, description: 'Page title' },
      { name: 'subtitle', type: 'string', required: false, description: 'Subtitle below the title' },
      { name: 'onBack', type: 'function', required: false, description: 'Back navigation callback (shows back arrow when provided)' },
      { name: 'breadcrumbs', type: 'BreadcrumbItem[]', required: false, description: 'Breadcrumb trail items' },
      { name: 'maxWidth', type: 'string', required: false, default: '768px', description: 'Max width of centered content area' },
      { name: 'headerActions', type: 'ReactNode', required: false, description: 'Actions rendered in header right area' },
      { name: 'children', type: 'ReactNode', required: false, description: 'Page body content' },
    ],
    usage: {
      when: [
        'Settings pages with focused content',
        'Onboarding or setup wizards',
        'Detail pages with back navigation',
      ],
      whenNot: [
        'Dashboard layouts with sidebars - use custom layout',
        'Content that needs full width - use standard layout',
        'Modal workflows - use FullScreenDialog',
      ],
      alternatives: ['FullScreenDialog (for modal workflows)', 'SideSheet (for supplementary panels)'],
      dos: [
        'Provide breadcrumbs or back button for navigation',
        'Keep content centered and focused',
      ],
      donts: [
        'Do not use for data-dense layouts that need full width',
      ],
      patterns: [
        { name: 'Settings page', description: 'Focused page with breadcrumbs and form content', components: ['FocusedPage', 'FormField', 'Button'] },
      ],
      domainContext: 'In data tools, use for connection setup, workspace settings, and profile configuration pages.',
    },
    designTokens: ['--background', '--foreground', '--border'],
    composableWith: ['Button', 'FormField', 'Tabs'],
  },

  {
    name: 'OnboardingCards',
    figmaName: 'cv-onboarding-cards',
    description: 'Step-by-step card carousel for first-time user guidance. Tracks completion state and supports collapse/dismiss.',
    category: 'layout',
    level: 'organism',
    props: [
      { name: 'cards', type: 'OnboardingCard[]', required: true, description: 'Array of onboarding step cards' },
      { name: 'heading', type: 'string', required: false, description: 'Header heading text' },
      { name: 'completed', type: 'boolean', required: false, default: 'false', description: 'Whether all cards are completed (shows completion banner)' },
      { name: 'collapsed', type: 'boolean', required: false, default: 'false', description: 'Whether the widget is collapsed (header only)' },
      { name: 'onSkipAll', type: 'function', required: false, description: 'Callback when user clicks "Skip all"' },
      { name: 'onToggleCollapse', type: 'function', required: false, description: 'Callback for collapse/expand toggle' },
      { name: 'onDismiss', type: 'function', required: false, description: 'Callback when user dismisses completion banner' },
    ],
    usage: {
      when: [
        'First-time user onboarding with sequential steps',
        'Feature discovery for new capabilities',
        'Getting started guides',
      ],
      whenNot: [
        'Inline help or tooltips - use Tooltip',
        'One-time notifications - use Snackbar or Alert',
        'Navigation between sections - use Tabs',
      ],
      alternatives: ['EmptyState (for single empty-state CTA)', 'Dialog (for one-time welcome modals)'],
      dos: [
        'Track completion state per card',
        'Allow users to skip or dismiss the entire onboarding',
        'Show completion banner when all steps are done',
      ],
      donts: [
        'Do not show more than 5-6 onboarding steps',
        'Do not block the main UI - keep onboarding dismissible',
      ],
      patterns: [
        { name: 'Getting started', description: 'Onboarding cards with sequential setup steps', components: ['OnboardingCards'] },
      ],
      domainContext: 'In data tools, use for "Connect a database", "Run your first query", "Create a dashboard" onboarding flows.',
    },
    designTokens: ['--surface', '--primary', '--positive'],
    composableWith: ['Button'],
  },

  // ── Data Display (continued) ────────────────────────────────────────────

  {
    name: 'ListItem',
    figmaName: 'cv-list-item',
    description: 'Single row in a list with primary/secondary/tertiary text, leading and trailing elements. Supports 1-line, 2-line, and 3-line layouts.',
    category: 'data-display',
    level: 'atom',
    props: [
      { name: 'primary', type: 'string', required: true, description: 'Primary text' },
      { name: 'secondary', type: 'string', required: false, description: 'Secondary text (2-line or 3-line layout)' },
      { name: 'tertiary', type: 'string', required: false, description: 'Tertiary text (3-line layout)' },
      { name: 'leading', type: 'ReactNode', required: false, description: 'Leading element (icon, avatar, checkbox)' },
      { name: 'trailing', type: 'ReactNode', required: false, description: 'Trailing element (icon, text, switch)' },
      { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Disabled state' },
      { name: 'selected', type: 'boolean', required: false, default: 'false', description: 'Selected/active state' },
    ],
    usage: {
      when: [
        'Vertical lists of items (files, contacts, settings)',
        'Navigation lists with icons',
        'Selection lists with leading checkboxes',
      ],
      whenNot: [
        'Tabular data with columns - use DataTable',
        'Hierarchical data - use TreeList',
        'Simple text lists - use plain HTML list',
      ],
      alternatives: ['DataTable (for columnar data)', 'TreeList (for hierarchical data)'],
      dos: [
        'Use leading icons for visual categorization',
        'Use trailing elements for secondary actions or metadata',
        'Keep primary text concise',
      ],
      donts: [
        'Do not put complex layouts inside list items',
        'Do not use more than 3 lines of text',
      ],
      patterns: [
        { name: 'Navigation list', description: 'List items with icons for sidebar navigation', components: ['ListItem', 'Icon'] },
        { name: 'Selection list', description: 'List items with checkboxes for multi-select', components: ['ListItem', 'Checkbox'] },
      ],
      domainContext: 'In data browsers, use for table/view/procedure lists. In file explorers, use for file/folder lists.',
    },
    designTokens: ['--on-surface', '--on-surface-variant', '--primary'],
    composableWith: ['Icon', 'Checkbox', 'Switch', 'Badge'],
  },

  {
    name: 'TreeList',
    figmaName: 'cv-tree-list',
    description: 'Hierarchical tree view for nested data with expand/collapse. Supports controlled and uncontrolled expansion.',
    category: 'data-display',
    level: 'organism',
    props: [
      { name: 'nodes', type: 'TreeNode[]', required: true, description: 'Tree data structure with id, label, icon, and children' },
      { name: 'selectedId', type: 'string', required: false, description: 'Currently selected node id' },
      { name: 'onSelect', type: 'function', required: false, description: 'Callback when a node is selected' },
      { name: 'expandedIds', type: 'Set<string>', required: false, description: 'Controlled set of expanded node ids' },
      { name: 'onToggle', type: 'function', required: false, description: 'Callback when a node is toggled' },
    ],
    usage: {
      when: [
        'File/folder hierarchies',
        'Database schema browsers (database > schema > table > column)',
        'Organizational charts or nested categories',
      ],
      whenNot: [
        'Flat lists - use ListItem',
        'Tabular data - use DataTable',
        'Deeply nested data (>5 levels) - consider search or flat list with breadcrumbs',
      ],
      alternatives: ['ListItem (for flat lists)', 'DataTable (for tabular data)'],
      dos: [
        'Provide icons for different node types',
        'Support keyboard navigation (arrow keys, Enter)',
        'Use controlled expandedIds for preserving state across re-renders',
      ],
      donts: [
        'Do not load entire deep hierarchies upfront - lazy-load children',
      ],
      patterns: [
        { name: 'Schema browser', description: 'Tree list of databases, schemas, tables, columns', components: ['TreeList'] },
      ],
      domainContext: 'In SQL tools, use for database object browser. In file managers, use for directory tree. In ML tools, use for model/experiment hierarchy.',
    },
    designTokens: ['--on-surface', '--primary', '--on-surface-variant'],
    subComponents: ['TreeListItem'],
    composableWith: ['SideSheet', 'Icon'],
  },

  {
    name: 'DataTable',
    figmaName: 'cv-data-table',
    description: 'Full-featured data table with row selection, column sorting, density levels, virtual scrolling, and per-row actions. For admin and management UIs.',
    category: 'data-display',
    level: 'organism',
    props: [
      { name: 'data', type: 'T[]', required: true, description: 'Row data array' },
      { name: 'columns', type: 'DataTableColumn[]', required: true, description: 'Column definitions with key, header, width, sortable, and render' },
      { name: 'height', type: 'number', required: false, default: '400', description: 'Container height in px for virtual scrolling' },
      { name: 'density', type: 'enum', required: false, default: 'default', description: 'Row density level', values: ['compact', 'default', 'comfortable', 'spacious'] },
      { name: 'virtualScrolling', type: 'boolean', required: false, default: 'true', description: 'Enable virtual scrolling (auto-disabled for ≤100 rows)' },
      { name: 'selectedKeys', type: 'Set<string|number>', required: false, description: 'Set of selected row keys (controlled)' },
      { name: 'onSelectionChange', type: 'function', required: false, description: 'Callback when row selection changes' },
      { name: 'sort', type: 'SortState', required: false, description: 'Current sort state (column + direction)' },
      { name: 'onSortChange', type: 'function', required: false, description: 'Callback when sort changes' },
      { name: 'rowActions', type: 'RowAction[]', required: false, description: 'Actions rendered in per-row overflow menu' },
      { name: 'onRowClick', type: 'function', required: false, description: 'Callback when a row body is clicked' },
    ],
    usage: {
      when: [
        'Admin panels with selectable, sortable rows',
        'Data management UIs with CRUD operations',
        'Large datasets requiring virtual scrolling',
      ],
      whenNot: [
        'Simple read-only data display - use a basic HTML table',
        'Hierarchical data - use TreeList',
        'Key-value pairs - use ListItem or definition list',
      ],
      alternatives: ['TreeList (for hierarchical data)', 'ListItem (for simple lists)'],
      dos: [
        'Define column widths for consistent layout',
        'Use row actions for per-row operations',
        'Enable virtual scrolling for datasets over 100 rows',
        'Provide aria-label for accessibility',
      ],
      donts: [
        'Do not render more than 10-12 columns without horizontal scrolling',
        'Do not use for tiny datasets where a simple list suffices',
      ],
      patterns: [
        { name: 'CRUD table', description: 'DataTable with selection, sorting, and row actions', components: ['DataTable', 'ActionRibbon', 'Button'] },
      ],
      domainContext: 'In data tools, use for query results, table management, and user administration. In ML tools, use for experiment/model listing.',
    },
    designTokens: ['--surface', '--on-surface', '--border', '--primary'],
    subComponents: ['DataTableRow'],
    composableWith: ['ActionRibbon', 'FilterChip', 'Badge', 'SideSheet'],
  },

  {
    name: 'NotebookCell',
    figmaName: 'cv-notebook-cell',
    description: 'Executable code or markdown cell for notebook-style interfaces. Supports execution status, error display, and rendered output.',
    category: 'data-display',
    level: 'organism',
    props: [
      { name: 'type', type: 'enum', required: true, description: 'Cell type', values: ['code', 'markdown'] },
      { name: 'value', type: 'string', required: true, description: 'Cell content value' },
      { name: 'onValueChange', type: 'function', required: false, description: 'Callback when value changes (makes cell editable)' },
      { name: 'status', type: 'enum', required: false, default: 'idle', description: 'Execution status', values: ['idle', 'running', 'success', 'error'] },
      { name: 'executionCount', type: 'number', required: false, description: 'Execution count number shown in gutter' },
      { name: 'selected', type: 'boolean', required: false, default: 'false', description: 'Whether cell is selected' },
      { name: 'error', type: 'NotebookCellError', required: false, description: 'Error displayed between editor and output' },
      { name: 'renderedOutput', type: 'ReactNode', required: false, description: 'Rendered output below editor (table, chart, etc.)' },
      { name: 'editor', type: 'ReactNode', required: false, description: 'Custom editor element (replaces built-in textarea)' },
      { name: 'onRun', type: 'function', required: false, description: 'Run callback triggered by Shift+Enter' },
    ],
    usage: {
      when: [
        'Interactive data analysis notebooks',
        'SQL query cells with inline results',
        'Mixed code and documentation workflows',
      ],
      whenNot: [
        'Simple code display - use CodeSnippet',
        'Single query input - use SQLEditor',
        'Document editing - use rich text editor',
      ],
      alternatives: ['CodeSnippet (for read-only code display)', 'Textarea (for plain text editing)'],
      dos: [
        'Show execution count in the gutter',
        'Display errors between editor and output',
        'Support Shift+Enter to run',
      ],
      donts: [
        'Do not auto-execute cells without user action',
      ],
      patterns: [
        { name: 'SQL notebook', description: 'Code cell with SQL editor and DataTable output', components: ['NotebookCell', 'DataTable'] },
      ],
      domainContext: 'In data analysis tools, use for interactive SQL/Python notebooks. In ML tools, use for experiment notebooks.',
    },
    designTokens: ['--surface', '--primary', '--negative', '--positive'],
    composableWith: ['DataTable', 'CodeSnippet', 'Alert'],
  },

  // ── Inputs (continued) ──────────────────────────────────────────────────

  {
    name: 'Slider',
    figmaName: 'cv-slider',
    description: 'Range input for selecting numeric values. Supports min/max, step increments, and commit-on-release.',
    category: 'inputs',
    level: 'atom',
    props: [
      { name: 'value', type: 'number', required: false, description: 'Current value (controlled)' },
      { name: 'defaultValue', type: 'number', required: false, description: 'Default value (uncontrolled)' },
      { name: 'min', type: 'number', required: false, default: '0', description: 'Minimum value' },
      { name: 'max', type: 'number', required: false, default: '100', description: 'Maximum value' },
      { name: 'step', type: 'number', required: false, default: '1', description: 'Step increment' },
      { name: 'disabled', type: 'boolean', required: false, default: 'false', description: 'Disabled state' },
      { name: 'onValueChange', type: 'function', required: false, description: 'Called on every value change during drag' },
      { name: 'onValueCommit', type: 'function', required: false, description: 'Called on mouse up / touch end (final value)' },
    ],
    usage: {
      when: [
        'Numeric value selection within a known range',
        'Volume, brightness, or opacity controls',
        'Price range or threshold filters',
      ],
      whenNot: [
        'Precise numeric input - use Input with type="number"',
        'Selection from discrete options - use RadioGroup or Select',
      ],
      alternatives: ['Input (for precise numbers)', 'RadioGroup (for discrete choices)'],
      dos: [
        'Always provide an aria-label',
        'Show the current value near the slider',
        'Use onValueCommit for expensive operations (API calls)',
      ],
      donts: [
        'Do not use for ranges wider than 1000 without step increments',
      ],
      patterns: [
        { name: 'Range filter', description: 'Slider with min/max labels for filtering', components: ['Slider', 'FormField'] },
      ],
      domainContext: 'In analytics, use for confidence thresholds, date range selectors, and sample size controls.',
    },
    designTokens: ['--primary', '--muted'],
    composableWith: ['FormField', 'Label'],
  },

  // ── Navigation (continued) ──────────────────────────────────────────────

  {
    name: 'Menu',
    figmaName: 'cv-menu',
    description: 'Dropdown menu of actions or navigation links. Supports icons, disabled items, and destructive actions.',
    category: 'navigation',
    level: 'molecule',
    props: [
      { name: 'trigger', type: 'ReactNode', required: true, description: 'Menu trigger element (button or icon button)' },
      { name: 'items', type: 'MenuItem[]', required: true, description: 'Menu item definitions with label, icon, onClick, disabled, destructive' },
      { name: 'align', type: 'enum', required: false, default: 'start', description: 'Alignment relative to trigger', values: ['start', 'end'] },
    ],
    usage: {
      when: [
        'Context menus for row-level actions',
        'Overflow menus when toolbar space is limited',
        'Account/profile dropdown menus',
      ],
      whenNot: [
        'Navigation between pages - use sidebar or tabs',
        'Selection from form options - use Select',
        'Actions always visible - use Button or IconButton',
      ],
      alternatives: ['Select (for form selections)', 'Toolbar (for visible actions)', 'Tabs (for view switching)'],
      dos: [
        'Use destructive styling for delete/remove actions',
        'Group related items visually with separators',
        'Provide icons for quick scanning',
      ],
      donts: [
        'Do not put more than 8-10 items in a single menu',
        'Do not nest menus more than one level deep',
      ],
      patterns: [
        { name: 'Row overflow', description: 'Three-dot icon button triggering a context menu', components: ['Menu', 'IconButton'] },
      ],
      domainContext: 'In data tables, use for per-row action overflow menus. In editors, use for file/edit/view menus.',
    },
    designTokens: ['--surface', '--on-surface', '--destructive'],
    composableWith: ['IconButton', 'Separator'],
  },

  {
    name: 'Toolbar',
    figmaName: 'cv-toolbar',
    description: 'Horizontal or vertical bar of tools and actions. Container for IconButtons, Buttons, and Separators.',
    category: 'navigation',
    level: 'molecule',
    props: [
      { name: 'children', type: 'ReactNode', required: true, description: 'Toolbar content (IconButtons, Buttons, Separators)' },
      { name: 'orientation', type: 'enum', required: false, default: 'horizontal', description: 'Toolbar orientation', values: ['horizontal', 'vertical'] },
    ],
    usage: {
      when: [
        'Editor formatting toolbars (bold, italic, align)',
        'Page-level action bars',
        'Filter/sort controls above data tables',
      ],
      whenNot: [
        'Navigation between pages - use Tabs or sidebar',
        'Status display - use ActionRibbon',
        'Single action - use Button directly',
      ],
      alternatives: ['ActionRibbon (for status + actions)', 'Tabs (for view switching)'],
      dos: [
        'Use Separator to group related actions',
        'Wrap icon buttons with Tooltips',
        'Keep toolbars to a single row',
      ],
      donts: [
        'Do not overflow toolbar items without an overflow menu',
      ],
      patterns: [
        { name: 'Editor toolbar', description: 'Formatting actions with separators', components: ['Toolbar', 'IconButton', 'Separator', 'Tooltip'] },
      ],
      domainContext: 'In SQL editors, use for run/format/copy toolbar. In notebooks, use for cell-level action toolbars.',
    },
    designTokens: ['--border', '--muted-foreground'],
    composableWith: ['IconButton', 'Button', 'Separator', 'Tooltip'],
  },

  // ── Content (continued) ─────────────────────────────────────────────────

  {
    name: 'Typography',
    figmaName: 'cv-typography',
    description: 'Text element with design system typography presets. Maps to semantic HTML elements (h1-h6, p, span) based on variant.',
    category: 'content',
    level: 'atom',
    props: [
      { name: 'variant', type: 'enum', required: false, default: 'body-md', description: 'Typography preset', values: ['headline-lg', 'headline-md', 'headline-sm', 'title-lg', 'title-md', 'title-sm', 'body-lg', 'body-md', 'body-sm', 'caption', 'overline'] },
      { name: 'as', type: 'string', required: false, description: 'Override the default HTML element (e.g. "span", "label")' },
      { name: 'muted', type: 'boolean', required: false, default: 'false', description: 'Apply muted (secondary) color' },
      { name: 'children', type: 'ReactNode', required: true, description: 'Text content' },
    ],
    usage: {
      when: [
        'Page headings and section titles',
        'Body text that needs consistent styling',
        'Captions and overline labels',
      ],
      whenNot: [
        'Interactive text - use Button or Link',
        'Simple inline text that does not need semantic styling',
      ],
      alternatives: ['TextLockup (for title + subtitle pairs)'],
      dos: [
        'Use semantic variants (headline for headings, body for paragraphs)',
        'Use muted for secondary/helper text',
      ],
      donts: [
        'Do not use headline variants for body text',
        'Do not manually set font sizes when a variant matches',
      ],
      patterns: [
        { name: 'Page header', description: 'Headline + body description', components: ['Typography', 'Typography'] },
      ],
      domainContext: 'Use across all UIs for consistent type hierarchy per the Covalent design system.',
    },
    designTokens: ['--on-surface', '--on-surface-variant'],
    composableWith: ['TextLockup'],
  },

  {
    name: 'Icon',
    figmaName: 'cv-icon',
    description: 'Themed icon container with consistent sizing and semantic color. Wraps SVG icons from lucide-react or custom sources.',
    category: 'content',
    level: 'atom',
    props: [
      { name: 'size', type: 'enum', required: false, default: 'md', description: 'Icon size preset', values: ['xs', 'sm', 'md', 'lg', 'xl'] },
      { name: 'color', type: 'enum', required: false, default: 'default', description: 'Semantic color', values: ['default', 'primary', 'muted', 'success', 'warning', 'error'] },
      { name: 'children', type: 'ReactNode', required: true, description: 'SVG icon element' },
    ],
    usage: {
      when: [
        'Leading icons in list items, buttons, and chips',
        'Status icons with semantic color',
        'Decorative icons in empty states',
      ],
      whenNot: [
        'Interactive icons - use IconButton',
        'Large illustrations - use custom SVG or image',
      ],
      alternatives: ['IconButton (for clickable icons)'],
      dos: [
        'Use semantic colors for status icons (success=green, error=red)',
        'Keep consistent size within a context',
      ],
      donts: [
        'Do not use Icon for clickable elements - wrap in IconButton',
      ],
      patterns: [],
      domainContext: 'In data tools, use for column type icons, status indicators, and category markers.',
    },
    designTokens: ['--on-surface', '--primary', '--positive', '--negative', '--caution'],
    composableWith: ['IconButton', 'ListItem', 'Badge'],
  },

  {
    name: 'IconLockup',
    figmaName: 'cv-icon-lockup',
    description: 'Icon paired with label text and optional description. Supports horizontal and vertical layouts.',
    category: 'content',
    level: 'molecule',
    props: [
      { name: 'icon', type: 'ReactNode', required: true, description: 'Icon element (SVG or Icon component)' },
      { name: 'label', type: 'string', required: true, description: 'Label text' },
      { name: 'description', type: 'string', required: false, description: 'Optional description below label' },
      { name: 'layout', type: 'enum', required: false, default: 'horizontal', description: 'Layout direction', values: ['horizontal', 'vertical'] },
    ],
    usage: {
      when: [
        'Feature lists with icons and descriptions',
        'Stats or metric displays with icons',
        'Navigation items with icons',
      ],
      whenNot: [
        'Clickable list rows - use ListItem',
        'Icon-only display - use Icon',
      ],
      alternatives: ['ListItem (for interactive rows)', 'TextLockup (for text-only pairs)'],
      dos: [
        'Use consistent icon sizes within a group of lockups',
        'Keep labels concise',
      ],
      donts: [
        'Do not use for navigation - use ListItem or Menu instead',
      ],
      patterns: [
        { name: 'Feature grid', description: 'Grid of icon lockups for feature overview', components: ['IconLockup'] },
      ],
      domainContext: 'In onboarding, use for feature highlights. In dashboards, use for metric cards with icons.',
    },
    designTokens: ['--on-surface', '--on-surface-variant'],
    composableWith: ['Icon'],
  },

  {
    name: 'TextLockup',
    figmaName: 'cv-text-lockup',
    description: 'Title/subtitle text pairing with size presets and alignment options. Use for card headers, section titles, and metadata display.',
    category: 'content',
    level: 'molecule',
    props: [
      { name: 'title', type: 'string', required: true, description: 'Primary title text' },
      { name: 'subtitle', type: 'string', required: false, description: 'Subtitle or supporting text' },
      { name: 'size', type: 'enum', required: false, default: 'md', description: 'Size preset', values: ['sm', 'md', 'lg'] },
      { name: 'align', type: 'enum', required: false, default: 'left', description: 'Text alignment', values: ['left', 'center'] },
    ],
    usage: {
      when: [
        'Card headers with title and subtitle',
        'Section headings with descriptions',
        'Metadata display (key-value header pairs)',
      ],
      whenNot: [
        'Icon + text combinations - use IconLockup',
        'Interactive headers - use custom composition',
      ],
      alternatives: ['Typography (for single text elements)', 'IconLockup (for icon + text)'],
      dos: [
        'Use size="lg" for page headings, "md" for section headings, "sm" for card headers',
      ],
      donts: [
        'Do not use for body text paragraphs',
      ],
      patterns: [
        { name: 'Card header', description: 'TextLockup as card title area', components: ['TextLockup'] },
      ],
    },
    designTokens: ['--on-surface', '--on-surface-variant'],
    composableWith: ['Badge'],
  },

  {
    name: 'CodeSnippet',
    figmaName: 'cv-code-snippet',
    description: 'Syntax-highlighted code block with copy button, filename header, and optional line numbers. Auto-detects language from filename extension.',
    category: 'content',
    level: 'molecule',
    props: [
      { name: 'code', type: 'string', required: true, description: 'Code content to display' },
      { name: 'language', type: 'string', required: false, description: 'Language for syntax highlighting (e.g. "sql", "javascript", "python")' },
      { name: 'filename', type: 'string', required: false, description: 'Filename shown in header (also infers language from extension)' },
      { name: 'showLineNumbers', type: 'boolean', required: false, default: 'false', description: 'Show line numbers' },
      { name: 'copyable', type: 'boolean', required: false, default: 'true', description: 'Show copy-to-clipboard button' },
      { name: 'maxHeight', type: 'string', required: false, description: 'Max height before scrolling (e.g. "300px")' },
    ],
    usage: {
      when: [
        'Displaying SQL queries, code samples, or configuration snippets',
        'API documentation with code examples',
        'Error details with stack traces',
      ],
      whenNot: [
        'Editable code - use NotebookCell or CodeMirror',
        'Inline code in text - use <code> element',
        'Plain text output - use <pre> element',
      ],
      alternatives: ['NotebookCell (for editable code)', 'Textarea (for simple code input)'],
      dos: [
        'Provide language or filename for syntax highlighting',
        'Enable copy button for code users will want to reuse',
        'Set maxHeight for long snippets',
      ],
      donts: [
        'Do not use for editable code - use an editor component',
      ],
      patterns: [
        { name: 'Query display', description: 'SQL code snippet with filename and copy button', components: ['CodeSnippet'] },
      ],
      domainContext: 'In SQL tools, use for displaying generated queries and execution plans. In API docs, use for request/response examples.',
    },
    designTokens: ['--surface', '--on-surface-variant', '--cm-keyword', '--cm-string', '--cm-number', '--cm-comment'],
    composableWith: ['StatusDialog'],
  },

  // ── Flow Components ───────────────────────────────────────────────────

  {
    name: 'FlowNode',
    figmaName: 'cv-flow-node',
    description: 'Generic themed node for ReactFlow canvases. Card-based with colored header, optional icon, description, and status badge. Includes configurable source/target connection handles.',
    category: 'flow',
    level: 'atom',
    props: [
      { name: 'label', type: 'string', required: true, description: 'Primary text label displayed in the node header' },
      { name: 'description', type: 'string', required: false, description: 'Supporting description text below the header' },
      { name: 'icon', type: 'ReactNode', required: false, description: 'Icon element displayed before the label' },
      { name: 'status', type: 'ReactNode', required: false, description: 'Status element (e.g. Badge) displayed after the label' },
      { name: 'variant', type: 'enum', required: false, default: 'default', description: 'Visual variant mapped to theme tokens', values: ['default', 'info', 'positive', 'warning', 'error', 'purple'] },
      { name: 'sourceHandle', type: 'boolean', required: false, default: 'true', description: 'Show output handle on right side' },
      { name: 'targetHandle', type: 'boolean', required: false, default: 'true', description: 'Show input handle on left side' },
    ],
    usage: {
      when: [
        'Building visual workflow editors with ReactFlow',
        'Representing pipeline stages, data sources, or processing steps',
        'Creating node-based UIs for ML workflows, ETL pipelines, or agent orchestrations',
      ],
      whenNot: [
        'Simple card layouts - use Card',
        'List items - use ListItem',
        'Non-flow contexts - use Card or Badge',
      ],
      alternatives: ['Card (for non-flow contexts)'],
      dos: [
        'Use variant to semantically group node types (info for input, positive for processing, warning for output)',
        'Include icons for quick visual identification',
      ],
      donts: [
        'Do not hardcode colors - use variant prop',
        'Do not use outside ReactFlow canvas context for handles to work',
      ],
      patterns: [
        { name: 'Pipeline step', description: 'FlowNode with icon and status Badge inside FlowCanvas', components: ['FlowNode', 'Badge', 'FlowCanvas'] },
      ],
      domainContext: 'Used in ML workflow builders, ETL pipeline editors, and agent orchestration visualizations. Nodes represent steps in a directed graph.',
    },
    designTokens: ['--surface', '--surface-container', '--foreground', '--muted-foreground', '--primary', '--positive', '--warning', '--error', '--tertiary'],
    composedOf: ['FlowHandle'],
    composableWith: ['Badge', 'FlowCanvas'],
  },

  {
    name: 'NodePalette',
    figmaName: 'cv-node-palette',
    description: 'Collapsible sidebar of categorized node templates. Users click items to add them to a flow canvas. Supports expandable categories, icons, and a footer slot for action buttons.',
    category: 'flow',
    level: 'molecule',
    props: [
      { name: 'title', type: 'string', required: false, description: 'Palette header title' },
      { name: 'description', type: 'string', required: false, description: 'Palette header subtitle' },
      { name: 'categories', type: 'PaletteCategory[]', required: true, description: 'Array of categories, each with items' },
      { name: 'onItemClick', type: '(item: PaletteItem) => void', required: false, description: 'Callback when a palette item is clicked' },
      { name: 'footer', type: 'ReactNode', required: false, description: 'Footer slot for action buttons' },
    ],
    usage: {
      when: [
        'Providing a toolbox of node types alongside a flow canvas',
        'Building drag-and-drop or click-to-add workflow editors',
      ],
      whenNot: [
        'Simple navigation menus - use Menu',
        'Non-flow item lists - use SelectableList',
      ],
      alternatives: ['Menu (for navigation)', 'SelectableList (for generic item selection)'],
      dos: [
        'Group items into logical categories',
        'Provide icons and descriptions for each item',
        'Use defaultExpanded on the most common category',
      ],
      donts: [
        'Do not put more than 10 items per category',
      ],
      patterns: [
        { name: 'Workflow editor sidebar', description: 'NodePalette alongside FlowCanvas in a flex layout', components: ['NodePalette', 'FlowCanvas'] },
      ],
      domainContext: 'Typically used as the left sidebar in visual workflow builders, providing a toolbox of available node types that can be added to the canvas.',
    },
    designTokens: ['--surface-container-lowest', '--foreground', '--muted-foreground', '--outline-variant'],
    composableWith: ['FlowCanvas', 'FlowEditor', 'Button'],
  },

  {
    name: 'FlowEditor',
    figmaName: 'cv-flow-editor',
    description: 'Complete visual workflow editor combining NodePalette sidebar with FlowCanvas. Manages internal node/edge state, handles connections, and notifies parent of changes.',
    category: 'flow',
    level: 'organism',
    props: [
      { name: 'categories', type: 'PaletteCategory[]', required: true, description: 'Node palette categories with items' },
      { name: 'paletteTitle', type: 'string', required: false, description: 'Title for the palette sidebar' },
      { name: 'paletteDescription', type: 'string', required: false, description: 'Description for the palette sidebar' },
      { name: 'initialNodes', type: 'Node[]', required: false, description: 'Initial nodes on the canvas' },
      { name: 'initialEdges', type: 'Edge[]', required: false, description: 'Initial edges connecting nodes' },
      { name: 'nodeTypes', type: 'Record<string, ComponentType>', required: false, description: 'Custom ReactFlow node type components' },
      { name: 'onNodeAdd', type: '(item, node) => void', required: false, description: 'Called when a palette item creates a node' },
      { name: 'onNodeClick', type: '(event, node) => void', required: false, description: 'Called when a node is clicked' },
      { name: 'onWorkflowChange', type: '(nodes, edges) => void', required: false, description: 'Called when workflow state changes' },
      { name: 'footer', type: 'ReactNode', required: false, description: 'Footer content for palette panel' },
    ],
    usage: {
      when: [
        'Building interactive ML pipeline or ETL workflow editors',
        'Creating visual node-based editors for any domain',
        'Prototyping data flow or agent orchestration UIs',
      ],
      whenNot: [
        'Read-only workflow visualization - use AgentFlowView',
        'Simple form-based configuration - use standard form components',
      ],
      alternatives: ['AgentFlowView (for read-only views)'],
      dos: [
        'Provide a footer with Run/Clear buttons',
        'Use onWorkflowChange to persist state',
        'Group palette items into 3-5 categories',
      ],
      donts: [
        'Do not put more than 50 nodes on the canvas (performance)',
      ],
      patterns: [
        { name: 'ML workflow builder', description: 'FlowEditor with Input/Processing/Output categories', components: ['FlowEditor', 'FlowNode'] },
      ],
      domainContext: 'Primary component for visual workflow building. Used in ML pipeline editors, data engineering tools, and AI agent orchestration platforms.',
    },
    designTokens: ['--background', '--surface-container-lowest', '--muted-foreground', '--outline-variant'],
    composedOf: ['NodePalette', 'FlowCanvas', 'FlowNode'],
    composableWith: ['Button'],
  },

  {
    name: 'AgentFlowView',
    figmaName: 'cv-agent-flow-view',
    description: 'Read-only DAG view of agent orchestrations. Auto-layouts agent steps using dagre with dependency-based connections. Shows status per agent with animated spinner for running steps.',
    category: 'flow',
    level: 'organism',
    props: [
      { name: 'steps', type: 'AgentStep[]', required: true, description: 'Array of agent steps with dependencies' },
      { name: 'direction', type: 'enum', required: false, default: 'LR', description: 'Layout direction', values: ['LR', 'TB'] },
      { name: 'onAgentClick', type: '(agentId: string) => void', required: false, description: 'Called when an agent node is clicked' },
      { name: 'emptyTitle', type: 'string', required: false, description: 'Title shown when no steps exist' },
      { name: 'emptyDescription', type: 'string', required: false, description: 'Description shown when no steps exist' },
      { name: 'emptyIcon', type: 'ReactNode', required: false, description: 'Icon shown in empty state' },
    ],
    usage: {
      when: [
        'Visualizing multi-agent orchestration workflows',
        'Displaying pipeline execution status with dependencies',
        'Monitoring running workflow progress with status badges',
      ],
      whenNot: [
        'Interactive workflow building - use FlowEditor',
        'Simple status lists - use ListItem with status badges',
      ],
      alternatives: ['FlowEditor (for interactive editing)', 'DataTable (for tabular status view)'],
      dos: [
        'Provide step dependencies to show correct DAG structure',
        'Use onAgentClick to navigate to agent detail views',
        'Keep to fewer than 20 steps for readability',
      ],
      donts: [
        'Do not use for editable workflows',
      ],
      patterns: [
        { name: 'Workflow monitor', description: 'AgentFlowView showing execution progress', components: ['AgentFlowView'] },
      ],
      domainContext: 'Used in AI agent platforms to visualize multi-agent workflow execution. Each node represents an agent with status (pending, running, completed, error, skipped).',
    },
    designTokens: ['--background', '--surface', '--primary', '--positive', '--error', '--muted-foreground', '--outline-variant'],
    composedOf: ['FlowCanvas', 'AgentNode', 'EmptyState'],
    composableWith: ['SideSheet'],
  },
];

// ── Lookup Helpers ───────────────────────────────────────────────────────────

/**
 * Get schema by React component name
 */
export function getSchemaByName(name: string): ComponentSchema | undefined {
  return COMPONENT_SCHEMAS.find(s => s.name === name);
}

/**
 * Get schemas by category
 */
export function getSchemasByCategory(category: string): ComponentSchema[] {
  return COMPONENT_SCHEMAS.filter(s => s.category === category);
}

/**
 * Get all available (implemented) component schemas
 */
export function getAvailableSchemas(): ComponentSchema[] {
  return COMPONENT_SCHEMAS;
}

/**
 * Generate a concise component catalog string for AI system prompts
 */
export function generateComponentCatalogPrompt(): string {
  let prompt = '# SurfacesUI Component Catalog\n\n';
  prompt += 'Available React components for building data analytics, AI/ML, and enterprise UIs.\n\n';

  const categories = [...new Set(COMPONENT_SCHEMAS.map(s => s.category))];

  for (const category of categories) {
    const schemas = getSchemasByCategory(category);
    prompt += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;

    for (const schema of schemas) {
      prompt += `### ${schema.name}\n`;
      prompt += `${schema.description}\n\n`;

      // Props
      prompt += 'Props:\n';
      for (const prop of schema.props) {
        const req = prop.required ? ' (required)' : '';
        const def = prop.default ? ` [default: ${prop.default}]` : '';
        const vals = prop.values ? ` - one of: ${prop.values.join(', ')}` : '';
        prompt += `- **${prop.name}**${req}: ${prop.description}${def}${vals}\n`;
      }

      // Usage guidance
      prompt += '\nWhen to use: ' + schema.usage.when.join('. ') + '\n';
      prompt += 'When NOT to use: ' + schema.usage.whenNot.join('. ') + '\n';
      if (schema.usage.alternatives.length > 0) {
        prompt += 'Alternatives: ' + schema.usage.alternatives.join(', ') + '\n';
      }
      if (schema.usage.domainContext) {
        prompt += 'Domain context: ' + schema.usage.domainContext + '\n';
      }

      // Composition
      if (schema.composableWith && schema.composableWith.length > 0) {
        prompt += 'Commonly composed with: ' + schema.composableWith.join(', ') + '\n';
      }

      prompt += '\n';
    }
  }

  return prompt;
}
