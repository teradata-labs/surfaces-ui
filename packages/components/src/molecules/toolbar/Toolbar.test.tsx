import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toolbar, ToolbarSeparator } from './Toolbar';

describe('Toolbar', () => {
  it('renders children', () => {
    render(<Toolbar><button>Bold</button><button>Italic</button></Toolbar>);
    expect(screen.getByText('Bold')).toBeDefined();
    expect(screen.getByText('Italic')).toBeDefined();
  });

  it('has role="toolbar"', () => {
    render(<Toolbar><button>Action</button></Toolbar>);
    expect(screen.getByRole('toolbar')).toBeDefined();
  });

  it('defaults to horizontal orientation', () => {
    render(<Toolbar><button>A</button></Toolbar>);
    expect(screen.getByRole('toolbar').getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('supports vertical orientation', () => {
    render(<Toolbar orientation="vertical"><button>A</button></Toolbar>);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.getAttribute('aria-orientation')).toBe('vertical');
    expect(toolbar.className).toContain('flex-col');
  });

  it('accepts custom className', () => {
    render(<Toolbar className="my-toolbar"><button>A</button></Toolbar>);
    expect(screen.getByRole('toolbar').className).toContain('my-toolbar');
  });
});

describe('ToolbarSeparator', () => {
  it('renders with separator role', () => {
    render(<Toolbar><button>A</button><ToolbarSeparator /><button>B</button></Toolbar>);
    expect(screen.getByRole('separator')).toBeDefined();
  });

  it('accepts custom className', () => {
    render(<Toolbar><ToolbarSeparator className="my-sep" /></Toolbar>);
    expect(screen.getByRole('separator').className).toContain('my-sep');
  });
});
