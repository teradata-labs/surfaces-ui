/**
 * TableWithFilters Molecule
 *
 * Composes DataTable + Filter + DensityToggle into a cohesive UI.
 * Molecule-level component (50-150 lines) in atomic design hierarchy.
 */
import * as React from 'react';
import { DataTable } from '../../primitives/data-table';
import { Filter } from '../../primitives/filter';
import { DensityToggle } from '../../primitives/density-toggle';
import type { Density } from '../../primitives/data-table/types';
import { cn } from '../../lib/utils';
import type { TableWithFiltersProps } from './types';

export function TableWithFilters({
  data,
  columns,
  height = 400,
  initialDensity = 'comfortable',
  showFilter = true,
  showDensityToggle = true,
  virtualScrolling = true,
  onRowClick,
  className,
}: TableWithFiltersProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [density, setDensity] = React.useState<Density>(initialDensity);

  // Filter data based on search term
  const filteredData = React.useMemo(() => {
    if (!searchTerm) return data;

    const lowerSearch = searchTerm.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((val) =>
        String(val).toLowerCase().includes(lowerSearch)
      )
    );
  }, [data, searchTerm]);

  // Get columns from data if not provided
  const derivedColumns = React.useMemo(() => {
    if (columns?.length) return columns;
    if (!data.length) return [];
    return Object.keys(data[0] || {});
  }, [columns, data]);

  const hasControls = showFilter || showDensityToggle;

  return (
    <div className={cn('space-y-2', className)}>
      {/* Controls Row */}
      {hasControls && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {showFilter && (
              <Filter
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search table..."
                debounceMs={150}
                className="w-48"
              />
            )}
            {searchTerm && filteredData.length !== data.length && (
              <span className="text-xs text-muted-foreground">
                {filteredData.length} of {data.length} rows
              </span>
            )}
          </div>
          {showDensityToggle && (
            <DensityToggle
              value={density}
              onChange={setDensity}
            />
          )}
        </div>
      )}

      {/* Data Table */}
      <DataTable
        data={filteredData}
        columns={derivedColumns}
        height={height}
        density={density}
        virtualScrolling={virtualScrolling}
        onRowClick={onRowClick}
      />

      {/* Row count footer */}
      <div className="text-xs text-muted-foreground">
        {filteredData.length === data.length
          ? `${data.length} rows`
          : `${filteredData.length} of ${data.length} rows (filtered)`}
      </div>
    </div>
  );
}

export default TableWithFilters;
