/**
 * Select — Covalent outlined select field.
 *
 * Matches Figma cv-select (node 8066:25314).
 * Outlined border with 4 density levels, Elevation 2 dropdown,
 * and Body1-sized list items.
 */

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';
import { useDensity } from '../../hooks/use-density';
import type { DensityMode } from '../../theme/ThemeProvider';

// ── Density Variants ──────────────────────────────────────────────────────

const selectTriggerVariants = cva(
  [
    // Layout
    'flex w-full items-center justify-between',
    // Outlined field: 1px border, 4px radius (border-input matches Input)
    'rounded border border-input bg-background',
    // Padding: 12px horizontal (Figma px-12)
    'px-3',
    // Text
    'text-foreground',
    // Ring offset for focus
    'ring-offset-background',
    // Placeholder
    'placeholder:text-on-surface-variant',
    // Focus: 2px primary ring (avoids layout shift vs border-2)
    'focus:outline-none focus:ring-2 focus:ring-primary',
    // Hover: slightly stronger border
    'hover:border-foreground/50',
    // Disabled
    'disabled:cursor-not-allowed disabled:opacity-50',
    // Text overflow
    '[&>span]:line-clamp-1',
    // Transition
    'transition-colors',
  ].join(' '),
  {
    variants: {
      density: {
        compact: 'h-8 text-sm',          // 32px
        comfortable: 'h-10 text-sm',     // 40px
        spacious: 'h-12 text-base',      // 48px
      },
    },
    defaultVariants: {
      density: 'compact',
    },
  },
);

// ── Internal density context (propagates to trigger + items) ──────────────

const SelectDensityCtx = React.createContext<DensityMode | undefined>(undefined);

// ── Root ───────────────────────────────────────────────────────────────────

interface SelectProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  /** Height density level applied to trigger and dropdown items.
   *  Falls back to ThemeProvider context, then 'compact'. */
  density?: DensityMode;
}

function Select({ density: densityProp, children, ...props }: SelectProps) {
  const density = useDensity(densityProp);
  return (
    <SelectDensityCtx.Provider value={density}>
      <SelectPrimitive.Root {...props}>
        {children}
      </SelectPrimitive.Root>
    </SelectDensityCtx.Provider>
  );
}

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

// ── Trigger ───────────────────────────────────────────────────────────────

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof selectTriggerVariants> {
  /** @deprecated Pass density to Select instead. Kept for backwards compat. */
  density?: DensityMode;
}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, density: densityProp, ...props }, ref) => {
  const selectDensity = React.useContext(SelectDensityCtx);
  const density = densityProp ?? selectDensity ?? 'compact';
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(selectTriggerVariants({ density }), className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-6 w-6 shrink-0 text-on-surface-variant" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

// ── Scroll Buttons ────────────────────────────────────────────────────────

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className,
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className,
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

// ── Content (Dropdown) ────────────────────────────────────────────────────

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        // Base
        'relative z-10000 max-h-96 min-w-32 overflow-hidden',
        // Figma cv-menu: 12px border-radius, surface background
        'rounded-xl bg-surface text-foreground',
        // Figma Elevation 2 shadow (no border)
        'shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_2px_6px_rgba(0,0,0,0.15)]',
        // Animations
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2',
        'data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2',
        'data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          // Figma cv-menu: 8px vertical padding
          'py-2',
          position === 'popper' &&
            'h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

// ── Label ─────────────────────────────────────────────────────────────────

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

// ── Item ──────────────────────────────────────────────────────────────────

const selectItemVariants = cva(
  [
    'relative flex w-full cursor-default select-none items-center',
    'outline-none focus:bg-on-surface/8 hover:bg-on-surface/8 active:bg-on-surface/12',
    'data-disabled:pointer-events-none data-disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      density: {
        compact: 'min-h-8 px-3 pl-8 text-sm',       // 32px
        comfortable: 'min-h-10 px-3 pl-8 text-sm',   // 40px
        spacious: 'min-h-14 px-4 pl-10 text-base',   // 56px
      },
    },
    defaultVariants: {
      density: 'compact',
    },
  },
);

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => {
  const selectDensity = React.useContext(SelectDensityCtx);
  const globalDensity = useDensity();
  const density = selectDensity ?? globalDensity;
  const isCompact = density === 'compact' || density === 'comfortable';
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(selectItemVariants({ density }), className)}
      {...props}
    >
      <span className={cn(
        'absolute flex items-center justify-center',
        isCompact ? 'left-2 h-4 w-4' : 'left-4 h-5 w-5',
      )}>
        <SelectPrimitive.ItemIndicator>
          <Check className={cn('text-primary', isCompact ? 'h-4 w-4' : 'h-5 w-5')} />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

// ── Separator ─────────────────────────────────────────────────────────────

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

// ── Exports ───────────────────────────────────────────────────────────────

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
