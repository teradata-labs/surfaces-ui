/**
 * Catalog Demo App
 *
 * Standalone HTML app for viewing catalog component examples
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CatalogDemo } from '../catalog/demo';
import { ThemeWrapper } from './ThemeWrapper';
import '../theme/tokens.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <React.StrictMode>
    <ThemeWrapper
      title="Catalog Demo"
      description="Component catalog examples"
    >
      <CatalogDemo />
    </ThemeWrapper>
  </React.StrictMode>
);
