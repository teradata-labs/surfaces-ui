/// <reference types="vite/client" />

// Declare SVG imports with ?url suffix
declare module '*.svg?url' {
  const content: string;
  export default content;
}

// Declare regular SVG imports
declare module '*.svg' {
  import * as React from 'react';
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}
