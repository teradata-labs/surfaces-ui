/**
 * SQLResultsTable - Table display for SQL results with sorting and filtering.
 */

import * as React from 'react';
import { ChevronUp, ChevronDown, Search, Download, Copy } from 'lucide-react';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Badge } from '../../primitives/badge';
import { ScrollArea } from '../../primitives/scroll-area';
import { cn } from '../../lib/utils';
import type { SQLResultsTableProps } from './types';

const LIMIT_OPTIONS = [50, 100, 500, 1000];

export function SQLResultsTable({
  columns,
  data,
  totalRows,
  sortBy,
  sortOrder = 'asc',
  onSortChange,
  searchTerm = '',
  onSearchChange,
  limit = 100,
  onLimitChange,
}: SQLResultsTableProps) {
  const filteredData = React.useMemo(() => {
    if (!searchTerm) return data;
    const lowerSearch = searchTerm.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((val) =>
        String(val ?? '').toLowerCase().includes(lowerSearch)
      )
    );
  }, [data, searchTerm]);

  const sortedData = React.useMemo(() => {
    if (!sortBy) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
      if (bVal == null) return sortOrder === 'asc' ? -1 : 1;
      const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal));
      const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal));
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [filteredData, sortBy, sortOrder]);

  const displayData = React.useMemo(() => sortedData.slice(0, limit), [sortedData, limit]);

  const handleCopyJson = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [data]);

  const handleExportCsv = React.useCallback(() => {
    const headers = columns.join(',');
    const rows = data.map((row) =>
      columns.map((col) => {
        const val = row[col];
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, data]);

  if (columns.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No data to display</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{totalRows ?? data.length} rows</Badge>
          {filteredData.length !== data.length && (
            <Badge variant="secondary" className="text-xs">Filtered: {filteredData.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="h-7 w-32 pl-7 text-xs"
              aria-label="Search results"
            />
          </div>
          <select
            value={limit}
            onChange={(e) => onLimitChange?.(Number(e.target.value))}
            className="h-7 px-2 text-xs border border-border rounded bg-background"
            aria-label="Rows per page"
          >
            {LIMIT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>Show {opt}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleCopyJson} className="h-7 px-2" aria-label="Copy as JSON">
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-7 px-2" aria-label="Export as CSV">
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <ScrollArea className="border border-border rounded-lg">
        <div className="max-h-[400px]">
          <table className="w-full text-xs" role="grid">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className={cn(
                      'px-3 py-2 text-left font-medium text-muted-foreground border-b border-border',
                      onSortChange && 'cursor-pointer hover:bg-muted/80'
                    )}
                    onClick={() => onSortChange?.(col)}
                    role="columnheader"
                    aria-sort={sortBy === col ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {sortBy === col && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, idx) => (
                <tr key={idx} className="border-b border-border last:border-b-0 hover:bg-muted/30">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 text-foreground max-w-xs truncate" title={String(row[col] ?? '')}>
                      {row[col] != null ? String(row[col]) : <span className="text-muted-foreground italic">null</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      {sortedData.length > limit && (
        <div className="text-xs text-muted-foreground">Showing {limit} of {sortedData.length} rows</div>
      )}
    </div>
  );
}
