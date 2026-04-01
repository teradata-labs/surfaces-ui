import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Typography } from './Typography';

describe('Typography', () => {
  it('renders children', () => {
    render(<Typography>Hello world</Typography>);
    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('defaults to body-md variant with p element', () => {
    render(<Typography>Text</Typography>);
    expect(screen.getByText('Text').tagName).toBe('P');
  });

  it('renders headline-lg as h1', () => {
    render(<Typography variant="headline-lg">Title</Typography>);
    expect(screen.getByText('Title').tagName).toBe('H1');
  });

  it('renders headline-md as h2', () => {
    render(<Typography variant="headline-md">Title</Typography>);
    expect(screen.getByText('Title').tagName).toBe('H2');
  });

  it('renders overline as span', () => {
    render(<Typography variant="overline">LABEL</Typography>);
    expect(screen.getByText('LABEL').tagName).toBe('SPAN');
  });

  it('allows element override via as prop', () => {
    render(<Typography variant="headline-lg" as="div">Custom</Typography>);
    expect(screen.getByText('Custom').tagName).toBe('DIV');
  });

  it('applies muted color', () => {
    render(<Typography muted>Muted text</Typography>);
    expect(screen.getByText('Muted text').className).toContain('text-on-surface-variant');
  });

  it('accepts custom className', () => {
    render(<Typography className="custom-typo">Styled</Typography>);
    expect(screen.getByText('Styled').className).toContain('custom-typo');
  });

  it('renders caption variant', () => {
    render(<Typography variant="caption">Small</Typography>);
    const el = screen.getByText('Small');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('text-xs');
  });
});
