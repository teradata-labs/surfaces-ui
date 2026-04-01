/**
 * SelectableList Molecule
 *
 * List of selectable items with search/filter and virtual scroll.
 * Based on canvas-ai-compute-studio AgentsPanel pattern.
 */
import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';
import { SearchInput } from '../../primitives/search-input';
import { SelectableCard } from '../../primitives/selectable-card';
import type { SelectableListProps } from './types';

export function SelectableList({
  items,
  selectedId,
  onItemClick,
  showSearch = true,
  searchPlaceholder = 'Search...',
  height,
  itemLabel = 'item',
  itemLabelPlural = 'items',
  className,
}: SelectableListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Filter items based on search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(item => {
      const name = item.name.toLowerCase();
      const description = (item.description || '').toLowerCase();
      const id = item.id.toLowerCase();
      return name.includes(query) || description.includes(query) || id.includes(query);
    });
  }, [items, searchQuery]);

  // Virtual scrolling
  const virtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  return (
    <div className={cn('flex flex-col', height === undefined && 'flex-1 min-h-0', className)}>
      {/* Header with count and search */}
      {showSearch && (
        <div className="border-b border-border p-4 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {searchQuery
                ? `${filteredItems.length} of ${items.length}`
                : `${items.length} ${items.length === 1 ? itemLabel : itemLabelPlural}`}
            </span>
          </div>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={searchPlaceholder}
          />
        </div>
      )}

      {/* Items List */}
      {items.length === 0 ? (
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground">No {itemLabelPlural} available</p>
        </div>
      ) : filteredItems.length === 0 && searchQuery ? (
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No {itemLabelPlural} match "{searchQuery}"
          </p>
        </div>
      ) : (
        <div
          ref={parentRef}
          className="flex-1 overflow-auto px-3"
          style={height !== undefined ? { height: `${height}px` } : undefined}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
              paddingTop: '8px',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = filteredItems[virtualItem.index];
              if (!item) return null;

              return (
                <div
                  key={item.id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full pb-2"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <SelectableCard
                    name={item.name}
                    status={item.status}
                    description={item.description}
                    metadata={item.metadata}
                    isSelected={selectedId === item.id}
                    onClick={() => onItemClick?.(item.id)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SelectableList;
