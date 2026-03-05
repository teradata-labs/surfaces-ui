/**
 * SearchInput Types
 */

export interface SearchInputProps {
  /** Current search value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Optional CSS class */
  className?: string;
}
