/**
 * SurfacesUI Logo Component
 *
 * Uses transparent SVG logos for light and dark themes.
 */

import * as React from 'react';
// Import the SVG files as URLs (Vite will handle this)
import logoLight from '../../../../assets/SurfacesUI-Light-Transparent.svg?url';
import logoDark from '../../../../assets/SurfacesUI-Dark-Transparent.svg?url';

interface LogoProps {
  className?: string;
  height?: number;
}

export function Logo({ className = '', height = 32 }: LogoProps) {
  return (
    <div className={className}>
      {/* Dark mode logo (light text) */}
      <img
        src={logoDark}
        alt="SurfacesUI"
        height={height}
        className="hidden dark:block"
        style={{ height: `${height}px`, width: 'auto' }}
      />
      {/* Light mode logo (dark text) */}
      <img
        src={logoLight}
        alt="SurfacesUI"
        height={height}
        className="block dark:hidden"
        style={{ height: `${height}px`, width: 'auto' }}
      />
    </div>
  );
}
