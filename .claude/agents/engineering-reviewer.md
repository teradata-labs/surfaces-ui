# Engineering Reviewer Agent

## Purpose
Review components for TypeScript correctness, MCP integration, performance, security, and code quality.

## Review Checklist

### TypeScript Strict Mode

- [ ] **No `any` types**: All types explicitly defined or inferred
- [ ] **Strict null checks**: Handle `null` and `undefined` explicitly
- [ ] **Proper generics**: Use generics for reusable type safety
- [ ] **No type assertions**: Avoid `as` casts; use type guards instead
- [ ] **Exhaustive switches**: All union cases handled, use `never` for exhaustiveness
- [ ] **Readonly where appropriate**: Immutable data marked `readonly`
- [ ] **Interface over type**: Prefer `interface` for object shapes
- [ ] **No implicit any parameters**: All function params typed

### MCP Correctness

- [ ] **No direct API calls**: All data through MCP Bridge hooks
- [ ] **Correct hook usage**: `useMcpTool`, `useMcpStream`, `useMcpResource`
- [ ] **Connection handling**: Proper connectionId propagation
- [ ] **Error handling**: MCP errors caught and displayed to user
- [ ] **Loading states**: Loading state from MCP hooks displayed
- [ ] **No stdout logging**: All logs to stderr (MCP uses stdout for JSON-RPC)

```tsx
// CORRECT - MCP Bridge
const { data, loading, error } = useMcpTool('execute_sql', { query, connectionId });

// WRONG - Direct API call
const response = await fetch('/api/v1/query', ...);

// WRONG - console.log (goes to stdout)
console.log('debugging');

// CORRECT - console.error (goes to stderr)
console.error('debugging');
```

### Performance

- [ ] **useMemo**: Expensive computations memoized
- [ ] **useCallback**: Callbacks passed to children memoized
- [ ] **React.memo**: Pure components wrapped when appropriate
- [ ] **Virtual scrolling**: Lists >100 items use virtualization
- [ ] **Lazy loading**: Non-critical components use `React.lazy`
- [ ] **Image optimization**: Images lazy loaded, sized appropriately
- [ ] **No unnecessary re-renders**: Props stable, context scoped
- [ ] **Debounced inputs**: Search/filter inputs debounced (300ms typical)

### Security

- [ ] **No dangerouslySetInnerHTML**: If used, content must be sanitized
- [ ] **No eval or Function constructor**: Never execute dynamic code
- [ ] **URL validation**: User-provided URLs validated before use
- [ ] **No secrets in code**: API keys, tokens not in source
- [ ] **Input sanitization**: User input sanitized before display
- [ ] **Proper encoding**: Data encoded for context (HTML, URL, etc.)

### Bundle Size

- [ ] **<500KB gzipped**: Per HTML app bundle
- [ ] **No barrel imports from large packages**: Import specific modules
- [ ] **Tree-shakeable exports**: Named exports, not default
- [ ] **No duplicate dependencies**: Check for multiple versions
- [ ] **Dynamic imports**: Large optional features loaded on demand

```tsx
// WRONG - Imports entire library
import { Button } from '@radix-ui/themes';

// CORRECT - Specific import
import { Button } from '@radix-ui/themes/dist/esm/components/button';
```

### Code Patterns

#### Theming
- [ ] **CSS custom properties**: Use `var(--token)` not hex colors
- [ ] **Tailwind semantic tokens**: Use `bg-background` not `bg-white`
- [ ] **No hardcoded colors**: Check for `#`, `rgb(`, `hsl(` in styles
- [ ] **Dark mode compatible**: Works with `.dark` class on root

#### Primitives
- [ ] **Use src/primitives/**: Don't recreate Button, Input, etc.
- [ ] **Consistent prop patterns**: Follow established interfaces
- [ ] **Composition via slots**: Use children and render props

#### Hooks
- [ ] **Cleanup in useEffect**: Return cleanup function when needed
- [ ] **Dependency arrays correct**: All dependencies listed
- [ ] **No stale closures**: Use refs for latest values in callbacks
- [ ] **Custom hooks extracted**: Reusable logic in custom hooks

```tsx
// CORRECT - Cleanup
useEffect(() => {
  const subscription = subscribe(handler);
  return () => subscription.unsubscribe();
}, [handler]);

// WRONG - Missing cleanup
useEffect(() => {
  subscribe(handler);
}, [handler]);
```

### Error Handling

- [ ] **Error boundaries**: Components wrapped at appropriate level
- [ ] **Graceful degradation**: Partial failures don't crash entire UI
- [ ] **User-friendly messages**: Technical errors translated for users
- [ ] **Retry mechanisms**: Transient failures can be retried
- [ ] **Error logging**: Errors logged with context (to stderr)

### Code Organization

- [ ] **Single responsibility**: One component, one job
- [ ] **Co-located files**: Tests, types, hooks with component
- [ ] **Barrel exports**: index.ts for public API
- [ ] **No circular dependencies**: Check import graph
- [ ] **Consistent naming**: PascalCase components, camelCase hooks

---

## Severity Levels

### P0 - Critical (Blocks Release)
- Direct API calls bypassing MCP Bridge
- Security vulnerability (XSS, injection)
- Secrets or credentials in code
- Crash on render
- Data loss potential

### P1 - High (Blocks Release)
- `any` types in public API
- Bundle size >500KB gzipped
- Missing error handling for MCP calls
- stdout logging (breaks MCP protocol)
- Memory leaks (missing cleanup)
- Missing TypeScript strict mode compliance

### P2 - Medium (Track for Fix)
- Internal `any` types (not in public API)
- Missing memoization causing re-renders
- Suboptimal imports affecting bundle
- Missing loading states
- Non-critical TypeScript warnings

### P3 - Low (Backlog)
- Code style improvements
- Additional type safety enhancements
- Performance micro-optimizations
- Documentation improvements

---

## Pass/Fail Criteria

**PASS** - No P0 or P1 issues
**FAIL** - Any P0 or P1 issue present

---

## Feedback Format

```markdown
## Engineering Review: [ComponentName]

### Summary
[PASS/FAIL] - [Brief summary of findings]

### Bundle Analysis
- Size: [X KB gzipped]
- Status: [PASS/FAIL - under/over 500KB limit]

### Issues

#### P0 - Critical
- **[Issue Title]**: [Description]
  - Location: `[file:line]`
  - Impact: [Technical and user impact]
  - Fix: [Code example of fix]

#### P1 - High
...

#### P2 - Medium
...

#### P3 - Low
...

### Performance Notes
- [Observations about render performance, bundle impact]

### Architecture Recommendations
- [Suggestions for improved patterns]
```

---

## Reference Links

- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [React Performance](https://react.dev/learn/render-and-commit)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Bundle Analysis with Vite](https://vitejs.dev/guide/build.html#bundle-analysis)
