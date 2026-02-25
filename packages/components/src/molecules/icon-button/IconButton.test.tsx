import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from './IconButton';

const PlusIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

describe('IconButton', () => {
  it('renders a button', () => {
    render(
      <IconButton aria-label="Add item">
        <PlusIcon />
      </IconButton>
    );
    expect(screen.getByRole('button', { name: 'Add item' })).toBeDefined();
  });

  it('calls onClick handler', () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Add" onClick={onClick}>
        <PlusIcon />
      </IconButton>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies filled variant classes', () => {
    render(
      <IconButton aria-label="Add" variant="filled">
        <PlusIcon />
      </IconButton>
    );
    expect(screen.getByRole('button').className).toContain('bg-primary');
  });

  it('applies active class when active=true', () => {
    render(
      <IconButton aria-label="Add" active>
        <PlusIcon />
      </IconButton>
    );
    expect(screen.getByRole('button').className).toContain('bg-secondary-container');
  });

  it('is disabled when disabled prop set', () => {
    render(
      <IconButton aria-label="Add" disabled>
        <PlusIcon />
      </IconButton>
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('accepts custom className', () => {
    render(
      <IconButton aria-label="Add" className="my-btn">
        <PlusIcon />
      </IconButton>
    );
    expect(screen.getByRole('button').className).toContain('my-btn');
  });

  it('renders sm size', () => {
    render(
      <IconButton aria-label="Add" size="sm">
        <PlusIcon />
      </IconButton>
    );
    expect(screen.getByRole('button').className).toContain('w-8');
  });
});
