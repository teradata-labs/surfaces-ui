import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from './FormField';
import { Input } from '../../primitives/input';

describe('FormField', () => {
  it('renders the label', () => {
    render(
      <FormField label="Email" htmlFor="email">
        <Input id="email" />
      </FormField>
    );
    expect(screen.getByText('Email')).toBeDefined();
  });

  it('renders helper text', () => {
    render(
      <FormField label="Email" helperText="We never share your email." htmlFor="email">
        <Input id="email" />
      </FormField>
    );
    expect(screen.getByText('We never share your email.')).toBeDefined();
  });

  it('renders error message instead of helper text when error is set', () => {
    render(
      <FormField label="Email" helperText="Helper" error="Invalid email." htmlFor="email">
        <Input id="email" />
      </FormField>
    );
    expect(screen.getByText('Invalid email.')).toBeDefined();
    expect(screen.queryByText('Helper')).toBeNull();
  });

  it('applies aria-invalid to child when error is set', () => {
    render(
      <FormField label="Email" error="Required" htmlFor="my-input">
        <Input id="my-input" />
      </FormField>
    );
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('shows required indicator when required=true', () => {
    render(
      <FormField label="Name" required htmlFor="name">
        <Input id="name" />
      </FormField>
    );
    expect(screen.getByText('*')).toBeDefined();
  });

  it('does not show required indicator when required=false', () => {
    render(
      <FormField label="Name" htmlFor="name">
        <Input id="name" />
      </FormField>
    );
    expect(screen.queryByText('*')).toBeNull();
  });

  it('renders without label', () => {
    render(
      <FormField htmlFor="field">
        <Input id="field" />
      </FormField>
    );
    expect(screen.getByRole('textbox')).toBeDefined();
  });
});
