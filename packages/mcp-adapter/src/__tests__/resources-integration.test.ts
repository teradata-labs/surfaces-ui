import { describe, it, expect } from 'vitest';
import { getSurfacesResources, readSurfacesResource } from '../resources.js';

describe('Resources Integration', () => {
  it('should list all resource types (apps, stylesheets, docs)', () => {
    const resources = getSurfacesResources();

    // Check that we have resources of each type
    const apps = resources.filter(r => r.mimeType === 'text/html;profile=mcp-app');
    const css = resources.filter(r => r.mimeType === 'text/css');
    const docs = resources.filter(r => r.mimeType === 'text/markdown');

    expect(apps.length).toBeGreaterThan(0);
    expect(css.length).toBe(2); // tokens.css and components.css
    expect(docs.length).toBe(1); // react-components.md

    // Check CSS resources exist
    const tokensCss = resources.find(r => r.uri === 'ui://styles/tokens');
    expect(tokensCss).toBeDefined();
    expect(tokensCss?.name).toBe('Design Tokens CSS');

    const componentsCss = resources.find(r => r.uri === 'ui://styles/components');
    expect(componentsCss).toBeDefined();
    expect(componentsCss?.name).toBe('Component Styles CSS');

    // Check docs resource exists
    const docs1 = resources.find(r => r.uri === 'ui://docs/react-components');
    expect(docs1).toBeDefined();
    expect(docs1?.name).toBe('React Components Guide');
  });

  it('should read CSS resources', () => {
    // Read tokens.css
    const tokensContent = readSurfacesResource('ui://styles/tokens');
    expect(tokensContent.mimeType).toBe('text/css');
    expect(tokensContent.text).toContain('--background');
    expect(tokensContent.text).toContain('--foreground');
    expect(tokensContent.text).toContain(':root');

    // Read components.css
    const componentsContent = readSurfacesResource('ui://styles/components');
    expect(componentsContent.mimeType).toBe('text/css');
    expect(componentsContent.text.length).toBeGreaterThan(1000);
  });

  it('should read documentation resources', () => {
    const docsContent = readSurfacesResource('ui://docs/react-components');
    expect(docsContent.mimeType).toBe('text/markdown');
    expect(docsContent.text).toContain('# SurfacesUI React Components Guide');
    expect(docsContent.text).toContain('Button');
    expect(docsContent.text).toContain('DataTable');
    expect(docsContent.text).toContain('MCP Bridge');
  });

  it('should handle query parameters in URIs', () => {
    // Query parameters should be stripped for resource lookup
    const content = readSurfacesResource('ui://styles/tokens?theme=dark');
    expect(content.uri).toBe('ui://styles/tokens?theme=dark');
    expect(content.text).toContain('--background');
  });

  it('should throw for unknown resource URIs', () => {
    expect(() => {
      readSurfacesResource('ui://unknown-resource');
    }).toThrow('Unknown surfaces-ui resource: "unknown-resource"');
  });
});
