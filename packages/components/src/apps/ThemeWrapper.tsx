/**
 * Reusable theme wrapper component
 * Provides dark mode support and theme persistence
 * Use this to wrap all standalone app components
 */
import * as React from 'react';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ThemeToggle } from './ThemeToggle';

interface ThemeWrapperProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  showToggle?: boolean;
}

export function ThemeWrapper({
  children,
  title,
  description,
  showToggle = true
}: ThemeWrapperProps) {
  return (
    <ThemeProvider persistTheme>
      <div className="min-h-screen bg-background text-foreground">
        {(title || showToggle) && (
          <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div>
                {title && <h1 className="text-2xl font-bold">{title}</h1>}
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              {showToggle && <ThemeToggle />}
            </div>
          </header>
        )}
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
