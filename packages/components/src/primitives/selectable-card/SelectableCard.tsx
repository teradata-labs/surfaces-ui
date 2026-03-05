/**
 * SelectableCard Primitive
 *
 * Displays selectable item: name, status, description, metadata.
 * Based on canvas-ai-compute-studio AgentsPanel pattern.
 */
import * as React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../badge';
import type { SelectableCardProps } from './types';

// Status badge styling (from loomAgentsService)
const getStatusBadge = (status: string): { bg: string; text: string } => {
  switch (status.toLowerCase()) {
    case 'running':
      return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' };
    case 'stopped':
      return { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300' };
    case 'error':
      return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' };
    case 'initializing':
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' };
    default:
      return { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300' };
  }
};

export function SelectableCard({
  name,
  status,
  description,
  metadata,
  isSelected = false,
  onClick,
  className,
}: SelectableCardProps) {
  const statusBadge = getStatusBadge(status);

  return (
    <div
      className={
        isSelected
          ? cn('border border-border rounded-lg p-3 cursor-pointer transition-colors bg-primary/20 border-l-[3px] !border-l-primary font-medium', className)
          : cn('border border-border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50', className)
      }
      onClick={onClick}
    >
      {/* Item header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isSelected ? (
            <svg
              className="h-4 w-4 text-primary flex-shrink-0"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-muted-foreground flex-shrink-0"
              fill="none"
              strokeWidth="2"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" />
            </svg>
          )}
          <span className="text-sm font-medium truncate">{name}</span>
        </div>
        <Badge
          variant="secondary"
          className={`text-xs ${statusBadge.bg} ${statusBadge.text}`}
        >
          {status}
        </Badge>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {description}
        </p>
      )}

      {/* Metadata */}
      {metadata && metadata.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {metadata.map((item, idx) => (
            <span key={idx}>{item}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default SelectableCard;
