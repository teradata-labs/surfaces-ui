import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TreeList } from './TreeList';
import type { TreeNode } from './TreeList';

const sampleTree: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      { id: 'index', label: 'index.ts' },
      {
        id: 'components',
        label: 'components',
        children: [
          { id: 'button', label: 'Button.tsx' },
          { id: 'input', label: 'Input.tsx' },
        ],
      },
    ],
  },
  { id: 'readme', label: 'README.md' },
];

describe('TreeList', () => {
  it('renders with role="tree"', () => {
    render(<TreeList nodes={sampleTree} />);
    expect(screen.getByRole('tree')).toBeDefined();
  });

  it('renders top-level nodes', () => {
    render(<TreeList nodes={sampleTree} />);
    expect(screen.getByText('src')).toBeDefined();
    expect(screen.getByText('README.md')).toBeDefined();
  });

  it('does not show children by default (collapsed)', () => {
    render(<TreeList nodes={sampleTree} />);
    expect(screen.queryByText('index.ts')).toBeNull();
  });

  it('expands node on click to show children', () => {
    render(<TreeList nodes={sampleTree} />);
    fireEvent.click(screen.getByText('src'));
    expect(screen.getByText('index.ts')).toBeDefined();
    expect(screen.getByText('components')).toBeDefined();
  });

  it('collapses expanded node on second click', () => {
    render(<TreeList nodes={sampleTree} />);
    fireEvent.click(screen.getByText('src'));
    expect(screen.getByText('index.ts')).toBeDefined();
    fireEvent.click(screen.getByText('src'));
    expect(screen.queryByText('index.ts')).toBeNull();
  });

  it('expands nested children', () => {
    render(<TreeList nodes={sampleTree} />);
    fireEvent.click(screen.getByText('src'));
    fireEvent.click(screen.getByText('components'));
    expect(screen.getByText('Button.tsx')).toBeDefined();
    expect(screen.getByText('Input.tsx')).toBeDefined();
  });

  it('calls onSelect when a node is clicked', () => {
    const onSelect = vi.fn();
    render(<TreeList nodes={sampleTree} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('README.md'));
    expect(onSelect).toHaveBeenCalledWith('readme');
  });

  it('highlights selected node', () => {
    render(<TreeList nodes={sampleTree} selectedId="readme" />);
    const item = screen.getByText('README.md').closest('[aria-selected]');
    expect(item?.getAttribute('aria-selected')).toBe('true');
  });

  it('sets aria-expanded on parent nodes', () => {
    render(<TreeList nodes={sampleTree} />);
    const srcItem = screen.getByText('src').closest('[role="treeitem"]');
    expect(srcItem?.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByText('src'));
    expect(srcItem?.getAttribute('aria-expanded')).toBe('true');
  });

  it('supports controlled expandedIds', () => {
    const onToggle = vi.fn();
    render(
      <TreeList
        nodes={sampleTree}
        expandedIds={new Set(['src'])}
        onToggle={onToggle}
      />
    );
    // Should show children because src is in expandedIds
    expect(screen.getByText('index.ts')).toBeDefined();
    // Click to toggle
    fireEvent.click(screen.getByText('src'));
    expect(onToggle).toHaveBeenCalledWith('src');
  });

  it('accepts custom className', () => {
    render(<TreeList nodes={sampleTree} className="my-tree" />);
    expect(screen.getByRole('tree').className).toContain('my-tree');
  });

  it('renders leaf nodes without aria-expanded', () => {
    render(<TreeList nodes={sampleTree} />);
    const readme = screen.getByText('README.md').closest('[role="treeitem"]');
    expect(readme?.hasAttribute('aria-expanded')).toBe(false);
  });
});
