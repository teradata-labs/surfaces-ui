/**
 * SelectableCard Types
 */

export interface SelectableCardProps {
  /** Item display name */
  name: string;
  /** Current status (running, idle, error, etc.) */
  status: string;
  /** Optional description */
  description?: string;
  /** Optional metadata items (e.g., "5 sessions", "100 messages") */
  metadata?: string[];
  /** Whether this item is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Optional CSS class */
  className?: string;
}
