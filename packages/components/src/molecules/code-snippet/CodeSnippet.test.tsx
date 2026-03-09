import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodeSnippet } from './CodeSnippet';

describe('CodeSnippet', () => {
  const sampleCode = 'SELECT * FROM users;';

  it('renders code content', () => {
    render(<CodeSnippet code={sampleCode} />);
    expect(screen.getByText(sampleCode)).toBeDefined();
  });

  it('renders language label', () => {
    render(<CodeSnippet code={sampleCode} language="SQL" />);
    expect(screen.getByText('SQL')).toBeDefined();
  });

  it('renders filename (overrides language)', () => {
    render(<CodeSnippet code={sampleCode} language="SQL" filename="query.sql" />);
    expect(screen.getByText('query.sql')).toBeDefined();
  });

  it('copies code to clipboard and shows feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    });

    render(<CodeSnippet code={sampleCode} />);
    fireEvent.click(screen.getByLabelText('Copy code'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(sampleCode);
    });
    expect(screen.getByText('Copied')).toBeDefined();

    vi.unstubAllGlobals();
  });

  it('hides copy button when copyable=false', () => {
    render(<CodeSnippet code={sampleCode} copyable={false} />);
    expect(screen.queryByLabelText('Copy code')).toBeNull();
  });

  it('renders line numbers when enabled', () => {
    render(<CodeSnippet code={'line1\nline2\nline3'} showLineNumbers />);
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('accepts custom className', () => {
    const { container } = render(<CodeSnippet code={sampleCode} className="custom-code" />);
    expect((container.firstChild as HTMLElement)?.className).toContain('custom-code');
  });
});
