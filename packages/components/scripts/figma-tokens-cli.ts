#!/usr/bin/env tsx
/**
 * Figma Tokens CLI
 *
 * Convert Figma design tokens to surfaces-ui CSS custom properties.
 *
 * Usage:
 *   pnpm figma-tokens <input.json> [output.css]
 *   pnpm figma-tokens tokens.json custom-theme.css
 *
 * Supports:
 *   - Design Tokens Community Group (DTCG) format
 *   - Figma Variables export format
 *   - Tokens Studio plugin export
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  mapFigmaTokensToSurfaces,
  mapFigmaVariablesToSurfaces,
  generateSurfacesCSS,
  type FigmaTokens,
  type FigmaVariable,
} from '../src/theme/figma-tokens';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Figma Tokens CLI - Convert Figma design tokens to surfaces-ui CSS

Usage:
  pnpm figma-tokens <input.json> [output.css]
  pnpm figma-tokens tokens.json custom-theme.css

Supported Input Formats:
  • Design Tokens Community Group (DTCG)
  • Figma Variables export (from REST API)
  • Tokens Studio plugin export

Examples:
  # Convert and write to file
  pnpm figma-tokens figma-tokens.json theme.css

  # Convert and print to stdout
  pnpm figma-tokens figma-tokens.json

  # Use in build script
  pnpm figma-tokens tokens.json src/theme/custom.css

Options:
  --help, -h     Show this help message
  --version, -v  Show version

For more information:
  https://github.com/teradata-labs/surfaces-ui
`);
  process.exit(0);
}

const inputPath = resolve(args[0]);
const outputPath = args[1] ? resolve(args[1]) : null;

try {
  // Read input file
  const inputContent = readFileSync(inputPath, 'utf-8');
  const input = JSON.parse(inputContent);

  // Detect format and convert
  let css: string;

  // Check if it's Figma Variables format (array with 'resolvedType')
  if (Array.isArray(input) && input[0]?.resolvedType) {
    console.log('📦 Detected: Figma Variables export format');
    const tokens = mapFigmaVariablesToSurfaces(input as FigmaVariable[]);
    css = generateSurfacesCSS(tokens);
  }
  // Otherwise assume DTCG/Tokens Studio format
  else {
    console.log('📦 Detected: DTCG/Tokens Studio format');
    const tokens = mapFigmaTokensToSurfaces(input as FigmaTokens);
    css = generateSurfacesCSS(tokens);
  }

  // Add header comment
  const header = `/* Generated from Figma design tokens */\n/* Source: ${inputPath} */\n/* Generated: ${new Date().toISOString()} */\n\n`;
  css = header + css;

  // Write or print
  if (outputPath) {
    writeFileSync(outputPath, css, 'utf-8');
    console.log(`✅ CSS generated: ${outputPath}`);
    console.log(`📏 Size: ${(css.length / 1024).toFixed(2)} KB`);
  } else {
    console.log(css);
  }

  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
