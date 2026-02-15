# Coding Conventions

**Analysis Date:** 2026-02-15

## Naming Patterns

**Files:**
- PascalCase for React component files: `SQLEditor.tsx`, `SQLToolbar.tsx`, `CodeMirrorSQLInput.tsx`
- kebab-case for utility and config files: `echart-themes.ts`, `view-mode-toggle.tsx`, `tailwind-preset.ts`
- snake_case for internal type definitions within types files: `sql_result`, `connection_id` (used in API parameters)
- Test files follow component name with test suffix: `SQLEditor.test.tsx`, `SQLEditor.a11y.test.tsx`, `SQLEditor.integration.test.tsx`

**Functions:**
- camelCase for all function and hook names: `useMcpTool`, `getStatusBadge`, `loadPersistedState`, `refetch`
- Prefix custom hooks with `use`: `useMcpTool`, `useMcpBridge`, `useMcpPagination`, `useMcpStream`
- Internal helper functions use camelCase: `getStatusBadge()`, `loadPersistedState()`

**Variables:**
- camelCase for all variables and constants: `initialCode`, `connectionId`, `hasResult`, `isExecuting`
- ALL_CAPS for module-level constants: `STORAGE_KEY`, `STATE_TTL_MS`
- Descriptive names reflecting purpose: `mockRefetch`, `handleCodeChange`, `handleExecutionComplete`

**Types:**
- PascalCase for interfaces and types: `SQLEditor`, `SQLResult`, `ChartConfig`, `ResultsConfig`, `UseMcpToolOptions`, `UseMcpToolResult`
- Props interfaces end with `Props`: `SQLEditorProps`, `SQLInputProps`, `SQLToolbarProps`, `ButtonProps`
- Configuration interfaces end with `Config`: `ThemeConfig`, `ChartConfig`, `ResultsConfig`, `McpBridgeConfig`
- Type interfaces use full names: `McpMessage`, `McpRenderData`, `McpToolResult`

## Code Style

**Formatting:**
- Tool: Prettier 3.7.0
- Print width: 100 characters
- Tab width: 2 spaces
- Single quotes for strings
- Trailing commas in all multi-line structures
- Semicolons required at end of statements
- Prettier plugin for Tailwind CSS class sorting

**Prettier Config** (`.prettierrc`):
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Linting:**
- Tool: ESLint (executed as `pnpm lint`)
- Config: Not present in root (inherited from base or package level)
- Run: `eslint . --ext .ts,.tsx` from packages/components

## Import Organization

**Order:**
1. React and React-DOM imports: `import * as React from 'react'` or `import { useState } from 'react'`
2. Third-party library imports: Lucide icons, Radix UI primitives, ECharts, etc.
3. Internal imports from utilities: `import { cn } from '../../lib/utils'`
4. Internal imports from bridge: `import { useMcpTool } from '../../bridge/hooks'`
5. Component imports: `import { CardContent } from '../../primitives/card'`
6. Type imports: `import type { SQLEditorProps, SQLResult } from './types'`

**Path Aliases:**
- `@/*` → `./src/*` (configured in `tsconfig.json`)
- Relative paths used in practice: `../../primitives/`, `../../bridge/`, `../../lib/`

**Example Import Block:**
```typescript
import * as React from 'react';
import { Card, CardContent } from '../../primitives/card';
import { useMcpTool } from '../../bridge/hooks';
import { cn } from '../../lib/utils';
import type { SQLResultsConfig, SQLResultsAction } from '../sql-results/types';
import type { SQLEditorProps, SQLResult } from './types';
```

## Error Handling

**Patterns:**
- Errors are captured in state: `[error, setError]` or returned from hooks
- MCP tool hooks return `{ data, loading, error, refetch }` object
- Errors displayed via Alert component with `role="alert"` for accessibility
- Component-level try-catch for localStorage operations (seen in SQLEditor.tsx)
- null coalescing for optional error handling: `error?.message`

**Error Display:**
- Use Alert/Badge components with destructive variant for errors
- Error messages stored as strings in state
- Visual feedback through status badge showing "Error" state
- Loading states prevent error display during active operations

## Logging

**Framework:** Console (no explicit logging library)

**Patterns:**
- Minimal logging in component code
- Console methods used for debugging: `console.log()`, `console.error()`
- No structured logging in production code
- Focus on state and UI feedback rather than logs

## Comments

**When to Comment:**
- JSDoc/TSDoc comments on exported functions and complex exports
- Documentation comments on interfaces and type definitions
- Algorithm explanation for non-obvious logic
- MCP bridge integration notes (seen in SQLEditor.tsx with detailed explanation of timing behavior)

**JSDoc/TSDoc:**
- Used extensively for exported hooks and functions
- Parameter descriptions: `@param toolName - Description`
- Return type documentation: `@returns Type`
- Example usage in code blocks

**Example JSDoc:**
```typescript
/**
 * Generic hook for calling an MCP tool with automatic loading/error state.
 *
 * Automatically fetches on mount when `enabled` is true (default).
 * Supports periodic refetching via `refetchInterval`.
 *
 * @param toolName - Name of the MCP tool to call
 * @param args - Optional arguments to pass to the tool
 * @param options - Options controlling fetch behavior
 */
export function useMcpTool<T = unknown>(
  toolName: string,
  args?: Record<string, unknown>,
  options?: UseMcpToolOptions,
): UseMcpToolResult<T>
```

## Function Design

**Size:**
- Small, focused functions under 50 lines typical
- Inner helper functions defined within component scope: `getStatusBadge()`
- Large components like SQLResultsDisplay (1772 lines) broken into sub-components

**Parameters:**
- Destructured in function signature: `function SQLToolbar({ isExecuting, hasResult, ... })`
- Props interfaces define all parameters
- Optional parameters marked with `?` in type definitions

**Return Values:**
- React components return JSX.Element
- Hooks return objects with named properties: `{ data, loading, error, refetch }`
- Utility functions return typed values matching interface definitions
- Arrow functions preferred for inline callbacks

## Module Design

**Exports:**
- Named exports for components and hooks
- Default exports avoided (all use named exports)
- Type exports marked with `export type` keyword
- Barrel file pattern at component level

**Barrel Files:**
- `src/components/sql-editor/index.ts` exports all component variants
- `src/index.ts` exports public API for the library
- Re-exports from sub-directories for convenience
- Format: `export { ComponentName } from './ComponentName'`

**Component Structure:**
```
src/components/[name]/
├── index.ts                       # Barrel export
├── [Name].tsx                     # Main component
├── [SubComponent].tsx             # Sub-components
├── [Name].test.tsx                # Unit tests
├── [Name].a11y.test.tsx           # Accessibility tests
├── [Name].integration.test.tsx    # Bridge integration tests
├── types.ts                       # Component-specific types
└── hooks.ts                       # Component-specific hooks
```

## React Patterns

**Hooks:**
- Extensive use of custom hooks: `useMcpTool`, `useMcpBridge`, `useMcpPagination`, `useMcpStream`
- useState for local state management
- useCallback for memoized callbacks
- useEffect for side effects with dependency arrays
- forwardRef for primitive component wrappers

**Components:**
- Function components exclusively (no class components)
- Destructured props in parameters
- JSX with proper spacing and formatting
- Aria attributes for accessibility: `aria-label`, `aria-selected`, `role`

**Provider Pattern:**
- `McpBridgeProvider` wraps application for bridge access
- `ThemeProvider` manages theme state
- `AnalyticsProvider` manages analytics state
- Context hooks expose functionality: `useMcpBridge()`, `useTheme()`, `useAnalytics()`

## Styling

**Tailwind CSS:**
- All styling via Tailwind utility classes
- CSS custom properties for theming: `--background`, `--foreground`, `--primary`, etc.
- `cn()` utility from `lib/utils.ts` for conditional class merging
- Tailwind preset at `src/theme/tailwind-preset.ts`
- Dark mode via `class` strategy on document root

**Component Styling:**
- No inline styles
- No CSS modules
- ClassName prop for custom styling
- Dark mode variants: `dark:bg-blue-900/30`, `dark:text-yellow-400`

**Example:**
```tsx
<div className="flex items-center justify-between p-3 border-b border-border">
  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
    Executing...
  </Badge>
</div>
```

## TypeScript

**Configuration** (`tsconfig.json`):
- Target: ES2022
- Module: ESNext
- JSX: react-jsx
- Strict mode: enabled
- `noUncheckedIndexedAccess`: true
- `esModuleInterop`: true
- `isolatedModules`: true
- Path alias: `@/*` → `./src/*`

**Patterns:**
- Strict null checking enforced
- Generic types used extensively: `<T = unknown>`
- Interface-based prop definitions
- Type guards for conditional rendering
- Union types for state variants: `'bar' | 'line' | 'pie'`

---

*Convention analysis: 2026-02-15*
