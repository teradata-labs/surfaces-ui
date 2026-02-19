/**
 * Filter Primitive
 *
 * Search input with optional debouncing for filtering data.
 * Atom-level component in atomic design hierarchy.
 *
 * Props limited to 6 for AI describability.
 */
import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../input';
import { Button } from '../button';
import { cn } from '../../lib/utils';
import type { FilterProps } from './types';

export function Filter({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 0,
  className,
  ariaLabel = 'Search filter',
}: FilterProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const timeoutRef = React.useRef<NodeJS.Timeout>();

  // Sync external value changes
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      if (debounceMs > 0) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => onChange(newValue), debounceMs);
      } else {
        onChange(newValue);
      }
    },
    [onChange, debounceMs]
  );

  const handleClear = React.useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className="absolute left-2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        role="searchbox"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="h-8 pl-8 pr-8 text-sm"
        aria-label={ariaLabel}
      />
      {localValue && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 h-6 w-6 p-0"
          aria-label="Clear filter"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default Filter;
