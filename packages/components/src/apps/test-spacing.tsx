import * as React from 'react';
import { createRoot } from 'react-dom/client';
import '../theme/tokens.css';

function SpacingTest() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold mb-4">Tailwind v4 Spacing Test</h1>

      <div className="space-y-4">
        <div className="p-4 bg-card border">
          <code>p-4</code> - Should have 1rem (16px) padding
        </div>

        <div className="p-8 bg-card border">
          <code>p-8</code> - Should have 2rem (32px) padding
        </div>

        <div className="m-4 p-4 bg-card border">
          <code>m-4 p-4</code> - Should have margin and padding
        </div>

        <div className="flex gap-4">
          <div className="p-4 bg-card border flex-1">Gap test 1</div>
          <div className="p-4 bg-card border flex-1">Gap test 2</div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-muted">
        <p>Open DevTools and inspect these elements.</p>
        <p>Check computed padding/margin values.</p>
        <p>The <code>--spacing</code> variable should be <code>0.25rem</code></p>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<SpacingTest />);
}
