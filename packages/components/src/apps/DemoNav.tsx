/**
 * Global Demo Navigation Component
 *
 * Provides consistent navigation across all demo apps.
 * Shows list of available demos with current demo highlighted.
 */
import * as React from 'react';
import { Logo } from './Logo';
import { IconButton } from '../molecules/icon-button';
import { Button } from '../primitives/button';
import { Menu, X, ChevronRight } from 'lucide-react';

export interface DemoItem {
  id: string;
  title: string;
  description: string;
  path: string;
}

export const DEMO_ITEMS: DemoItem[] = [
  {
    id: 'docs',
    title: 'Documentation',
    description: 'Complete guide to all available demos',
    path: '/src/apps/demo-docs.html',
  },
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

export interface SubMenuItem {
  id: string;
  label: string;
  onClick?: () => void;
}

interface DemoNavProps {
  currentDemo: string;
  subMenuItems?: SubMenuItem[];
  activeSubItem?: string;
}

export function DemoNav({ currentDemo, subMenuItems, activeSubItem }: DemoNavProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSubMenuOpen, setIsSubMenuOpen] = React.useState(true);

  return (
    <>
      {/* Mobile Toggle Button */}
      <IconButton
        onClick={() => setIsOpen(!isOpen)}
        variant="filled"
        size="lg"
        className="lg:hidden fixed bottom-4 right-4 z-50 shadow-lg"
        aria-label="Toggle demo navigation"
      >
        <Menu className="h-6 w-6" />
      </IconButton>

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
              <Logo height={28} />
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground">v0.1.0</span>
                <h2 className="text-base font-bold">Demos</h2>
              </div>
            </div>
            <IconButton
              onClick={() => setIsOpen(false)}
              variant="standard"
              size="sm"
              className="lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </IconButton>
          </div>
        </div>

        {/* Demo List */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {DEMO_ITEMS.map((demo) => {
            const isActive = currentDemo === demo.id;
            const hasSubMenu = isActive && subMenuItems && subMenuItems.length > 0;

            return (
              <div key={demo.id}>
                {/* Parent Item */}
                <div
                  className={`
                    flex items-center mb-1 rounded-lg transition-colors
                    ${
                      isActive
                        ? 'bg-secondary-container text-secondary-container-foreground font-medium'
                        : 'text-muted-foreground hover:bg-secondary-container/10 hover:text-foreground'
                    }
                  `}
                >
                  <a
                    href={demo.path}
                    className="flex-1 px-3 py-2.5 text-sm"
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

                  {/* Collapse button - only show if has submenu */}
                  {hasSubMenu && (
                    <IconButton
                      onClick={() => setIsSubMenuOpen(!isSubMenuOpen)}
                      variant="standard"
                      size="sm"
                      className="px-2"
                      aria-label={isSubMenuOpen ? 'Collapse navigation' : 'Expand navigation'}
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${isSubMenuOpen ? 'rotate-90' : ''}`} />
                    </IconButton>
                  )}
                </div>

                {/* Submenu */}
                {hasSubMenu && isSubMenuOpen && (
                  <div className="ml-4 mb-2 space-y-0.5">
                    {subMenuItems.map((item) => (
                      <Button
                        key={item.id}
                        onClick={item.onClick}
                        variant={activeSubItem === item.id ? 'tonal' : 'text'}
                        size="sm"
                        className="w-full justify-start text-xs h-auto py-1.5"
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
