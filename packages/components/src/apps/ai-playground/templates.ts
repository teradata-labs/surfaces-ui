/**
 * Page Type Templates for AI Playground
 *
 * Each template provides contextual guidance for the LLM,
 * example prompts, and a pre-built sample spec for preview.
 */
import type { PageTemplate } from './types';

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'KPI metrics, charts, and data tables for monitoring and analytics',
    icon: 'LayoutDashboard',
    examplePrompts: [
      'Create a sales dashboard with monthly revenue, order count, and average order value KPIs, a revenue trend line chart, and a top products table',
      'Build an HR dashboard showing headcount, turnover rate, and open positions with a department distribution pie chart',
      'Design a real-time monitoring dashboard with system CPU, memory, error rate metrics and a request latency chart',
    ],
    systemPromptAddition: `## Page Type: Dashboard
Generate a dashboard layout using the following structure:
- Use a root Box with direction="column" and gap=24
- Top section: Box with columns=3 or columns=4 containing StatCard components for KPI metrics
- Middle section: One or two Chart or ChartWithControls for trend visualization
- Bottom section: TableWithFilters or DataTable for detailed data inspection
- Each StatCard should have a meaningful label, formatted value, and trend indicator
- Use realistic sample data that tells a coherent story`,
    sampleSpec: {
      root: 'dashboard',
      elements: {
        'dashboard': {
          type: 'Box',
          props: { direction: 'column', gap: 24 },
          children: ['heading', 'stats-row', 'chart-section', 'table-section'],
        },
        'heading': {
          type: 'Heading',
          props: { text: 'Sales Dashboard', level: '1' },
        },
        'stats-row': {
          type: 'Box',
          props: { direction: 'row', gap: 16, columns: 4 },
          children: ['stat-revenue', 'stat-orders', 'stat-aov', 'stat-conversion'],
        },
        'stat-revenue': {
          type: 'StatCard',
          props: { label: 'Total Revenue', value: '$124,500', change: '+12.5%', trend: 'up' },
        },
        'stat-orders': {
          type: 'StatCard',
          props: { label: 'Orders', value: '1,847', change: '+8.2%', trend: 'up' },
        },
        'stat-aov': {
          type: 'StatCard',
          props: { label: 'Avg Order Value', value: '$67.40', change: '-2.1%', trend: 'down' },
        },
        'stat-conversion': {
          type: 'StatCard',
          props: { label: 'Conversion Rate', value: '3.2%', change: '+0.4%', trend: 'up' },
        },
        'chart-section': {
          type: 'Card',
          props: { title: 'Revenue Trend', padding: 'md' },
          children: ['revenue-chart'],
        },
        'revenue-chart': {
          type: 'Chart',
          props: { type: 'line', xAxis: 'month', yAxis: 'revenue', height: 300 },
        },
        'table-section': {
          type: 'Card',
          props: { title: 'Recent Orders', padding: 'md' },
          children: ['orders-table'],
        },
        'orders-table': {
          type: 'TableWithFilters',
          props: { columns: ['id', 'customer', 'amount', 'status'], height: 300, showFilter: true },
        },
      },
      state: {
        data: [
          { month: 'Jan', revenue: 18500, id: '1001', customer: 'Acme Corp', amount: 2400, status: 'Completed' },
          { month: 'Feb', revenue: 21200, id: '1002', customer: 'Globex Inc', amount: 1850, status: 'Pending' },
          { month: 'Mar', revenue: 19800, id: '1003', customer: 'Initech', amount: 3200, status: 'Completed' },
          { month: 'Apr', revenue: 24100, id: '1004', customer: 'Umbrella Co', amount: 950, status: 'Shipped' },
          { month: 'May', revenue: 22500, id: '1005', customer: 'Stark Industries', amount: 4100, status: 'Completed' },
          { month: 'Jun', revenue: 26800, id: '1006', customer: 'Wayne Enterprises', amount: 2750, status: 'Processing' },
        ],
      },
    },
  },

  // ── Landing Page ───────────────────────────────────────────────────────────
  {
    id: 'landing',
    name: 'Landing Page',
    description: 'Hero sections, feature highlights, and call-to-action layouts',
    icon: 'Globe',
    examplePrompts: [
      'Create a product landing page for a data analytics platform with a hero section, 3 feature cards, and a pricing section',
      'Build a SaaS landing page with a bold headline, product screenshots description, feature list, and signup CTA',
      'Design a developer tool landing page with code examples, integration steps, and testimonial cards',
    ],
    systemPromptAddition: `## Page Type: Landing Page
Generate a landing page layout using the following structure:
- Use a root Box with direction="column" and gap=32
- Hero section: Heading (level 1, centered) + Text (centered, muted) for tagline
- Features section: Heading (level 2) + Box with columns=3 containing Card components
- Each feature Card should have a title and description
- Optional sections: Stats row with StatCards, additional Text content
- Use center alignment for hero content
- Keep text concise and impactful`,
    sampleSpec: {
      root: 'landing',
      elements: {
        'landing': {
          type: 'Box',
          props: { direction: 'column', gap: 48, padding: 24 },
          children: ['hero', 'divider-1', 'features-heading', 'features', 'divider-2', 'stats'],
        },
        'hero': {
          type: 'Box',
          props: { direction: 'column', gap: 16, align: 'center', padding: 32 },
          children: ['hero-title', 'hero-subtitle'],
        },
        'hero-title': {
          type: 'Heading',
          props: { text: 'Build Better Data Experiences', level: '1', align: 'center' },
        },
        'hero-subtitle': {
          type: 'Text',
          props: { content: 'The component library for **data-driven applications**. Beautiful, accessible, and blazingly fast.', size: 'lg', muted: true, align: 'center' },
        },
        'divider-1': {
          type: 'Divider',
          props: { orientation: 'horizontal' },
        },
        'features-heading': {
          type: 'Heading',
          props: { text: 'Why Choose SurfacesUI?', level: '2', align: 'center' },
        },
        'features': {
          type: 'Box',
          props: { direction: 'row', gap: 16, columns: 3 },
          children: ['feature-1', 'feature-2', 'feature-3'],
        },
        'feature-1': {
          type: 'Card',
          props: { title: 'AI-Powered', description: 'Generate entire UIs from natural language prompts using any LLM provider.', variant: 'outline', padding: 'md' },
        },
        'feature-2': {
          type: 'Card',
          props: { title: 'Data-First', description: 'Built for tables, charts, and dashboards with virtual scrolling and real-time updates.', variant: 'outline', padding: 'md' },
        },
        'feature-3': {
          type: 'Card',
          props: { title: 'Enterprise Ready', description: 'WCAG AA accessible, theme-aware, and designed for Teradata-scale data.', variant: 'outline', padding: 'md' },
        },
        'divider-2': {
          type: 'Divider',
          props: { orientation: 'horizontal' },
        },
        'stats': {
          type: 'Box',
          props: { direction: 'row', gap: 16, columns: 3 },
          children: ['stat-1', 'stat-2', 'stat-3'],
        },
        'stat-1': {
          type: 'StatCard',
          props: { label: 'Components', value: '38+', trend: 'neutral' },
        },
        'stat-2': {
          type: 'StatCard',
          props: { label: 'Bundle Size', value: '~660KB', trend: 'neutral' },
        },
        'stat-3': {
          type: 'StatCard',
          props: { label: 'Test Coverage', value: '80%+', trend: 'up' },
        },
      },
    },
  },

  // ── Dynamic Form ───────────────────────────────────────────────────────────
  {
    id: 'form',
    name: 'Dynamic Form',
    description: 'Input fields, dropdowns, and structured data collection',
    icon: 'FileInput',
    examplePrompts: [
      'Create a user registration form with name, email, password, and role selection',
      'Build a contact form with first name, last name, email, phone, message, and department dropdown',
      'Design a product configuration form with name, category selector, price, and description fields',
    ],
    systemPromptAddition: `## Page Type: Dynamic Form
Generate a form layout using the following structure:
- Use a root Box with direction="column" and gap=24
- Wrap the form in a Card with a title describing the form purpose
- Group related fields using Box with direction="column" and gap=16
- Use FormInput for text/email/number fields with descriptive labels
- Use FormSelect for dropdown selections with meaningful options
- Add helper text for fields that need clarification
- Mark required fields with required=true
- Use a logical field order (name before email, etc.)`,
    sampleSpec: {
      root: 'form-page',
      elements: {
        'form-page': {
          type: 'Box',
          props: { direction: 'column', gap: 24, padding: 16 },
          children: ['form-heading', 'form-description', 'form-card'],
        },
        'form-heading': {
          type: 'Heading',
          props: { text: 'Create Account', level: '2' },
        },
        'form-description': {
          type: 'Text',
          props: { content: 'Fill in your details to get started with your new account.', muted: true },
        },
        'form-card': {
          type: 'Card',
          props: { variant: 'outline', padding: 'lg' },
          children: ['form-fields'],
        },
        'form-fields': {
          type: 'Box',
          props: { direction: 'column', gap: 16 },
          children: ['name-row', 'email-field', 'role-field', 'password-field'],
        },
        'name-row': {
          type: 'Box',
          props: { direction: 'row', gap: 16 },
          children: ['first-name', 'last-name'],
        },
        'first-name': {
          type: 'FormInput',
          props: { label: 'First Name', name: 'firstName', placeholder: 'John', required: true },
        },
        'last-name': {
          type: 'FormInput',
          props: { label: 'Last Name', name: 'lastName', placeholder: 'Doe', required: true },
        },
        'email-field': {
          type: 'FormInput',
          props: { label: 'Email Address', name: 'email', type: 'email', placeholder: 'john@example.com', required: true, helperText: 'We\'ll send a verification email to this address' },
        },
        'role-field': {
          type: 'FormSelect',
          props: {
            label: 'Role', name: 'role', placeholder: 'Select your role',
            options: [
              { label: 'Developer', value: 'developer' },
              { label: 'Data Analyst', value: 'analyst' },
              { label: 'Data Engineer', value: 'engineer' },
              { label: 'Manager', value: 'manager' },
            ],
            required: true,
          },
        },
        'password-field': {
          type: 'FormInput',
          props: { label: 'Password', name: 'password', type: 'password', placeholder: 'At least 8 characters', required: true, helperText: 'Must contain uppercase, lowercase, and a number' },
        },
      },
    },
  },

  // ── Survey / Questionnaire ─────────────────────────────────────────────────
  {
    id: 'survey',
    name: 'Survey',
    description: 'Multi-section questionnaires with varied question types',
    icon: 'ClipboardList',
    examplePrompts: [
      'Create a customer satisfaction survey with rating questions, feedback text, and NPS score',
      'Build an employee engagement survey with sections for culture, management, and growth',
      'Design a product feedback questionnaire with feature importance ratings and improvement suggestions',
    ],
    systemPromptAddition: `## Page Type: Survey / Questionnaire
Generate a survey layout using the following structure:
- Use a root Box with direction="column" and gap=32
- Start with a Heading and Text describing the survey purpose
- Group questions into themed sections using Cards with titles
- Each section Card contains a Box with FormInput/FormSelect fields
- Use FormSelect for multiple-choice and rating questions
- Use FormInput (type "text") for open-ended questions
- Add Dividers between major sections
- Keep questions clear and concise`,
    sampleSpec: {
      root: 'survey',
      elements: {
        'survey': {
          type: 'Box',
          props: { direction: 'column', gap: 32, padding: 16 },
          children: ['survey-header', 'section-1', 'section-2', 'section-3'],
        },
        'survey-header': {
          type: 'Box',
          props: { direction: 'column', gap: 8 },
          children: ['survey-title', 'survey-desc'],
        },
        'survey-title': {
          type: 'Heading',
          props: { text: 'Customer Satisfaction Survey', level: '1' },
        },
        'survey-desc': {
          type: 'Text',
          props: { content: 'Help us improve by sharing your experience. This survey takes about 3 minutes.', muted: true },
        },
        'section-1': {
          type: 'Card',
          props: { title: 'Overall Experience', variant: 'outline', padding: 'lg' },
          children: ['section-1-fields'],
        },
        'section-1-fields': {
          type: 'Box',
          props: { direction: 'column', gap: 16 },
          children: ['q-satisfaction', 'q-recommend'],
        },
        'q-satisfaction': {
          type: 'FormSelect',
          props: {
            label: 'How satisfied are you with our product?',
            name: 'satisfaction',
            options: [
              { label: 'Very Satisfied', value: '5' },
              { label: 'Satisfied', value: '4' },
              { label: 'Neutral', value: '3' },
              { label: 'Dissatisfied', value: '2' },
              { label: 'Very Dissatisfied', value: '1' },
            ],
            required: true,
          },
        },
        'q-recommend': {
          type: 'FormSelect',
          props: {
            label: 'How likely are you to recommend us? (0-10)',
            name: 'nps',
            options: Array.from({ length: 11 }, (_, i) => ({ label: String(i), value: String(i) })),
            required: true,
          },
        },
        'section-2': {
          type: 'Card',
          props: { title: 'Product Features', variant: 'outline', padding: 'lg' },
          children: ['section-2-fields'],
        },
        'section-2-fields': {
          type: 'Box',
          props: { direction: 'column', gap: 16 },
          children: ['q-feature', 'q-missing'],
        },
        'q-feature': {
          type: 'FormSelect',
          props: {
            label: 'Which feature do you use most?',
            name: 'topFeature',
            options: [
              { label: 'Data Visualization', value: 'viz' },
              { label: 'SQL Editor', value: 'sql' },
              { label: 'Dashboard Builder', value: 'dashboard' },
              { label: 'Report Generator', value: 'reports' },
            ],
          },
        },
        'q-missing': {
          type: 'FormInput',
          props: { label: 'What feature would you most like to see added?', name: 'missingFeature', placeholder: 'Describe the feature...' },
        },
        'section-3': {
          type: 'Card',
          props: { title: 'Additional Feedback', variant: 'outline', padding: 'lg' },
          children: ['section-3-fields'],
        },
        'section-3-fields': {
          type: 'Box',
          props: { direction: 'column', gap: 16 },
          children: ['q-feedback'],
        },
        'q-feedback': {
          type: 'FormInput',
          props: { label: 'Any other comments or suggestions?', name: 'feedback', placeholder: 'Share your thoughts...' },
        },
      },
    },
  },

  // ── Control Plane ──────────────────────────────────────────────────────────
  {
    id: 'control-plane',
    name: 'Control Plane',
    description: 'System status, health metrics, and operational controls',
    icon: 'Settings',
    examplePrompts: [
      'Create a Kubernetes cluster control plane showing node status, pod counts, CPU/memory usage, and recent events table',
      'Build a database operations dashboard with connection pool status, query throughput, replication lag, and active sessions',
      'Design a CI/CD pipeline dashboard with build status metrics, deployment frequency chart, and recent deployments table',
    ],
    systemPromptAddition: `## Page Type: Control Plane
Generate a control plane layout using the following structure:
- Use a root Box with direction="column" and gap=24
- Top: Heading with the system/service name
- Status section: Box with columns=4 containing StatCards for key health metrics
- Charts section: Box with columns=2 containing Chart components for time-series data
- Details section: TableWithFilters or DataTable for logs, events, or resource lists
- Use trend indicators on StatCards (up=good for throughput, down=good for errors)
- Include realistic operational metrics`,
    sampleSpec: {
      root: 'control-plane',
      elements: {
        'control-plane': {
          type: 'Box',
          props: { direction: 'column', gap: 24 },
          children: ['cp-header', 'cp-metrics', 'cp-charts', 'cp-events'],
        },
        'cp-header': {
          type: 'Box',
          props: { direction: 'column', gap: 4 },
          children: ['cp-title', 'cp-subtitle'],
        },
        'cp-title': {
          type: 'Heading',
          props: { text: 'Cluster Status: Production', level: '1' },
        },
        'cp-subtitle': {
          type: 'Text',
          props: { content: 'Real-time health metrics for the production Kubernetes cluster', muted: true },
        },
        'cp-metrics': {
          type: 'Box',
          props: { direction: 'row', gap: 16, columns: 4 },
          children: ['metric-nodes', 'metric-pods', 'metric-cpu', 'metric-memory'],
        },
        'metric-nodes': {
          type: 'StatCard',
          props: { label: 'Active Nodes', value: '12/12', trend: 'neutral' },
        },
        'metric-pods': {
          type: 'StatCard',
          props: { label: 'Running Pods', value: '847', change: '+23', trend: 'up' },
        },
        'metric-cpu': {
          type: 'StatCard',
          props: { label: 'CPU Usage', value: '62%', change: '+5%', trend: 'up' },
        },
        'metric-memory': {
          type: 'StatCard',
          props: { label: 'Memory Usage', value: '71%', change: '-3%', trend: 'down' },
        },
        'cp-charts': {
          type: 'Box',
          props: { direction: 'row', gap: 16, columns: 2 },
          children: ['cpu-chart-card', 'requests-chart-card'],
        },
        'cpu-chart-card': {
          type: 'Card',
          props: { title: 'CPU Over Time', padding: 'md' },
          children: ['cpu-chart'],
        },
        'cpu-chart': {
          type: 'Chart',
          props: { type: 'area', xAxis: 'time', yAxis: 'cpu', height: 250 },
        },
        'requests-chart-card': {
          type: 'Card',
          props: { title: 'Request Rate', padding: 'md' },
          children: ['requests-chart'],
        },
        'requests-chart': {
          type: 'Chart',
          props: { type: 'line', xAxis: 'time', yAxis: 'requests', height: 250 },
        },
        'cp-events': {
          type: 'Card',
          props: { title: 'Recent Events', padding: 'md' },
          children: ['events-table'],
        },
        'events-table': {
          type: 'DataTable',
          props: { columns: ['time', 'type', 'resource', 'message'], height: 250, density: 'compact' },
        },
      },
      state: {
        data: [
          { time: '14:30', cpu: 62, requests: 1200, type: 'Warning', resource: 'pod/api-server-3', message: 'High memory usage' },
          { time: '14:25', cpu: 58, requests: 1150, type: 'Normal', resource: 'deploy/frontend', message: 'Scaled to 5 replicas' },
          { time: '14:20', cpu: 55, requests: 1100, type: 'Normal', resource: 'node/worker-7', message: 'Node ready' },
          { time: '14:15', cpu: 61, requests: 1180, type: 'Warning', resource: 'pod/worker-12', message: 'Container restart' },
          { time: '14:10', cpu: 53, requests: 980, type: 'Normal', resource: 'service/api', message: 'Endpoint updated' },
        ],
      },
    },
  },
];

/**
 * Get a template by its page type ID
 */
export function getTemplate(id: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find(t => t.id === id);
}
