/**
 * NodePalette types
 */

import type { FlowNodeVariant } from '../../primitives/flow-node';

export interface PaletteItem {
  /** Unique identifier for this item */
  id: string;
  /** Display label */
  label: string;
  /** Supporting description */
  description?: string;
  /** Icon element */
  icon?: React.ReactNode;
  /** Color variant for the generated node */
  variant?: FlowNodeVariant;
}

export interface PaletteCategory {
  /** Category identifier */
  id: string;
  /** Category display label */
  label: string;
  /** Items in this category */
  items: PaletteItem[];
  /** Whether this category starts expanded */
  defaultExpanded?: boolean;
}
