# Testing Patterns

**Analysis Date:** 2026-02-15

## Test Framework

**Runner:**
- Vitest 1.0.0
- Config: `vitest.config.ts`
- Environment: jsdom (browser-like DOM testing)
- Globals enabled (no import of describe/it/expect needed)

**Assertion Library:**
- Vitest assertions (expect API)
- Testing Library queries and matchers
- jest-axe for accessibility assertions

**Run Commands:**
```bash
pnpm test                   # Run all tests once
pnpm test:watch            # Watch mode with auto-rerun
pnpm test:coverage         # Generate coverage report
```

**Vitest Config** (`vitest.config.ts`):
```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
```

## Test File Organization

**Location:**
- Co-located with components in `__tests__/` subdirectory
- Shared test utilities in `src/test/setup.ts`
- Test files at same level as component files

**Naming:**
- `.test.tsx` for unit tests
- `.a11y.test.tsx` for accessibility tests
- `.integration.test.tsx` for MCP bridge integration tests
- Example: `SQLEditor.test.tsx`, `SQLEditor.a11y.test.tsx`, `SQLEditor.integration.test.tsx`

**Structure:**
```
src/components/sql-editor/
├── SQLEditor.tsx
├── __tests__/
│   ├── SQLEditor.test.tsx           # Unit tests
│   ├── SQLEditor.a11y.test.tsx      # Accessibility tests
│   └── SQLEditor.integration.test.tsx # Integration tests
├── types.ts
└── hooks.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe('SQLEditor', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      // Test implementation
    });
  });

  describe('Code Input', () => {
    it('updates code on user input', async () => {
      // Test implementation
    });
  });
});
```

**Patterns:**

- Top-level describe block per component
- Nested describe blocks grouping related tests by feature/area
- userEvent setup at suite level: `const user = userEvent.setup()`
- beforeEach hook clears mocks between tests: `vi.clearAllMocks()`
- Test names describe behavior: "renders without crashing", "updates code on user input"

## Mocking

**Framework:** Vitest `vi` (built-in mocking)

**Patterns:**
```typescript
// Mock entire module
vi.mock('../../../bridge/hooks', () => ({
  useMcpTool: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

// Mock and customize per test
vi.mocked(useMcpTool).mockReturnValue({
  data: { success: true, columns: ['id'], data: [{ id: 1 }], row_count: 1 },
  loading: false,
  error: null,
  refetch: vi.fn(),
});

// Mock third-party library
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
  })),
  registerTheme: vi.fn(),
}));

// Global mocks for browser APIs
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

**What to Mock:**
- MCP bridge hooks (`useMcpTool`, `useMcpBridge`)
- Third-party chart libraries (ECharts) to avoid canvas/rendering issues
- Browser APIs (ResizeObserver, IntersectionObserver)
- External dependencies that have side effects

**What NOT to Mock:**
- Testing Library's render/screen utilities
- User interaction (userEvent) - use for real interaction simulation
- DOM nodes and elements
- Components being tested (unless testing composition)

## Fixtures and Factories

**Test Data:**
```typescript
// Mock data setup
const mockResult = {
  success: true,
  columns: ['id', 'name'],
  data: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ],
  row_count: 2,
};

vi.mocked(useMcpTool).mockReturnValue({
  data: mockResult,
  loading: false,
  error: null,
  refetch: vi.fn(),
});
```

**Location:**
- Inline within test files near usage
- No shared fixture files in observed tests
- Mock objects created immediately before use
- Keep mocks close to test for clarity

## Coverage

**Requirements:** 80% minimum enforced
- Lines: 80%
- Branches: 80%
- Functions: 80%
- Statements: 80%

**View Coverage:**
```bash
pnpm test:coverage
# Generates coverage reports in text, lcov, and html formats
```

## Test Types

**Unit Tests:**
- File: `SQLEditor.test.tsx`
- Scope: Individual component behavior in isolation
- Approach: Mock MCP hooks, render component, assert UI changes
- Examples:
  - Rendering with different props
  - User input handling
  - Conditional rendering based on state
  - Callback invocation

**Accessibility Tests:**
- File: `SQLEditor.a11y.test.tsx`
- Scope: WCAG AA 2.2 compliance, screen reader support
- Approach: Use axe-core for automated checks, test keyboard navigation, ARIA attributes
- Coverage:
  - axe-core violations (0 violations required)
  - Keyboard navigation (Tab, Ctrl+Enter, Cmd+Enter)
  - ARIA attributes (aria-label, aria-selected, role)
  - Screen reader announcements
  - Focus management
  - Color contrast (no color-only information)

**Integration Tests:**
- File: `SQLEditor.integration.test.tsx`
- Scope: MCP bridge communication and tool invocation
- Approach: Mock bridge hooks, verify correct parameters passed, test data flow
- Examples:
  - MCP hook receives correct tool name
  - Query parameters passed correctly
  - Connection ID passed through
  - Tool invocation with proper arguments

## Common Patterns

**Async Testing:**
```typescript
// Using async/await
it('updates code on user input', async () => {
  render(<SQLEditor />);
  const textarea = screen.getByRole('textbox');

  await user.type(textarea, 'SELECT 1');
  expect(textarea).toHaveValue('SELECT 1');
});

// Using waitFor for async state updates
it('calls onExecutionComplete with result', async () => {
  const handleComplete = vi.fn();
  vi.mocked(useMcpTool).mockReturnValue({
    data: mockResult,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });

  render(<SQLEditor initialCode="SELECT 1" onExecutionComplete={handleComplete} />);

  await waitFor(() => {
    expect(handleComplete).toHaveBeenCalledWith(mockResult);
  });
});
```

**Error Testing:**
```typescript
// Test error state display
it('displays error message on query failure', () => {
  vi.mocked(useMcpTool).mockReturnValue({
    data: {
      success: false,
      error: 'Syntax error at position 10',
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  });

  render(<SQLEditor initialCode="SELEC 1" />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByText(/Syntax error/)).toBeInTheDocument();
});
```

**Mock Verification:**
```typescript
// Verify mock was called with specific arguments
it('passes connectionId to MCP hook', () => {
  render(<SQLEditor connectionId="test-connection" />);

  expect(useMcpTool).toHaveBeenCalledWith(
    'execute_sql',
    expect.objectContaining({ connection_id: 'test-connection' }),
    expect.any(Object)
  );
});

// Verify refetch was called
it('executes SQL on button click', async () => {
  const mockRefetch = vi.fn();
  vi.mocked(useMcpTool).mockReturnValue({
    data: null,
    loading: false,
    error: null,
    refetch: mockRefetch,
  });

  render(<SQLEditor initialCode="SELECT 1" />);
  const executeBtn = screen.getByRole('button', { name: /execute sql/i });
  await user.click(executeBtn);

  expect(mockRefetch).toHaveBeenCalled();
});
```

## Test Setup

**Setup File** (`src/test/setup.ts`):
```typescript
import '@testing-library/jest-dom';
```

**What it provides:**
- jest-dom matchers extended to expect: `toBeInTheDocument()`, `toHaveAttribute()`, etc.
- Custom matchers for DOM assertions

**Before Each Test:**
- Mocks are cleared automatically via `vi.clearAllMocks()` in beforeEach hooks
- Component state is fresh
- No persisted state between tests

## Testing Best Practices Observed

1. **User-Centric Testing:** Tests use `userEvent` to simulate real user interactions, not direct state manipulation
2. **Accessibility First:** All tests check ARIA attributes, keyboard navigation, roles
3. **Isolated Mocks:** Each test sets up only the mocks it needs
4. **Descriptive Test Names:** Names describe behavior, not implementation
5. **Comprehensive Coverage:** Unit + a11y + integration tests for major components
6. **Clear Arrange-Act-Assert:** Tests follow AAA pattern clearly

## Debugging Tests

**Watch Mode:**
```bash
pnpm test:watch
```
Re-runs tests on file changes, useful during development.

**Single Test File:**
```bash
pnpm test SQLEditor.test.tsx
```
Run tests for a specific file.

**Coverage Report:**
```bash
pnpm test:coverage
# Opens HTML report in browser
open coverage/index.html
```

---

*Testing analysis: 2026-02-15*
