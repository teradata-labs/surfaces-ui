/**
 * SQLToolbar - Toolbar with execute button, status badges, and actions.
 */

import * as React from 'react';
import { Play, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../../primitives/button';
import { Badge } from '../../primitives/badge';
import type { SQLToolbarProps } from './types';

export function SQLToolbar({
  isExecuting,
  hasResult,
  hasError,
  onExecute,
  onClear,
  title = 'SQL Editor',
}: SQLToolbarProps) {
  const getStatusBadge = () => {
    if (isExecuting) {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
          Executing...
        </Badge>
      );
    }
    if (hasError) {
      return <Badge variant="destructive">Error</Badge>;
    }
    if (hasResult) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          Complete
        </Badge>
      );
    }
    return <Badge variant="outline">Ready</Badge>;
  };

  return (
    <div className="flex items-center justify-between p-3 border-b border-border">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          SQL
        </Badge>
        {getStatusBadge()}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExecute}
          disabled={isExecuting}
          aria-label="Execute SQL"
        >
          {isExecuting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>

        {(hasResult || hasError) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            aria-label="Clear results"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
