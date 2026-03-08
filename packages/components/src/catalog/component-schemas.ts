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
