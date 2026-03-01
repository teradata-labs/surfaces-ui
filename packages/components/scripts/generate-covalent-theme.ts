#!/usr/bin/env tsx
/**
 * Generate Covalent Theme CSS
 *
 * Converts Covalent design system tokens to surfaces-ui CSS custom properties.
 *
 * Usage:
 *   pnpm generate-covalent-theme [output.css]
 *   pnpm generate-covalent-theme src/theme/covalent.css
 *
 * Source:
 *   Tokens: https://cdn.jsdelivr.net/npm/@covalent/tokens@11.7.0/index.css
 *   Figma: https://www.figma.com/design/KvXVAmYdCVAS7hzkOa73Em/Covalent-Principles
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { convertCovalentToSurfaces } from '../src/theme/covalent-tokens';
import { generateSurfacesCSS } from '../src/theme/figma-tokens';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Covalent Theme Generator - Convert Covalent design system to surfaces-ui

Usage:
  pnpm generate-covalent-theme [output.css]
  pnpm generate-covalent-theme src/theme/covalent.css

Examples:
  # Generate and write to file
  pnpm generate-covalent-theme src/theme/covalent.css

  # Generate and print to stdout
  pnpm generate-covalent-theme

Source:
  Tokens: https://cdn.jsdelivr.net/npm/@covalent/tokens@11.7.0/index.css
  Figma Colors: https://www.figma.com/design/KvXVAmYdCVAS7hzkOa73Em/Covalent-Principles?node-id=8017-35193
  Figma Examples: https://www.figma.com/design/KvXVAmYdCVAS7hzkOa73Em/Covalent-Principles?node-id=24091-30327
`);
  process.exit(0);
}

const outputPath = args[0] ? resolve(args[0]) : null;

try {
  console.log('🎨 Converting Covalent design system tokens...');

  // Convert tokens
  const tokens = convertCovalentToSurfaces();
  let css = generateSurfacesCSS(tokens);

  // Add header
  const header = `/**
 * Covalent Design System Theme
 *
 * Generated from @covalent/tokens@11.7.0
 * Figma: https://www.figma.com/design/KvXVAmYdCVAS7hzkOa73Em/Covalent-Principles
 * Generated: ${new Date().toISOString()}
 *
 * Color Palette:
 * - Primary Blue: #3053f4 (light) / #688bf1 (dark)
 * - Secondary Navy: #00233c (light) / #c3c5dd (dark)
 * - Error: #ae1209 (light) / #fd7d69 (dark)
 * - Success: #036600 (light) / #81f976 (dark)
 * - Warning: #f38800 (light) / #ffcd9e (dark)
 * - Emphasis: #b10142 (light) / #cc809c (dark)
 */

`;
  css = header + css;

  // Write or print
  if (outputPath) {
    writeFileSync(outputPath, css, 'utf-8');
    console.log(`✅ Covalent theme generated: ${outputPath}`);
    console.log(`📏 Size: ${(css.length / 1024).toFixed(2)} KB`);
    console.log(`🎨 Colors: Primary Blue (#3053f4), Navy (#00233c)`);
  } else {
    console.log(css);
  }

  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
