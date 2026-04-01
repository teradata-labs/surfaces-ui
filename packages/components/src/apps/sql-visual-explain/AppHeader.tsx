/**
 * AppHeader - SQL Visual EXPLAIN
 *
 * Reusable header component with Logo, Layout menu, and Theme toggle.
 * For ReactFlow canvas view: only shows "Show SQL Editor" toggle.
 */

import * as React from 'react';
import { Logo } from '../Logo';
import { ThemeToggle } from '../ThemeToggle';
import { Menu } from '../../molecules/menu/Menu';
import { Settings, Check } from 'lucide-react';

interface AppHeaderProps {
  onToggleSQLEditor: () => void;
  showSQLEditor: boolean;
}

export function AppHeader({
  onToggleSQLEditor,
  showSQLEditor
}: AppHeaderProps) {
  const menuItems = [
    {
      label: 'Show SQL Editor',
      icon: showSQLEditor ? <Check className="h-4 w-4" /> : undefined,
      onClick: onToggleSQLEditor,
    },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          <Logo height={32} />
          <div className="text-sm text-muted-foreground">SQL Visual EXPLAIN</div>
        </div>

        {/* Right: Layout Menu + Theme Toggle */}
        <div className="flex items-center gap-2">
          <Menu
            trigger={
              <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                <Settings className="h-4 w-4" />
                Layout
              </button>
            }
            items={menuItems}
            align="end"
          />

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
