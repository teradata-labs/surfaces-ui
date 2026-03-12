// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { defineAppConfig } from '../index';

describe('defineAppConfig', () => {
  it('returns a valid Vite config with expected plugins', () => {
    const config = defineAppConfig({ title: 'Test App' });

    expect(config.plugins).toBeDefined();
    expect(Array.isArray(config.plugins)).toBe(true);

    const pluginNames = (config.plugins as Array<{ name?: string }>)
      .filter((p) => p && typeof p === 'object' && 'name' in p)
      .map((p) => p.name);

    // Should include our html-entry plugin
    expect(pluginNames).toContain('surfacesui:html-entry');
  });

  it('uses default values', () => {
    const config = defineAppConfig();

    expect(config.build?.outDir).toBe('dist');
    expect(config.build?.emptyOutDir).toBe(true);
  });

  it('allows overriding outDir', () => {
    const config = defineAppConfig({ outDir: 'build' });
    expect(config.build?.outDir).toBe('build');
  });

  it('merges extra plugins', () => {
    const customPlugin = { name: 'custom-plugin' };
    const config = defineAppConfig({ plugins: [customPlugin as any] });

    const pluginNames = (config.plugins as Array<{ name?: string }>)
      .filter((p) => p && typeof p === 'object' && 'name' in p)
      .map((p) => p.name);

    expect(pluginNames).toContain('custom-plugin');
  });

  it('includes dev proxy plugin when devProxy is configured', () => {
    const config = defineAppConfig({
      devProxy: { command: 'echo test' },
    });

    const pluginNames = (config.plugins as Array<{ name?: string }>)
      .filter((p) => p && typeof p === 'object' && 'name' in p)
      .map((p) => p.name);

    expect(pluginNames).toContain('surfacesui:dev-proxy');
  });

  it('does not include dev proxy plugin when devProxy is not configured', () => {
    const config = defineAppConfig();

    const pluginNames = (config.plugins as Array<{ name?: string }>)
      .filter((p) => p && typeof p === 'object' && 'name' in p)
      .map((p) => p.name);

    expect(pluginNames).not.toContain('surfacesui:dev-proxy');
  });

  it('applies vite overrides', () => {
    const config = defineAppConfig({
      vite: { server: { port: 4000 } },
    });

    expect(config.server?.port).toBe(4000);
  });
});
