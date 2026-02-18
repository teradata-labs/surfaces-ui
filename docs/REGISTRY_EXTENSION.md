# Registry Extension Guide

How to add custom components to the json-render catalog and registry.

## Overview

The registry maps catalog specs to React component implementations. Extending it allows:

1. Adding custom components not in base catalog
2. Overriding default component implementations
3. Injecting custom context data patterns
4. Supporting organization-specific UI patterns

## Architecture

### Catalog → Registry → Renderer Flow

```
AI generates spec → Catalog validates → Registry maps → Renderer displays
     JSON             Zod schema          React       Component tree
```

**Catalog** (`schema.ts`):
- Zod schemas defining AI-specifiable props
- JSON structure LLM can generate
- Descriptions for AI understanding

**Registry** (`registry.tsx`):
- Maps component types to React implementations
- Wraps components to inject context data
- Uses ComponentContext pattern for json-render integration

**Renderer** (`renderer.tsx`):
- Takes validated spec + context data
- Passes to json-render with registry
- Applies theme/density providers

## Adding a New Component

### Step 1: Define Catalog Schema

Create Zod schema with 5-8 props max:

```typescript
// packages/components/src/catalog/schema.ts
import { z } from 'zod';

export const MetricCardSchema = z.object({
  title: z.string().describe('Card title'),
  value: z.number().describe('Metric value'),
  trend: z.enum(['up', 'down', 'neutral']).optional().describe('Trend indicator'),
  unit: z.string().optional().describe('Value unit (%, $, etc)'),
  comparison: z.string().optional().describe('Comparison text'),
});

export type MetricCardProps = z.infer<typeof MetricCardSchema>;
```

**Key constraints**:
- Max 8 props (AI describability limit)
- Descriptions under 60 chars
- Use `.optional()` for non-required props
- Use `z.enum()` for limited choices
- Use `.default()` for sensible defaults

### Step 2: Add to Catalog Definition

```typescript
// packages/components/src/catalog/schema.ts
export const catalog = defineCatalog(schema, {
  components: {
    // ... existing components
    MetricCard: {
      props: MetricCardSchema,
      description: 'Display a single metric with optional trend and comparison',
      hasChildren: false,
    },
  },
  // ... actions
});
```

### Step 3: Create React Component

```typescript
// packages/components/src/primitives/metric-card/MetricCard.tsx
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: number;
  trend?: 'up' | 'down' | 'neutral';
  unit?: string;
  comparison?: string;
}

export function MetricCard({
  title,
  value,
  trend,
  unit,
  comparison,
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-4xl font-bold">
            {value.toLocaleString()}{unit}
          </div>
          {trend && (
            <TrendIcon className={`h-5 w-5 ${trendColor}`} aria-label={`Trend: ${trend}`} />
          )}
        </div>
        {comparison && (
          <div className="mt-2 text-sm text-muted-foreground">
            {comparison}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 4: Create Registry Wrapper

Wrap component to inject context data using ComponentContext pattern:

```typescript
// packages/components/src/catalog/registry.tsx
import { defineRegistry, type ComponentContext, useStateValue } from '@json-render/react';
import { MetricCard } from '../primitives/metric-card';
import type { MetricCardProps } from './types';

function CatalogMetricCard(ctx: ComponentContext<typeof catalog, 'MetricCard'>) {
  const props = ctx.props as MetricCardProps;

  // Extract context data if needed
  const data = useStateValue<Record<string, unknown>>('/data');

  // You can compute derived values from context
  // For example, dynamically calculate value from data
  const computedValue = data?.[props.title] ?? props.value;

  return (
    <MetricCard
      title={props.title}
      value={computedValue}
      trend={props.trend}
      unit={props.unit}
      comparison={props.comparison}
    />
  );
}

export const { registry } = defineRegistry(catalog, {
  components: {
    // ... existing components
    MetricCard: CatalogMetricCard,
  },
});
```

**Why wrappers**: json-render requires functional components with context access. Direct component imports don't have access to context data or json-render state.

### Step 5: Add to Type Definitions

```typescript
// packages/components/src/catalog/types.ts
import type { z } from 'zod';
import type { MetricCardSchema } from './schema';

export type MetricCardProps = z.infer<typeof MetricCardSchema>;

// Add to catalog spec union type
export type CatalogSpec =
  | DataTableSpec
  | ChartSpec
  // ... existing types
  | { type: 'MetricCard'; props: MetricCardProps };
```

### Step 6: Add to Prompt Generation

```typescript
// packages/components/src/catalog/prompt.ts
// The catalog.prompt() method automatically generates prompts
// from your schema descriptions. No manual work needed!

// But if you want custom prompt text, you can add it:
export const aiSystemPrompt = catalog.prompt({
  customRules: [
    'Use Chart for visualizing trends, comparisons, and distributions',
    'Use DataTable for detailed row-by-row data inspection',
    'Use MetricCard for displaying single numeric values with context',
    // ... other rules
  ],
});
```

### Step 7: Add Tests

Create validation and rendering tests:

```typescript
// packages/components/src/catalog/registry.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SurfacesRenderer } from './renderer';
import { MetricCardSchema } from './schema';

describe('MetricCard Registry', () => {
  it('validates MetricCard spec', () => {
    const spec = {
      type: 'MetricCard',
      props: { title: 'Revenue', value: 1000 },
    };
    const result = MetricCardSchema.safeParse(spec.props);
    expect(result.success).toBe(true);
  });

  it('rejects invalid MetricCard spec', () => {
    const spec = {
      type: 'MetricCard',
      props: { title: 'Revenue', value: '1000' }, // Should be number
    };
    const result = MetricCardSchema.safeParse(spec.props);
    expect(result.success).toBe(false);
  });

  it('renders MetricCard from spec', () => {
    const spec = {
      root: 'metric',
      elements: {
        metric: {
          type: 'MetricCard',
          props: { title: 'Users', value: 500 },
        },
      },
    };

    render(<SurfacesRenderer spec={spec} />);
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('injects context data', () => {
    const spec = {
      root: 'metric',
      elements: {
        metric: {
          type: 'MetricCard',
          props: { title: 'Revenue', value: 0 },
        },
      },
    };

    render(
      <SurfacesRenderer
        spec={spec}
        initialState={{ data: { Revenue: 5000 } }}
      />
    );

    // Component should use context value (5000) not prop value (0)
    expect(screen.getByText('5000')).toBeInTheDocument();
  });
});
```

### Step 8: Export Component

Make the component available for import:

```typescript
// packages/components/src/catalog/index.ts
export { catalog, registry } from './registry';
export { SurfacesRenderer } from './renderer';
export type { MetricCardProps } from './types';
```

## Advanced Patterns

### Handling Context Data

Components receive data from registry wrappers via `useStateValue` hook:

```typescript
function CatalogMetricCard(ctx: ComponentContext<typeof catalog, 'MetricCard'>) {
  const props = ctx.props as MetricCardProps;

  // Access shared context state
  const data = useStateValue<Record<string, unknown>>('/data');
  const theme = useStateValue<string>('/theme');
  const filters = useStateValue<string[]>('/filters');

  // Compute derived values
  const actualValue = data?.[props.title] ?? props.value;
  const isFiltered = filters?.includes(props.title);

  return (
    <MetricCard
      {...props}
      value={actualValue}
      className={isFiltered ? 'opacity-50' : ''}
    />
  );
}
```

**Use cases**:
- Fetch data from shared state
- Access theme/density settings
- Wire callbacks to parent handlers
- Transform data for component consumption
- Apply global filters or selections

### Type Safety with Explicit Interfaces

Use explicit interfaces for type checking:

```typescript
interface RegistryProps {
  title: string;
  value: number;
  trend?: 'up' | 'down' | 'neutral';
}

const CatalogMetricCard = (ctx: ComponentContext<typeof catalog, 'MetricCard'>) => {
  const props = ctx.props as RegistryProps;
  const data = useStateValue<Record<string, unknown>>('/data');

  return <MetricCard {...props} />;
};

export const { registry } = defineRegistry(catalog, {
  components: {
    MetricCard: CatalogMetricCard,
  },
});
```

Provides IDE autocomplete and catches type errors at compile time.

### Memoization for Performance

Use `React.useMemo` for expensive context transformations:

```typescript
function CatalogMetricCard(ctx: ComponentContext<typeof catalog, 'MetricCard'>) {
  const props = ctx.props as MetricCardProps;
  const data = useStateValue<DataRow[]>('/data');

  // Memoize expensive computation
  const processedValue = React.useMemo(() => {
    if (!data || data.length === 0) return props.value;

    // Expensive aggregation
    return data.reduce((sum, row) => sum + (row[props.title] as number || 0), 0);
  }, [data, props.title, props.value]);

  return <MetricCard {...props} value={processedValue} />;
}
```

Important for:
- Large datasets
- Complex computations
- Virtual scrolling
- Frequent re-renders

### Component Composition

Build complex components from primitives:

```typescript
// Define molecule that composes primitives
export const DashboardCardSchema = z.object({
  title: z.string().describe('Dashboard title'),
  metrics: z.array(z.object({
    label: z.string(),
    value: z.number(),
  })).describe('Metrics to display'),
  chartType: z.enum(['bar', 'line']).default('bar'),
  height: z.number().default(300),
});

function CatalogDashboardCard(ctx: ComponentContext<typeof catalog, 'DashboardCard'>) {
  const props = ctx.props as DashboardCardProps;
  const data = useStateValue<DataRow[]>('/data');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {props.metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              title={metric.label}
              value={metric.value}
            />
          ))}
        </div>
        <Chart
          data={data}
          type={props.chartType}
          height={props.height}
        />
      </CardContent>
    </Card>
  );
}
```

### Accessing Actions

Trigger actions from within components:

```typescript
import { useAction } from '@json-render/react';

function CatalogMetricCard(ctx: ComponentContext<typeof catalog, 'MetricCard'>) {
  const props = ctx.props as MetricCardProps;
  const exportCsv = useAction('export_csv');
  const executeSql = useAction('execute_sql');

  const handleExport = () => {
    exportCsv({ filename: `${props.title}-data.csv` });
  };

  const handleRefresh = () => {
    executeSql({
      query: `SELECT * FROM metrics WHERE name = '${props.title}'`,
    });
  };

  return (
    <MetricCard {...props}>
      <Button onClick={handleExport}>Export</Button>
      <Button onClick={handleRefresh}>Refresh</Button>
    </MetricCard>
  );
}
```

## Validation

### Schema Validation Tests

Test schemas with both valid and invalid specs:

```typescript
describe('MetricCard Schema', () => {
  it('accepts valid spec', () => {
    const valid = {
      title: 'Sales',
      value: 100,
      trend: 'up',
      unit: '$',
    };
    expect(MetricCardSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid value type', () => {
    const invalid = {
      title: 'Sales',
      value: '100', // Should be number
    };
    expect(MetricCardSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects unknown trend value', () => {
    const invalid = {
      title: 'Sales',
      value: 100,
      trend: 'sideways', // Not in enum
    };
    expect(MetricCardSchema.safeParse(invalid).success).toBe(false);
  });

  it('allows optional props to be omitted', () => {
    const minimal = {
      title: 'Sales',
      value: 100,
    };
    expect(MetricCardSchema.safeParse(minimal).success).toBe(true);
  });

  it('enforces prop count limit (max 8)', () => {
    // Your schema should have at most 8 props
    const schemaKeys = Object.keys(MetricCardSchema.shape);
    expect(schemaKeys.length).toBeLessThanOrEqual(8);
  });
});
```

### Registry Validation Tests

Test that registry wrappers correctly inject context:

```typescript
describe('MetricCard Registry Wrapper', () => {
  it('passes through all props', () => {
    const spec = {
      root: 'metric',
      elements: {
        metric: {
          type: 'MetricCard',
          props: {
            title: 'Revenue',
            value: 1000,
            trend: 'up',
            unit: '$',
            comparison: 'vs last month',
          },
        },
      },
    };

    render(<SurfacesRenderer spec={spec} />);

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
    expect(screen.getByLabelText('Trend: up')).toBeInTheDocument();
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('injects context data to component', () => {
    const contextData = { Revenue: 5000 };

    render(
      <SurfacesRenderer
        spec={{
          root: 'metric',
          elements: {
            metric: {
              type: 'MetricCard',
              props: { title: 'Revenue', value: 0 },
            },
          },
        }}
        initialState={{ data: contextData }}
      />
    );

    // Component should use context value (5000) not prop value (0)
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it('handles missing context gracefully', () => {
    render(
      <SurfacesRenderer
        spec={{
          root: 'metric',
          elements: {
            metric: {
              type: 'MetricCard',
              props: { title: 'Revenue', value: 1000 },
            },
          },
        }}
        initialState={{}} // No data in context
      />
    );

    // Should fall back to prop value
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
  });
});
```

### Integration Tests

Test component within full stack:

```typescript
describe('MetricCard Integration', () => {
  it('updates when context data changes', () => {
    const { rerender } = render(
      <SurfacesRenderer
        spec={{
          root: 'metric',
          elements: {
            metric: {
              type: 'MetricCard',
              props: { title: 'Revenue', value: 0 },
            },
          },
        }}
        initialState={{ data: { Revenue: 1000 } }}
      />
    );

    expect(screen.getByText(/1,000/)).toBeInTheDocument();

    // Update context data
    rerender(
      <SurfacesRenderer
        spec={{
          root: 'metric',
          elements: {
            metric: {
              type: 'MetricCard',
              props: { title: 'Revenue', value: 0 },
            },
          },
        }}
        initialState={{ data: { Revenue: 2000 } }}
      />
    );

    expect(screen.getByText(/2,000/)).toBeInTheDocument();
  });

  it('triggers actions correctly', async () => {
    const mockExport = vi.fn();

    render(
      <SurfacesRenderer
        spec={{
          root: 'metric',
          elements: {
            metric: {
              type: 'MetricCard',
              props: { title: 'Revenue', value: 1000 },
            },
          },
        }}
        handlers={{
          export_csv: mockExport,
        }}
      />
    );

    await userEvent.click(screen.getByText('Export'));
    expect(mockExport).toHaveBeenCalledWith({ filename: 'Revenue-data.csv' });
  });
});
```

## Best Practices

1. **Atomic Design**: Keep components small (<400 lines, single responsibility)
2. **Prop Limits**: Stay within 5-8 props for AI describability
3. **Context Usage**: Use `useStateValue` for runtime data, not AI-specifiable props
4. **Type Safety**: Define explicit interfaces, avoid type assertions where possible
5. **Performance**: Memoize expensive operations, especially for virtual scrolling
6. **Testing**: Cover schema validation, rendering, and context injection
7. **Documentation**: Add clear descriptions to schema fields (<60 chars)
8. **Accessibility**: Include ARIA labels, keyboard support, screen reader text
9. **Error Handling**: Gracefully handle missing context data
10. **Defaults**: Provide sensible defaults for optional props

## Examples

See existing components for reference:

- **Primitive**: `packages/components/src/primitives/data-table/` - Simple, single-purpose (200 lines)
- **Molecule**: `packages/components/src/molecules/table-with-filters/` - Composed from primitives (100 lines)
- **Organism**: `packages/components/src/organisms/sql-results-display/` - Complex, multi-feature (247 lines)

## Troubleshooting

### "Component not found in registry"

**Symptoms**: Runtime error when rendering spec with your component type.

**Verify**:
1. Component added to registry object with correct name
2. Name matches `type` field in spec exactly (case-sensitive)
3. Registry exported from `packages/components/src/catalog/index.ts`
4. No typos in component name

**Fix**:
```typescript
// registry.tsx - ensure component is in registry
export const { registry } = defineRegistry(catalog, {
  components: {
    MetricCard: CatalogMetricCard, // Name must match exactly
  },
});
```

### Context data not accessible

**Symptoms**: Component doesn't display data from state.

**Verify**:
1. Using `useStateValue` hook in wrapper component
2. Context data passed to SurfacesRenderer: `initialState={{ data: ... }}`
3. Correct state path used: `useStateValue('/data')`
4. State path exists in initial state

**Fix**:
```typescript
function CatalogMetricCard(ctx: ComponentContext<typeof catalog, 'MetricCard'>) {
  // Use useStateValue hook, not direct context access
  const data = useStateValue<Record<string, unknown>>('/data');

  // Provide fallback for missing data
  const value = data?.[props.title] ?? props.value;

  return <MetricCard {...props} value={value} />;
}
```

### Props not type-safe

**Symptoms**: No TypeScript errors despite wrong prop types, or IDE no autocomplete.

**Fix**: Use explicit interfaces:
```typescript
interface MetricCardRegistryProps {
  title: string;
  value: number;
  trend?: 'up' | 'down' | 'neutral';
  unit?: string;
  comparison?: string;
}

const CatalogMetricCard = (ctx: ComponentContext<typeof catalog, 'MetricCard'>) => {
  const props = ctx.props as MetricCardRegistryProps;
  // Now you have full type safety
  return <MetricCard {...props} />;
};
```

### Schema validation fails unexpectedly

**Symptoms**: Valid-looking specs fail validation.

**Debug**:
```typescript
import { MetricCardSchema } from './schema';

const spec = { title: 'Sales', value: 100 };
const result = MetricCardSchema.safeParse(spec);

if (!result.success) {
  console.error('Validation errors:', result.error.errors);
  // Shows exactly which field failed and why
}
```

**Common issues**:
- Wrong type (string instead of number)
- Missing required field
- Invalid enum value
- Too many props (>8)

### Component not updating when state changes

**Symptoms**: Component renders once but doesn't re-render on state updates.

**Causes**:
1. Not using `useStateValue` hook (direct context access doesn't subscribe to changes)
2. Memoization preventing re-renders
3. State path doesn't exist

**Fix**:
```typescript
// WRONG - doesn't subscribe to changes
const data = (ctx as any).data?.value;

// CORRECT - subscribes to state changes
const data = useStateValue('/data');
```

### Performance issues with large datasets

**Symptoms**: Component slow or unresponsive with many rows.

**Fixes**:
1. Memoize expensive computations:
```typescript
const processedData = React.useMemo(() => {
  return expensiveTransform(data);
}, [data]);
```

2. Avoid creating new objects in render:
```typescript
// WRONG - creates new array every render
const columns = props.columns || Object.keys(data[0]);

// CORRECT - memoized
const columns = React.useMemo(
  () => props.columns || (data[0] ? Object.keys(data[0]) : []),
  [props.columns, data]
);
```

3. Use virtual scrolling for tables/lists

## Next Steps

- See [Catalog API](./CATALOG_API.md) for existing components
- See [Integration Guide](./INTEGRATION_GUIDE.md) for usage examples
- Review registry implementation: `packages/components/src/catalog/registry.tsx`
- Check test examples: `packages/components/src/catalog/registry.test.tsx`
