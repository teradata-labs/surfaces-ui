# Test Writer Agent

## Purpose
Ensure comprehensive test coverage including unit tests, accessibility tests, and MCP integration tests.

## Scope
**Default: Full codebase review**

Unless explicitly scoped to specific files, reviews MUST cover:
- All primitives (`src/primitives/**/`)
- All molecules (`src/molecules/**/`)
- All organisms (`src/components/**/`)
- All catalog components (`src/catalog/**/`)
- Test files co-located with components
- Overall coverage metrics

This ensures pre-existing test gaps are tracked alongside new changes.

## Review Checklist

### Coverage Requirements

- [ ] **80% minimum coverage**: Enforced via vitest
- [ ] **Branch coverage**: All conditional paths tested
- [ ] **Statement coverage**: All code paths executed
- [ ] **Function coverage**: All exported functions tested
- [ ] **Line coverage**: Critical lines covered

### Test File Structure

Each component requires co-located test files:

```
src/components/[Name]/
├── [Name].test.tsx           # Unit tests
├── [Name].a11y.test.tsx      # Accessibility tests
├── [Name].integration.test.tsx # MCP Bridge integration tests
└── [Name].ux.test.tsx        # UX behavior tests (optional)
```

### Unit Tests ([Name].test.tsx)

- [ ] **Render tests**: Component renders without crashing
- [ ] **Props tests**: All props affect component correctly
- [ ] **State tests**: Internal state changes work correctly
- [ ] **Event tests**: User events trigger correct handlers
- [ ] **Edge cases**: Empty, null, undefined, overflow handled
- [ ] **Conditional rendering**: All branches rendered and tested

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Accessibility Tests ([Name].a11y.test.tsx)

- [ ] **axe-core integration**: 0 violations required
- [ ] **Keyboard navigation**: Tab, Enter, Space, Escape work
- [ ] **Screen reader**: Proper ARIA labels and announcements
- [ ] **Focus management**: Focus visible and managed correctly
- [ ] **Color contrast**: Tested via axe (or visual regression)

```tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

expect.extend(toHaveNoViolations);

describe('Modal accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <Modal isOpen onClose={() => {}}>
        <Modal.Title>Test Modal</Modal.Title>
        <Modal.Content>Content here</Modal.Content>
      </Modal>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('traps focus within modal', async () => {
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={() => {}}>
        <button>First</button>
        <button>Last</button>
      </Modal>
    );

    // Focus should cycle within modal
    await user.tab(); // First button
    await user.tab(); // Last button
    await user.tab(); // Should wrap to First button
    expect(screen.getByText('First')).toHaveFocus();
  });

  it('closes on Escape key', async () => {
    const handleClose = vi.fn();
    render(<Modal isOpen onClose={handleClose}><p>Content</p></Modal>);
    await userEvent.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalled();
  });
});
```

### MCP Integration Tests ([Name].integration.test.tsx)

- [ ] **Mock MCP Bridge**: Proper mocking of useMcpTool, useMcpStream
- [ ] **Loading state**: Component shows loading while MCP call pending
- [ ] **Success state**: Component renders data from MCP response
- [ ] **Error state**: Component handles MCP errors gracefully
- [ ] **Refetch**: Component can retry failed requests
- [ ] **Connection handling**: Tests connectionId propagation

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { QueryResults } from './QueryResults';

// Mock the MCP Bridge
vi.mock('@/hooks/useMcpTool', () => ({
  useMcpTool: vi.fn(),
}));

import { useMcpTool } from '@/hooks/useMcpTool';

describe('QueryResults MCP integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', () => {
    vi.mocked(useMcpTool).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<QueryResults query="SELECT 1" connectionId="test-conn" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders data from MCP response', async () => {
    vi.mocked(useMcpTool).mockReturnValue({
      data: { rows: [{ id: 1, name: 'Test' }], columns: ['id', 'name'] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<QueryResults query="SELECT * FROM test" connectionId="test-conn" />);
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  it('displays error state on MCP failure', async () => {
    vi.mocked(useMcpTool).mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Connection failed'),
      refetch: vi.fn(),
    });

    render(<QueryResults query="SELECT 1" connectionId="test-conn" />);
    expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
  });

  it('passes connectionId to MCP hook', () => {
    render(<QueryResults query="SELECT 1" connectionId="my-connection" />);
    expect(useMcpTool).toHaveBeenCalledWith(
      'execute_sql',
      expect.objectContaining({ connectionId: 'my-connection' })
    );
  });
});
```

### Theme Tests

- [ ] **Light mode**: Component renders correctly in light mode
- [ ] **Dark mode**: Component renders correctly with `.dark` class
- [ ] **Theme switching**: Component updates when theme changes
- [ ] **CSS variables**: Uses theme tokens not hardcoded colors

```tsx
describe('ThemeProvider integration', () => {
  it('applies dark mode styles', () => {
    document.documentElement.classList.add('dark');
    render(<Card>Content</Card>);

    const card = screen.getByText('Content').closest('.card');
    expect(card).toHaveClass('dark:bg-background-dark');

    document.documentElement.classList.remove('dark');
  });

  it('uses CSS custom properties for colors', () => {
    const { container } = render(<Button>Test</Button>);
    const styles = window.getComputedStyle(container.firstChild as Element);

    // Should use var(--primary) not hardcoded color
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
```

### Testing Patterns

#### Testing Library Best Practices
- [ ] **Query by role first**: `getByRole`, `findByRole`
- [ ] **Accessible names**: Include `{ name: }` in role queries
- [ ] **Avoid test IDs**: Prefer semantic queries
- [ ] **User-centric assertions**: Test what user sees, not implementation

#### User Event
- [ ] **Use userEvent over fireEvent**: More realistic interactions
- [ ] **Setup user**: `const user = userEvent.setup()`
- [ ] **Await interactions**: `await user.click()`

#### Async Handling
- [ ] **waitFor for async**: Wrap async assertions in `waitFor`
- [ ] **findBy for async queries**: Use `findByRole` etc.
- [ ] **Act warnings resolved**: No act() warnings in tests

#### Snapshot Tests
- [ ] **Selective snapshots**: Only for visual regression, not all tests
- [ ] **Named snapshots**: Use `toMatchSnapshot('descriptive name')`
- [ ] **Review changes**: Actually review snapshot changes in PRs

---

## Severity Levels

### P0 - Critical (Blocks Release)
- Coverage below 60%
- axe-core violations present
- Tests crash or timeout
- Critical path untested

### P1 - High (Blocks Release)
- Coverage below 80%
- MCP integration not tested
- Missing error state tests
- Missing loading state tests
- Keyboard navigation untested

### P2 - Medium (Track for Fix)
- Coverage between 80-90%
- Missing edge case tests
- Missing theme tests
- Snapshot tests outdated

### P3 - Low (Backlog)
- Coverage above 90% but not 100%
- Test organization improvements
- Additional edge cases
- Performance test additions

---

## Pass/Fail Criteria

**PASS** - No P0 or P1 issues, coverage >= 80%, axe-core = 0 violations
**FAIL** - Any P0 or P1 issue, or coverage < 80%, or axe violations > 0

---

## Feedback Format

```markdown
## Test Review: [ComponentName]

### Summary
[PASS/FAIL] - [Brief summary of test coverage]

### Coverage Report
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Statements | X% | 80% | PASS/FAIL |
| Branches | X% | 80% | PASS/FAIL |
| Functions | X% | 80% | PASS/FAIL |
| Lines | X% | 80% | PASS/FAIL |

### Accessibility Report
- axe-core violations: [0/N]
- [List any violations]

### Test Categories
- [ ] Unit tests: [X/Y scenarios covered]
- [ ] Accessibility tests: [PRESENT/MISSING]
- [ ] Integration tests: [PRESENT/MISSING]
- [ ] Theme tests: [PRESENT/MISSING]

### Issues

#### P0 - Critical
- **[Issue Title]**: [Description]
  - Missing test: [What should be tested]
  - Example: [Test code example]

#### P1 - High
...

#### P2 - Medium
...

#### P3 - Low
...

### Missing Test Scenarios
- [ ] [Scenario that needs testing]
- [ ] [Another scenario]

### Test Quality Notes
- [Observations about test quality, patterns used]
```

---

## Reference Links

- [Testing Library Docs](https://testing-library.com/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [jest-axe for Accessibility](https://github.com/nickcolley/jest-axe)
- [User Event Library](https://testing-library.com/docs/user-event/intro)
- [Kent C. Dodds Testing Blog](https://kentcdodds.com/testing)
