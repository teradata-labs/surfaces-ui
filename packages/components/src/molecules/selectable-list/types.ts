/**
 * SelectableList Types
 */

export interface SelectableItem {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Status (running, stopped, error, etc.) */
  status: string;
  /** Optional description */
  description?: string;
  /** Optional metadata for display (e.g., "5 sessions", "100 messages") */
  metadata?: string[];
}

export interface SelectableListProps {
  /** List of items to display */
  items: SelectableItem[];
  /** Currently selected item ID */
  selectedId?: string;
  /** Click handler for item selection */
  onItemClick?: (itemId: string) => void;
  /** Enable search/filter (default: true) */
  showSearch?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Fixed height for scroll area (optional - if not provided, fills container) */
  height?: number;
  /** Singular label for items (e.g., "agent", "server") */
  itemLabel?: string;
  /** Plural label for items (e.g., "agents", "servers") */
  itemLabelPlural?: string;
  /** Optional CSS class */
  className?: string;
}
