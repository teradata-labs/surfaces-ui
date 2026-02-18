/**
 * DensityToggle Primitive Types
 */

/** Density options */
export type Density = 'compact' | 'comfortable' | 'spacious';

/** Density option with label and description */
export interface DensityOption {
  value: Density;
  label: string;
  description?: string;
}

/** Default density options */
export const DENSITY_OPTIONS: DensityOption[] = [
  { value: 'compact', label: 'Compact', description: 'Dense rows, more data visible' },
  { value: 'comfortable', label: 'Comfortable', description: 'Balanced spacing' },
  { value: 'spacious', label: 'Spacious', description: 'Relaxed rows, easier to read' },
];

/** DensityToggle props - 5 props for AI describability */
export interface DensityToggleProps {
  /** Current density value */
  value: Density;
  /** Callback when density changes */
  onChange: (density: Density) => void;
  /** Available options (defaults to all three) */
  options?: DensityOption[];
  /** Show labels or icons only */
  showLabels?: boolean;
  /** Additional CSS class */
  className?: string;
}
