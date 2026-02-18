/**
 * ThemeProvider Tests - Density Integration
 *
 * Tests density state management, localStorage persistence, and data-density attribute application.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme, type DensityMode } from './ThemeProvider';

// Test component to access context
function DensityConsumer() {
  const { density, setDensity } = useTheme();
  return (
    <div>
      <span data-testid="density-value">{density}</span>
      <button onClick={() => setDensity('compact')}>Set Compact</button>
      <button onClick={() => setDensity('spacious')}>Set Spacious</button>
    </div>
  );
}

describe('ThemeProvider - Density', () => {
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    document.documentElement.removeAttribute('data-density');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to comfortable density', () => {
    localStorageMock.getItem.mockReturnValue(null);
    render(
      <ThemeProvider>
        <DensityConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('density-value')).toHaveTextContent('comfortable');
  });

  it('accepts initial density prop', () => {
    render(
      <ThemeProvider density="compact">
        <DensityConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('density-value')).toHaveTextContent('compact');
  });

  it('reads density from localStorage on mount', () => {
    localStorageMock.getItem.mockReturnValue('spacious');
    render(
      <ThemeProvider>
        <DensityConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('density-value')).toHaveTextContent('spacious');
  });

  it('persists density changes to localStorage', () => {
    localStorageMock.getItem.mockReturnValue(null);
    render(
      <ThemeProvider>
        <DensityConsumer />
      </ThemeProvider>
    );

    act(() => {
      screen.getByText('Set Compact').click();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('density', 'compact');
  });

  it('applies data-density attribute to wrapper', () => {
    render(
      <ThemeProvider density="spacious">
        <DensityConsumer />
      </ThemeProvider>
    );

    // Check document element has density attribute (from effect)
    expect(document.documentElement.getAttribute('data-density')).toBe('spacious');
  });

  it('updates data-density when density changes', () => {
    localStorageMock.getItem.mockReturnValue(null);
    render(
      <ThemeProvider>
        <DensityConsumer />
      </ThemeProvider>
    );

    act(() => {
      screen.getByText('Set Compact').click();
    });

    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
  });

  it('exposes setDensity through useTheme hook', () => {
    localStorageMock.getItem.mockReturnValue(null);
    render(
      <ThemeProvider>
        <DensityConsumer />
      </ThemeProvider>
    );

    // Initially comfortable
    expect(screen.getByTestId('density-value')).toHaveTextContent('comfortable');

    // Change to spacious
    act(() => {
      screen.getByText('Set Spacious').click();
    });

    expect(screen.getByTestId('density-value')).toHaveTextContent('spacious');
  });

  // Type safety test - ensures all density modes are valid
  it('accepts all valid density modes', () => {
    const densityModes: DensityMode[] = ['compact', 'comfortable', 'spacious'];

    densityModes.forEach(mode => {
      const { unmount } = render(
        <ThemeProvider density={mode}>
          <DensityConsumer />
        </ThemeProvider>
      );
      expect(screen.getByTestId('density-value')).toHaveTextContent(mode);
      unmount();
    });
  });
});
