/**
 * Catalog Demo App
 *
 * Standalone HTML app for viewing catalog component examples
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CatalogDemo } from '../catalog/demo';
import { ThemeProvider } from '../theme/ThemeProvider';
import '../theme/tokens.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider theme="system">
      <CatalogDemo />
    </ThemeProvider>
  </React.StrictMode>
);
