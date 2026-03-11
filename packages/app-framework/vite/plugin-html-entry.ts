import type { Plugin } from 'vite';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

interface HtmlEntryOptions {
  /** Path to the entry script (relative to project root). */
  entry: string;
  /** HTML page title. */
  title: string;
}

/**
 * Vite plugin that generates an index.html if the consumer doesn't have one.
 *
 * The generated HTML includes:
 * - FOUC prevention script (applies dark class before React loads)
 * - Root element for React mounting
 * - Script tag pointing to the entry file
 *
 * If the consumer has their own index.html in the project root, the plugin
 * defers and does nothing.
 */
export function pluginHtmlEntry(options: HtmlEntryOptions): Plugin {
  const { entry, title } = options;
  let projectRoot = '';
  let createdHtml = false;

  return {
    name: 'surfacesui:html-entry',
    enforce: 'pre',

    config(_, { command }) {
      projectRoot = projectRoot || process.cwd();
      const htmlPath = resolve(projectRoot, 'index.html');

      if (!existsSync(htmlPath)) {
        // Write a physical index.html for Vite to use as its entry
        writeFileSync(htmlPath, generateHtml(entry, title), 'utf-8');
        createdHtml = true;
      }

      return null;
    },

    configResolved(config) {
      projectRoot = config.root;
    },

    // During dev, serve the generated HTML for the root URL if we created it
    configureServer(server) {
      if (!createdHtml) return;

      // The physical file exists, so Vite will serve it normally.
      // No extra middleware needed.
    },

    // Clean up the generated index.html after build
    closeBundle() {
      if (createdHtml) {
        const htmlPath = resolve(projectRoot, 'index.html');
        try {
          unlinkSync(htmlPath);
        } catch {
          // Ignore cleanup errors
        }
        createdHtml = false;
      }
    },
  };
}

function generateHtml(entry: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <script>
    // Apply dark class immediately (before React loads) to prevent FOUC
    (function() {
      var theme = localStorage.getItem('theme') || 'system';
      var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${escapeHtml(entry)}"></script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
