import { describe, it, expect } from 'vitest';
import { convertCovalentToSurfaces, COVALENT_TOKENS } from './covalent-tokens';

describe('Covalent Token Conversion', () => {
  it('converts Covalent tokens to surfaces-ui format', () => {
    const tokens = convertCovalentToSurfaces();

    expect(tokens.root).toBeDefined();
    expect(tokens.dark).toBeDefined();
  });

  it('converts light mode colors to HSL', () => {
    const tokens = convertCovalentToSurfaces();

    // Primary should be Covalent blue (#3053f4)
    expect(tokens.root.primary).toMatch(/^\d+ \d+% \d+%$/);

    // Background should be light gray (#f8f9fb)
    expect(tokens.root.background).toMatch(/^\d+ \d+% \d+%$/);
  });

  it('converts dark mode colors to HSL', () => {
    const tokens = convertCovalentToSurfaces();

    // Primary should be lighter blue (#688bf1)
    expect(tokens.dark.primary).toMatch(/^\d+ \d+% \d+%$/);

    // Background should be near black (#030406)
    expect(tokens.dark.background).toMatch(/^\d+ \d+% \d+%$/);
  });

  it('includes Covalent semantic colors', () => {
    const tokens = convertCovalentToSurfaces();

    // Success (green)
    expect(tokens.root.success).toMatch(/^\d+ \d+% \d+%$/);
    expect(tokens.dark.success).toMatch(/^\d+ \d+% \d+%$/);

    // Warning (orange)
    expect(tokens.root.warning).toMatch(/^\d+ \d+% \d+%$/);
    expect(tokens.dark.warning).toMatch(/^\d+ \d+% \d+%$/);

    // Error/destructive (red)
    expect(tokens.root.destructive).toMatch(/^\d+ \d+% \d+%$/);
    expect(tokens.dark.destructive).toMatch(/^\d+ \d+% \d+%$/);
  });

  it('has all required surfaces-ui semantic tokens', () => {
    const tokens = convertCovalentToSurfaces();

    const required = [
      'background',
      'foreground',
      'card',
      'card-foreground',
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'muted',
      'muted-foreground',
      'accent',
      'accent-foreground',
      'destructive',
      'destructive-foreground',
      'border',
      'input',
      'ring',
    ];

    for (const token of required) {
      expect(tokens.root[token]).toBeDefined();
      expect(tokens.dark[token]).toBeDefined();
    }
  });

  it('preserves Covalent color values', () => {
    expect(COVALENT_TOKENS.light.primary).toBe('#3053f4');
    expect(COVALENT_TOKENS.dark.primary).toBe('#688bf1');
    expect(COVALENT_TOKENS.light.error).toBe('#ae1209');
    expect(COVALENT_TOKENS.dark.success).toBe('#81f976');
  });
});
