/**
 * CatalogDemo - Interactive demo for catalog-to-component rendering
 *
 * Validates the end-to-end flow from JSON spec to rendered UI.
 * Provides selector for different component types and JSON preview.
 */
import React, { useState } from 'react';
import type { Spec } from '@json-render/core';

import { SurfacesRenderer } from './renderer';
import {
  chartSpec,
  dataTableSpec,
  tableWithFiltersSpec,
  sqlResultsSpec,
} from './demo-specs';

/* ── Types ─────────────────────────────────────────────────────────── */

interface SpecOption {
  label: string;
  spec: Spec;
}

const specOptions: Record<string, SpecOption> = {
  chart: { label: 'Chart (Primitive)', spec: chartSpec },
  dataTable: { label: 'DataTable (Primitive)', spec: dataTableSpec },
  tableWithFilters: {
    label: 'TableWithFilters (Molecule)',
    spec: tableWithFiltersSpec,
  },
  sqlResults: {
    label: 'SQLResultsDisplay (Organism)',
    spec: sqlResultsSpec,
  },
};

/* ── Component ─────────────────────────────────────────────────────── */

export function CatalogDemo() {
  const [selectedSpec, setSelectedSpec] = useState<string>('chart');
  const currentSpec = specOptions[selectedSpec];

  // Guard against undefined spec (should never happen with valid select options)
  if (!currentSpec) {
    return <div className="p-4 text-error">Invalid spec selected</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Component Selector */}
      <div className="flex items-center gap-4">
        <label htmlFor="spec-select" className="font-medium">
          Select Component:
        </label>
        <select
          id="spec-select"
          value={selectedSpec}
          onChange={(e) => setSelectedSpec(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          {Object.entries(specOptions).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Rendered Component */}
      <div className="border rounded-lg p-4 bg-background">
        <h3 className="font-medium mb-2">{currentSpec.label}</h3>
        <SurfacesRenderer
          spec={currentSpec.spec}
          initialState={currentSpec.spec.state || {}}
        />
      </div>

      {/* JSON Preview */}
      <details className="border rounded-lg p-4">
        <summary className="cursor-pointer font-medium">View JSON Spec</summary>
        <pre className="mt-2 p-4 bg-muted rounded text-sm overflow-auto">
          {JSON.stringify(currentSpec.spec, null, 2)}
        </pre>
      </details>
    </div>
  );
}
