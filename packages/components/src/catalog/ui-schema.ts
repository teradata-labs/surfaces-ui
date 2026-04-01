/**
 * Extended UI Component Schemas for json-render
 *
 * Adds layout, content, and form components to the data-viz catalog.
 * These enable AI generation of dashboards, landing pages, forms,
 * surveys, and control plane UIs — not just data visualization.
 */
import { z } from 'zod';

// ── Layout ────────────────────────────────────────────────────────────────────

export const BoxSchema = z.object({
  direction: z.enum(['row', 'column']).default('column').describe('Flex direction'),
  gap: z.number().default(16).describe('Gap between children in pixels'),
  columns: z.number().optional().describe('CSS grid columns (overrides direction to grid layout)'),
  padding: z.number().default(0).describe('Padding in pixels'),
  align: z.enum(['start', 'center', 'end', 'stretch']).default('stretch').describe('Cross-axis alignment'),
  justify: z.enum(['start', 'center', 'end', 'between', 'around']).default('start').describe('Main-axis justification'),
  wrap: z.boolean().default(false).describe('Allow children to wrap to next line'),
});

export const DividerSchema = z.object({
  orientation: z.enum(['horizontal', 'vertical']).default('horizontal').describe('Divider orientation'),
  label: z.string().optional().describe('Optional text label in the center of the divider'),
});

// ── Content ───────────────────────────────────────────────────────────────────

export const HeadingSchema = z.object({
  text: z.string().describe('Heading text content'),
  level: z.enum(['1', '2', '3', '4']).default('2').describe('Heading level (h1-h4)'),
  align: z.enum(['left', 'center', 'right']).default('left').describe('Text alignment'),
});

export const TextSchema = z.object({
  content: z.string().describe('Text content (supports basic markdown: **bold**, *italic*)'),
  size: z.enum(['sm', 'base', 'lg']).default('base').describe('Text size'),
  muted: z.boolean().default(false).describe('Use muted/secondary color'),
  align: z.enum(['left', 'center', 'right']).default('left').describe('Text alignment'),
});

export const CardSchema = z.object({
  title: z.string().optional().describe('Card title'),
  description: z.string().optional().describe('Card description text'),
  variant: z.enum(['default', 'outline', 'filled']).default('default').describe('Card visual style'),
  padding: z.enum(['none', 'sm', 'md', 'lg']).default('md').describe('Inner padding'),
});

export const StatCardSchema = z.object({
  label: z.string().describe('Metric label (e.g. "Total Revenue")'),
  value: z.string().describe('Metric value (formatted string, e.g. "$12,345")'),
  change: z.string().optional().describe('Change indicator (e.g. "+12.5%")'),
  trend: z.enum(['up', 'down', 'neutral']).optional().describe('Trend direction for color coding'),
  icon: z.string().optional().describe('Lucide icon name (e.g. "dollar-sign", "users", "activity")'),
});

// ── Form ──────────────────────────────────────────────────────────────────────

export const FormInputSchema = z.object({
  label: z.string().describe('Input label'),
  name: z.string().describe('Input field name (used as key in form state)'),
  placeholder: z.string().optional().describe('Placeholder text'),
  type: z.enum(['text', 'email', 'number', 'password', 'url', 'tel', 'date']).default('text').describe('Input type'),
  required: z.boolean().default(false).describe('Whether the field is required'),
  helperText: z.string().optional().describe('Helper text shown below the input'),
});

export const FormSelectSchema = z.object({
  label: z.string().describe('Select label'),
  name: z.string().describe('Select field name (used as key in form state)'),
  placeholder: z.string().optional().describe('Placeholder text'),
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).describe('Dropdown options'),
  required: z.boolean().default(false).describe('Whether the field is required'),
});

// ── Type Exports ──────────────────────────────────────────────────────────────

export type BoxProps = z.infer<typeof BoxSchema>;
export type DividerProps = z.infer<typeof DividerSchema>;
export type HeadingProps = z.infer<typeof HeadingSchema>;
export type TextProps = z.infer<typeof TextSchema>;
export type CardProps = z.infer<typeof CardSchema>;
export type StatCardProps = z.infer<typeof StatCardSchema>;
export type FormInputProps = z.infer<typeof FormInputSchema>;
export type FormSelectProps = z.infer<typeof FormSelectSchema>;
