#!/usr/bin/env node

/**
 * Simple HTTP server to test HTML apps locally
 */

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3456;

const apps = {
  '/sql-editor': resolve(__dirname, 'packages/mcp-adapter/apps/sql-editor-cdn.html'),
  '/json-render': resolve(__dirname, 'packages/mcp-adapter/apps/json-render-cdn.html'),
};

const server = createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Handle root - show menu
  if (pathname === '/' || pathname === '') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SurfacesUI Apps</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          h1 { color: #333; }
          .app { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
          a { color: #0066cc; text-decoration: none; font-size: 18px; }
          a:hover { text-decoration: underline; }
          .size { color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>🎨 SurfacesUI Demo Apps</h1>
        <div class="app">
          <a href="/sql-editor" target="_blank">SQL Editor</a>
          <div class="size">Interactive SQL editor with query execution</div>
        </div>
        <div class="app">
          <a href="/json-render" target="_blank">JSON Render UI Generator</a>
          <div class="size">Natural language UI component generator</div>
        </div>
        <div class="app">
          <a href="/json-render?prompt=Show%20a%20table%20with%20product%20data" target="_blank">
            JSON Render (with prompt)
          </a>
          <div class="size">Pre-filled with example prompt</div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Handle app requests
  const appPath = apps[pathname];
  if (appPath) {
    try {
      let html = readFileSync(appPath, 'utf-8');

      // If there's a prompt query param, inject it into the page
      const prompt = url.searchParams.get('prompt');
      if (prompt && pathname === '/json-render') {
        // The json-render app reads from URL params, so no injection needed
        console.log(`  → Serving with prompt: ${prompt}`);
      }

      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache'
      });
      res.end(html);
      console.log(`  ✅ Served ${pathname} (${(html.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error loading app: ${err.message}`);
      console.error(`  ❌ Error: ${err.message}`);
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🚀 SurfacesUI Apps Server`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`Available apps:`);
  console.log(`   • http://localhost:${PORT}/sql-editor`);
  console.log(`   • http://localhost:${PORT}/json-render`);
  console.log(`   • http://localhost:${PORT}/json-render?prompt=Show%20a%20table\n`);
});
