// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pluginHtmlEntry } from '../plugin-html-entry';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true), // default: consumer has index.html
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('pluginHtmlEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: consumer has their own index.html
    vi.mocked(existsSync).mockReturnValue(true);
  });

  it('creates a plugin with the correct name', () => {
    const plugin = pluginHtmlEntry({ entry: './src/main.tsx', title: 'Test' });
    expect(plugin.name).toBe('surfacesui:html-entry');
  });

  it('enforces pre ordering', () => {
    const plugin = pluginHtmlEntry({ entry: './src/main.tsx', title: 'Test' });
    expect(plugin.enforce).toBe('pre');
  });

  it('does not write index.html if consumer has one', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const plugin = pluginHtmlEntry({ entry: './src/main.tsx', title: 'Test' });

    const configFn = plugin.config as Function;
    configFn({}, { command: 'build' });

    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('writes index.html if consumer does not have one', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const plugin = pluginHtmlEntry({ entry: './src/main.tsx', title: 'My App' });

    const configFn = plugin.config as Function;
    configFn({}, { command: 'build' });

    expect(writeFileSync).toHaveBeenCalledTimes(1);
    const [, content] = vi.mocked(writeFileSync).mock.calls[0]!;
    expect(content).toContain('<title>My App</title>');
    expect(content).toContain('src="./src/main.tsx"');
    expect(content).toContain('id="root"');
  });

  it('generated HTML includes FOUC prevention script', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const plugin = pluginHtmlEntry({ entry: './src/main.tsx', title: 'Test' });

    const configFn = plugin.config as Function;
    configFn({}, { command: 'build' });

    const [, content] = vi.mocked(writeFileSync).mock.calls[0]!;
    expect(content).toContain("localStorage.getItem('theme')");
    expect(content).toContain("classList.add('dark')");
    expect(content).toContain('prefers-color-scheme: dark');
  });

  it('escapes HTML entities in title', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const plugin = pluginHtmlEntry({ entry: './src/main.tsx', title: '<script>alert("xss")</script>' });

    const configFn = plugin.config as Function;
    configFn({}, { command: 'build' });

    const [, content] = vi.mocked(writeFileSync).mock.calls[0]!;
    expect(content).not.toContain('<script>alert("xss")</script>');
    expect(content).toContain('&lt;script&gt;');
  });

  it('cleans up generated HTML on closeBundle', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const plugin = pluginHtmlEntry({ entry: './src/main.tsx', title: 'Test' });

    // Create the HTML
    const configFn = plugin.config as Function;
    configFn({}, { command: 'build' });
    expect(writeFileSync).toHaveBeenCalled();

    // Simulate closeBundle
    const closeBundleFn = plugin.closeBundle as Function;
    closeBundleFn();
    expect(unlinkSync).toHaveBeenCalled();
  });
});
