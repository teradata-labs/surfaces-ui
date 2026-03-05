import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeWrapper } from './ThemeWrapper';
import '../theme/tokens.css';

function SpacingDemo() {
  return (
    <ThemeWrapper
      title="Tailwind v4 Spacing Utilities"
      description="Comprehensive showcase of padding, margin, gap, and space utilities"
      showDemoNav={true}
      currentDemo="spacing"
    >
      <div className="space-y-12">
        {/* Padding Examples */}
        <section>
          <h2 className="text-xl font-semibold mb-6 text-primary">Padding Utilities</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">All Sides (p-*)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 2, 4, 6, 8, 12].map((size) => (
                  <div key={size} className="border border-border rounded">
                    <div className={`bg-primary/10 p-${size}`}>
                      <div className="bg-card border border-dashed border-primary p-2 text-center text-xs">
                        p-{size}
                        <div className="text-muted-foreground">
                          {size * 0.25}rem
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Horizontal (px-*)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[2, 4, 8].map((size) => (
                  <div key={size} className="border border-border rounded">
                    <div className={`bg-success/10 px-${size} py-2`}>
                      <div className="bg-card border border-dashed border-success p-2 text-center text-xs">
                        px-{size}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Vertical (py-*)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[2, 4, 8].map((size) => (
                  <div key={size} className="border border-border rounded">
                    <div className={`bg-warning/10 py-${size} px-2`}>
                      <div className="bg-card border border-dashed border-warning p-2 text-center text-xs">
                        py-{size}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Individual Sides</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { class: 'pt-8', label: 'pt-8 (top)' },
                  { class: 'pr-8', label: 'pr-8 (right)' },
                  { class: 'pb-8', label: 'pb-8 (bottom)' },
                  { class: 'pl-8', label: 'pl-8 (left)' },
                ].map(({ class: className, label }) => (
                  <div key={className} className="border border-border rounded">
                    <div className={`bg-accent/10 ${className} p-2`}>
                      <div className="bg-card border border-dashed border-accent p-2 text-center text-xs">
                        {label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Margin Examples */}
        <section>
          <h2 className="text-xl font-semibold mb-6 text-primary">Margin Utilities</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">All Sides (m-*)</h3>
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex flex-wrap gap-0">
                  {[0, 2, 4, 6, 8].map((size) => (
                    <div key={size} className={`m-${size} bg-card border border-primary p-2 text-xs`}>
                      m-{size}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Negative Margins</h3>
              <div className="bg-muted p-8 rounded-lg relative">
                <div className="-m-4 bg-destructive/20 border-2 border-destructive p-4 text-center text-sm">
                  -m-4 (negative margin pulls element outside)
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Auto Margins (Centering)</h3>
              <div className="bg-muted p-4 rounded-lg">
                <div className="mx-auto w-1/2 bg-card border border-success p-4 text-center text-sm">
                  mx-auto (centered horizontally)
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gap Examples */}
        <section>
          <h2 className="text-xl font-semibold mb-6 text-primary">Gap Utilities (Flexbox & Grid)</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Flex with gap-*</h3>
              {[2, 4, 6, 8].map((size) => (
                <div key={size} className="bg-muted p-4 rounded-lg">
                  <div className={`flex gap-${size}`}>
                    <div className="bg-primary text-primary-foreground p-3 rounded text-xs flex-1 text-center">
                      Item 1
                    </div>
                    <div className="bg-primary text-primary-foreground p-3 rounded text-xs flex-1 text-center">
                      Item 2
                    </div>
                    <div className="bg-primary text-primary-foreground p-3 rounded text-xs flex-1 text-center">
                      Item 3
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">gap-{size}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Grid with gap-*</h3>
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-secondary text-secondary-foreground p-4 rounded text-center text-sm">
                      {i}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-2">grid gap-4</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Gap-x (horizontal) & Gap-y (vertical)</h3>
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-3 gap-x-8 gap-y-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-accent text-accent-foreground p-3 rounded text-center text-sm">
                      {i}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-2">gap-x-8 gap-y-2</div>
              </div>
            </div>
          </div>
        </section>

        {/* Space Between Examples */}
        <section>
          <h2 className="text-xl font-semibold mb-6 text-primary">Space Between Utilities</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">space-y-* (vertical spacing)</h3>
              <div className="bg-muted p-4 rounded-lg">
                <div className="space-y-4">
                  <div className="bg-card border border-border p-3 rounded">Item 1</div>
                  <div className="bg-card border border-border p-3 rounded">Item 2</div>
                  <div className="bg-card border border-border p-3 rounded">Item 3</div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">space-y-4</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">space-x-* (horizontal spacing)</h3>
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex space-x-6">
                  <div className="bg-card border border-border p-3 rounded">A</div>
                  <div className="bg-card border border-border p-3 rounded">B</div>
                  <div className="bg-card border border-border p-3 rounded">C</div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">space-x-6</div>
              </div>
            </div>
          </div>
        </section>

        {/* Responsive Spacing */}
        <section>
          <h2 className="text-xl font-semibold mb-6 text-primary">Responsive Spacing</h2>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-2 md:p-4 lg:p-8 rounded-lg border border-border">
              <div className="bg-card p-4 rounded text-center">
                <div className="text-sm font-medium">Resize your browser to see spacing change</div>
                <div className="text-xs text-muted-foreground mt-2">
                  p-2 (mobile) → p-4 (tablet) → p-8 (desktop)
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 lg:gap-8">
              <div className="bg-card border border-border p-4 rounded text-center text-sm">Column 1</div>
              <div className="bg-card border border-border p-4 rounded text-center text-sm">Column 2</div>
              <div className="bg-card border border-border p-4 rounded text-center text-sm">Column 3</div>
            </div>
            <div className="text-xs text-muted-foreground">
              gap-2 (mobile) → gap-4 (tablet) → gap-8 (desktop)
            </div>
          </div>
        </section>

        {/* Debug Info */}
        <section className="bg-muted p-6 rounded-lg border-2 border-dashed border-border">
          <h2 className="text-lg font-semibold mb-4">Debugging Info</h2>
          <div className="space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">--spacing variable:</span>
              <span className="text-foreground">0.25rem (4px)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">p-4 result:</span>
              <span className="text-foreground">4 × 0.25rem = 1rem (16px)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">p-8 result:</span>
              <span className="text-foreground">8 × 0.25rem = 2rem (32px)</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
            💡 Tip: Right-click any element and "Inspect" to see computed spacing values in DevTools
          </div>
        </section>
      </div>
    </ThemeWrapper>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<SpacingDemo />);
}
