/**
 * useVirtualTable — Shared virtual scrolling hook for table components.
 *
 * Wraps @tanstack/react-virtual with:
 *   - Dynamic overscan based on dataset size
 *   - Auto-disabling for small datasets (≤100 rows)
 */

import { useVirtualizer } from '@tanstack/react-virtual';

/** Dynamic overscan: larger datasets get more overscan for smoother scrolling. */
function getOverscan(count: number): number {
  if (count < 1_000) return 5;
  if (count < 50_000) return 10;
  return 15;
}

export interface UseVirtualTableOptions {
  /** Total row count */
  count: number;
  /** Row height in px */
  rowHeight: number;
  /** Scroll container ref */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Enable virtual scrolling (default: true, auto-false for ≤100 rows) */
  enabled?: boolean;
}

export interface UseVirtualTableResult {
  /** Virtual items to render (only defined when `isVirtual` is true) */
  virtualItems: ReturnType<ReturnType<typeof useVirtualizer>['getVirtualItems']>;
  /** Total virtual height in px */
  totalSize: number;
  /** Whether virtual scrolling is active */
  isVirtual: boolean;
}

export function useVirtualTable({
  count,
  rowHeight,
  containerRef,
  enabled = true,
}: UseVirtualTableOptions): UseVirtualTableResult {
  const isVirtual = enabled && count > 100;

  const virtualizer = useVirtualizer({
    count: isVirtual ? count : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: getOverscan(count),
    enabled: isVirtual,
  });

  return {
    virtualItems: isVirtual ? virtualizer.getVirtualItems() : [],
    totalSize: isVirtual ? virtualizer.getTotalSize() : 0,
    isVirtual,
  };
}
