/**
 * Spec Validation for AI-Generated json-render Specifications
 *
 * Validates generated specs against catalog Zod schemas before rendering.
 * Catches hallucinations (unknown component types, invalid props) and provides
 * structured error information for error recovery.
 */
import { z, ZodError, ZodIssue } from 'zod';
import {
  ChartSchema,
  DataTableSchema,
  FilterSchema,
  DensityToggleSchema,
  ViewModeToggleSchema,
  TableWithFiltersSchema,
  ChartWithControlsSchema,
  SQLResultsDisplaySchema,
} from './schema';

// Known component types and their schemas
const componentSchemas: Record<string, z.ZodTypeAny> = {
  Chart: ChartSchema,
  DataTable: DataTableSchema,
  Filter: FilterSchema,
  DensityToggle: DensityToggleSchema,
  ViewModeToggle: ViewModeToggleSchema,
  TableWithFilters: TableWithFiltersSchema,
  ChartWithControls: ChartWithControlsSchema,
  SQLResultsDisplay: SQLResultsDisplaySchema,
};

// Spec structure schema
const SpecElementSchema = z.object({
  type: z.string(),
  props: z.record(z.string(), z.unknown()).optional().default({}),
});

const SpecSchema = z.object({
  root: z.string(),
  elements: z.record(z.string(), SpecElementSchema),
  data: z.array(z.record(z.string(), z.unknown())).optional(),
});

export interface ValidationError {
  path: string;
  message: string;
  code: string;
  expected?: string;
  received?: string;
}

export interface ValidationResult {
  valid: boolean;
  spec?: z.infer<typeof SpecSchema>;
  errors: ValidationError[];
}

/**
 * Format a Zod issue into a user-friendly ValidationError
 */
function formatZodIssue(issue: ZodIssue, prefix = ''): ValidationError {
  const path = prefix ? `${prefix}.${issue.path.join('.')}` : issue.path.join('.');
  return {
    path: path || 'root',
    message: issue.message,
    code: issue.code,
    expected: 'expected' in issue ? String(issue.expected) : undefined,
    received: 'received' in issue ? String(issue.received) : undefined,
  };
}

/**
 * Validate a generated spec against catalog schemas.
 *
 * @param rawSpec - The raw spec object from AI generation
 * @returns ValidationResult with either valid spec or array of errors
 */
export function validateGeneratedSpec(rawSpec: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Step 1: Validate overall spec structure
  const structureResult = SpecSchema.safeParse(rawSpec);
  if (!structureResult.success) {
    return {
      valid: false,
      errors: structureResult.error.issues.map(issue => formatZodIssue(issue)),
    };
  }

  const spec = structureResult.data;

  // Step 2: Validate root element exists
  if (!spec.elements[spec.root]) {
    errors.push({
      path: 'root',
      message: `Root element "${spec.root}" not found in elements`,
      code: 'missing_root',
    });
    return { valid: false, errors };
  }

  // Step 3: Validate each element's type and props
  for (const [elementId, element] of Object.entries(spec.elements)) {
    // Type guard to ensure element has the expected structure
    if (!element || typeof element !== 'object' || !('type' in element)) {
      errors.push({
        path: `elements.${elementId}`,
        message: 'Invalid element structure',
        code: 'invalid_element',
      });
      continue;
    }

    const elementType = (element as { type: unknown }).type;
    if (typeof elementType !== 'string') {
      errors.push({
        path: `elements.${elementId}.type`,
        message: 'Element type must be a string',
        code: 'invalid_type',
      });
      continue;
    }

    const componentSchema = componentSchemas[elementType];

    if (!componentSchema) {
      errors.push({
        path: `elements.${elementId}.type`,
        message: `Unknown component type: "${elementType}"`,
        code: 'unknown_component',
        expected: Object.keys(componentSchemas).join(', '),
        received: elementType,
      });
      continue;
    }

    // Validate props against component schema
    const elementProps = 'props' in element ? (element as { props: unknown }).props : {};
    const propsResult = componentSchema.safeParse(elementProps);
    if (!propsResult.success) {
      for (const issue of propsResult.error.issues) {
        errors.push(formatZodIssue(issue, `elements.${elementId}.props`));
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, spec, errors: [] };
}

/**
 * Attempt to auto-fix common validation errors.
 *
 * @param spec - The invalid spec
 * @param errors - The validation errors
 * @returns Fixed spec or null if unfixable
 */
export function attemptAutoFix(
  spec: unknown,
  errors: ValidationError[]
): z.infer<typeof SpecSchema> | null {
  if (!spec || typeof spec !== 'object') return null;

  const fixedSpec = JSON.parse(JSON.stringify(spec)) as z.infer<typeof SpecSchema>;

  for (const error of errors) {
    // Fix: Missing props object
    if (error.code === 'invalid_type' && error.path.endsWith('.props') && error.expected === 'object') {
      const pathParts = error.path.split('.');
      if (pathParts[0] === 'elements' && pathParts[1]) {
        fixedSpec.elements[pathParts[1]].props = {};
      }
    }

    // Fix: Unknown component type - can't fix, need to use fallback
    if (error.code === 'unknown_component') {
      return null;
    }
  }

  // Revalidate the fixed spec
  const revalidated = validateGeneratedSpec(fixedSpec);
  return revalidated.valid ? revalidated.spec : null;
}

/**
 * Get list of known component types for error messages.
 */
export function getKnownComponentTypes(): string[] {
  return Object.keys(componentSchemas);
}
