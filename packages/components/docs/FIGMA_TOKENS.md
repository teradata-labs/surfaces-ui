# Figma Design Tokens Integration

Guide to using Figma design tokens with surfaces-ui components.

## Overview

surfaces-ui provides utilities to convert Figma design tokens into CSS custom properties compatible with the component library's theming system. This enables:

- **Design System Sync**: Keep components in sync with Figma designs
- **Brand Customization**: Apply custom brand colors from Figma
- **Multi-theme Support**: Generate light and dark themes from Figma variables
- **Type Safety**: TypeScript support for token mapping

## Supported Formats

1. **Figma Variables** - Exported via Figma REST API
2. **Design Tokens Community Group (DTCG)** - Standard format
3. **Tokens Studio** - Figma plugin export format

---

## Quick Start

### 1. Export Tokens from Figma

**Option A: Figma Variables (Recommended)**

Export via Figma REST API:

```bash
curl -H "X-Figma-Token: YOUR_TOKEN" \
  "https://api.figma.com/v1/files/FILE_KEY/variables/local" > figma-tokens.json
```

**Option B: Tokens Studio Plugin**

1. Install [Tokens Studio plugin](https://www.figma.com/community/plugin/843461159747178978)
2. Export tokens as JSON (Settings → Export)

### 2. Convert to surfaces-ui CSS

Using the CLI:

```bash
cd packages/components
pnpm figma-tokens figma-tokens.json src/theme/custom.css
```

Output:
```
📦 Detected: Figma Variables export format
✅ CSS generated: src/theme/custom.css
📏 Size: 2.34 KB
```

### 3. Import Custom Theme

```tsx
import './theme/custom.css'; // Your Figma-generated tokens
import './theme/tokens.css'; // Base surfaces-ui tokens
```

---

## Token Mapping

### Semantic Color Tokens

Figma token names are automatically mapped to surfaces-ui tokens:

| Figma Token | surfaces-ui Token | Usage |
|-------------|-------------------|-------|
| `background` | `--background` | Page background |
| `foreground` | `--foreground` | Text color |
| `primary` | `--primary` | Primary brand color |
| `secondary` | `--secondary` | Secondary UI elements |
| `muted` | `--muted` | Muted backgrounds |
| `accent` | `--accent` | Accent highlights |
| `border` | `--border` | Border colors |
| `destructive` | `--destructive` | Error/danger states |

### Custom Mapping

Provide custom mappings for non-standard names:

```ts
import { mapFigmaTokensToSurfaces } from '@surfacesui/components';

const tokens = mapFigmaTokensToSurfaces(figmaTokens, {
  semanticMapping: {
    'brand-blue': 'primary',
    'text-primary': 'foreground',
    'bg-surface': 'background',
  },
});
```

---

## Examples

### Example 1: Basic DTCG Format

**Input** (`tokens.json`):
```json
{
  "colors": {
    "background": {
      "$value": "#ffffff",
      "$type": "color"
    },
    "foreground": {
      "$value": "#0f172a",
      "$type": "color"
    },
    "primary": {
      "$value": "#1e293b",
      "$type": "color"
    },
    "dark": {
      "background": {
        "$value": "#0f172a",
        "$type": "color"
      },
      "foreground": {
        "$value": "#f8fafc",
        "$type": "color"
      }
    }
  }
}
```

**Output** (`theme.css`):
```css
:root {
  --background: 0 0% 100%;
  --foreground: 217 91% 12%;
  --primary: 217 91% 18%;
}

.dark {
  --background: 217 91% 12%;
  --foreground: 210 40% 98%;
}
```

### Example 2: Figma Variables Format

**Input** (`variables.json`):
```json
[
  {
    "id": "VariableID:1:1",
    "name": "colors/background",
    "resolvedType": "COLOR",
    "valuesByMode": {
      "1:0": "#ffffff",
      "1:1": "#0f172a"
    }
  },
  {
    "id": "VariableID:1:2",
    "name": "colors/primary",
    "resolvedType": "COLOR",
    "valuesByMode": {
      "1:0": "#1e293b"
    }
  }
]
```

**Convert with mode IDs:**
```bash
pnpm figma-tokens variables.json --light-mode "1:0" --dark-mode "1:1"
```

### Example 3: Programmatic Usage

```ts
import {
  mapFigmaTokensToSurfaces,
  generateSurfacesCSS,
  mergeSurfacesTokens
} from '@surfacesui/components';
import figmaTokens from './figma-tokens.json';
import existingTokens from './existing-theme';

// Convert Figma tokens
const figmaTheme = mapFigmaTokensToSurfaces(figmaTokens, {
  colorPath: ['semantic', 'colors'],
  darkModePath: ['semantic', 'colors', 'dark'],
});

// Merge with existing tokens (existing takes precedence)
const mergedTheme = mergeSurfacesTokens(existingTokens, figmaTheme);

// Generate CSS
const css = generateSurfacesCSS(mergedTheme);

// Write to file or inject
fs.writeFileSync('theme.css', css);
```

---

## Workflow Integration

### With Figma Desktop MCP

Use Claude's Figma MCP integration to extract design tokens on the fly:

1. Open your Figma file in Figma Desktop
2. Select components with color variables
3. Ask Claude: "Extract design tokens from this selection and convert to surfaces-ui format"
4. Claude uses Figma MCP + our token mapper to generate CSS

### With CI/CD

Automate token sync in your build pipeline:

```yaml
# .github/workflows/sync-tokens.yml
name: Sync Figma Tokens

on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 * * 1' # Weekly on Monday

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Fetch Figma tokens
        run: |
          curl -H "X-Figma-Token: ${{ secrets.FIGMA_TOKEN }}" \
            "https://api.figma.com/v1/files/${{ vars.FIGMA_FILE }}/variables/local" \
            > figma-tokens.json

      - name: Convert to surfaces-ui
        run: |
          cd packages/components
          pnpm figma-tokens ../../figma-tokens.json src/theme/figma.css

      - name: Create PR
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'chore: sync Figma design tokens'
          body: 'Automated sync of design tokens from Figma'
```

---

## Advanced Usage

### Color Space Conversion

All colors are converted to HSL format used by surfaces-ui:

```ts
import { rgbToHsl, parseColorToHsl } from '@surfacesui/components';

// RGB to HSL
rgbToHsl(255, 0, 0); // "0 100% 50%" (red)

// Parse any format
parseColorToHsl('#ff0000');        // "0 100% 50%"
parseColorToHsl('rgb(255, 0, 0)'); // "0 100% 50%"
parseColorToHsl('hsl(0, 100%, 50%)'); // "0 100% 50%"
```

### Custom Token Paths

For nested token structures:

```ts
const tokens = mapFigmaTokensToSurfaces(figmaTokens, {
  colorPath: ['theme', 'semantic', 'colors'],
  darkModePath: ['theme', 'semantic', 'dark', 'colors'],
});
```

### Partial Overrides

Override specific tokens while keeping others:

```ts
import baseTheme from './theme/tokens';

const customTheme = mergeSurfacesTokens(baseTheme, {
  root: {
    primary: '220 90% 56%',      // Custom primary
    accent: '142 76% 36%',        // Custom accent
  },
  dark: {
    primary: '220 90% 66%',
  },
}, true); // true = Figma tokens override base
```

---

## Troubleshooting

### Issue: Colors not converting

**Problem**: Some colors are skipped or show warnings

**Solution**: Ensure color values are in supported formats:
- Hex: `#ffffff` or `#fff`
- RGB: `rgb(255, 255, 255)`
- RGBA: `rgba(255, 255, 255, 1)`
- HSL: `hsl(0, 0%, 100%)`

### Issue: Token names not matching

**Problem**: Figma tokens have different names than surfaces-ui expects

**Solution**: Use semantic mapping:

```ts
const tokens = mapFigmaTokensToSurfaces(figmaTokens, {
  semanticMapping: {
    'bg-primary': 'background',
    'text-main': 'foreground',
    'color-brand': 'primary',
  },
});
```

### Issue: Dark mode not generated

**Problem**: No `.dark` section in output CSS

**Solution**: Ensure dark mode tokens exist in Figma:
- For DTCG: Nested under `colors.dark`
- For Variables: Different mode ID in `valuesByMode`

---

## API Reference

### `mapFigmaTokensToSurfaces(tokens, options?)`

Convert DTCG/Tokens Studio format to surfaces-ui tokens.

**Parameters:**
- `tokens: FigmaTokens` - Input token object
- `options.colorPath?: string[]` - Path to colors (default: `['colors']`)
- `options.darkModePath?: string[]` - Path to dark variants (default: `['colors', 'dark']`)
- `options.semanticMapping?: Record<string, string>` - Custom name mapping

**Returns:** `SurfacesTokens`

### `mapFigmaVariablesToSurfaces(variables, options?)`

Convert Figma Variables export to surfaces-ui tokens.

**Parameters:**
- `variables: FigmaVariable[]` - Array of Figma variables
- `options.lightModeId?: string` - Light mode ID (default: `'light'`)
- `options.darkModeId?: string` - Dark mode ID (default: `'dark'`)
- `options.semanticMapping?: Record<string, string>` - Custom name mapping

**Returns:** `SurfacesTokens`

### `generateSurfacesCSS(tokens)`

Generate CSS custom properties from tokens.

**Parameters:**
- `tokens: SurfacesTokens` - surfaces-ui tokens

**Returns:** `string` - CSS content

### `mergeSurfacesTokens(existing, figma, override?)`

Merge Figma tokens with existing tokens.

**Parameters:**
- `existing: SurfacesTokens` - Base tokens
- `figma: SurfacesTokens` - Figma tokens to merge
- `override?: boolean` - If true, Figma tokens override existing (default: false)

**Returns:** `SurfacesTokens`

---

## Resources

- [Figma Variables API](https://www.figma.com/developers/api#variables)
- [Design Tokens Community Group](https://tr.designtokens.org/format/)
- [Tokens Studio Plugin](https://tokens.studio/)
- [surfaces-ui Theming Guide](../README.md#theming)

---

**Need help?** Open an issue on [GitHub](https://github.com/teradata-labs/surfaces-ui/issues)
