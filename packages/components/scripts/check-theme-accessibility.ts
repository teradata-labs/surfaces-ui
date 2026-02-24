#!/usr/bin/env tsx
/**
 * WCAG 2.1 AA Accessibility Checker for Theme Colors
 *
 * Checks contrast ratios for all foreground/background combinations
 * WCAG 2.1 AA requires:
 * - Normal text: 4.5:1 minimum
 * - Large text: 3:1 minimum
 */

import { convertCovalentToSurfaces, parseColorToHsl } from '../src/theme/covalent-tokens';
import { COVALENT_TOKENS } from '../src/theme/covalent-tokens';

// Convert HSL string "222 47% 11%" to RGB
function hslToRgb(hslString: string): [number, number, number] {
  const [h, s, l] = hslString.split(' ').map((v, i) => {
    const num = parseFloat(v.replace('%', ''));
    return i === 0 ? num : num / 100;
  });

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

// Convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

// Calculate relative luminance
function getLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((val) => {
    const sRGB = val / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio
function getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Check if contrast passes WCAG AA
function checkWCAG_AA(ratio: number): { normal: boolean; large: boolean } {
  return {
    normal: ratio >= 4.5, // Normal text
    large: ratio >= 3.0,  // Large text (18pt+ or 14pt+ bold)
  };
}

interface ContrastCheck {
  pair: string;
  foreground: string;
  background: string;
  ratio: number;
  passes: { normal: boolean; large: boolean };
  level: 'AAA' | 'AA' | 'AA Large' | 'Fail';
}

// Get WCAG level
function getWCAGLevel(ratio: number): 'AAA' | 'AA' | 'AA Large' | 'Fail' {
  if (ratio >= 7.0) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3.0) return 'AA Large';
  return 'Fail';
}

// Check all color combinations
function checkThemeAccessibility(mode: 'light' | 'dark'): ContrastCheck[] {
  const surfacesTokens = convertCovalentToSurfaces();
  const tokens = mode === 'light' ? surfacesTokens.root : surfacesTokens.dark;
  const covalentTokens = mode === 'light' ? COVALENT_TOKENS.light : COVALENT_TOKENS.dark;
  const results: ContrastCheck[] = [];

  // Define foreground/background pairs that must be checked
  // These use the actual converted surfaces tokens
  const pairs: Array<[string, string, string, string]> = [
    ['background/foreground', tokens.background, tokens.foreground, 'Main background text'],
    ['card/card-foreground', tokens.card, tokens['card-foreground'], 'Card text'],
    ['primary/primary-foreground', tokens.primary, tokens['primary-foreground'], 'Primary button text'],
    ['secondary/secondary-foreground', tokens.secondary, tokens['secondary-foreground'], 'Secondary button text'],
    ['muted/muted-foreground', tokens.muted, tokens['muted-foreground'], 'Muted text'],
    ['destructive/destructive-foreground', tokens.destructive, tokens['destructive-foreground'], 'Error button text'],
    ['success/success-foreground', tokens.success!, tokens['success-foreground']!, 'Success button text'],
    ['warning/warning-foreground', tokens.warning!, tokens['warning-foreground']!, 'Warning button text'],
  ];

  for (const [name, bgHsl, fgHsl, description] of pairs) {
    const bgRgb = hslToRgb(bgHsl);
    const fgRgb = hslToRgb(fgHsl);
    const ratio = getContrastRatio(fgRgb, bgRgb);
    const passes = checkWCAG_AA(ratio);
    const level = getWCAGLevel(ratio);

    // Convert back to hex for display
    const bgHex = `#${bgRgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
    const fgHex = `#${fgRgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;

    results.push({
      pair: `${name} (${description})`,
      foreground: fgHex,
      background: bgHex,
      ratio: Math.round(ratio * 100) / 100,
      passes,
      level,
    });
  }

  return results;
}

// Format results
function formatResults(mode: 'light' | 'dark', results: ContrastCheck[]): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${mode.toUpperCase()} MODE - WCAG 2.1 AA Accessibility Check`);
  console.log('='.repeat(80));

  const failures: ContrastCheck[] = [];
  const warnings: ContrastCheck[] = [];
  const passes: ContrastCheck[] = [];

  for (const result of results) {
    if (!result.passes.normal) {
      failures.push(result);
    } else if (result.level === 'AA') {
      warnings.push(result);
    } else {
      passes.push(result);
    }
  }

  // Show failures first
  if (failures.length > 0) {
    console.log('\n❌ FAILURES (Does not meet WCAG 2.1 AA for normal text):');
    for (const result of failures) {
      console.log(`\n  ${result.pair}`);
      console.log(`    FG: ${result.foreground} / BG: ${result.background}`);
      console.log(`    Contrast: ${result.ratio}:1 (${result.level})`);
      console.log(`    Normal text: ❌ FAIL (need 4.5:1)`);
      console.log(`    Large text:  ${result.passes.large ? '✅ PASS' : '❌ FAIL'} (need 3.0:1)`);
    }
  }

  // Show warnings (AA but not AAA)
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (Meets WCAG 2.1 AA but not AAA):');
    for (const result of warnings) {
      console.log(`\n  ${result.pair}`);
      console.log(`    FG: ${result.foreground} / BG: ${result.background}`);
      console.log(`    Contrast: ${result.ratio}:1 (${result.level})`);
      console.log(`    Normal text: ✅ PASS (4.5:1+)`);
      console.log(`    Large text:  ✅ PASS (3.0:1+)`);
    }
  }

  // Show passes
  if (passes.length > 0) {
    console.log('\n✅ PASSES (Meets or exceeds WCAG 2.1 AA):');
    for (const result of passes) {
      console.log(`\n  ${result.pair}`);
      console.log(`    FG: ${result.foreground} / BG: ${result.background}`);
      console.log(`    Contrast: ${result.ratio}:1 (${result.level})`);
      console.log(`    Normal text: ✅ PASS`);
      console.log(`    Large text:  ✅ PASS`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log(`  ✅ Passes: ${passes.length}`);
  console.log(`  ⚠️  Warnings: ${warnings.length}`);
  console.log(`  ❌ Failures: ${failures.length}`);
  console.log('='.repeat(80));

  if (failures.length === 0) {
    console.log(`\n✅ ${mode.toUpperCase()} MODE: All color combinations meet WCAG 2.1 AA standards!`);
  } else {
    console.log(`\n❌ ${mode.toUpperCase()} MODE: ${failures.length} color combination(s) need adjustment.`);
  }
}

// Main
console.log('🎨 Checking Covalent Theme Accessibility...\n');
console.log('WCAG 2.1 AA Requirements:');
console.log('  - Normal text: 4.5:1 minimum contrast ratio');
console.log('  - Large text (18pt+ or 14pt+ bold): 3:1 minimum contrast ratio');

const lightResults = checkThemeAccessibility('light');
formatResults('light', lightResults);

const darkResults = checkThemeAccessibility('dark');
formatResults('dark', darkResults);

// Exit with error if any failures
const totalFailures =
  lightResults.filter(r => !r.passes.normal).length +
  darkResults.filter(r => !r.passes.normal).length;

if (totalFailures > 0) {
  console.log(`\n❌ Total failures: ${totalFailures}`);
  console.log('Please adjust colors to meet WCAG 2.1 AA standards.\n');
  process.exit(1);
} else {
  console.log('\n✅ All color combinations pass WCAG 2.1 AA standards!\n');
  process.exit(0);
}
