/**
 * Global Demo Navigation Component
 *
 * Provides consistent navigation across all demo apps.
 * Shows list of available demos with current demo highlighted.
 */
import * as React from 'react';

export interface DemoItem {
  id: string;
  title: string;
  description: string;
  path: string;
}

export const DEMO_ITEMS: DemoItem[] = [
  {
    id: 'spacing',
    title: 'Spacing Utilities',
    description: 'Tailwind v4 padding, margin, gap, and space utilities',
    path: '/src/apps/demo-spacing.html',
  },
  {
    id: 'catalog',
    title: 'Catalog Components',
    description: 'Component catalog examples',
    path: '/src/apps/catalog-demo.html',
  },
  {
    id: 'showcase',
    title: 'Component Showcase',
    description: '8 components powered by json-render',
    path: '/src/apps/showcase.html',
  },
  {
    id: 'kitchen-sink',
    title: 'Kitchen Sink',
    description: 'All SurfacesUI primitives and molecules',
    path: '/src/apps/kitchen-sink.html',
  },
  {
    id: 'loom',
    title: 'Loom Integration',
    description: 'Bridge integration with Loom server',
    path: '/src/apps/demo-loom.html',
  },
];

interface DemoNavProps {
  currentDemo: string;
}

export function DemoNav({ currentDemo }: DemoNavProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Toggle demo navigation"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Navigation Panel */}
      <nav
        className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 bg-surface-container-lowest border-r border-border
          flex flex-col z-40 transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="border-b border-border px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
                SurfacesUI
              </p>
              <h2 className="mt-0.5 text-base font-bold">Demos</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden text-muted-foreground hover:text-foreground"
              aria-label="Close navigation"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Demo List */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {DEMO_ITEMS.map((demo) => {
            const isActive = currentDemo === demo.id;
            return (
              <a
                key={demo.id}
                href={demo.path}
                className={`
                  block mb-1 rounded-lg px-3 py-2.5 text-sm transition-colors
                  ${
                    isActive
                      ? 'bg-secondary-container text-secondary-container-foreground font-medium'
                      : 'text-muted-foreground hover:bg-secondary-container/10 hover:text-foreground'
                  }
                `}
              >
                <div className="font-medium">{demo.title}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    isActive
                      ? 'text-secondary-container-foreground/70'
                      : 'text-muted-foreground'
                  }`}
                >
                  {demo.description}
                </div>
              </a>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            SurfacesUI Demo Gallery
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Component library showcase
          </p>
        </div>
      </nav>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
