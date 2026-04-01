# SurfacesUI CSS & Documentation Resources Guide

This guide explains how to use the SurfacesUI CSS stylesheets and React component documentation in Claude Desktop and other MCP clients.

## Overview

The SurfacesUI MCP server now exposes three types of resources:

1. **HTML Apps** (`text/html;profile=mcp-app`) - Pre-built interactive applications
2. **CSS Stylesheets** (`text/css`) - Design tokens and component styles
3. **Documentation** (`text/markdown`) - React component guides and usage examples

## Available CSS Resources

### 1. Design Tokens (`ui://styles/tokens`)

**File**: `tokens.css` (19KB)
**Purpose**: Core design system tokens for building UIs without React

Contains:
- Color tokens (semantic colors, status colors, brand colors)
- Typography tokens (font families, sizes, line heights)
- Spacing tokens (density-aware spacing system)
- Theme variables (dark mode support via `.dark` class)
- Animation tokens
- Elevation and shadows

**Usage in HTML:**
```html
<!DOCTYPE html>
<html class="dark"> <!-- Add 'dark' class for dark mode -->
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Reference the tokens from MCP resource -->
  <link rel="stylesheet" href="tokens.css">
  <title>My App</title>
</head>
<body>
  <div style="background-color: var(--background); color: var(--foreground);">
    <button style="background-color: var(--primary); color: var(--primary-foreground);">
      Click Me
    </button>
  </div>
</body>
</html>
```

**Key CSS Variables:**
```css
/* Core semantic colors */
--background: hsl(220 27% 98%);        /* Page background */
--foreground: hsl(205 100% 12%);      /* Text color */
--primary: hsl(229 90% 57%);          /* Primary brand color */
--secondary: hsl(205 100% 12%);       /* Secondary actions */
--border: hsl(216 12% 84%);           /* Border color */

/* Status colors */
--positive: hsl(118 100% 20%);        /* Success/positive */
--negative: hsl(4 92% 37%);           /* Error/danger */
--caution: hsl(33 100% 48%);          /* Warning */

/* Density system */
--space-sm-scaled: calc(8px * var(--density-scale));  /* Responsive spacing */
--space-md-scaled: calc(16px * var(--density-scale));
--space-lg-scaled: calc(24px * var(--density-scale));
```

### 2. Component Styles (`ui://styles/components`)

**File**: `components.css` (15KB, ~3KB gzipped)
**Purpose**: Complete compiled CSS for all SurfacesUI components

Contains:
- All primitive component styles
- React Flow styles
- Third-party library styles (compiled and optimized)
- Responsive utilities

**Usage in HTML:**
```html
<head>
  <!-- Include both tokens and components -->
  <link rel="stylesheet" href="tokens.css">
  <link rel="stylesheet" href="components.css">
</head>
```

## Available Documentation Resources

### React Components Guide (`ui://docs/react-components`)

**File**: `react-components.md` (10KB)
**Purpose**: Complete reference for using SurfacesUI React components

Contains:
- Quick start guide (MCP App Framework vs standalone)
- Complete component catalog with TypeScript examples
- Primitives: Button, Card, Badge, Alert, Input, Dialog, Tabs, etc.
- Molecules: IconButton, FilterChip, EmptyState, Menu, etc.
- Organisms: DataTable, SideSheet, TreeList, SQLEditor, etc.
- MCP Bridge integration patterns
- Theming guide
- Accessibility best practices
- Bundle size information

## How Claude Can Use These Resources

### Scenario 1: Creating Standalone HTML/CSS/JS

When Claude creates an HTML file for you, it can now:

1. Reference the CSS resources directly
2. Use the design tokens for consistent styling
3. Build UIs that match the SurfacesUI design system

**Example Claude prompt:**
> "Create an HTML page with a dashboard using the SurfacesUI design tokens. Include cards for metrics and use the primary color for buttons."

Claude will:
1. Read `ui://styles/tokens` to get color variables
2. Create HTML that uses those CSS custom properties
3. Ensure the design matches the rest of your SurfacesUI apps

### Scenario 2: Recommending React Components

When you ask Claude to build a feature, it can now:

1. Read `ui://docs/react-components` to see available components
2. Recommend the appropriate SurfacesUI components
3. Provide correct TypeScript imports and props

**Example Claude prompt:**
> "I need to display tabular data with sorting and filtering"

Claude will:
1. Read the React Components Guide
2. Recommend using `<DataTable>` from `@surfacesui/components`
3. Provide correct usage examples with TypeScript types

### Scenario 3: Building with the App Framework

**Example Claude prompt:**
> "Create a new MCP app that shows a form for data entry"

Claude will:
1. Use `@surfacesui/app-framework` for bootstrapping
2. Select appropriate primitives (Input, Label, Button, Card)
3. Wire up the MCP Bridge for data submission
4. Apply correct theming

## Design System Tokens Reference

### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|--------|
| `--background` | White-ish | Dark blue | Page background |
| `--foreground` | Dark blue | Light gray | Primary text |
| `--primary` | Blue | Light blue | Primary actions, links |
| `--secondary` | Dark blue | Light gray | Secondary actions |
| `--muted` | Light gray | Dark gray | Disabled elements |
| `--accent` | Magenta | Pink | Highlights, badges |

### Status Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|--------|
| `--positive` | Dark green | Light green | Success messages |
| `--negative` | Dark red | Light red | Error messages |
| `--caution` | Orange | Light orange | Warning messages |

### Density Modes

Set density via `data-density` attribute:

```html
<body data-density="compact">    <!-- 0.8x spacing -->
<body data-density="comfortable"> <!-- 1.0x spacing (default) -->
<body data-density="spacious">    <!-- 1.2x spacing -->
```

### Dark Mode

Toggle dark mode by adding/removing the `dark` class:

```html
<html class="dark">
  <!-- All colors automatically switch to dark variants -->
</html>
```

```javascript
// Toggle dark mode
document.documentElement.classList.toggle('dark');
```

## Utility Classes

The components.css includes these utility classes:

```css
.text-error-accessible      /* WCAG-compliant error text */
.text-warning-accessible    /* WCAG-compliant warning text */
.bg-error-accessible        /* Error background */
.bg-warning-accessible      /* Warning background */
.border-error-accessible    /* Error border */
.border-warning-accessible  /* Warning border */
```

## Best Practices

### 1. Always Use Semantic Tokens

❌ **Don't:**
```css
.my-button {
  background: #3053f4;  /* Hardcoded color */
  color: white;
}
```

✅ **Do:**
```css
.my-button {
  background: var(--primary);
  color: var(--primary-foreground);
}
```

### 2. Respect Density Modes

❌ **Don't:**
```css
.card {
  padding: 16px;  /* Fixed spacing */
}
```

✅ **Do:**
```css
.card {
  padding: var(--space-md-scaled);  /* Responsive to density */
}
```

### 3. Support Dark Mode

❌ **Don't:**
```css
.header {
  background: #f0f0f0;  /* Only works in light mode */
}
```

✅ **Do:**
```css
.header {
  background: var(--surface);  /* Adapts to theme */
}
```

## Accessing Resources in MCP Clients

### Claude Desktop

Resources are automatically available. Claude can read them via:
- List resources: Shows all `ui://` resources
- Read resource: `ui://styles/tokens`, `ui://styles/components`, `ui://docs/react-components`

### Other MCP Clients

Use the MCP SDK to list and read resources:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({ name: 'my-app', version: '1.0.0' });

// List all resources
const { resources } = await client.request({
  method: 'resources/list'
});

// Read a CSS resource
const { contents } = await client.request({
  method: 'resources/read',
  params: { uri: 'ui://styles/tokens' }
});

console.log(contents[0].text); // CSS content
```

## Complete Example: Custom HTML Page

Here's a complete example using the tokens:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Dashboard</title>
  <!-- Get these from MCP resources -->
  <link rel="stylesheet" href="tokens.css">
  <link rel="stylesheet" href="components.css">
  <style>
    body {
      font-family: var(--font-sans);
      background: var(--background);
      color: var(--foreground);
      padding: var(--space-lg-scaled);
      margin: 0;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: var(--space-md-scaled);
      margin-bottom: var(--space-md-scaled);
    }

    .btn {
      background: var(--primary);
      color: var(--primary-foreground);
      border: none;
      padding: var(--space-sm-scaled) var(--space-md-scaled);
      border-radius: var(--radius);
      cursor: pointer;
      font-size: 14px;
    }

    .btn:hover {
      opacity: 0.9;
    }

    .badge {
      display: inline-block;
      padding: 2px var(--space-sm-scaled);
      background: var(--positive-container);
      color: var(--on-positive-container);
      border-radius: 4px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>Task Dashboard</h1>

  <div class="card">
    <h2>Active Tasks <span class="badge">3</span></h2>
    <p>You have 3 tasks in progress</p>
    <button class="btn">View Tasks</button>
  </div>

  <div class="card">
    <h2>Completed</h2>
    <p>15 tasks completed this week</p>
  </div>
</body>
</html>
```

## Additional Resources

- **Full Documentation**: See `/CLAUDE.md` in the repo root
- **Component Library**: `@surfacesui/components` package
- **App Framework**: `@surfacesui/app-framework` package
- **MCP Server**: `@surfacesui/server` package

## License

Apache 2.0
