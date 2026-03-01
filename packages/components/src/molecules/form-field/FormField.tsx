import * as React from 'react';
import { Label } from '../../primitives/label';
import { cn } from '../../lib/utils';

export interface FormFieldProps {
  /** Label text */
  label?: string;
  /** Helper text shown below the input */
  helperText?: string;
  /** Error message — replaces helperText and applies error styling */
  error?: string;
  /** Links the label to the input via htmlFor */
  htmlFor?: string;
  /** Appends a required indicator (*) to the label */
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, helperText, error, htmlFor, required, children, className }, ref) => {
    // Auto-generate an ID for aria-describedby wiring when htmlFor is provided
    const helperId = htmlFor ? `${htmlFor}-helper` : undefined;
    const hasError = Boolean(error);

    return (
      <div ref={ref} className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <Label htmlFor={htmlFor} className="text-xs font-medium text-on-surface-variant">
            {label}
            {required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}
          </Label>
        )}

        {/* Clone child to inject aria-describedby + aria-invalid */}
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<React.HTMLAttributes<HTMLElement>>, {
              'aria-describedby': helperId,
              'aria-invalid': hasError ? true : undefined,
              id: htmlFor,
            } as React.HTMLAttributes<HTMLElement>)
          : children}

        {(error || helperText) && (
          <p
            id={helperId}
            className={cn(
              'text-xs',
              hasError ? 'text-destructive' : 'text-on-surface-variant'
            )}
          >
            {error ?? helperText}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = 'FormField';

export { FormField };
