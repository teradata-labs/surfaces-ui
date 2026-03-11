import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { viteSingleFile } from 'vite-plugin-singlefile';
import type { UserConfig, Plugin } from 'vite';

import { pluginHtmlEntry } from './plugin-html-entry.js';
import { pluginDevProxy, type DevProxyOptions } from './plugin-dev-proxy.js';

export type { DevProxyOptions };

export interface AppConfigOptions {
  /** Entry file path. Default: './src/main.tsx' */
  entry?: string;
  /** Output directory. Default: 'dist' */
  outDir?: string;
  /** HTML title. Default: 'MCP App' */
  title?: string;
  /** Additional Vite plugins. */
  plugins?: Plugin[];
  /** Override or extend the generated Vite config. */
  vite?: Partial<UserConfig>;
  /** Dev proxy configuration for connecting to a real MCP server during development. */
  devProxy?: DevProxyOptions;
}

/**
 * Create a Vite config preset for building single-file MCP App HTML bundles.
 *
 * ```ts
 * // vite.config.ts
 * import { defineAppConfig } from '@surfacesui/app-framework/vite';
 * export default defineAppConfig({ title: 'Org Chart' });
 * ```
 */
export function defineAppConfig(options: AppConfigOptions = {}): UserConfig {
  const {
    entry = './src/main.tsx',
    outDir = 'dist',
    title = 'MCP App',
    plugins: extraPlugins = [],
    vite: overrides = {},
    devProxy,
  } = options;

  const devProxyPlugins: Plugin[] = devProxy ? [pluginDevProxy(devProxy)] : [];

  const config: UserConfig = {
    plugins: [
      tailwindcss(),
      react(),
      viteSingleFile(),
      pluginHtmlEntry({ entry, title }),
      ...devProxyPlugins,
      ...extraPlugins,
    ],
    build: {
      outDir,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
    },
    ...overrides,
  };

  return config;
}
