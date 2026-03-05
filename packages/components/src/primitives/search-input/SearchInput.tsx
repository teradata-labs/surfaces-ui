/**
 * SearchInput Primitive
 *
 * Search input with icon. Matches canvas-ai-compute-studio pattern.
 */
import * as React from 'react';
import { cn } from '../../lib/utils';
import type { SearchInputProps } from './types';

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: SearchInputProps) {
  return (
    <div className={cn('flex items-center gap-2 border border-border rounded-lg px-2 py-1.5', className)}>
      <svg
        className="w-4 h-4 text-muted-foreground flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 outline-none text-xs text-foreground bg-transparent min-w-0"
      />
    </div>
  );
}

export default SearchInput;
