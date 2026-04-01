import * as React from 'react';
import { cn } from '../../lib/utils';

/* ── Types ────────────────────────────────────────────────────────────── */

export interface TreeNode {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children?: TreeNode[];
}

export interface TreeListProps {
  /** Tree data */
  nodes: TreeNode[];
  /** Currently selected node id */
  selectedId?: string;
  /** Callback when a node is selected */
  onSelect?: (id: string) => void;
  /** Custom set of expanded node ids (controlled) */
  expandedIds?: Set<string>;
  /** Callback when a node is toggled */
  onToggle?: (id: string) => void;
  className?: string;
}

export interface TreeListItemProps {
  node: TreeNode;
  depth: number;
  selectedId?: string;
  expandedIds: Set<string>;
  onSelect?: (id: string) => void;
  onToggle: (id: string) => void;
}

/* ── Chevron icon ─────────────────────────────────────────────────────── */

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={cn(
      'w-4 h-4 text-on-surface-variant transition-transform duration-150',
      expanded && 'rotate-90'
    )}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ── TreeListItem ─────────────────────────────────────────────────────── */

const TreeListItem: React.FC<TreeListItemProps> = ({
  node,
  depth,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  const handleClick = () => {
    if (hasChildren) {
      onToggle(node.id);
    }
    onSelect?.(node.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
    if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      e.preventDefault();
      onToggle(node.id);
    }
    if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
      e.preventDefault();
      onToggle(node.id);
    }
  };

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={isSelected}>
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md transition-colors',
          'hover:bg-surface-container',
          isSelected && 'bg-secondary-container text-secondary-container-foreground'
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
      >
        {/* Expand/collapse chevron or spacer */}
        <span className="w-4 shrink-0 flex items-center justify-center">
          {hasChildren && <ChevronIcon expanded={isExpanded} />}
        </span>

        {/* Optional icon */}
        {node.icon && (
          <span className="w-4 h-4 shrink-0 text-on-surface-variant flex items-center">
            {node.icon}
          </span>
        )}

        {/* Label */}
        <span className="text-sm truncate">{node.label}</span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <ul role="group">
          {node.children!.map(child => (
            <TreeListItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
};
TreeListItem.displayName = 'TreeListItem';

/* ── TreeList ─────────────────────────────────────────────────────────── */

const TreeList: React.FC<TreeListProps> = ({
  nodes,
  selectedId,
  onSelect,
  expandedIds: controlledExpandedIds,
  onToggle: controlledOnToggle,
  className,
}) => {
  // Internal expanded state for uncontrolled usage
  const [internalExpanded, setInternalExpanded] = React.useState<Set<string>>(new Set());

  const expandedIds = controlledExpandedIds ?? internalExpanded;
  const handleToggle = (id: string) => {
    if (controlledOnToggle) {
      controlledOnToggle(id);
    } else {
      setInternalExpanded(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
  };

  return (
    <ul role="tree" className={cn('flex flex-col', className)}>
      {nodes.map(node => (
        <TreeListItem
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          expandedIds={expandedIds}
          onSelect={onSelect}
          onToggle={handleToggle}
        />
      ))}
    </ul>
  );
};
TreeList.displayName = 'TreeList';

export { TreeList, TreeListItem };
