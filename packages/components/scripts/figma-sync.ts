#!/usr/bin/env tsx
/**
 * Figma Variable Sync Script
 *
 * Syncs Figma variables (exported as JSON) through the Covalent variable
 * map to produce SurfacesUI CSS custom properties.
 *
 * Usage:
 *   pnpm figma-sync <variables.json> [output.css]
 *   pnpm figma-sync --diff <variables.json>   # show diff only
 *
 * Workflow:
 *   1. Export Figma variables to JSON (via REST API or plugin)
 *   2. Run `pnpm figma-sync <variables.json>`
 *   3. Script maps through covalent-variable-map.ts
 *   4. Diffs against current tokens.css
 *   5. Generates updated CSS if changes detected
 *   6. Reports new/changed/removed tokens
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  COLOR_VARIABLE_MAP,
  COMPONENT_VARIABLE_MAP,
  TYPOGRAPHY_VARIABLE_MAP,
  ELEVATION_MAP,
} from '../src/theme/covalent-variable-map';
import { parseColorToHsl } from '../src/theme/figma-tokens';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Types ──────────────────────────────────────────────────────────────────

interface FigmaVariableExport {
  id: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  valuesByMode: Record<string, string | number | boolean>;
  scopes?: string[];
}

interface SyncResult {
  added: string[];
  changed: Array<{ token: string; oldValue: string; newValue: string }>;
  removed: string[];
  unchanged: number;
  css: string;
}

// ── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Figma Variable Sync - Map Covalent Figma variables to SurfacesUI tokens

Usage:
  pnpm figma-sync <variables.json> [output.css]
  pnpm figma-sync --diff <variables.json>

Options:
  --diff          Show token diff only, do not write output
  --light-mode    Mode ID for light theme (default: "light" or "Light")
  --dark-mode     Mode ID for dark theme (default: "dark" or "Dark")
  -h, --help      Show this help

Input Format:
  JSON array of Figma variable objects with:
  - name: variable name (e.g., "colors/primary" or "cv-theme-primary")
  - resolvedType: "COLOR" | "FLOAT" | "STRING"
  - valuesByMode: { "<modeId>": "<value>" }

Examples:
  pnpm figma-sync figma-variables.json
  pnpm figma-sync figma-variables.json src/theme/tokens.css
  pnpm figma-sync --diff figma-variables.json
`);
  process.exit(0);
}

const diffOnly = args.includes('--diff');
const filteredArgs = args.filter(a => !a.startsWith('--'));
const inputPath = resolve(filteredArgs[0] || '');
const defaultOutputPath = resolve(__dirname, '../src/theme/tokens.css');
const outputPath = filteredArgs[1] ? resolve(filteredArgs[1]) : defaultOutputPath;

// Parse mode overrides
const lightModeIdx = args.indexOf('--light-mode');
const darkModeIdx = args.indexOf('--dark-mode');
const lightModeId = lightModeIdx !== -1 ? args[lightModeIdx + 1] : undefined;
const darkModeId = darkModeIdx !== -1 ? args[darkModeIdx + 1] : undefined;

// ── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  if (!existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = readFileSync(inputPath, 'utf-8');
  let variables: FigmaVariableExport[];

  try {
    const parsed = JSON.parse(raw);
    variables = Array.isArray(parsed) ? parsed : parsed.variables || parsed.data || [];
  } catch {
    console.error('Error: Invalid JSON input');
    process.exit(1);
  }

  console.log(`Found ${variables.length} Figma variables`);

  const result = syncVariables(variables);

  // Report
  console.log(`\nSync Results:`);
  console.log(`  Added:     ${result.added.length}`);
  console.log(`  Changed:   ${result.changed.length}`);
  console.log(`  Removed:   ${result.removed.length}`);
  console.log(`  Unchanged: ${result.unchanged}`);

  if (result.added.length > 0) {
    console.log(`\nNew tokens:`);
    for (const token of result.added) {
      console.log(`  + --${token}`);
    }
  }

  if (result.changed.length > 0) {
    console.log(`\nChanged tokens:`);
    for (const { token, oldValue, newValue } of result.changed) {
      console.log(`  ~ --${token}: ${oldValue} → ${newValue}`);
    }
  }

  if (result.removed.length > 0) {
    console.log(`\nRemoved tokens:`);
    for (const token of result.removed) {
      console.log(`  - --${token}`);
    }
  }

  if (!diffOnly && (result.added.length > 0 || result.changed.length > 0)) {
    writeFileSync(outputPath, result.css, 'utf-8');
    console.log(`\nWritten to: ${outputPath}`);
  } else if (diffOnly) {
    console.log(`\nDiff mode - no files written`);
  } else {
    console.log(`\nNo changes detected`);
  }
}

// ── Sync Logic ─────────────────────────────────────────────────────────────

function syncVariables(variables: FigmaVariableExport[]): SyncResult {
  const lightTokens: Record<string, string> = {};
  const darkTokens: Record<string, string> = {};
  const componentTokens: Record<string, string> = {};

  // Detect mode IDs from the first variable
  const detectedModes = detectModeIds(variables);
  const lightMode = lightModeId || detectedModes.light;
  const darkMode = darkModeId || detectedModes.dark;

  for (const variable of variables) {
    const figmaName = normalizeFigmaName(variable.name);

    if (variable.resolvedType === 'COLOR') {
      const surfacesName = COLOR_VARIABLE_MAP[figmaName];
      if (!surfacesName) continue;

      const lightValue = variable.valuesByMode[lightMode];
      if (lightValue && typeof lightValue === 'string') {
        try {
          lightTokens[surfacesName] = parseColorToHsl(lightValue);
        } catch {
          console.warn(`  Warning: Could not parse light color for ${figmaName}: ${lightValue}`);
        }
      }

      const darkValue = variable.valuesByMode[darkMode];
      if (darkValue && typeof darkValue === 'string') {
        try {
          darkTokens[surfacesName] = parseColorToHsl(darkValue);
        } catch {
          console.warn(`  Warning: Could not parse dark color for ${figmaName}: ${darkValue}`);
        }
      }
    } else if (variable.resolvedType === 'FLOAT') {
      const mapping = COMPONENT_VARIABLE_MAP[figmaName];
      if (!mapping) continue;

      const lightValue = variable.valuesByMode[lightMode];
      if (lightValue !== undefined && typeof lightValue === 'number') {
        componentTokens[mapping.surfaces] = `${lightValue}${mapping.unit}`;
      }
    }
  }

  // Load existing tokens for diff
  const existingTokens = loadExistingTokens(outputPath);

  // Calculate diff
  const allNewTokens = { ...lightTokens, ...componentTokens };
  const added: string[] = [];
  const changed: Array<{ token: string; oldValue: string; newValue: string }> = [];
  const removed: string[] = [];
  let unchanged = 0;

  for (const [token, value] of Object.entries(allNewTokens)) {
    if (!(token in existingTokens)) {
      added.push(token);
    } else if (existingTokens[token] !== value) {
      changed.push({ token, oldValue: existingTokens[token]!, newValue: value });
    } else {
      unchanged++;
    }
  }

  for (const token of Object.keys(existingTokens)) {
    if (!(token in allNewTokens)) {
      removed.push(token);
    }
  }

  // Generate CSS
  const css = generateCSS(lightTokens, darkTokens, componentTokens);

  return { added, changed, removed, unchanged, css };
}

function detectModeIds(variables: FigmaVariableExport[]): { light: string; dark: string } {
  if (variables.length === 0) return { light: 'light', dark: 'dark' };

  const modes = Object.keys(variables[0]?.valuesByMode || {});
  const light = modes.find(m => /light/i.test(m)) || modes[0] || 'light';
  const dark = modes.find(m => /dark/i.test(m)) || modes[1] || 'dark';

  return { light, dark };
}

function normalizeFigmaName(name: string): string {
  // Handle path-style names: "colors/primary" -> "cv-theme-primary"
  // Handle already-prefixed: "cv-theme-primary" -> "cv-theme-primary"
  // Handle slash-style: "cv/button-height" -> "cv/button-height"
  if (name.startsWith('cv-') || name.startsWith('cv/')) {
    return name;
  }

  // Convert path to flat name: "colors/background" -> "cv-theme-background"
  const parts = name.split('/');
  const lastPart = parts[parts.length - 1]?.toLowerCase().replace(/[_\s]/g, '-');
  if (!lastPart) return name;

  return `cv-theme-${lastPart}`;
}

function loadExistingTokens(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};

  const css = readFileSync(filePath, 'utf-8');
  const tokens: Record<string, string> = {};
  const regex = /--([\w-]+):\s*([^;]+);/g;
  let match;

  while ((match = regex.exec(css)) !== null) {
    if (match[1] && match[2]) {
      tokens[match[1]] = match[2].trim();
    }
  }

  return tokens;
}

function generateCSS(
  lightTokens: Record<string, string>,
  darkTokens: Record<string, string>,
  componentTokens: Record<string, string>,
): string {
  let css = `/* Auto-generated by figma-sync - do not edit manually */\n`;
  css += `/* Source: Covalent Figma Variables */\n\n`;

  css += `:root {\n`;

  // Color tokens
  if (Object.keys(lightTokens).length > 0) {
    css += `  /* Semantic colors */\n`;
    for (const [key, value] of Object.entries(lightTokens)) {
      css += `  --${key}: ${value};\n`;
    }
  }

  // Component tokens
  if (Object.keys(componentTokens).length > 0) {
    css += `\n  /* Component dimensions */\n`;
    for (const [key, value] of Object.entries(componentTokens)) {
      css += `  --${key}: ${value};\n`;
    }
  }

  // Elevation tokens
  if (Object.keys(ELEVATION_MAP).length > 0) {
    css += `\n  /* Elevation */\n`;
    for (const [key, value] of Object.entries(ELEVATION_MAP)) {
      css += `  --${key}: ${value};\n`;
    }
  }

  css += `}\n`;

  // Dark mode
  if (Object.keys(darkTokens).length > 0) {
    css += `\n.dark {\n`;
    for (const [key, value] of Object.entries(darkTokens)) {
      css += `  --${key}: ${value};\n`;
    }
    css += `}\n`;
  }

  return css;
}

// ── Run ────────────────────────────────────────────────────────────────────

main();
