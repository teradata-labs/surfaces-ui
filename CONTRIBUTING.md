# Contributing to SurfacesUI

Thank you for your interest in contributing to SurfacesUI! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We are committed to providing a welcoming and inclusive experience for everyone.

## How to Contribute

### Reporting Issues

- Use [GitHub Issues](https://github.com/teradata-labs/surfaces-ui/issues) to report bugs
- Include steps to reproduce, expected behavior, and actual behavior
- Include browser/OS version and relevant environment details

### Submitting Changes

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following the guidelines below
4. Write or update tests as needed
5. Ensure all tests pass and coverage meets thresholds
6. Submit a pull request

### Development Setup

```bash
# Clone your fork
git clone git@github.com:YOUR_USERNAME/surfaces-ui.git
cd surfaces-ui

# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test
```

## Guidelines

### Code Quality

- **TypeScript**: Strict mode, no `any` types without justification
- **Components**: Follow atomic design principles, max 400 lines per component
- **Tests**: 80% coverage minimum, include accessibility tests
- **Accessibility**: axe-core 0 violations required

### MCP Bridge Pattern

Components must use the MCP Bridge for data communication, never direct REST calls:

```tsx
// Correct
const { data } = useMcpTool('execute_sql', { query });

// Incorrect - never do this
const response = await fetch('/api/query', ...);
```

### Theming

- Use CSS custom properties and Tailwind semantic tokens
- Never hardcode colors
- Test in both light and dark modes

### Commit Messages

- Use clear, descriptive commit messages
- Reference issue numbers when applicable

### Pull Request Process

1. PRs must pass all CI checks (build, test, lint, accessibility)
2. PRs are reviewed by maintainers
3. Maintain backwards compatibility when possible
4. Update documentation for user-facing changes

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
