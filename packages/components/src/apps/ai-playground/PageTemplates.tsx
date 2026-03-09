/**
 * PageTemplates — Visual page type selector
 *
 * Displays cards for each page type template with icons and descriptions.
 * Clicking a card selects it and pre-fills the prompt.
 */
import * as React from 'react';
import {
  LayoutDashboard, Globe, FileInput, ClipboardList, Settings,
} from 'lucide-react';
import { PAGE_TEMPLATES } from './templates';
import type { PageType } from './types';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Globe,
  FileInput,
  ClipboardList,
  Settings,
};

interface PageTemplatesProps {
  selected: PageType | null;
  onSelect: (id: PageType) => void;
  /** Layout orientation */
  layout?: 'horizontal' | 'vertical';
}

export function PageTemplates({ selected, onSelect, layout = 'horizontal' }: PageTemplatesProps) {
  return (
    <div className={cn(
      'flex gap-3',
      layout === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col',
    )}>
      {PAGE_TEMPLATES.map(template => {
        const Icon = ICON_MAP[template.icon] || Settings;
        const isSelected = selected === template.id;

        return (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 text-left transition-all',
              layout === 'horizontal' ? 'flex-1 min-w-[180px]' : 'w-full',
              isSelected
                ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30',
            )}
          >
            <div className={cn(
              'rounded-md p-2 shrink-0',
              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className={cn(
                'font-medium text-sm',
                isSelected ? 'text-primary' : 'text-foreground',
              )}>
                {template.name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {template.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
