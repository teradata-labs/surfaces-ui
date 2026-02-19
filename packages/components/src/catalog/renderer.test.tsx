/**
 * SurfacesRenderer Tests - Density Integration & Zero-Runtime Verification
 *
 * Tests density passthrough from SurfacesRenderer to ThemeProvider and verifies
 * the zero-runtime constraint (THEME-06): no CSS-in-JS libraries.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { SurfacesRenderer } from './renderer';

describe('SurfacesRenderer - Density Integration', () => {
  const minimalSpec = {
    type: 'Stack' as const,
    children: [{ type: 'Text' as const, value: 'Test Content' }],
  };

  beforeEach(() => {
    document.documentElement.removeAttribute('data-density');
    // Note: localStorage is already mocked globally in src/test/setup.ts
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes density prop to ThemeProvider', () => {
    render(
      <SurfacesRenderer spec={minimalSpec} density="compact" />
    );

    // Verify data-density is applied to document
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
  });

  it('defaults to comfortable density', () => {
    render(
      <SurfacesRenderer spec={minimalSpec} />
    );

    expect(document.documentElement.getAttribute('data-density')).toBe('comfortable');
  });

  it('accepts all density modes', () => {
    const modes = ['compact', 'comfortable', 'spacious'] as const;

    modes.forEach(mode => {
      const { unmount } = render(
        <SurfacesRenderer spec={minimalSpec} density={mode} />
      );
      expect(document.documentElement.getAttribute('data-density')).toBe(mode);
      unmount();
      document.documentElement.removeAttribute('data-density');
    });
  });
});

describe('Zero-Runtime Styling Constraint (THEME-06)', () => {
  it('does not import CSS-in-JS libraries', async () => {
    // Read the renderer source file
    const fs = await import('fs');
    const path = await import('path');

    const rendererPath = path.join(__dirname, 'renderer.tsx');
    const themeProviderPath = path.join(__dirname, '../theme/ThemeProvider.tsx');

    const rendererSource = fs.readFileSync(rendererPath, 'utf-8');
    const themeProviderSource = fs.readFileSync(themeProviderPath, 'utf-8');

    // CSS-in-JS libraries that would violate zero-runtime
    const cssInJsPatterns = [
      'styled-components',
      '@emotion',
      'linaria',
      'vanilla-extract',
      'stitches',
      'goober',
    ];

    cssInJsPatterns.forEach(pattern => {
      expect(rendererSource).not.toContain(pattern);
      expect(themeProviderSource).not.toContain(pattern);
    });
  });

  it('uses CSS custom properties for theming', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const tokensCssPath = path.join(__dirname, '../theme/tokens.css');
    const densityCssPath = path.join(__dirname, '../theme/density.css');

    const tokensCss = fs.readFileSync(tokensCssPath, 'utf-8');
    const densityCss = fs.readFileSync(densityCssPath, 'utf-8');

    // Verify CSS custom properties are used
    expect(tokensCss).toContain('--');
    expect(densityCss).toContain('--density-scale');
    expect(densityCss).toContain('data-density');
  });
});
