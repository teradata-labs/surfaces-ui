#!/usr/bin/env node
/**
 * Register surfaces-ui HTML bundles with a running Loom service.
 *
 * Usage:
 *   node scripts/register-loom-apps.mjs [--loom-url http://localhost:5006] [--app sql-editor-cdn]
 *
 * Reads built HTML bundles from dist/apps/, base64-encodes them,
 * and registers them with Loom via POST /v1/apps (raw HTML content path).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_APPS = resolve(__dirname, '..', 'dist', 'apps');

/** App definitions matching the mcp-adapter registry. */
const APPS = {
  'sql-editor-cdn': {
    name: 'sql-editor',
    displayName: 'SQL Editor',
    description: 'Interactive SQL editor with query execution and result visualization',
    filename: 'sql-editor-cdn.html',
  },
  'json-render-cdn': {
    name: 'json-render',
    displayName: 'NL UI Generator',
    description: 'Natural language-driven UI component generator powered by json-render catalog',
    filename: 'json-render-cdn.html',
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    loomUrl: 'http://localhost:5006',
    app: null, // null = all apps
    unregister: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--loom-url' && args[i + 1]) {
      opts.loomUrl = args[++i];
    } else if (args[i] === '--app' && args[i + 1]) {
      opts.app = args[++i];
    } else if (args[i] === '--unregister') {
      opts.unregister = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage: register-loom-apps.mjs [options]

Options:
  --loom-url <url>   Loom HTTP gateway URL (default: http://localhost:5006)
  --app <id>         Register a single app (sql-editor-cdn or json-render-cdn)
  --unregister       Remove apps from Loom instead of registering
  --help             Show this help message`);
      process.exit(0);
    }
  }

  return opts;
}

async function checkHealth(loomUrl) {
  try {
    const resp = await fetch(`${loomUrl}/health`);
    const data = await resp.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}

async function registerApp(loomUrl, appDef) {
  const htmlPath = resolve(DIST_APPS, appDef.filename);

  if (!existsSync(htmlPath)) {
    console.error(`  ✗ ${appDef.name}: HTML bundle not found at ${htmlPath}`);
    console.error(`    Run 'pnpm build:apps' first.`);
    return false;
  }

  const htmlBytes = readFileSync(htmlPath);
  const contentBase64 = htmlBytes.toString('base64');
  const sizeKB = (htmlBytes.length / 1024).toFixed(0);

  console.log(`  → ${appDef.name} (${sizeKB} KB) ...`);

  const resp = await fetch(`${loomUrl}/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: appDef.name,
      display_name: appDef.displayName,
      description: appDef.description,
      content: contentBase64,
      overwrite: true,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error(`  ✗ ${appDef.name}: ${resp.status} ${errText}`);
    return false;
  }

  const result = await resp.json();
  const overwritten = result.overwritten ? ' (overwritten)' : '';
  console.log(`  ✓ ${appDef.name} → ${result.app?.uri}${overwritten}`);
  return true;
}

async function unregisterApp(loomUrl, appDef) {
  console.log(`  → Removing ${appDef.name} ...`);

  const resp = await fetch(`${loomUrl}/v1/apps/${appDef.name}`, {
    method: 'DELETE',
  });

  if (!resp.ok) {
    const errText = await resp.text();
    if (resp.status === 404 || errText.includes('not found')) {
      console.log(`  - ${appDef.name}: not registered (skipped)`);
      return true;
    }
    console.error(`  ✗ ${appDef.name}: ${resp.status} ${errText}`);
    return false;
  }

  console.log(`  ✓ ${appDef.name}: removed`);
  return true;
}

async function main() {
  const opts = parseArgs();

  // Check Loom health
  const healthy = await checkHealth(opts.loomUrl);
  if (!healthy) {
    console.error(`Error: Loom is not reachable at ${opts.loomUrl}`);
    console.error('Make sure the Loom service is running (looms serve).');
    process.exit(1);
  }

  console.log(`Loom: ${opts.loomUrl} (healthy)`);

  // Determine which apps to process
  const appIds = opts.app ? [opts.app] : Object.keys(APPS);
  const action = opts.unregister ? 'Unregistering' : 'Registering';
  console.log(`${action} ${appIds.length} app(s):\n`);

  let allOk = true;
  for (const id of appIds) {
    const appDef = APPS[id];
    if (!appDef) {
      console.error(`  ✗ Unknown app: ${id}`);
      console.error(`    Available: ${Object.keys(APPS).join(', ')}`);
      allOk = false;
      continue;
    }

    const ok = opts.unregister
      ? await unregisterApp(opts.loomUrl, appDef)
      : await registerApp(opts.loomUrl, appDef);

    if (!ok) allOk = false;
  }

  console.log('');
  if (allOk) {
    console.log('Done.');
  } else {
    console.error('Some operations failed.');
    process.exit(1);
  }
}

main();
