import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotebookCell } from './NotebookCell';

/*
 * Mock CellCodeMirror so unit tests focus on NotebookCell chrome,
 * not CodeMirror internals. The mock renders a plain <textarea>
 * that mirrors the real component's props: value, onChange, editable, onRun.
 */
vi.mock('./CellCodeMirror', () => ({
  CellCodeMirror: ({
    value,
    onChange,
    editable,
    onRun,
    type,
  }: {
    value: string;
    onChange?: (v: string) => void;
    editable?: boolean;
    onRun?: () => void;
    type: string;
  }) => (
    <textarea
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      readOnly={!editable}
      onKeyDown={(e) => {
        if (e.shiftKey && e.key === 'Enter' && onRun) {
          e.preventDefault();
          onRun();
        }
      }}
      className={type === 'code' ? 'font-mono' : 'font-sans'}
      aria-label={`${type} cell input`}
      data-testid="cell-editor"
    />
  ),
}));

describe('NotebookCell', () => {
  it('renders editor with value', () => {
    render(<NotebookCell type="code" value="SELECT * FROM users;" />);
    const editor = screen.getByTestId('cell-editor') as HTMLTextAreaElement;
    expect(editor.value).toBe('SELECT * FROM users;');
  });

  it('renders code cell with monospace font', () => {
    render(<NotebookCell type="code" value="x = 1" />);
    const editor = screen.getByTestId('cell-editor');
    expect(editor.className).toContain('font-mono');
  });

  it('renders markdown cell without monospace font', () => {
    render(<NotebookCell type="markdown" value="# Hello" />);
    const editor = screen.getByTestId('cell-editor');
    expect(editor.className).toContain('font-sans');
  });

  it('calls onValueChange when typing', () => {
    const onChange = vi.fn();
    render(<NotebookCell type="code" value="" onValueChange={onChange} />);
    fireEvent.change(screen.getByTestId('cell-editor'), {
      target: { value: 'new value' },
    });
    expect(onChange).toHaveBeenCalledWith('new value');
  });

  it('is read-only when onValueChange is not provided', () => {
    render(<NotebookCell type="code" value="x = 1" />);
    expect(screen.getByTestId('cell-editor').hasAttribute('readonly')).toBe(true);
  });

  it('renders execution count', () => {
    render(<NotebookCell type="code" value="x = 1" executionCount={5} />);
    expect(screen.getByText('[5]')).toBeDefined();
  });

  it('shows spinner when running', () => {
    const { container } = render(
      <NotebookCell type="code" value="x = 1" status="running" />,
    );
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('shows no count when not provided and not running', () => {
    render(<NotebookCell type="code" value="x = 1" />);
    expect(screen.queryByText(/\[/)).toBeNull();
  });

  it('renders custom editor when provided', () => {
    render(
      <NotebookCell
        type="code"
        value=""
        editor={<div data-testid="custom-editor">Monaco</div>}
      />,
    );
    expect(screen.getByTestId('custom-editor')).toBeDefined();
    expect(screen.queryByTestId('cell-editor')).toBeNull();
  });

  it('shows selection indicator when selected', () => {
    render(<NotebookCell type="code" value="" selected />);
    const indicator = screen.getByTestId('selection-indicator');
    expect(indicator.className).toContain('bg-on-surface-variant');
  });

  it('hides selection indicator when not selected', () => {
    render(<NotebookCell type="code" value="" />);
    const indicator = screen.getByTestId('selection-indicator');
    expect(indicator.className).not.toContain('bg-on-surface-variant');
  });

  it('fires onSelect when cell is clicked', () => {
    const onSelect = vi.fn();
    render(<NotebookCell type="code" value="" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('article'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders error alert with title', () => {
    render(
      <NotebookCell
        type="code"
        value="bad query"
        error={{ title: 'Syntax error' }}
      />,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Syntax error')).toBeDefined();
  });

  it('renders error alert with description', () => {
    render(
      <NotebookCell
        type="code"
        value="bad query"
        error={{ title: 'Error', description: 'Unexpected token' }}
      />,
    );
    expect(screen.getByText('Unexpected token')).toBeDefined();
  });

  it('renders error alert actions', () => {
    render(
      <NotebookCell
        type="code"
        value="bad query"
        error={{
          title: 'Error',
          actions: <button type="button">Retry</button>,
        }}
      />,
    );
    expect(screen.getByText('Retry')).toBeDefined();
  });

  it('renders rendered output', () => {
    render(
      <NotebookCell
        type="markdown"
        value="# Hello"
        renderedOutput={<h2>Hello</h2>}
      />,
    );
    expect(screen.getByTestId('rendered-output')).toBeDefined();
    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('fires onRun on Shift+Enter', () => {
    const onRun = vi.fn();
    render(
      <NotebookCell type="code" value="" onValueChange={() => {}} onRun={onRun} />,
    );
    fireEvent.keyDown(screen.getByTestId('cell-editor'), {
      key: 'Enter',
      shiftKey: true,
    });
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('does not fire onRun on Enter without Shift', () => {
    const onRun = vi.fn();
    render(
      <NotebookCell type="code" value="" onValueChange={() => {}} onRun={onRun} />,
    );
    fireEvent.keyDown(screen.getByTestId('cell-editor'), {
      key: 'Enter',
      shiftKey: false,
    });
    expect(onRun).not.toHaveBeenCalled();
  });

  it('has correct aria-label with execution count', () => {
    render(<NotebookCell type="code" value="" executionCount={3} />);
    expect(screen.getByRole('article', { name: 'code cell [3]' })).toBeDefined();
  });

  it('has correct aria-label without execution count', () => {
    render(<NotebookCell type="markdown" value="" />);
    expect(screen.getByRole('article', { name: 'markdown cell' })).toBeDefined();
  });

  it('accepts custom className', () => {
    const { container } = render(
      <NotebookCell type="code" value="" className="my-cell" />,
    );
    expect(container.firstElementChild?.className).toContain('my-cell');
  });
});
