/**
 * SQLResultsDisplay Utility Functions
 *
 * Extracted from SQLResultsDisplay for reusability and size reduction.
 */
import { Copy, Download, ExternalLink } from 'lucide-react';
import type { SQLResultsAction } from './types';

/**
 * Create default actions for the results toolbar
 */
export function createDefaultActions(options: {
  projectId?: string;
  teradataBaseUrl?: string;
}): SQLResultsAction[] {
  const actions: SQLResultsAction[] = [
    {
      id: 'copy',
      label: 'Copy',
      icon: Copy,
      tooltip: 'Copy as JSON',
      onClick: async ({ data }) => {
        try {
          await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        } catch {
          // Fallback for older browsers
          const textarea = document.createElement('textarea');
          textarea.value = JSON.stringify(data, null, 2);
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
      },
    },
    {
      id: 'export-csv',
      label: 'Export',
      icon: Download,
      tooltip: 'Export to CSV',
      onClick: ({ columns, data }) => {
        const headers = columns.join(',');
        const rows = data
          .map((row) =>
            columns
              .map((col) => {
                const value = row[col];
                const str = String(value ?? '');
                if (str.includes(',') || str.includes('"')) {
                  return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
              })
              .join(',')
          )
          .join('\n');
        const csv = `${headers}\n${rows}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'query_results.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
    },
  ];

  // Add "Open in Teradata" action
  const baseUrl = options.teradataBaseUrl || 'http://localhost:8080';
  actions.push({
    id: 'open-in-teradata',
    label: options.projectId ? 'Open in Teradata' : 'New Project',
    icon: ExternalLink,
    tooltip: options.projectId
      ? 'Open this project in Teradata Studio'
      : 'Open in Teradata Studio as a new project',
    onClick: () => {
      const url = options.projectId
        ? `${baseUrl}/project/${options.projectId}`
        : `${baseUrl}/project/new`;
      window.open(url, '_blank');
    },
  });

  return actions;
}

/**
 * Build URL for "Open in Teradata" with SQL context
 */
export function buildTeradataUrl(
  sql: string | undefined,
  projectId: string | undefined,
  teradataBaseUrl: string | undefined
): string {
  const baseUrl = teradataBaseUrl || 'http://localhost:8080';
  const basePath = projectId
    ? `${baseUrl}/project/${projectId}`
    : `${baseUrl}/project/new`;

  if (sql) {
    const encodedSql = encodeURIComponent(sql.slice(0, 1500));
    return `${basePath}?sql=${encodedSql}`;
  }
  return basePath;
}
