/**
 * NodePalette — Collapsible sidebar of node templates
 *
 * Generic palette for selecting and adding nodes to a flow canvas.
 * Categories are collapsible; items are clickable.
 *
 * Level: Molecule (~120 lines)
 */

import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ScrollArea } from '../../primitives/scroll-area';
import type { PaletteCategory, PaletteItem } from './types';

export interface NodePaletteProps {
  /** Palette header title */
  title?: string;
  /** Palette header description */
  description?: string;
  /** Categories with items */
  categories: PaletteCategory[];
  /** Callback when an item is clicked */
  onItemClick?: (item: PaletteItem) => void;
  /** Footer slot (e.g., action buttons) */
  footer?: React.ReactNode;
  className?: string;
}

const variantBgClasses: Record<string, string> = {
  default: 'bg-surface-container/50 border-su-outline-variant',
  info: 'bg-primary/5 border-primary/20',
  positive: 'bg-positive/5 border-positive/20',
  warning: 'bg-warning/5 border-warning/20',
  error: 'bg-error/5 border-error/20',
  purple: 'bg-tertiary/5 border-tertiary/20',
};

const NodePalette = React.forwardRef<HTMLDivElement, NodePaletteProps>(
  ({ title, description, categories, onItemClick, footer, className }, ref) => {
    const [expanded, setExpanded] = React.useState<string[]>(
      categories.filter((c) => c.defaultExpanded).map((c) => c.id),
    );

    const toggle = (id: string) => {
      setExpanded((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    };

    return (
      <div
        ref={ref}
        className={cn(
          'w-72 bg-surface-container-lowest flex flex-col',
          className,
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="p-4">
            {title && (
              <h2 className="text-lg font-semibold text-foreground mb-1">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}

        {/* Categories */}
        <ScrollArea className="flex-1">
          <div className="p-4 pt-0 space-y-3">
            {categories.map((category) => {
              const isOpen = expanded.includes(category.id);

              return (
                <div key={category.id}>
                  <button
                    onClick={() => toggle(category.id)}
                    className="flex items-center justify-between w-full p-2 text-sm font-medium text-foreground hover:bg-surface-container/50 rounded-md transition-colors"
                  >
                    <span>{category.label}</span>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="ml-2 mt-2 space-y-2">
                      {category.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onItemClick?.(item)}
                          className={cn(
                            'w-full p-3 text-left border rounded-lg hover:brightness-95 dark:hover:brightness-110 transition-all',
                            variantBgClasses[item.variant || 'default'],
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {item.icon && (
                              <span className="mt-0.5 shrink-0">{item.icon}</span>
                            )}
                            <div>
                              <div className="font-medium text-sm text-foreground">
                                {item.label}
                              </div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-su-outline-variant bg-surface-container/30">
            {footer}
          </div>
        )}
      </div>
    );
  },
);
NodePalette.displayName = 'NodePalette';

export { NodePalette };
