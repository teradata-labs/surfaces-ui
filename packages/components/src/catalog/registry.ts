/**
 * json-render Component Registry
 *
 * Maps catalog definitions to React component implementations.
 * Components are registered as they're extracted from SQLResultsDisplay.
 */
import { defineRegistry } from '@json-render/react';
import { catalog } from './schema';

// Placeholder components - will be replaced with real implementations
const PlaceholderChart = () => null;
const PlaceholderDataTable = () => null;
const PlaceholderFilter = () => null;
const PlaceholderDensityToggle = () => null;
const PlaceholderViewModeToggle = () => null;

export const { registry } = defineRegistry(catalog, {
  components: {
    Chart: PlaceholderChart,
    DataTable: PlaceholderDataTable,
    Filter: PlaceholderFilter,
    DensityToggle: PlaceholderDensityToggle,
    ViewModeToggle: PlaceholderViewModeToggle,
  },
});
