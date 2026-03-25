# SurfacesUI React Components Guide

Complete reference for using SurfacesUI React components in your applications.

## Quick Start

### Option 1: Use the MCP App Framework (Recommended)

The fastest way to build MCP apps with SurfacesUI:

```tsx
import { createMcpApp, Button, Card } from '@surfacesui/app-framework';

function MyApp() {
  return (
    <Card>
      <Button>Click Me</Button>
    </Card>
  );
}

// Automatically sets up React, MCP Bridge, and Theme
createMcpApp(MyApp);
```

### Option 2: Standalone HTML with CSS

Include the CSS resources from this MCP server:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Get these from MCP resources: ui://styles/tokens and ui://styles/components -->
  <link rel="stylesheet" href="tokens.css">
  <link rel="stylesheet" href="components.css">
</head>
<body>
  <!-- Your HTML here using the CSS classes -->
</body>
</html>
```

## Design System Tokens

All components use CSS custom properties for theming. Key tokens:

### Colors (Semantic)
- `--background` / `--foreground` - Page background and text
- `--primary` / `--primary-foreground` - Primary actions
- `--secondary` / `--secondary-foreground` - Secondary actions
- `--destructive` / `--destructive-foreground` - Destructive actions
- `--muted` / `--muted-foreground` - Muted UI elements
- `--accent` / `--accent-foreground` - Accent highlights
- `--border` - Border color
- `--input` - Input field backgrounds
- `--ring` - Focus ring color

### Status Colors
- `--positive` / `--on-positive` - Success states
- `--negative` / `--on-negative` - Error states
- `--caution` / `--on-caution` - Warning states

### Density & Spacing
- `--density-scale` - 0.8 (compact), 1 (comfortable), 1.2 (spacious)
- `--space-xs` through `--space-xl` - Base spacing units
- `--space-xs-scaled` through `--space-xl-scaled` - Density-aware spacing

### Dark Mode
Add `.dark` class to root element to enable dark mode:
```html
<html class="dark">
```

## Component Categories

### Primitives (Atoms)

#### Button
```tsx
import { Button } from '@surfacesui/app-framework';

<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button disabled>Disabled</Button>
```

#### Card
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@surfacesui/app-framework';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    Card body content
  </CardContent>
  <CardFooter>
    Footer actions
  </CardFooter>
</Card>
```

#### Badge
```tsx
import { Badge } from '@surfacesui/app-framework';

<Badge variant="default">New</Badge>
<Badge variant="secondary">Beta</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Custom</Badge>
```

#### Alert
```tsx
import { Alert, AlertTitle, AlertDescription } from '@surfacesui/app-framework';

<Alert variant="default">
  <AlertTitle>Note</AlertTitle>
  <AlertDescription>This is informational</AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Something went wrong</AlertDescription>
</Alert>
```

#### Input
```tsx
import { Input, Label } from '@surfacesui/app-framework';

<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@example.com" />
</div>
```

#### Dialog
```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@surfacesui/app-framework';

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Are you sure?</DialogTitle>
      <DialogDescription>This action cannot be undone.</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### Tabs
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@surfacesui/app-framework';

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

#### Form Controls
```tsx
import { Switch, Checkbox, RadioGroup, RadioGroupItem } from '@surfacesui/app-framework';

<Switch checked={enabled} onCheckedChange={setEnabled} />

<Checkbox checked={agreed} onCheckedChange={setAgreed} />

<RadioGroup value={selected} onValueChange={setSelected}>
  <RadioGroupItem value="option1" />
  <RadioGroupItem value="option2" />
</RadioGroup>
```

#### Progress Indicators
```tsx
import { Progress, CircularProgress } from '@surfacesui/app-framework';

<Progress value={75} />
<CircularProgress value={50} size="lg" />
```

### Molecules (Functional Groups)

#### IconButton
```tsx
import { IconButton } from '@surfacesui/components';

<IconButton icon={<SaveIcon />} tooltip="Save" onClick={handleSave} />
```

#### FilterChip / InputChip
```tsx
import { FilterChip, InputChip } from '@surfacesui/components';

<FilterChip label="Active" selected={true} onToggle={() => {}} />
<InputChip label="Tag" onRemove={() => {}} />
```

#### EmptyState
```tsx
import { EmptyState } from '@surfacesui/components';

<EmptyState
  icon={<InboxIcon />}
  title="No messages"
  description="Your inbox is empty"
  action={<Button>Compose</Button>}
/>
```

#### FormField
```tsx
import { FormField } from '@surfacesui/components';

<FormField
  label="Username"
  helperText="Choose a unique username"
  error="Username is taken"
  required
>
  <Input />
</FormField>
```

#### Snackbar
```tsx
import { Snackbar } from '@surfacesui/components';

<Snackbar
  open={true}
  message="File saved successfully"
  variant="success"
  action={<Button>Undo</Button>}
/>
```

#### CodeSnippet
```tsx
import { CodeSnippet } from '@surfacesui/components';

<CodeSnippet
  code="const x = 42;"
  language="javascript"
  showLineNumbers
/>
```

#### Menu
```tsx
import { Menu } from '@surfacesui/components';

<Menu
  items={[
    { label: 'Edit', onClick: handleEdit },
    { label: 'Delete', onClick: handleDelete, variant: 'destructive' },
    { type: 'separator' },
    { label: 'Settings', onClick: handleSettings }
  ]}
/>
```

### Organisms (Complex Components)

#### DataTable
```tsx
import { DataTable } from '@surfacesui/components';

<DataTable
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'status', label: 'Status', type: 'badge' }
  ]}
  data={rows}
  density="comfortable"
  onRowClick={handleRowClick}
/>
```

#### SideSheet
```tsx
import { SideSheet, SideSheetHeader, SideSheetContent, SideSheetFooter } from '@surfacesui/components';

<SideSheet open={true} onClose={handleClose} position="right">
  <SideSheetHeader title="Details" />
  <SideSheetContent>
    Content here
  </SideSheetContent>
  <SideSheetFooter>
    <Button onClick={handleClose}>Close</Button>
  </SideSheetFooter>
</SideSheet>
```

#### TreeList
```tsx
import { TreeList } from '@surfacesui/components';

<TreeList
  nodes={[
    { id: '1', label: 'Folder 1', children: [
      { id: '1-1', label: 'File 1' }
    ]}
  ]}
  onNodeClick={handleClick}
/>
```

#### SQLEditor (Full Editor)
```tsx
import { SQLEditor } from '@surfacesui/components';
import { useMcpTool } from '@surfacesui/app-framework';

function MyEditor() {
  const { execute } = useMcpTool('execute_query');

  return (
    <SQLEditor
      onExecute={(query) => execute({ sql: query })}
      results={queryResults}
    />
  );
}
```

#### ECharts (Visualization)
```tsx
import { ECharts } from '@surfacesui/components';

<ECharts
  option={{
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
    yAxis: { type: 'value' },
    series: [{ data: [120, 200, 150], type: 'line' }]
  }}
  theme="light"
/>
```

## MCP Bridge Integration

All components work seamlessly with the MCP Bridge for data fetching:

```tsx
import { useMcpTool, McpBridgeProvider } from '@surfacesui/app-framework';

function DataComponent() {
  const { data, loading, error } = useMcpTool('fetch_data', { id: 123 });

  if (loading) return <CircularProgress />;
  if (error) return <Alert variant="destructive">{error.message}</Alert>;

  return <DataTable data={data.rows} columns={data.columns} />;
}
```

## Theming

### Using ThemeProvider
```tsx
import { ThemeProvider } from '@surfacesui/app-framework';

<ThemeProvider theme="dark" density="comfortable">
  <App />
</ThemeProvider>
```

### Custom Theme Tokens
```tsx
<ThemeProvider
  tokenOverrides={{
    '--primary': '220 90% 60%',
    '--radius': '0.75rem'
  }}
>
  <App />
</ThemeProvider>
```

## Accessibility

All components follow WCAG 2.2 AA standards:
- Keyboard navigation
- Screen reader support
- Focus indicators
- Sufficient color contrast
- ARIA labels

Use the provided utility classes for accessible colors:
```tsx
<div className="text-error-accessible">Error message</div>
<div className="text-warning-accessible">Warning message</div>
```

## Bundle Size

- **Tokens CSS**: ~2KB gzipped
- **Components CSS**: ~3KB gzipped
- **React Components**: ~50KB gzipped (tree-shakeable)
- **Full SQL Editor App**: ~660KB gzipped (includes React 19, ECharts, CodeMirror)

## Best Practices

1. **Always use semantic color tokens** - Never hardcode colors
2. **Respect density modes** - Use `--space-*-scaled` for responsive spacing
3. **Use MCP Bridge for data** - Never call APIs directly
4. **Keep components under 400 lines** - Split into smaller components if needed
5. **80% test coverage minimum** - Write unit and accessibility tests
6. **Zero axe-core violations** - Run accessibility tests

## TypeScript Support

All components are fully typed:

```tsx
import type { ButtonProps, DataTableColumn } from '@surfacesui/app-framework';

const columns: DataTableColumn[] = [
  { key: 'name', label: 'Name', type: 'text' }
];
```

## Getting Help

- GitHub: https://github.com/yourusername/surfaces-ui
- Documentation: See the CLAUDE.md file in the repo root
- Examples: packages/app-framework/examples/

## License

Apache 2.0
